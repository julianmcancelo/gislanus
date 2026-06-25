import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function GET() {
  try {
    const lineas = await prisma.lineaTransporte.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        numero: true,
        color: true,
        descripcion: true,
        activo: true,
        datosGeo: true,
        creadoEn: true,
        actualizadoEn: true,
      },
    });
    return NextResponse.json(lineas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { nombre, numero, color, descripcion, categoria, subcategoria, datosGeo } = await req.json();

    if (!nombre || !datosGeo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: nombre y datosGeo' }, { status: 400 });
    }

    let parsedGeo;
    try {
      parsedGeo = typeof datosGeo === 'string' ? JSON.parse(datosGeo) : datosGeo;
    } catch {
      return NextResponse.json({ error: 'datosGeo no es JSON válido' }, { status: 400 });
    }

    if (!['Feature', 'FeatureCollection', 'LineString', 'MultiLineString'].includes(parsedGeo.type)) {
      return NextResponse.json({ error: 'GeoJSON debe ser LineString, MultiLineString, Feature o FeatureCollection' }, { status: 400 });
    }

    const linea = await prisma.lineaTransporte.create({
      data: {
        nombre,
        numero: numero || null,
        color: color || '#E53E3E',
        descripcion: descripcion || null,
        categoria: categoria || 'NACIONAL',
        subcategoria: subcategoria || null,
        datosGeo: typeof datosGeo === 'string' ? datosGeo : JSON.stringify(datosGeo),
      },
    });

    return NextResponse.json(linea, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Bulk PATCH: { ids: string[], activo: boolean }
export async function PATCH(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { ids, activo } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0 || typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    await prisma.lineaTransporte.updateMany({ where: { id: { in: ids } }, data: { activo } });
    return NextResponse.json({ updated: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
