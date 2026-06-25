import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    await prisma.grupo.delete({
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

    const updateData: any = {};
    if (body.nombre) updateData.nombre = body.nombre;
    if (body.color) updateData.color = body.color;

    const updated = await prisma.grupo.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
