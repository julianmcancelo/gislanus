import { NextResponse } from 'next/server';
import { geocodeIntersection, geocodeSegment } from '@/utils/lanusGeocoder';

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

function parseReporteRegex(texto: string): { tituloPlan: string; items: ParsedItem[] } {
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let tituloPlan = 'Plan de Pavimentación Lanús';
  let empresaActual = 'MUNICIPAL';
  let zonaActual = 'Lanús';
  let tipoMaterialActual = 'Hormigón';
  const items: ParsedItem[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];

    // Encabezado general
    if (/PLAN DE PAVIMENTACI[OÓ]N/i.test(l) || /Semana del/i.test(l)) {
      if (/Semana del/i.test(l)) {
        tituloPlan = l.replace(/- EMPRESAS/i, '').trim();
      }
      continue;
    }

    // Detección de Empresa
    if (/^(LÁZARO|LAZARO|KAVOS|USIMIX)/i.test(l)) {
      empresaActual = l.toUpperCase().split(/[-:]/)[0].trim();
      continue;
    }

    // Detección de Zona y Tipo de Material (ej: "Zona Este - Hormigón:", "Villa Esperanza - Cordón cuneta:")
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

    // Detección de Ítems numerados (ej: "1. Tucumán y Posadas - Bacheo...")
    const itemMatch = l.match(/^(\d+)[\.\)]\s*(.+)$/);
    if (itemMatch) {
      const cuerpo = itemMatch[2].trim();
      let partes = cuerpo.split(/\s*[-–—]\s*/);
      let dirText = partes[0].trim();
      let obsText = partes.slice(1).join(' - ').trim();

      // Analizar si es un tramo: "Calle entre X e Y"
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

      // Analizar si es un cruce: "Calle A y Calle B"
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

      // Fallback genérico
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

    // Parser heurístico
    const { tituloPlan, items } = parseReporteRegex(texto);

    // Geocodificar en serie para no sobrecargar el endpoint USIG / Georef
    const features: any[] = [];
    const fallidos: any[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const color = EMPRESA_COLORS[item.empresa] || '#2563eb';

      if (item.tipoForma === 'tramo' && item.callePrincipal && item.entreCalle1 && item.entreCalle2) {
        const seg = await geocodeSegment(item.callePrincipal, item.entreCalle1, item.entreCalle2);

        // Si tenemos ambas esquinas, calculamos el punto medio exacto de la cuadra/tramo
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
          // Si solo pudimos ubicar una esquina
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

      // Pequeña pausa de 80ms para cumplir con límites de rate limit
      await new Promise(r => setTimeout(r, 80));
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
