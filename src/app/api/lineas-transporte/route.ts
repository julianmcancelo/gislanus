import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';
import { clipGeometryToLanus } from '@/utils/geo';

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
        categoria: true,
        subcategoria: true,
        sentido: true,
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
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  try {
    const { nombre, numero, color, descripcion, categoria, subcategoria, sentido, datosGeo } = await req.json();

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

    if (parsedGeo.type === 'FeatureCollection') {
      parsedGeo.features = parsedGeo.features.map((f: any) => ({
        ...f,
        geometry: clipGeometryToLanus(f.geometry)
      }));
    } else if (parsedGeo.type === 'Feature') {
      parsedGeo.geometry = clipGeometryToLanus(parsedGeo.geometry);
    } else if (parsedGeo.type === 'LineString' || parsedGeo.type === 'MultiLineString') {
      parsedGeo = clipGeometryToLanus(parsedGeo);
    }

    const linea = await prisma.lineaTransporte.create({
      data: {
        nombre,
        numero: numero || null,
        color: color || '#E53E3E',
        descripcion: descripcion || null,
        categoria: categoria || 'NACIONAL',
        subcategoria: subcategoria || null,
        sentido: sentido || null,
        datosGeo: typeof datosGeo === 'string' ? datosGeo : JSON.stringify(datosGeo),
      },
    });

    return NextResponse.json(linea, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Bulk DELETE: { ids: string[] }
export async function DELETE(req: Request) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    await prisma.lineaTransporte.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ deleted: ids.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Bulk PATCH: { ids: string[], activo: boolean }
export async function PATCH(req: Request) {
  const guard = await requirePermission(req, 'editarLineas');
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

// Auto-pair duplicate Ida / Vuelta traces across the whole database
export async function PUT(req: Request) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  try {
    const all = await prisma.lineaTransporte.findMany({
      orderBy: [{ numero: 'asc' }, { id: 'asc' }]
    });

    const groups: Record<string, any[]> = {};
    all.forEach(l => {
      const key = `${l.categoria || 'NACIONAL'}-${l.numero || l.nombre}-${l.subcategoria || 'principal'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });

    let fixedCount = 0;
    for (const traces of Object.values(groups)) {
      if (traces.length === 2) {
        const [t1, t2] = traces;
        const s1 = (t1.sentido || '').toUpperCase();
        const s2 = (t2.sentido || '').toUpperCase();
        // If both are IDA, or both null, or identical sentidos
        if ((s1 === 'IDA' && s2 === 'IDA') || (!s1 && !s2) || (s1 === s2)) {
          await prisma.lineaTransporte.update({ where: { id: t1.id }, data: { sentido: 'IDA' } });
          await prisma.lineaTransporte.update({ where: { id: t2.id }, data: { sentido: 'VUELTA' } });
          fixedCount += 2;
        }
      }
    }

    return NextResponse.json({ fixedCount, message: `${fixedCount} trazas emparejadas correctamente como Ida y Vuelta.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

