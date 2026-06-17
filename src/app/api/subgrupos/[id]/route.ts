import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { nombre, color, grupoId } = body;

    const data: any = {};
    if (nombre) data.nombre = nombre;
    if (color) data.color = color;
    if (grupoId) data.grupoId = grupoId;

    const subGrupo = await prisma.subGrupo.update({
      where: { id },
      data
    });

    return NextResponse.json(subGrupo);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update sub-grupo' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    await prisma.subGrupo.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'SubGrupo deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete sub-grupo' }, { status: 500 });
  }
}
