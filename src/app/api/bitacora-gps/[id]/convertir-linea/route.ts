import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clipGeometryToLanus } from '@/utils/geo';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const trip = await prisma.relevamientoGPS.findUnique({
      where: { id },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Relevamiento GPS no encontrado' }, { status: 404 });
    }

    let parsedGeo: any;
    try {
      parsedGeo = typeof trip.datosGeo === 'string' ? JSON.parse(trip.datosGeo) : trip.datosGeo;
    } catch {
      return NextResponse.json({ error: 'Los datos geográficos del relevamiento están corruptos' }, { status: 400 });
    }

    // Find the LineString or MultiLineString representing the route
    let routeGeometry: any = null;
    let stopPoints: any[] = [];

    if (parsedGeo.type === 'FeatureCollection' && Array.isArray(parsedGeo.features)) {
      const lineFeat = parsedGeo.features.find(
        (f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
      );
      if (lineFeat) {
        routeGeometry = lineFeat.geometry;
      }
      stopPoints = parsedGeo.features.filter((f: any) => f.properties?.type === 'stop');
    } else if (parsedGeo.type === 'Feature' && (parsedGeo.geometry?.type === 'LineString' || parsedGeo.geometry?.type === 'MultiLineString')) {
      routeGeometry = parsedGeo.geometry;
    } else if (parsedGeo.type === 'LineString' || parsedGeo.type === 'MultiLineString') {
      routeGeometry = parsedGeo;
    }

    if (!routeGeometry) {
      return NextResponse.json(
        { error: 'No se encontró una geometría LineString válida en este relevamiento' },
        { status: 400 }
      );
    }

    // Clip to Lanús boundaries by default unless client explicitly requested not to
    const shouldClip = body.clipToLanus !== false;
    let finalGeometry = routeGeometry;
    if (shouldClip) {
      finalGeometry = clipGeometryToLanus(routeGeometry) || routeGeometry;
    }

    // Determine line metadata
    const numero = body.numero || trip.lineaNumero || 'S/N';
    const ramal = body.subcategoria || trip.ramal || 'Principal';
    const sentido = (body.sentido || trip.sentido || 'IDA').toUpperCase();
    const nombre = body.nombre || `Línea ${numero} - ${ramal} (${sentido})`;
    const categoria = body.categoria || (['520', '521', '522', '523', '524', '526', '527'].includes(numero) ? 'MUNICIPAL' : 'PROVINCIAL');
    const color = body.color || (sentido === 'VUELTA' ? '#8b5cf6' : '#2563eb');
    const descripcion = body.descripcion || `Relevamiento GPS de campo (${trip.interno ? `Int. ${trip.interno}` : ''} ${trip.chofer ? `Chofer: ${trip.chofer}` : ''} - ${(trip.distanciaMeters / 1000).toFixed(1)} km) promovido desde Bitácora GPS`;

    // Construct clean FeatureCollection with the trace and stops
    const finalFeatures: any[] = [
      {
        type: 'Feature',
        geometry: finalGeometry,
        properties: {
          name: nombre,
          numero,
          ramal,
          sentido,
          categoria,
          relevamientoId: trip.id,
          source: 'BusTrackerGPS',
        },
      },
    ];

    // Include stops as Points if available
    for (const stop of stopPoints) {
      finalFeatures.push({
        type: 'Feature',
        geometry: stop.geometry,
        properties: {
          ...stop.properties,
          linea: numero,
          ramal,
          sentido,
        },
      });
    }

    const finalGeoJson = {
      type: 'FeatureCollection',
      features: finalFeatures,
    };

    // Save as LineaTransporte
    const nuevaLinea = await prisma.lineaTransporte.create({
      data: {
        nombre,
        numero,
        color,
        descripcion,
        categoria,
        subcategoria: ramal,
        sentido,
        activo: true,
        datosGeo: JSON.stringify(finalGeoJson),
      },
    });

    return NextResponse.json({
      success: true,
      linea: nuevaLinea,
      message: `Relevamiento promovido exitosamente a Línea de Transporte Oficial (#${nuevaLinea.id})`,
    });
  } catch (error: any) {
    console.error('Error promoting relevamiento to linea:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
