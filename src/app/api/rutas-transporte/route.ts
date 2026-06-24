import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { numeroSolicitud, nombreSolicitante, patente, tipoVehiculo, pesoToneladas, cargaPeligrosa, datosGeo, calles, idSolicitudWeb, vigenciaDesde, vigenciaHasta, aseguradora, nroSeguro } = body;

    if (!numeroSolicitud || !nombreSolicitante || !datosGeo) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    if (String(numeroSolicitud).length > 50 || String(nombreSolicitante).length > 150) {
      return NextResponse.json({ error: 'Datos de solicitud demasiado largos' }, { status: 400 });
    }

    let parsedGeo;
    if (typeof datosGeo === 'string') {
      try {
        parsedGeo = JSON.parse(datosGeo);
      } catch {
        return NextResponse.json({ error: 'Datos geográficos no son un JSON válido' }, { status: 400 });
      }
    } else {
      parsedGeo = datosGeo;
    }

    if (!parsedGeo.type || (parsedGeo.type !== 'FeatureCollection' && parsedGeo.type !== 'Feature')) {
      return NextResponse.json({ error: 'Formato GeoJSON inválido' }, { status: 400 });
    }

    const ruta = await prisma.rutaTransporte.create({
      data: {
        numeroSolicitud,
        nombreSolicitante,
        patente: patente || null,
        tipoVehiculo: tipoVehiculo || null,
        pesoToneladas: pesoToneladas ? parseFloat(pesoToneladas) : null,
        cargaPeligrosa: !!cargaPeligrosa,
        datosGeo: typeof datosGeo === 'string' ? datosGeo : JSON.stringify(datosGeo),
        calles,
        estado: 'BORRADOR',
        idSolicitudWeb,
        vigenciaDesde,
        vigenciaHasta,
        aseguradora,
        nroSeguro
      },
    });

    return NextResponse.json(ruta, { status: 201 });
  } catch (error: any) {
    console.error('Error creando ruta de transporte:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rutas = await prisma.rutaTransporte.findMany({
      where: {
        estado: { not: 'BORRADOR' }
      },
      orderBy: {
        creadoEn: 'desc'
      }
    });
    return NextResponse.json(rutas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
