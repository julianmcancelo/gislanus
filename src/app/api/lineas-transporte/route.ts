import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authGuard';
import { clipGeometryToLanus } from '@/utils/geo';
import { adminDc } from '@/lib/dataconnectAdmin';
import { listLineasTransporte, createLineaTransporte, deleteLineaTransporte, updateLineaTransporte } from '@/lib/dataconnect-admin';

export async function GET() {
  try {
    const res = await listLineasTransporte(adminDc);
    const lineas = res.data.lineaTransportes.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    
    // Map timestamps
    const mapped = lineas.map((l: any) => ({
      ...l,
      creadoEn: l.creadoEn ? new Date(l.creadoEn).toISOString() : null,
      actualizadoEn: l.actualizadoEn ? new Date(l.actualizadoEn).toISOString() : null,
    }));
    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error procesando GET /api/lineas-transporte:', error);
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

    const res = await createLineaTransporte(adminDc, {
      nombre,
      numero: numero || null,
      color: color || '#E53E3E',
      descripcion: descripcion || null,
      categoria: categoria || 'NACIONAL',
      subcategoria: subcategoria || null,
      sentido: sentido || null,
      datosGeo: typeof datosGeo === 'string' ? datosGeo : JSON.stringify(datosGeo),
    });

    return NextResponse.json({ id: res.data.lineaTransporte_insert.id }, { status: 201 });
  } catch (error: any) {
    console.error('Error creando linea de transporte:', error);
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
    for (const id of ids) {
      await deleteLineaTransporte(adminDc, { id });
    }
    return NextResponse.json({ deleted: ids.length });
  } catch (error: any) {
    console.error('Error bulk DELETE /api/lineas-transporte:', error);
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
    for (const id of ids) {
      await updateLineaTransporte(adminDc, { id, activo });
    }
    return NextResponse.json({ updated: ids.length });
  } catch (error: any) {
    console.error('Error bulk PATCH /api/lineas-transporte:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
