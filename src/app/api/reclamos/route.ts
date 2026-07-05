import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authGuard';
import { adminDc } from '@/lib/dataconnectAdmin';
import { listReclamos, deleteReclamo } from '@/lib/dataconnect-admin';

export async function GET(req: Request) {
  try {
    // Verificar permisos del usuario (requiere permiso verReclamos para ver reclamos de movilidad)
    const guard = await requirePermission(req, 'verReclamos');
    if (guard.error) return guard.error;

    const { searchParams } = new URL(req.url);
    
    // Obtener filtros de la query string
    const motivoIdParam = searchParams.get('motivoId');
    const estado = searchParams.get('estado');
    const prioridad = searchParams.get('prioridad');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    let ids = [] as number[];
    if (motivoIdParam) {
      ids = motivoIdParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    const res = await listReclamos(adminDc);
    let reclamos = res.data.reclamos;

    // Apply filters in memory
    if (ids.length > 0) {
      reclamos = reclamos.filter((r: any) => ids.includes(r.motivoId));
    }
    if (estado && estado !== 'TODOS') {
      reclamos = reclamos.filter((r: any) => r.estado === estado);
    }
    if (prioridad && prioridad !== 'TODAS') {
      reclamos = reclamos.filter((r: any) => r.prioridad === prioridad);
    }
    if (fechaDesde) {
      // Basic string comparison (if YYYY-MM-DD)
      reclamos = reclamos.filter((r: any) => r.fecha && r.fecha >= fechaDesde);
    }
    if (fechaHasta) {
      reclamos = reclamos.filter((r: any) => r.fecha && r.fecha <= fechaHasta);
    }

    const mapped = reclamos.map((r: any) => ({
      ...r,
      creadoEn: r.creadoEn ? new Date(r.creadoEn).toISOString() : null,
      actualizadoEn: r.actualizadoEn ? new Date(r.actualizadoEn).toISOString() : null,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching reclamos:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requirePermission(req, 'editarReclamos');
    if (guard.error) return guard.error;

    const res = await listReclamos(adminDc);
    for (const r of res.data.reclamos) {
      await deleteReclamo(adminDc, { id: r.id });
    }
    return NextResponse.json({ success: true, message: 'Todos los reclamos fueron eliminados.' });
  } catch (error: any) {
    console.error('Error deleting all reclamos:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
