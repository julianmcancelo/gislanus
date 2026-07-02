import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requirePermission } from '@/lib/authGuard';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const { estado } = await req.json();

    if (!estado) {
      return NextResponse.json({ error: 'El estado es requerido' }, { status: 400 });
    }

    const ruta = await prisma.rutaTransporte.update({
      where: { id },
      data: { estado }
    });

    return NextResponse.json(ruta);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const { id } = await params;

    await prisma.rutaTransporte.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'verRutas');
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const ruta = await prisma.rutaTransporte.findUnique({
      where: { id }
    });

    if (!ruta) {
      return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
    }

    // Solo ADMIN/SUPER_ADMIN pueden ver rutas de otros usuarios
    const isAdmin = ['SUPER_ADMIN', 'ADMINISTRADOR'].includes(guard.user.rol);
    if (!isAdmin && ruta.creadoPorId && ruta.creadoPorId !== guard.user.id) {
      return NextResponse.json({ error: 'Sin permisos para ver esta solicitud' }, { status: 403 });
    }

    return NextResponse.json(ruta);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const { id } = await params;

    // Verificar que el usuario solo edite sus propias rutas (salvo ADMIN)
    const isAdmin = ['SUPER_ADMIN', 'ADMINISTRADOR'].includes(guard.user.rol);
    if (!isAdmin) {
      const existing = await prisma.rutaTransporte.findUnique({ where: { id }, select: { creadoPorId: true } });
      if (existing?.creadoPorId && existing.creadoPorId !== guard.user.id) {
        return NextResponse.json({ error: 'Sin permisos para editar esta solicitud' }, { status: 403 });
      }
    }
    const body = await req.json();
    const {
      numeroSolicitud, idSolicitudWeb, fechaCreacion,
      nombreSolicitante, empresaSolicitante, cuilCuit, emailSolicitante, telefonoSolicitante,
      patente, tipoVehiculo, pesoToneladas, cargaPeligrosa, tipoCarga,
      largoVehiculo, anchoVehiculo, alturaVehiculo, cantidadEjes,
      aseguradora, nroSeguro,
      origenDireccion, origenLocalidad, origenPartido, origenNombre,
      destinoDireccion, destinoLocalidad, destinoPartido, destinoNombre,
      frecuencia, horario, observaciones,
      vigenciaDesde, vigenciaHasta,
      datosGeo, calles,
      editadoPorId, editadoPorNombre, enlaceDocumento
    } = body;

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

    const ruta = await prisma.rutaTransporte.update({
      where: { id },
      data: {
        numeroSolicitud,
        idSolicitudWeb: idSolicitudWeb || null,
        fechaCreacion: fechaCreacion || null,
        nombreSolicitante,
        empresaSolicitante: empresaSolicitante || null,
        cuilCuit: cuilCuit || null,
        emailSolicitante: emailSolicitante || null,
        telefonoSolicitante: telefonoSolicitante || null,
        patente: patente || null,
        tipoVehiculo: tipoVehiculo || null,
        pesoToneladas: pesoToneladas ? parseFloat(pesoToneladas) : null,
        cargaPeligrosa: !!cargaPeligrosa,
        tipoCarga: tipoCarga || null,
        largoVehiculo: largoVehiculo || null,
        anchoVehiculo: anchoVehiculo || null,
        alturaVehiculo: alturaVehiculo || null,
        cantidadEjes: cantidadEjes ? parseInt(cantidadEjes) : null,
        aseguradora: aseguradora || null,
        nroSeguro: nroSeguro || null,
        origenDireccion: origenDireccion || null,
        origenLocalidad: origenLocalidad || null,
        origenPartido: origenPartido || null,
        origenNombre: origenNombre || null,
        destinoDireccion: destinoDireccion || null,
        destinoLocalidad: destinoLocalidad || null,
        destinoPartido: destinoPartido || null,
        destinoNombre: destinoNombre || null,
        frecuencia: frecuencia || null,
        horario: horario || null,
        observaciones: observaciones || null,
        vigenciaDesde: vigenciaDesde || null,
        vigenciaHasta: vigenciaHasta || null,
        datosGeo: typeof datosGeo === 'string' ? datosGeo : JSON.stringify(datosGeo),
        calles: calles || null,
        editadoPorId: editadoPorId || null,
        editadoPorNombre: editadoPorNombre || null,
        enlaceDocumento: enlaceDocumento || null,
      },
    });

    return NextResponse.json(ruta);
  } catch (error: any) {
    console.error('Error actualizando ruta:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}

