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
 * POST /api/desvios/analizar-afectacion
 * Recibe: { lat: number, lng: number, radioMetros?: number } o { geojson: Feature }
 * Devuelve: Lista de líneas y ramales que intersectan o están dentro del radio de corte.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, radioMetros = 60, geojson } = body;

    let zonaCorteFeature: any = null;

    if (geojson && geojson.geometry) {
      if (geojson.geometry.type === 'Point') {
        const pt = turf.point(geojson.geometry.coordinates);
        zonaCorteFeature = turf.buffer(pt, radioMetros / 1000, { units: 'kilometers' });
      } else {
        zonaCorteFeature = geojson;
      }
    } else if (typeof lat === 'number' && typeof lng === 'number') {
      const pt = turf.point([lng, lat]);
      zonaCorteFeature = turf.buffer(pt, radioMetros / 1000, { units: 'kilometers' });
    } else {
      return NextResponse.json(
        { error: 'Debe proveer lat/lng o un objeto geojson válido' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Obtener todas las líneas de transporte activas con su geometría
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

    const afectadas: any[] = [];

    for (const linea of lineas) {
      try {
        if (!linea.datosGeo) continue;
        const parsedGeo = JSON.parse(linea.datosGeo);

        let features: any[] = [];
        if (parsedGeo.type === 'FeatureCollection' && Array.isArray(parsedGeo.features)) {
          features = parsedGeo.features;
        } else if (parsedGeo.type === 'Feature') {
          features = [parsedGeo];
        } else if (parsedGeo.type === 'LineString' || parsedGeo.type === 'MultiLineString') {
          features = [turf.feature(parsedGeo)];
        }

        let isAfectada = false;
        let puntoInterseccion = null;

        for (const feat of features) {
          if (!feat.geometry) continue;

          // Si la geometría es una línea
          if (feat.geometry.type === 'LineString' || feat.geometry.type === 'MultiLineString') {
            // Evaluamos si intersecta con la zona de corte
            if (turf.booleanIntersects(feat, zonaCorteFeature)) {
              isAfectada = true;
              break;
            }
          }
        }

        if (isAfectada) {
          afectadas.push({
            id: linea.id,
            nombre: linea.nombre,
            numero: linea.numero || linea.nombre.replace(/\D/g, ''),
            color: linea.color,
            categoria: linea.categoria,
            ramal: linea.subcategoria || 'General',
            sentido: linea.sentido || (linea.nombre.toLowerCase().includes('vuelta') ? 'VUELTA' : 'IDA'),
          });
        }
      } catch (err) {
        // En caso de json corrupto se continúa
        continue;
      }
    }

    return NextResponse.json({
      afectadasCount: afectadas.length,
      lineasAfectadas: afectadas,
      radioMetros,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error analizando afectacion vial:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
