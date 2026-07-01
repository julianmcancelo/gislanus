import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';
import { clipGeometryToLanus } from '@/utils/geo';

export async function POST(req: Request) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const { sourceRutaId, cloneData, fieldsToChange } = body;

    if (!sourceRutaId) {
      return NextResponse.json({ error: 'ID de solicitud origen requerido' }, { status: 400 });
    }

    const sourceRuta = await prisma.rutaTransporte.findUnique({
      where: { id: sourceRutaId },
    });

    if (!sourceRuta) {
      return NextResponse.json({ error: 'Solicitud origen no encontrada' }, { status: 404 });
    }

    const clonedData: any = {
      numeroSolicitud: sourceRuta.numeroSolicitud,
      idSolicitudWeb: sourceRuta.idSolicitudWeb || null,
      fechaCreacion: sourceRuta.fechaCreacion || null,
      nombreSolicitante: sourceRuta.nombreSolicitante,
      empresaSolicitante: sourceRuta.empresaSolicitante || null,
      cuilCuit: sourceRuta.cuilCuit || null,
      emailSolicitante: sourceRuta.emailSolicitante || null,
      telefonoSolicitante: sourceRuta.telefonoSolicitante || null,
      patente: sourceRuta.patente || null,
      tipoVehiculo: sourceRuta.tipoVehiculo || null,
      pesoToneladas: sourceRuta.pesoToneladas,
      cargaPeligrosa: sourceRuta.cargaPeligrosa,
      tipoCarga: sourceRuta.tipoCarga || null,
      largoVehiculo: sourceRuta.largoVehiculo || null,
      anchoVehiculo: sourceRuta.anchoVehiculo || null,
      alturaVehiculo: sourceRuta.alturaVehiculo || null,
      cantidadEjes: sourceRuta.cantidadEjes,
      aseguradora: sourceRuta.aseguradora || null,
      nroSeguro: sourceRuta.nroSeguro || null,
      origenDireccion: sourceRuta.origenDireccion || null,
      origenLocalidad: sourceRuta.origenLocalidad || null,
      origenPartido: sourceRuta.origenPartido || null,
      origenNombre: sourceRuta.origenNombre || null,
      destinoDireccion: sourceRuta.destinoDireccion || null,
      destinoLocalidad: sourceRuta.destinoLocalidad || null,
      destinoPartido: sourceRuta.destinoPartido || null,
      destinoNombre: sourceRuta.destinoNombre || null,
      frecuencia: sourceRuta.frecuencia || null,
      horario: sourceRuta.horario || null,
      observaciones: sourceRuta.observaciones || null,
      vigenciaDesde: sourceRuta.vigenciaDesde,
      vigenciaHasta: sourceRuta.vigenciaHasta,
      datosGeo: sourceRuta.datosGeo,
      calles: sourceRuta.calles || null,
      estado: sourceRuta.estado,
      creadoPorId: sourceRuta.creadoPorId || null,
      creadoPorNombre: sourceRuta.creadoPorNombre || null,
      enlaceDocumento: sourceRuta.enlaceDocumento || null,
      activo: true,
    };

    // Sobrescribir solo los campos que se indican en fieldsToChange
    if (fieldsToChange && Array.isArray(fieldsToChange) && cloneData) {
      fieldsToChange.forEach(field => {
        if (field in cloneData && cloneData[field] !== undefined) {
          clonedData[field] = cloneData[field];
        }
      });
    }

    let parsedGeo;
    if (typeof clonedData.datosGeo === 'string') {
      try {
        parsedGeo = JSON.parse(clonedData.datosGeo);
      } catch {
        return NextResponse.json({ error: 'Datos geográficos no son un JSON válido' }, { status: 400 });
      }
    } else {
      parsedGeo = clonedData.datosGeo;
    }

    if (!parsedGeo.type || (parsedGeo.type !== 'FeatureCollection' && parsedGeo.type !== 'Feature')) {
      return NextResponse.json({ error: 'Formato GeoJSON inválido' }, { status: 400 });
    }

    // Clip geometry to Lanús borders
    if (parsedGeo.type === 'FeatureCollection') {
      parsedGeo.features = parsedGeo.features.map((f: any) => ({
        ...f,
        geometry: clipGeometryToLanus(f.geometry)
      }));
    } else if (parsedGeo.type === 'Feature') {
      parsedGeo.geometry = clipGeometryToLanus(parsedGeo.geometry);
    }

    const newRuta = await prisma.rutaTransporte.create({
      data: {
        numeroSolicitud: clonedData.numeroSolicitud,
        idSolicitudWeb: clonedData.idSolicitudWeb,
        fechaCreacion: clonedData.fechaCreacion,
        nombreSolicitante: clonedData.nombreSolicitante,
        empresaSolicitante: clonedData.empresaSolicitante,
        cuilCuit: clonedData.cuilCuit,
        emailSolicitante: clonedData.emailSolicitante,
        telefonoSolicitante: clonedData.telefonoSolicitante,
        patente: clonedData.patente,
        tipoVehiculo: clonedData.tipoVehiculo,
        pesoToneladas: clonedData.pesoToneladas,
        cargaPeligrosa: clonedData.cargaPeligrosa,
        tipoCarga: clonedData.tipoCarga,
        largoVehiculo: clonedData.largoVehiculo,
        anchoVehiculo: clonedData.anchoVehiculo,
        alturaVehiculo: clonedData.alturaVehiculo,
        cantidadEjes: clonedData.cantidadEjes,
        aseguradora: clonedData.aseguradora,
        nroSeguro: clonedData.nroSeguro,
        origenDireccion: clonedData.origenDireccion,
        origenLocalidad: clonedData.origenLocalidad,
        origenPartido: clonedData.origenPartido,
        origenNombre: clonedData.origenNombre,
        destinoDireccion: clonedData.destinoDireccion,
        destinoLocalidad: clonedData.destinoLocalidad,
        destinoPartido: clonedData.destinoPartido,
        destinoNombre: clonedData.destinoNombre,
        frecuencia: clonedData.frecuencia,
        horario: clonedData.horario,
        observaciones: clonedData.observaciones,
        vigenciaDesde: clonedData.vigenciaDesde,
        vigenciaHasta: clonedData.vigenciaHasta,
        datosGeo: typeof clonedData.datosGeo === 'string' ? clonedData.datosGeo : JSON.stringify(parsedGeo),
        calles: clonedData.calles,
        estado: clonedData.estado,
        creadoPorId: clonedData.creadoPorId,
        creadoPorNombre: clonedData.creadoPorNombre,
        enlaceDocumento: clonedData.enlaceDocumento,
        activo: clonedData.activo,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitud clonada exitosamente',
      numeroSolicitud: newRuta.numeroSolicitud,
      id: newRuta.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error clonando ruta de transporte:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
