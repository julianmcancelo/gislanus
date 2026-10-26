import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { geocodeIntersection, geocodeSegment, geocodeStreetWithNumber, cleanStreetName, isInsideLanus } from '@/utils/lanusGeocoder';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface ParsedItem {
  empresa: string;
  zona: string;
  tipoMaterial: string;
  tipoForma: 'cruce' | 'tramo' | 'altura';
  callePrincipal: string;
  calleSecundaria?: string;
  entreCalle1?: string;
  entreCalle2?: string;
  altura?: string;
  descripcionOriginal: string;
  observaciones: string;
}

const EMPRESA_COLORS: Record<string, string> = {
  'LÁZARO': '#ea580c',
  'LAZARO': '#ea580c',
  'KAVOS': '#2563eb',
  'USIMIX': '#16a34a',
  'MUNICIPAL': '#7c3aed',
};

/**
 * Parser con OpenAI GPT-4o-mini:
 * Extrae y estructura las calles y contratistas con total fidelidad.
 */
async function parsePlanWithOpenAI(texto: string): Promise<{ tituloPlan: string; items: ParsedItem[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = `Actúa como el Jefe de Catastro y Obras Viales del Municipio de Lanús.
Analiza este reporte oficial de pavimentación y bacheo en Lanús:

"""${texto}"""

Estructura cada intervención en formato JSON.
Reglas:
1. "empresa": Contratista asignada (ej: "LÁZARO", "KAVOS", "USIMIX", o "MUNICIPAL").
2. "zona": Localidad o sector de Lanús (ej: "Zona Este", "Zona Oeste", "Villa Esperanza", "Gerli Este", etc.).
3. "tipoMaterial": Ej: "Hormigón", "Carpeta asfáltica", "Cordón cuneta", "Bacheo".
4. "tipoForma":
   - "tramo" si dice "entre [calle1] y [calle2]" o "e/ [calle1] y [calle2]".
   - "altura" si es una calle con número exacto (ej: "Bueras 1818").
   - "cruce" si es intersección "calle1 y calle2".
5. "callePrincipal": Nombre de la calle principal.
6. "calleSecundaria": Si es cruce, la calle con la que corta.
7. "entreCalle1" y "entreCalle2": Si es tramo, las dos calles límite.
8. "altura": Si es altura, el número de puerta (ej: "1818").
9. "observaciones": Tareas pendientes o estado (ej: "En ejecución - Falta H30", "Media calzada", etc.).
10. "descripcionOriginal": Texto de la línea.

Devuelve ÚNICAMENTE un JSON con:
{
  "tituloPlan": "Plan de Pavimentación...",
  "items": [...]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde siempre en formato JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      return {
        tituloPlan: parsed.tituloPlan || 'Plan de Pavimentación Lanús',
        items: parsed.items,
      };
    }
  } catch (err) {
    console.error('Error parseando con OpenAI:', err);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const texto = body.texto || '';
    const registrarComoCortes = body.registrarComoCortes !== false; // Por defecto crear también en intervenciones viales

    if (!texto.trim()) {
      return NextResponse.json({ error: 'No se proveyó ningún texto para analizar' }, { status: 400 });
    }

    const parsedData = await parsePlanWithOpenAI(texto);
    if (!parsedData || parsedData.items.length === 0) {
      return NextResponse.json({ error: 'No se pudieron extraer intervenciones del texto provisto' }, { status: 422 });
    }

    const { tituloPlan, items } = parsedData;
    const features: any[] = [];
    const fallidos: any[] = [];

    // Geocodificación paralela con Georef IGN para cada punto
    const geocodePromises = items.map(async (item, idx) => {
      let coords: { lat: number; lng: number } | null = null;
      let nombrePunto = '';

      if (item.tipoForma === 'tramo' && item.callePrincipal && item.entreCalle1 && item.entreCalle2) {
        nombrePunto = `${item.callePrincipal} e/ ${item.entreCalle1} y ${item.entreCalle2}`;
        const seg = await geocodeSegment(item.callePrincipal, item.entreCalle1, item.entreCalle2);
        if (seg.startCoords && seg.endCoords) {
          coords = {
            lat: (seg.startCoords.lat + seg.endCoords.lat) / 2,
            lng: (seg.startCoords.lng + seg.endCoords.lng) / 2,
          };
        } else if (seg.startCoords) {
          coords = seg.startCoords;
        }
      } else if (item.tipoForma === 'altura' && item.callePrincipal && item.altura) {
        nombrePunto = `${item.callePrincipal} ${item.altura}`;
        coords = await geocodeStreetWithNumber(`${item.callePrincipal} ${item.altura}`);
      } else if (item.callePrincipal && item.calleSecundaria) {
        nombrePunto = `${item.callePrincipal} y ${item.calleSecundaria}`;
        coords = await geocodeIntersection(item.callePrincipal, item.calleSecundaria);
      } else if (item.descripcionOriginal) {
        // Fallback: si tiene número en la descripción
        const matchNum = item.descripcionOriginal.match(/([a-zA-Z\s]+)\s+(\d{3,5})/);
        if (matchNum) {
          nombrePunto = matchNum[0].trim();
          coords = await geocodeStreetWithNumber(nombrePunto);
        }
      }

      if (coords && isInsideLanus(coords.lat, coords.lng)) {
        const color = EMPRESA_COLORS[item.empresa] || '#2563eb';
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [coords.lng, coords.lat],
          },
          properties: {
            id: `obra_${idx + 1}`,
            nombre: nombrePunto || item.descripcionOriginal,
            empresa: item.empresa,
            zona: item.zona,
            tipoMaterial: item.tipoMaterial,
            tipoForma: item.tipoForma,
            color,
            observaciones: item.observaciones,
            descripcionOriginal: item.descripcionOriginal,
            estado: 'PLANIFICADO',
            geocodificado: true,
          },
        };
      } else {
        return { fallido: item };
      }
    });

    const results = await Promise.all(geocodePromises);

    for (const r of results) {
      if ('fallido' in r) {
        fallidos.push(r.fallido);
      } else {
        features.push(r);
      }
    }

    const featureCollection = {
      type: 'FeatureCollection',
      properties: {
        titulo: tituloPlan,
        totalItems: items.length,
        geocodificados: features.length,
        fallidos: fallidos.length,
      },
      features,
    };

    // Si se solicitó registrar como cortes y desvíos activos en el Planificador:
    if (registrarComoCortes && features.length > 0) {
      const year = new Date().getFullYear();
      const currentCount = await prisma.intervencionVial.count();

      for (let i = 0; i < features.length; i++) {
        const feat = features[i];
        const props = feat.properties;
        const codigo = `CORTE-${year}-${String(currentCount + i + 1).padStart(4, '0')}`;
        
        try {
          await prisma.intervencionVial.create({
            data: {
              codigo,
              titulo: `${props.empresa}: ${props.nombre}`,
              tipo: 'BACHEO',
              tipoCorte: 'TOTAL',
              motivo: props.observaciones || props.tipoMaterial,
              areaResponsable: `Obras Públicas - ${props.empresa}`,
              callesAfectadas: props.nombre,
              fechaInicio: new Date(),
              estado: 'PLANIFICADO',
              datosGeo: JSON.stringify(feat.geometry),
            },
          });
        } catch (dbErr) {
          console.error('Error insertando intervencion en DB:', dbErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      tituloPlan,
      geojson: featureCollection,
      itemsTotal: items.length,
      itemsGeocodificados: features.length,
      fallidos,
      registradosEnDesvios: registrarComoCortes ? features.length : 0,
    });
  } catch (error: any) {
    console.error('Error parseando plan de obras:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el plan' }, { status: 500 });
  }
}
