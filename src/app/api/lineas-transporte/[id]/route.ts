import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';
import { clipGeometryToLanus } from '@/utils/geo';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const linea = await prisma.lineaTransporte.findUnique({ where: { id } });
    if (!linea) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    return NextResponse.json(linea);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  const { id } = await params;
  try {
    const body = await req.json();
    const data: any = {};

    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.numero !== undefined) data.numero = body.numero;
    if (body.color !== undefined) data.color = body.color;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.categoria !== undefined) data.categoria = body.categoria;
    if (body.subcategoria !== undefined) data.subcategoria = body.subcategoria;
    if (body.sentido !== undefined) data.sentido = body.sentido;
    if (body.activo !== undefined) data.activo = body.activo;

    if (body.datosGeo !== undefined) {
      let parsedGeo = typeof body.datosGeo === 'string' ? JSON.parse(body.datosGeo) : body.datosGeo;
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
      data.datosGeo = JSON.stringify(parsedGeo);
    } else if (body.sentido !== undefined) {
      // Sincronizar sentido dentro del JSON de datosGeo existente
      try {
        const current = await prisma.lineaTransporte.findUnique({ where: { id }, select: { datosGeo: true } });
        if (current?.datosGeo) {
          let parsedGeo = typeof current.datosGeo === 'string' ? JSON.parse(current.datosGeo) : current.datosGeo;
          const nextSentido = String(body.sentido || '').toUpperCase();
          if (parsedGeo.type === 'Feature') {
            parsedGeo.properties = { ...parsedGeo.properties, sentido: nextSentido, direction: nextSentido, _sentido: nextSentido };
          } else if (parsedGeo.type === 'FeatureCollection' && Array.isArray(parsedGeo.features)) {
            parsedGeo.features = parsedGeo.features.map((f: any) => ({
              ...f,
              properties: { ...f.properties, sentido: nextSentido, direction: nextSentido, _sentido: nextSentido }
            }));
          }
          data.datosGeo = JSON.stringify(parsedGeo);
        }
      } catch (e) {
        console.error('Error sincronizando datosGeo con sentido:', e);
      }
    }

    const linea = await prisma.lineaTransporte.update({ where: { id }, data });
    return NextResponse.json(linea);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  const { id } = await params;
  try {
    await prisma.lineaTransporte.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
