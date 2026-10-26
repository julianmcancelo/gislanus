import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { geocodeIntersection, geocodeSegment, cleanStreetName, isInsideLanus } from '@/utils/lanusGeocoder';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface ParsedItem {
  empresa: string;
  zona: string;
  tipoMaterial: string; // Hormigón, Carpeta asfáltica, Cordón cuneta, etc.
  tipoForma: 'cruce' | 'tramo';
  callePrincipal: string;
  calleSecundaria?: string;
  entreCalle1?: string;
  entreCalle2?: string;
  descripcionOriginal: string;
  observaciones: string;
}

// Colores institucionales por contratista
const EMPRESA_COLORS: Record<string, string> = {
  'LÁZARO': '#ea580c', // Naranja intenso
  'LAZARO': '#ea580c',
  'KAVOS': '#2563eb', // Azul
  'USIMIX': '#16a34a', // Verde
};

/**
 * Parser con OpenAI GPT-4o-mini:
 * Extrae y normaliza el reporte semanal de obras desglosando exactamente
 * las empresas, zonas, tipos de trabajo y las calles oficiales de Lanús.
 */
async function parsePlanWithOpenAI(texto: string): Promise<{ tituloPlan: string; items: ParsedItem[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = `Actúa como el Ingeniero Jefe de Vialidad y Catastro del Municipio de Lanús, Buenos Aires.
Analiza el siguiente texto que contiene un parte oficial o plan de pavimentación, bacheo y obras viales en Lanús:

"""${texto}"""

Tu objetivo es estructurar cada una de las intervenciones dentro del Partido de Lanús en formato JSON.
Para cada punto u obra identifica:
1. "empresa": Contratista asignada (ej: "LÁZARO", "KAVOS", "USIMIX", o "MUNICIPAL").
2. "zona": Localidad o sector de Lanús (ej: "Zona Este", "Zona Oeste", "Villa Esperanza", "Gerli Este", etc.).
3. "tipoMaterial": Tipo de intervención (ej: "Hormigón", "Carpeta asfáltica", "Cordón cuneta", "Bacheo").
4. "tipoForma": 
   - "tramo" si dice "entre [calle 1] y [calle 2]"
   - "cruce" si es una esquina o intersección "calle 1 y calle 2"
5. "callePrincipal": Nombre limpio y normalizado de la calle principal en Lanús.
6. "calleSecundaria": Si es cruce, la calle con la que corta.
7. "entreCalle1" y "entreCalle2": Si es tramo, las dos calles límite.
8. "observaciones": Notas técnicas, estado o tareas pendientes (ej: "Resta aserrar", "Media calzada", etc.).
9. "descripcionOriginal": El texto original de la línea.

Devuelve ÚNICAMENTE un JSON con este formato:
{
  "tituloPlan": "Plan de Pavimentación...",
  "items": [
    {
      "empresa": "LÁZARO",
      "zona": "Zona Este",
      "tipoMaterial": "Hormigón",
      "tipoForma": "cruce",
      "callePrincipal": "Tucumán",
      "calleSecundaria": "Gervasio Antonio de Posadas",
      "observaciones": "Resta aserrar y tirar hormigón en el centro de bocacalle.",
      "descripcionOriginal": "Tucumán y Posadas - Bacheo de hormigón..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde siempre en formato JSON.' },
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
    console.error('Error parseando plan con OpenAI:', err);
  }
  return null;
}

// Fallback heurístico mediante expresiones regulares
function parseReporteRegex(texto: string): { tituloPlan: string; items: ParsedItem[] } {
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let tituloPlan = 'Plan de Pavimentación Lanús';
  let empresaActual = 'MUNICIPAL';
  let zonaActual = 'Lanús';
  let tipoMaterialActual = 'Hormigón';
  const items: ParsedItem[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];

    if (/PLAN DE PAVIMENTACI[OÓ]N/i.test(l) || /Semana del/i.test(l)) {
      if (/Semana del/i.test(l)) {
        tituloPlan = l.replace(/- EMPRESAS/i, '').trim();
      }
      continue;
    }

    if (/^(LÁZARO|LAZARO|KAVOS|USIMIX)/i.test(l)) {
      empresaActual = l.toUpperCase().split(/[-:]/)[0].trim();
      continue;
    }

    const zonaMatch = l.match(/^([^:-]+)(?:[-:]\s*(.+))?:?$/i);
    if (zonaMatch && !/^\d+\./.test(l) && (l.includes('-') || l.endsWith(':'))) {
      const p1 = (zonaMatch[1] || '').trim();
      const p2 = (zonaMatch[2] || '').trim();
      if (p1 && (p1.includes('Zona') || p1.includes('Villa') || p1.includes('Gerli') || p1.includes('Lanús') || p1.includes('Alsina'))) {
        zonaActual = p1;
        if (p2) tipoMaterialActual = p2.replace(/:$/, '').trim();
        continue;
      }
      if (/hormig[oó]n|asf[aá]ltica|cord[oó]n/i.test(p1)) {
        tipoMaterialActual = p1.replace(/:$/, '').trim();
        continue;
      }
    }

    const itemMatch = l.match(/^(\d+)[\.\)]\s*(.+)$/);
    if (itemMatch) {
      const cuerpo = itemMatch[2].trim();
      let partes = cuerpo.split(/\s*[-–—]\s*/);
      let dirText = partes[0].trim();
      let obsText = partes.slice(1).join(' - ').trim();

      const entreMatch = dirText.match(/^(.+?)\s+entre\s+(.+?)\s+y\s+(.+)$/i);
      if (entreMatch) {
        items.push({
          empresa: empresaActual,
          zona: zonaActual,
          tipoMaterial: tipoMaterialActual,
          tipoForma: 'tramo',
          callePrincipal: entreMatch[1].trim(),
          entreCalle1: entreMatch[2].trim(),
          entreCalle2: entreMatch[3].trim(),
          descripcionOriginal: cuerpo,
          observaciones: obsText,
        });
        continue;
      }

      const cruceMatch = dirText.match(/^(.+?)\s+y\s+(.+)$/i);
      if (cruceMatch) {
        items.push({
          empresa: empresaActual,
          zona: zonaActual,
          tipoMaterial: tipoMaterialActual,
          tipoForma: 'cruce',
          callePrincipal: cruceMatch[1].trim(),
          calleSecundaria: cruceMatch[2].trim(),
          descripcionOriginal: cuerpo,
          observaciones: obsText,
        });
        continue;
      }

      items.push({
        empresa: empresaActual,
        zona: zonaActual,
        tipoMaterial: tipoMaterialActual,
        tipoForma: 'cruce',
        callePrincipal: dirText,
        descripcionOriginal: cuerpo,
        observaciones: obsText,
      });
    }
  }

  return { tituloPlan, items };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const texto = body.texto || '';

    if (!texto.trim()) {
      return NextResponse.json({ error: 'No se proveyó ningún texto para analizar' }, { status: 400 });
    }

    // 1. Intentamos el análisis contextual profundo con OpenAI ChatGPT
    let parsedData = await parsePlanWithOpenAI(texto);

    // 2. Si OpenAI no está disponible o falla, usamos el parser heurístico local
    if (!parsedData || parsedData.items.length === 0) {
      parsedData = parseReporteRegex(texto);
    }

    const { tituloPlan, items } = parsedData;

    // Geocodificar en serie para no sobrecargar los servicios de catastro
    const features: any[] = [];
    const fallidos: any[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const color = EMPRESA_COLORS[item.empresa] || '#2563eb';

      if (item.tipoForma === 'tramo' && item.callePrincipal && item.entreCalle1 && item.entreCalle2) {
        const seg = await geocodeSegment(item.callePrincipal, item.entreCalle1, item.entreCalle2);

        if (seg.startCoords && seg.endCoords) {
          const midLat = (seg.startCoords.lat + seg.endCoords.lat) / 2;
          const midLng = (seg.startCoords.lng + seg.endCoords.lng) / 2;

          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [midLng, midLat],
            },
            properties: {
              id: `obra_${idx + 1}`,
              nombre: `${item.callePrincipal} e/ ${item.entreCalle1} y ${item.entreCalle2}`,
              empresa: item.empresa,
              zona: item.zona,
              tipoMaterial: item.tipoMaterial,
              tipoForma: 'cruce',
              color,
              observaciones: item.observaciones,
              descripcionOriginal: item.descripcionOriginal,
              estado: 'PLANIFICADO',
              geocodificado: true,
            },
          });
        } else if (seg.startCoords) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [seg.startCoords.lng, seg.startCoords.lat],
            },
            properties: {
              id: `obra_${idx + 1}`,
              nombre: `${item.callePrincipal} e/ ${item.entreCalle1} y ${item.entreCalle2}`,
              empresa: item.empresa,
              zona: item.zona,
              tipoMaterial: item.tipoMaterial,
              tipoForma: 'cruce',
              color,
              observaciones: item.observaciones,
              descripcionOriginal: item.descripcionOriginal,
              estado: 'PLANIFICADO',
              geocodificado: true,
            },
          });
        } else {
          fallidos.push(item);
        }
      } else if (item.callePrincipal && item.calleSecundaria) {
        const coords = await geocodeIntersection(item.callePrincipal, item.calleSecundaria);

        if (coords) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [coords.lng, coords.lat],
            },
            properties: {
              id: `obra_${idx + 1}`,
              nombre: `${item.callePrincipal} y ${item.calleSecundaria}`,
              empresa: item.empresa,
              zona: item.zona,
              tipoMaterial: item.tipoMaterial,
              tipoForma: 'cruce',
              color,
              observaciones: item.observaciones,
              descripcionOriginal: item.descripcionOriginal,
              estado: 'PLANIFICADO',
              geocodificado: true,
            },
          });
        } else {
          fallidos.push(item);
        }
      } else {
        fallidos.push(item);
      }

      await new Promise(r => setTimeout(r, 60));
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

    return NextResponse.json({
      success: true,
      tituloPlan,
      geojson: featureCollection,
      itemsTotal: items.length,
      itemsGeocodificados: features.length,
      fallidos,
    });
  } catch (error: any) {
    console.error('Error parseando plan de obras:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el plan' }, { status: 500 });
  }
}
