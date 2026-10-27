import * as turf from '@turf/turf';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { geocodeIntersection, geocodeSegment, geocodeStreetWithNumber, isInsideLanus } from '@/utils/lanusGeocoder';
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
 * Parser Instantáneo Heurístico:
 * Analiza el reporte en milisegundos sin depender de la latencia de red de LLMs,
 * garantizando cero timeouts (504).
 */
function parseReporteInstantaneo(texto: string): { tituloPlan: string; items: ParsedItem[] } {
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

    // Encabezados de zona o material (ej: "Zona Oeste - Hormigón:" o "Villa Esperanza - Cordón cuneta:")
    if (/(Zona\s+(?:Este|Oeste|Centro|Norte|Sur)|Villa\s+\w+|Gerli[\w\s]*|Hormig[oó]n|Cord[oó]n\s+cuneta|Carpeta\s+asf[aá]ltica)/i.test(l) && (l.endsWith(':') || l.length < 45) && !l.includes(' e/ ') && !l.includes(' y ')) {
      const parts = l.replace(/:$/, '').split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        zonaActual = parts[0].trim();
        tipoMaterialActual = parts[1].trim();
      } else if (parts.length === 1) {
        if (/Hormig|Cord|Carpeta|Asfalto/i.test(parts[0])) {
          tipoMaterialActual = parts[0].trim();
        } else {
          zonaActual = parts[0].trim();
        }
      }
      continue;
    }

    // Si la línea contiene una dirección
    if (!l.includes(' y ') && !l.includes(' e/ ') && !l.includes(' entre ') && !/\d{3,5}/.test(l)) {
      continue;
    }

    let tipoForma: 'cruce' | 'tramo' | 'altura' = 'cruce';
    let callePrincipal = '';
    let calleSecundaria = '';
    let entreCalle1 = '';
    let entreCalle2 = '';
    let altura = '';
    let observaciones = '';

    const partes = l.split(/\s*[-–—]\s*/);
    let calleRaw = partes[0].replace(/^[\d\.\-\*\•\s]+/, '').trim();
    if (partes.length > 1) {
      observaciones = partes.slice(1).join(' - ').trim();
    }

    // Caso A: tramo entre esquinas
    const tramoMatch = calleRaw.match(/(.+?)\s+(?:e\/|entre)\s+(.+?)\s+y\s+(.+)/i);
    if (tramoMatch) {
      tipoForma = 'tramo';
      callePrincipal = tramoMatch[1].trim();
      entreCalle1 = tramoMatch[2].trim();
      entreCalle2 = tramoMatch[3].trim();
    } else {
      // Caso B: cruce de esquinas
      const cruceMatch = calleRaw.match(/(.+?)\s+y\s+(.+)/i);
      if (cruceMatch) {
        tipoForma = 'cruce';
        callePrincipal = cruceMatch[1].trim();
        calleSecundaria = cruceMatch[2].trim();
      } else {
        // Caso C: altura exacta
        const alturaMatch = calleRaw.match(/(.+?)\s+(\d{3,5})/);
        if (alturaMatch) {
          tipoForma = 'altura';
          callePrincipal = alturaMatch[1].trim();
          altura = alturaMatch[2].trim();
        } else {
          continue;
        }
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
      altura: altura || undefined,
      descripcionOriginal: l,
      observaciones: observaciones || 'Sin observaciones técnicas',
    });
  }

  return { tituloPlan, items };
}

/**
 * Parser de respaldo con OpenAI (con timeout de 6 segundos)
 */
async function parsePlanWithOpenAIFallback(texto: string): Promise<{ tituloPlan: string; items: ParsedItem[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const openai = new OpenAI({ apiKey, timeout: 6000 });
    const prompt = `Extrae en JSON { tituloPlan: string, items: Array<{ empresa: string, zona: string, tipoMaterial: string, tipoForma: string, callePrincipal: string, calleSecundaria?: string, entreCalle1?: string, entreCalle2?: string, altura?: string, observaciones: string, descripcionOriginal: string }> }: ${texto}`;

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
    // Si da timeout o error, se usa el parser instantáneo
  }
  return null;
}


