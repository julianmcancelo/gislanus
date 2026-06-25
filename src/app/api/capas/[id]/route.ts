import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const capa = await prisma.capa.findUnique({
      where: { id },
      select: { datosGeo: true }
    });

    if (!capa) {
      return NextResponse.json({ error: 'Capa no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ datosGeo: capa.datosGeo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    await prisma.capa.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const dataToUpdate: any = {};
    if (body.nombre !== undefined) dataToUpdate.nombre = body.nombre;
    if (body.color !== undefined) dataToUpdate.color = body.color;
    if (body.icono !== undefined) dataToUpdate.icono = body.icono;
    if (body.grupoId !== undefined) dataToUpdate.grupoId = body.grupoId;
    if (body.subGrupoId !== undefined) dataToUpdate.subGrupoId = body.subGrupoId;
    if (body.geoData) dataToUpdate.datosGeo = typeof body.geoData === 'string' ? body.geoData : JSON.stringify(body.geoData);

    const capaUpdate = await prisma.capa.update({
      where: { id },
      data: dataToUpdate
    });
    return NextResponse.json(capaUpdate);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
