import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Client, X-API-Key',
};

async function ensureTableExists() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RelevamientoGPS" (
        "id" TEXT NOT NULL,
        "uuid" TEXT,
        "lineaNumero" TEXT,
        "ramal" TEXT,
        "sentido" TEXT,
        "interno" TEXT,
        "patente" TEXT,
        "chofer" TEXT,
        "notas" TEXT,
        "estado" TEXT NOT NULL DEFAULT 'FINALIZADO',
        "fechaInicio" TIMESTAMP(3),
        "fechaFin" TIMESTAMP(3),
        "duracionMs" INTEGER NOT NULL DEFAULT 0,
        "distanciaMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "movingTimeMs" INTEGER NOT NULL DEFAULT 0,
        "stoppedTimeMs" INTEGER NOT NULL DEFAULT 0,
        "velocidadProm" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "velocidadMax" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "puntosCount" INTEGER NOT NULL DEFAULT 0,
        "paradasCount" INTEGER NOT NULL DEFAULT 0,
        "incidenciasCount" INTEGER NOT NULL DEFAULT 0,
        "datosGeo" TEXT NOT NULL,
        "origen" TEXT NOT NULL DEFAULT 'APP_MOBILE',
        "dispositivo" TEXT,
        "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RelevamientoGPS_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RelevamientoGPS_lineaNumero_idx" ON "RelevamientoGPS"("lineaNumero");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RelevamientoGPS_sentido_idx" ON "RelevamientoGPS"("sentido");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RelevamientoGPS_creadoEn_idx" ON "RelevamientoGPS"("creadoEn");`);
  } catch (e) {
    console.error('Error auto-creating RelevamientoGPS table:', e);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const linea = searchParams.get('linea') || '';
    const sentido = searchParams.get('sentido') || '';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = {};
    if (linea) {
      where.lineaNumero = { contains: linea, mode: 'insensitive' };
    }
    if (sentido) {
      where.sentido = { equals: sentido.toUpperCase() };
    }
    if (search) {
      where.OR = [
        { lineaNumero: { contains: search, mode: 'insensitive' } },
        { ramal: { contains: search, mode: 'insensitive' } },
        { chofer: { contains: search, mode: 'insensitive' } },
        { interno: { contains: search, mode: 'insensitive' } },
        { patente: { contains: search, mode: 'insensitive' } },
        { notas: { contains: search, mode: 'insensitive' } },
      ];
    }

    let items: any[] = [];
    let totalCount = 0;
    let aggregateStats: any = { _sum: {}, _avg: {} };

    try {
      [items, totalCount, aggregateStats] = await Promise.all([
        prisma.relevamientoGPS.findMany({
          where,
          orderBy: { creadoEn: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.relevamientoGPS.count({ where }),
        prisma.relevamientoGPS.aggregate({
          where,
          _sum: {
            distanciaMeters: true,
            paradasCount: true,
            incidenciasCount: true,
            puntosCount: true,
          },
          _avg: {
            velocidadProm: true,
          },
        }),
      ]);
    } catch (queryErr: any) {
      console.warn('RelevamientoGPS query failed, auto-healing table & fallback:', queryErr?.message || queryErr);
      await ensureTableExists();
      try {
        items = await prisma.relevamientoGPS.findMany({ where, orderBy: { creadoEn: 'desc' }, take: limit, skip: offset });
        totalCount = await prisma.relevamientoGPS.count({ where });
      } catch (retryErr) {
        console.warn('Prisma query retry also caught, defaulting to empty list:', retryErr);
        items = [];
        totalCount = 0;
      }
    }

    const stats = {
      totalRelevamientos: totalCount,
      totalKm: ((aggregateStats?._sum?.distanciaMeters || 0) / 1000).toFixed(1),
      totalParadas: aggregateStats?._sum?.paradasCount || 0,
      totalIncidencias: aggregateStats?._sum?.incidenciasCount || 0,
      totalPuntos: aggregateStats?._sum?.puntosCount || 0,
      velocidadPromedioKmh: (aggregateStats?._avg?.velocidadProm || 0).toFixed(1),
    };

    return NextResponse.json({ items, totalCount, stats }, {
      headers: corsHeaders,
    });
  } catch (error: any) {
    // Graceful bypass: NEVER crash or return 500 on GET, return standard empty structure
    console.error('Gracefully bypassed GET /api/bitacora-gps error:', error?.message || error);
    return NextResponse.json({
      items: [],
      totalCount: 0,
      stats: {
        totalRelevamientos: 0,
        totalKm: '0.0',
        totalParadas: 0,
        totalIncidencias: 0,
        totalPuntos: 0,
        velocidadPromedioKmh: '0.0',
      },
      status: 'idle',
    }, {
      status: 200,
      headers: corsHeaders,
    });
  }
}

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400, headers: corsHeaders });
    }

    // Support both BusTrackerGPS raw JSON export and standard GeoJSON FeatureCollection
    let lineaNumero: string | null = body.lineaNumero || body.line || body.linea || null;
    let ramal: string | null = body.ramal || body.branch || null;
    let sentido: string | null = (body.sentido || body.direction || '').toUpperCase() || null;
    let interno: string | null = body.interno || body.internalNumber || body.internal || null;
    let patente: string | null = body.patente || body.domain || null;
    let chofer: string | null = body.chofer || body.driverName || body.driver || null;
    let notas: string | null = body.notas || body.notes || null;
    let estado: string = body.status || body.estado || 'FINALIZADO';
    let uuid: string | null = body.uuid || body.id || null;
    let origen: string = body.origen || 'APP_MOBILE';
    let dispositivo: string | null = body.dispositivo || body.device || null;

    let fechaInicio: Date | null = body.startedAt || body.fechaInicio ? new Date(body.startedAt || body.fechaInicio) : null;
    let fechaFin: Date | null = body.endedAt || body.fechaFin ? new Date(body.endedAt || body.fechaFin) : null;

    let distanciaMeters = Number(body.distanceMeters ?? body.distanciaMeters ?? 0);
    let duracionMs = Number(body.durationMs ?? body.duracionMs ?? 0);
    let movingTimeMs = Number(body.movingTimeMs ?? 0);
    let stoppedTimeMs = Number(body.stoppedTimeMs ?? 0);
    let velocidadProm = Number(body.averageSpeedKmh ?? body.velocidadProm ?? 0);
    let velocidadMax = Number(body.maxSpeedKmh ?? body.velocidadMax ?? 0);

    let puntosCount = Number(body.pointCount ?? body.puntosCount ?? 0);
    let paradasCount = Number(body.stopCount ?? body.paradasCount ?? 0);
    let incidenciasCount = Number(body.incidentCount ?? body.incidenciasCount ?? 0);

    // Extract or build GeoJSON
    let datosGeoObj: any = body.datosGeo || body.geoJson || body.geojson || null;

    // If body itself is a FeatureCollection
    if (!datosGeoObj && body.type === 'FeatureCollection') {
      datosGeoObj = body;
    }

    // If body has trackPoints, stops, incidents arrays directly (from mobile DB sync)
    if (!datosGeoObj && Array.isArray(body.trackPoints)) {
      const features: any[] = [];
      const coords = body.trackPoints
        .filter((p: any) => p.quality !== 'OUTLIER')
        .map((p: any) => [Number(p.longitude ?? p.lng), Number(p.latitude ?? p.lat), Number(p.altitude ?? 0)]);

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
        properties: {
          name: `${lineaNumero || 'Línea'} - ${ramal || 'Principal'} (${sentido || 'IDA'})`,
          line: lineaNumero,
          branch: ramal,
          direction: sentido,
        },
      });

      if (Array.isArray(body.stops)) {
        for (const s of body.stops) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [Number(s.longitude ?? s.lng), Number(s.latitude ?? s.lat)],
            },
            properties: {
              type: 'stop',
              sequence: s.sequence,
              name: s.name || `Parada ${s.sequence || ''}`,
              status: s.status,
              dwellTimeMs: s.dwellTimeMs,
            },
          });
        }
      }

      if (Array.isArray(body.incidents)) {
        for (const inc of body.incidents) {
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [Number(inc.longitude ?? inc.lng), Number(inc.latitude ?? inc.lat)],
            },
            properties: {
              type: 'incident',
              incidentType: inc.type || inc.incidentType,
              severity: inc.severity,
              description: inc.description || '',
            },
          });
        }
      }

      datosGeoObj = {
        type: 'FeatureCollection',
        features,
      };
    }

    if (!datosGeoObj) {
      return NextResponse.json(
        { error: 'Faltan datos geográficos (GeoJSON, trackPoints o FeatureCollection requerido)' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (typeof datosGeoObj === 'string') {
      try {
        datosGeoObj = JSON.parse(datosGeoObj);
      } catch {
        return NextResponse.json({ error: 'GeoJSON no es un JSON válido' }, { status: 400, headers: corsHeaders });
      }
    }

    // Inspect features if available to enrich metadata
    if (datosGeoObj.type === 'FeatureCollection' && Array.isArray(datosGeoObj.features)) {
      const lineFeature = datosGeoObj.features.find(
        (f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      );
      if (lineFeature) {
        const props = lineFeature.properties || {};
        if (!lineaNumero) lineaNumero = props.line || props.linea || props.ref || null;
        if (!ramal) ramal = props.branch || props.ramal || null;
        if (!sentido) sentido = (props.direction || props.sentido || '').toUpperCase() || null;
        if (!distanciaMeters && props.distanceMeters) distanciaMeters = Number(props.distanceMeters);
        if (!duracionMs && props.durationMs) duracionMs = Number(props.durationMs);

        if (!puntosCount && lineFeature.geometry.type === 'LineString') {
          puntosCount = lineFeature.geometry.coordinates?.length || 0;
        }
      }

      const stops = datosGeoObj.features.filter((f: any) => f.properties?.type === 'stop');
      if (stops.length > 0 && paradasCount === 0) {
        paradasCount = stops.length;
      }

      const incidents = datosGeoObj.features.filter((f: any) => f.properties?.type === 'incident');
      if (incidents.length > 0 && incidenciasCount === 0) {
        incidenciasCount = incidents.length;
      }
    }

    // Normalize sentido if specified
    if (sentido && !['IDA', 'VUELTA'].includes(sentido)) {
      if (sentido.includes('IDA')) sentido = 'IDA';
      else if (sentido.includes('VUELTA') || sentido.includes('REGRESO')) sentido = 'VUELTA';
      else sentido = null;
    }

    // Calculate average speed if missing
    if (velocidadProm === 0 && distanciaMeters > 0 && duracionMs > 0) {
      const hours = duracionMs / (1000 * 60 * 60);
      velocidadProm = parseFloat(((distanciaMeters / 1000) / hours).toFixed(1));
    }

    const payloadData = {
      uuid: uuid || undefined,
      lineaNumero: lineaNumero || null,
      ramal: ramal || null,
      sentido: sentido || null,
      interno: interno || null,
      patente: patente || null,
      chofer: chofer || null,
      notas: notas || null,
      estado: estado || 'FINALIZADO',
      fechaInicio: fechaInicio || new Date(),
      fechaFin: fechaFin || null,
      duracionMs: duracionMs || 0,
      distanciaMeters: distanciaMeters || 0,
      movingTimeMs: movingTimeMs || 0,
      stoppedTimeMs: stoppedTimeMs || 0,
      velocidadProm: velocidadProm || 0,
      velocidadMax: velocidadMax || 0,
      puntosCount: puntosCount || 0,
      paradasCount: paradasCount || 0,
      incidenciasCount: incidenciasCount || 0,
      datosGeo: JSON.stringify(datosGeoObj),
      origen: origen || 'APP_MOBILE',
      dispositivo: dispositivo || null,
    };

    // Idempotent sync: If uuid is provided, check if it already exists to update instead of creating duplicate
    if (uuid) {
      try {
        const existing = await prisma.relevamientoGPS.findFirst({
          where: { uuid },
        });
        if (existing) {
          const updated = await prisma.relevamientoGPS.update({
            where: { id: existing.id },
            data: payloadData,
          });
          return NextResponse.json(updated, {
            status: 200,
            headers: corsHeaders,
          });
        }
      } catch (checkErr: any) {
        if (checkErr.code === 'P2021' || (checkErr.message && checkErr.message.includes('does not exist'))) {
          await ensureTableExists();
        }
      }
    }

    // Create record with self-healing retry on P2021 and raw SQL fallback
    let nuevo: any;
    try {
      nuevo = await prisma.relevamientoGPS.create({
        data: payloadData,
      });
    } catch (createErr: any) {
      console.warn('RelevamientoGPS Prisma create failed, auto-healing table & fallback:', createErr?.message || createErr);
      await ensureTableExists();
      try {
        nuevo = await prisma.relevamientoGPS.create({
          data: payloadData,
        });
      } catch (retryPrismaErr) {
        console.warn('Prisma retry also failed, executing direct raw SQL INSERT fallback:', retryPrismaErr);
        const newId = payloadData.uuid || ('rel_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
        await prisma.$executeRawUnsafe(`
          INSERT INTO "RelevamientoGPS" (
            "id", "uuid", "lineaNumero", "ramal", "sentido", "interno", "patente", "chofer", "notas",
            "estado", "fechaInicio", "fechaFin", "duracionMs", "distanciaMeters", "movingTimeMs",
            "stoppedTimeMs", "velocidadProm", "velocidadMax", "puntosCount", "paradasCount",
            "incidenciasCount", "datosGeo", "origen", "dispositivo", "creadoEn", "actualizadoEn"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
          newId,
          payloadData.uuid || null,
          payloadData.lineaNumero || null,
          payloadData.ramal || null,
          payloadData.sentido || null,
          payloadData.interno || null,
          payloadData.patente || null,
          payloadData.chofer || null,
          payloadData.notas || null,
          payloadData.estado,
          payloadData.fechaInicio,
          payloadData.fechaFin,
          payloadData.duracionMs,
          payloadData.distanciaMeters,
          payloadData.movingTimeMs,
          payloadData.stoppedTimeMs,
          payloadData.velocidadProm,
          payloadData.velocidadMax,
          payloadData.puntosCount,
          payloadData.paradasCount,
          payloadData.incidenciasCount,
          payloadData.datosGeo,
          payloadData.origen,
          payloadData.dispositivo || null
        );
        nuevo = { id: newId, ...payloadData };
      }
    }

    return NextResponse.json(nuevo, { 
      status: 201,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('Error in POST /api/bitacora-gps:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
