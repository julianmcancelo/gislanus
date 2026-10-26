import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { geocodeIntersection, geocodeSegment, cleanStreetName, isInsideLanus, LANUS_BBOX } from '@/utils/lanusGeocoder';

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
  lat?: number;
  lng?: number;
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
 * Extrae, normaliza y GEOLOCALIZA directamente en una única llamada ultra rápida de OpenAI
 * asignando latitud y longitud a cada punto dentro del Partido de Lanús.
 */
async function parsePlanWithOpenAI(texto: string): Promise<{ tituloPlan: string; items: ParsedItem[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey });
    const prompt = `Actúa como el Ingeniero Jefe de Catastro y Vialidad del Municipio de Lanús, Provincia de Buenos Aires, Argentina.
Analiza el siguiente texto oficial con partes de pavimentación, bacheo y obras viales en Lanús:

"""${texto}"""

Tu objetivo es estructurar cada intervención en formato JSON y PROPORCIONAR LAS COORDENADAS ("lat" y "lng") EXACTAS de cada cruce o tramo en el Partido de Lanús.

Reglas ESTRICTAS:
1. "lat" DEBE estar entre ${LANUS_BBOX.minLat} y ${LANUS_BBOX.maxLat} (ej: -34.7045)
2. "lng" DEBE estar entre ${LANUS_BBOX.minLng} y ${LANUS_BBOX.maxLng} (ej: -58.4120)
3. "empresa": Contratista (ej: "LÁZARO", "KAVOS", "USIMIX", o "MUNICIPAL").
4. "zona": Localidad o sector de Lanús (ej: "Zona Este", "Zona Oeste", "Villa Porá", "Gerli", etc.).
5. "tipoMaterial": Ej: "Hormigón", "Carpeta asfáltica", "Cordón cuneta", "Bacheo".
6. "tipoForma": "cruce" si es intersección o "tramo" si es entre calles.
7. "callePrincipal": Nombre oficial limpio de la calle en Lanús.
8. "calleSecundaria": Si es cruce, la calle con la que corta.
9. "entreCalle1" y "entreCalle2": Si es tramo, las calles límite.
10. "lat" y "lng": Coordenadas geográficas obligatorias en Lanús (punto medio si es tramo).
11. "observaciones": Notas técnicas o estado pendiente.
12. "descripcionOriginal": Texto original de la línea.

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
      "lat": -34.7180,
      "lng": -58.3850,
      "observaciones": "Resta aserrar y tirar hormigón.",
      "descripcionOriginal": "Tucumán y Posadas - Bacheo..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Responde siempre en formato JSON válido y conciso.' },
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

    if (/L[AÁ]ZARO/i.test(l)) {
      empresaActual = 'LÁZARO';
      continue;
    }
    if (/KAVOS/i.test(l)) {
      empresaActual = 'KAVOS';
      continue;
    }
    if (/USIMIX/i.test(l)) {
      empresaActual = 'USIMIX';
      continue;
    }

    if (/^(ZONA|LOCALIDAD|BARRIO)\s*[:\-]/i.test(l) || /Zona\s+(Este|Oeste|Centro|Norte|Sur)/i.test(l)) {
      zonaActual = l.replace(/^[^:]+:\s*/, '').trim();
      continue;
    }

    if (/(Hormig[oó]n|Carpeta|Cuneta|Asfalto|Fresado)/i.test(l) && l.length < 50 && !l.includes(' y ') && !l.includes(' e/ ')) {
      tipoMaterialActual = l;
      continue;
    }

    if (!l.includes(' y ') && !l.includes(' e/ ') && !l.includes(' entre ')) {
      continue;
    }

    let tipoForma: 'cruce' | 'tramo' = 'cruce';
    let callePrincipal = '';
    let calleSecundaria = '';
    let entreCalle1 = '';
    let entreCalle2 = '';
    let observaciones = '';

    const partesObs = l.split(/\s*[-–—]\s*/);
    const calleStr = partesObs[0].replace(/^[\d\.\-\*\•\s]+/, '').trim();
    if (partesObs.length > 1) {
      observaciones = partesObs.slice(1).join(' - ').trim();
    }

    const tramoMatch = calleStr.match(/(.+?)\s+(?:e\/|entre)\s+(.+?)\s+y\s+(.+)/i);
    if (tramoMatch) {
      tipoForma = 'tramo';
      callePrincipal = cleanStreetName(tramoMatch[1]);
      entreCalle1 = cleanStreetName(tramoMatch[2]);
      entreCalle2 = cleanStreetName(tramoMatch[3]);
    } else {
      const cruceMatch = calleStr.match(/(.+?)\s+y\s+(.+)/i);
      if (cruceMatch) {
        tipoForma = 'cruce';
        callePrincipal = cleanStreetName(cruceMatch[1]);
        calleSecundaria = cleanStreetName(cruceMatch[2]);
      } else {
        continue;
      }
    }

    items.push({
      empresa: empresaActual,
      zona: zonaActual,
      tipoMaterial: tipoMaterialActual,
      tipoForma,
      callePrincipal,
      calleSecundaria: calleSecundaria || undefined,
      entreCalle1: entreCalle1 || undefined,
      entreCalle2: entreCalle2 || undefined,
      descripcionOriginal: l,
      observaciones: observaciones || 'Sin observaciones técnicas',
    });
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

    // 1. Intentamos análisis y georreferenciación simultánea con OpenAI ChatGPT
    let parsedData = await parsePlanWithOpenAI(texto);

    // 2. Si OpenAI falló, usamos el fallback regex
    if (!parsedData || parsedData.items.length === 0) {
      parsedData = parseReporteRegex(texto);
    }

    const { tituloPlan, items } = parsedData;

    const features: any[] = [];
    const fallidos: any[] = [];

    // Procesamos cada ítem
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const color = EMPRESA_COLORS[item.empresa] || '#2563eb';
      const nombrePunto = item.tipoForma === 'tramo' && item.entreCalle1 && item.entreCalle2
        ? `${item.callePrincipal} e/ ${item.entreCalle1} y ${item.entreCalle2}`
        : `${item.callePrincipal} y ${item.calleSecundaria || ''}`;

      // Caso A: Ya vino geolocalizado por OpenAI directamente
      if (typeof item.lat === 'number' && typeof item.lng === 'number' && isInsideLanus(item.lat, item.lng)) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat],
          },
          properties: {
            id: `obra_${idx + 1}`,
            nombre: nombrePunto,
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
        continue;
      }

      // Caso B: Si no vino lat/lng de OpenAI, geocodificamos con cascada rápida
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
              nombre: nombrePunto,
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
              nombre: nombrePunto,
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
              nombre: nombrePunto,
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
