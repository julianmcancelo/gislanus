import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authGuard';
import { clipGeometryToLanus } from '@/utils/geo';
import { adminDc } from '@/lib/dataconnectAdmin';
import { listRutasTransporte, createRutaTransporte } from '@/lib/dataconnect-admin';
import { updateRutaTransporte } from '@/lib/dataconnect-admin';

async function resolveUserWithPermisos(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const { verifyIdToken } = await import('@/lib/firebaseAdmin');
    const decoded = await verifyIdToken(authHeader.slice(7));
    if (!decoded) return null;
    
    // Fetch user and permissions from Data Connect instead of Prisma
    const { getUsuario } = await import('@/lib/dataconnect-admin');
    const userRes = await getUsuario(adminDc, { firebaseUid: decoded.uid });
    const user = userRes.data.usuario;
    if (!user) return null;
    
    // Since we don't have rolPermisos in Data Connect easily accessible here, we mock it or fetch it if needed.
    // For now we check the static permissions based on role if it's admin.
    const isAdmin = ['SUPER_ADMIN', 'ADMINISTRADOR'].includes(user.rol);
    // Ideally we should query RolPermisos
    return { ...user, isAdmin };
  } catch { return null; }
}

export async function GET(req: Request) {
  const user = await resolveUserWithPermisos(req);
  const isAdmin = user && ['SUPER_ADMIN', 'ADMINISTRADOR'].includes(user.rol);
  // Ideally we check user.rolPermisos.verRutas, assuming true for admin for now
  const hasVerRutas = isAdmin; // Simplified for the migration unless we fetch RolPermisos

  try {
    const res = await listRutasTransporte(adminDc);
    const todas = res.data.rutaTransportes;
    
    let filtradas = todas;

    if (!user) {
      // Sin auth: solo APROBADAS activas (para el mapa público)
      filtradas = todas.filter((r: any) => r.estado === 'APROBADA' && r.activo === true);
    } else if (isAdmin || hasVerRutas) {
      // Admin: todo.
    } else {
      // Autenticado sin verRutas: solo sus propias solicitudes + APROBADAS
      filtradas = todas.filter((r: any) => r.creadoPorId === user.id || (r.estado === 'APROBADA' && r.activo === true));
    }

    // Convert timestamps to ISO strings
    const mapped = filtradas.map((r: any) => ({
      ...r,
      creadoEn: r.creadoEn ? new Date(r.creadoEn).toISOString() : null,
      actualizadoEn: r.actualizadoEn ? new Date(r.actualizadoEn).toISOString() : null,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error GET /api/rutas-transporte:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
      creadoPorId, creadoPorNombre, enlaceDocumento,
      tipoServicio
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

    const res = await createRutaTransporte(adminDc, {
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
      tipoServicio: tipoServicio || 'FIJO',
      creadoPorId: creadoPorId || null,
      creadoPorNombre: creadoPorNombre || null,
      enlaceDocumento: enlaceDocumento || null,
    });

    return NextResponse.json({ id: res.data.rutaTransporte_insert.id }, { status: 201 });
  } catch (error: any) {
    console.error('Error creando ruta de transporte:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
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
    
    // Data Connect doesn't support updateMany directly yet, we do it in a loop
    const { updateRutaTransporte } = await import('@/lib/dataconnect-admin');
    
    for (const id of ids) {
      const dataToUpdate: any = { id };
      if (typeof activo === 'boolean') dataToUpdate.activo = activo;
      if (typeof estado === 'string') dataToUpdate.estado = estado;
      await updateRutaTransporte(adminDc, dataToUpdate);
    }

    return NextResponse.json({ updated: ids.length });
  } catch (error: any) {
    console.error('Error bulk PATCH /api/rutas-transporte:', error);
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
    
    const { deleteRutaTransporte } = await import('@/lib/dataconnect-admin');
    for (const id of ids) {
      await deleteRutaTransporte(adminDc, { id });
    }
    return NextResponse.json({ deleted: ids.length });
  } catch (error: any) {
    console.error('Error bulk DELETE /api/rutas-transporte:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
