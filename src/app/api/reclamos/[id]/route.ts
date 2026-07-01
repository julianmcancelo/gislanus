import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission(req, 'editarReclamos');
    if (guard.error) return guard.error;

    const { id } = await params;
    const body = await req.json();
    const { estado, prioridad } = body;

    const data: any = {};
    if (estado !== undefined) data.estado = estado.toUpperCase();
    if (prioridad !== undefined) data.prioridad = prioridad.toUpperCase();

    const updated = await prisma.reclamo.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating reclamo:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el reclamo.', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission(req, 'editarReclamos');
    if (guard.error) return guard.error;

    const { id } = await params;

    await prisma.reclamo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Reclamo eliminado.' });
  } catch (error: any) {
    console.error('Error deleting reclamo:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el reclamo.', details: error.message },
      { status: 500 }
    );
  }
}
