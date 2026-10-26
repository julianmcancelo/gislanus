import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as turf from '@turf/turf';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/obras/analizar-proximidad
 * Analiza un punto de obra o bacheo respecto a la red de colectivos de Lanús.
 * Clasifica las líneas en:
 *  1. Pasan directo sobre la obra / cruce exacto (< 35 metros)
 *  2. Pasan cerca / chocan / radio de proximidad (35m - 200m)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, radioMaxMetros = 200, radioDirectoMetros = 35 } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Debe proveer latitud y longitud numéricas válidas' },
        { status: 400, headers: corsHeaders }
      );
    }

    const puntoObra = turf.point([lng, lat]);

    // Consultamos todas las líneas de transporte activas de Lanús
    const lineas = await prisma.lineaTransporte.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        numero: true,
        color: true,
        categoria: true,
        subcategoria: true,
        sentido: true,
        datosGeo: true,
      },
    });

    const directas: any[] = [];
    const cercanas: any[] = [];

    for (const linea of lineas) {
      if (!linea.datosGeo) continue;
      try {
        const parsedGeo = typeof linea.datosGeo === 'string' ? JSON.parse(linea.datosGeo) : linea.datosGeo;

        let lineFeatures: any[] = [];
        if (parsedGeo.type === 'FeatureCollection' && Array.isArray(parsedGeo.features)) {
          lineFeatures = parsedGeo.features;
        } else if (parsedGeo.type === 'Feature') {
          lineFeatures = [parsedGeo];
        } else if (parsedGeo.type === 'LineString' || parsedGeo.type === 'MultiLineString') {
          lineFeatures = [turf.feature(parsedGeo)];
        }

        let minDistMeters = Infinity;

        for (const feat of lineFeatures) {
          if (!feat.geometry) continue;
          if (feat.geometry.type === 'LineString') {
            const nearest = turf.nearestPointOnLine(feat, puntoObra, { units: 'meters' });
            const d = nearest?.properties?.dist ?? Infinity;
            if (d < minDistMeters) minDistMeters = d;
          } else if (feat.geometry.type === 'MultiLineString') {
            for (const coords of feat.geometry.coordinates) {
              const ls = turf.lineString(coords);
              const nearest = turf.nearestPointOnLine(ls, puntoObra, { units: 'meters' });
              const d = nearest?.properties?.dist ?? Infinity;
              if (d < minDistMeters) minDistMeters = d;
            }
          }
        }

        if (minDistMeters <= radioMaxMetros) {
          const item = {
            id: linea.id,
            nombre: linea.nombre,
            numero: linea.numero || linea.nombre.replace(/\D/g, ''),
            color: linea.color || '#2563eb',
            categoria: linea.categoria || 'MUNICIPAL',
            ramal: linea.subcategoria || 'General',
            sentido: linea.sentido || (linea.nombre.toLowerCase().includes('vuelta') ? 'VUELTA' : 'IDA'),
            distanciaMetros: Math.round(minDistMeters),
            esDirecta: minDistMeters <= radioDirectoMetros,
            datosGeo: linea.datosGeo,
          };

          if (item.esDirecta) {
            directas.push(item);
          } else {
            cercanas.push(item);
          }
        }
      } catch (err) {
        // En caso de geojson inválido se salta
        continue;
      }
    }

    // Ordenar por distancia ascendente
    directas.sort((a, b) => a.distanciaMetros - b.distanciaMetros);
    cercanas.sort((a, b) => a.distanciaMetros - b.distanciaMetros);

    return NextResponse.json({
      punto: [lat, lng],
      totalLineasEncontradas: directas.length + cercanas.length,
      directas,
      cercanas,
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Error analizando proximidad de colectivos con obra:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
