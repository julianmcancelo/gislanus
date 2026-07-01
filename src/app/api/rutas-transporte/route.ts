import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';
import { clipGeometryToLanus } from '@/utils/geo';

export async function POST(req: Request) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
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
      creadoPorId, creadoPorNombre, enlaceDocumento
    } = body;

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

    // Clip geometry to Lanús borders
    if (parsedGeo.type === 'FeatureCollection') {
      parsedGeo.features = parsedGeo.features.map((f: any) => ({
        ...f,
        geometry: clipGeometryToLanus(f.geometry)
      }));
    } else if (parsedGeo.type === 'Feature') {
      parsedGeo.geometry = clipGeometryToLanus(parsedGeo.geometry);
    }

    const ruta = await prisma.rutaTransporte.create({
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
        estado: 'APROBADA',
        creadoPorId: creadoPorId || null,
        creadoPorNombre: creadoPorNombre || null,
        enlaceDocumento: enlaceDocumento || null,
      },
    });

    return NextResponse.json(ruta, { status: 201 });
  } catch (error: any) {
    console.error('Error creando ruta de transporte:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}

async function resolveUserWithPermisos(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const { verifyIdToken } = await import('@/lib/firebaseAdmin');
    const decoded = await verifyIdToken(authHeader.slice(7));
    if (!decoded) return null;
    const u = await prisma.usuario.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, rol: true, email: true },
    });
    if (!u) return null;
    const rolPermisos = await prisma.rolPermisos.findUnique({ where: { rol: u.rol } });
    return { ...u, rolPermisos };
  } catch { return null; }
}

export async function GET(req: Request) {
  const user = await resolveUserWithPermisos(req);
  const isAdmin = user && ['SUPER_ADMIN', 'ADMINISTRADOR'].includes(user.rol);
  const hasVerRutas = isAdmin || (user?.rolPermisos?.verRutas === true);

  try {
    let where: any;

    if (!user) {
      // Sin auth: solo APROBADAS activas (para el mapa público)
      where = { estado: 'APROBADA', activo: true };
    } else if (isAdmin || hasVerRutas) {
      // Admin: todo. Con verRutas: propias + todas las APROBADAS
      where = isAdmin ? undefined : { OR: [{ estado: 'APROBADA' as const }, { creadoPorId: user.id }] };
    } else {
      // Autenticado sin verRutas: solo sus propias solicitudes + APROBADAS
      where = { OR: [{ creadoPorId: user.id }, { estado: 'APROBADA', activo: true }] };
    }

    const rutas = await prisma.rutaTransporte.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
    });
    return NextResponse.json(rutas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Bulk PATCH: { ids: string[], activo: boolean }
export async function PATCH(req: Request) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const { ids, activo, estado } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    
    const dataToUpdate: any = {};
    if (typeof activo === 'boolean') dataToUpdate.activo = activo;
    if (typeof estado === 'string') dataToUpdate.estado = estado;

    await prisma.rutaTransporte.updateMany({
      where: { id: { in: ids } },
      data: dataToUpdate,
    });
    return NextResponse.json({ updated: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Bulk DELETE: { ids: string[] }
export async function DELETE(req: Request) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    
    await prisma.rutaTransporte.deleteMany({
      where: { id: { in: ids } }
    });
    return NextResponse.json({ deleted: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
