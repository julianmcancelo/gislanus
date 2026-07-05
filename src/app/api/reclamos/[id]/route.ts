import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authGuard';
import { adminDc } from '@/lib/dataconnectAdmin';
import { updateReclamo, deleteReclamo } from '@/lib/dataconnect-admin';

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

    const data: any = { id };
    if (estado !== undefined) data.estado = estado.toUpperCase();
    if (prioridad !== undefined) data.prioridad = prioridad.toUpperCase();

    const res = await updateReclamo(adminDc, data);

    return NextResponse.json(res.data.reclamo_update);
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

    await deleteReclamo(adminDc, { id });

    return NextResponse.json({ success: true, message: 'Reclamo eliminado.' });
  } catch (error: any) {
    console.error('Error deleting reclamo:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el reclamo.', details: error.message },
      { status: 500 }
    );
  }
}
