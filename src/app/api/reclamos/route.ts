import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

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

    // Construir la condición where
    const where: any = {};

    if (motivoIdParam) {
      const ids = motivoIdParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) {
        where.motivoId = { in: ids };
      }
    }

    if (estado && estado !== 'TODOS') {
      where.estado = estado;
    }

    if (prioridad && prioridad !== 'TODAS') {
      where.prioridad = prioridad;
    }

    // Filtros por fecha (suponiendo formato YYYY-MM-DD o similar)
    if (fechaDesde || fechaHasta) {
      // Si guardamos la fecha como string en la base de datos (e.g. "2026-06-25"), 
      // podemos hacer comparaciones lexicográficas sencillas si las fechas de SAT vienen en formato ISO.
      // Si vienen en DD/MM/YYYY, tendremos que normalizarlas. 
      // Por ahora, aplicamos filtro directo si es necesario o comparamos en base a la creación.
    }

    const reclamos = await prisma.reclamo.findMany({
      where,
      orderBy: {
        fecha: 'desc'
      }
    });

    return NextResponse.json(reclamos);
  } catch (error: any) {
    console.error('Error fetching reclamos:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const guard = await requirePermission(req, 'editarReclamos');
    if (guard.error) return guard.error;

    await prisma.reclamo.deleteMany({});
    return NextResponse.json({ success: true, message: 'Todos los reclamos fueron eliminados.' });
  } catch (error: any) {
    console.error('Error deleting all reclamos:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