// Función de análisis de proximidad y cruce de colectivos para un punto de obra
function detectarLineasQueCruzan(
  coords: { lat: number; lng: number },
  lineasCache: any[],
  radioMetros = 45
) {
  const pt = turf.point([coords.lng, coords.lat]);
  const encontradasMap = new Map<string, any>();

  for (const linea of lineasCache) {
    if (!linea.parsedGeo) continue;
    let minDist = Infinity;

    for (const feat of linea.parsedGeo) {
      if (!feat.geometry) continue;
      if (feat.geometry.type === 'LineString') {
        const nearest = turf.nearestPointOnLine(feat, pt, { units: 'meters' });
        const d = nearest?.properties?.dist ?? Infinity;
        if (d < minDist) minDist = d;
      } else if (feat.geometry.type === 'MultiLineString') {
        for (const c of feat.geometry.coordinates) {
          const ls = turf.lineString(c);
          const nearest = turf.nearestPointOnLine(ls, pt, { units: 'meters' });
          const d = nearest?.properties?.dist ?? Infinity;
          if (d < minDist) minDist = d;
        }
      }
    }

    if (minDist <= radioMetros) {
      const num = (linea.numero || linea.nombre.replace(/\D/g, '') || linea.nombre).trim();
      const ramal = linea.subcategoria || (linea.nombre.includes('Ramal') ? linea.nombre : null);
      const key = `${num}_${ramal || ''}`;
      if (!encontradasMap.has(key)) {
        encontradasMap.set(key, {
          lineaId: linea.id,
          lineaNumero: num,
          ramal,
          sentido: linea.sentido || 'IDA',
          distancia: Math.round(minDist),
        });
      }
    }
  }

  return Array.from(encontradasMap.values());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const texto = body.texto || '';
    const registrarComoCortes = body.registrarComoCortes !== false;

    if (!texto.trim()) {
      return NextResponse.json({ error: 'No se proveyó ningún texto para analizar' }, { status: 400 });
    }

    // 1. Parser instantáneo (0ms, 100% confiable y sin timeouts)
    let parsedData = parseReporteInstantaneo(texto);

    // Si por formato atípico no encontró ítems, intenta OpenAI como fallback
    if (!parsedData || parsedData.items.length === 0) {
      const aiData = await parsePlanWithOpenAIFallback(texto);
      if (aiData && aiData.items.length > 0) {
        parsedData = aiData;
      }
    }

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

    let registradosCount = 0;
    // Si se solicitó registrar como cortes y desvíos activos en el Planificador:
    if (registrarComoCortes && features.length > 0) {
      const year = new Date().getFullYear();
      const currentCount = await prisma.intervencionVial.count();

      // Cargar previamente todas las líneas activas de transporte para hacer el análisis espacial rápido
      let lineasCache: any[] = [];
      try {
        const rawLineas = await prisma.lineaTransporte.findMany({
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            numero: true,
            subcategoria: true,
            sentido: true,
            datosGeo: true,
          },
        });
        lineasCache = rawLineas.map((l) => {
          let parsedGeo: any[] = [];
          if (l.datosGeo) {
            try {
              const g = JSON.parse(l.datosGeo);
              parsedGeo = g.type === 'FeatureCollection' ? g.features : [g];
            } catch {}
          }
          return { ...l, parsedGeo };
        });
      } catch (errLineas) {
        console.error('Error cargando lineas para analisis espacial:', errLineas);
      }

      for (let i = 0; i < features.length; i++) {
        const feat = features[i];
        const props = feat.properties;
        const coords = { lat: feat.geometry.coordinates[1], lng: feat.geometry.coordinates[0] };
        const codigo = `CORTE-${year}-${String(currentCount + i + 1).padStart(4, '0')}`;

        // Detectar automáticamente líneas de colectivo que cruzan o pasan directo por el corte (< 45 metros)
        const lineasCruzadas = detectarLineasQueCruzan(coords, lineasCache, 55);

        try {
          await prisma.intervencionVial.create({
            data: {
              codigo,
              titulo: `${props.empresa}: ${props.nombre}`,
              tipo: 'BACHEO',
              tipoCorte: 'TOTAL',
              motivo: props.observaciones || props.tipoMaterial,
              areaResponsable: tituloPlan,
              callesAfectadas: props.nombre,
              fechaInicio: new Date(),
              estado: 'PLANIFICADO',
              datosGeo: JSON.stringify(feat.geometry),
              desvios: {
                create: lineasCruzadas.map((d) => ({
                  lineaId: d.lineaId,
                  lineaNumero: d.lineaNumero,
                  ramal: d.ramal,
                  sentido: d.sentido,
                  datosGeoDesvio: JSON.stringify(feat.geometry),
                  callesDesvio: `Afectada por obra (${d.distancia}m)`,
                  activo: true,
                })),
              },
            },
          });
          registradosCount++;
        } catch (dbErr) {
          console.error('Error insertando intervencion con lineas afectadas en DB:', dbErr);
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
      registradosEnDesvios: registradosCount,
    });
  } catch (error: any) {
    console.error('Error parseando plan de obras:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el plan' }, { status: 500 });
  }
}
