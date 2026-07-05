import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authGuard';
import { adminDc } from '@/lib/dataconnectAdmin';
import { deleteGrupo, updateGrupo } from '@/lib/dataconnect-admin';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    await deleteGrupo(adminDc, { id });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error procesando DELETE /api/grupos/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = { id };
    if (body.nombre) updateData.nombre = body.nombre;
    if (body.color) updateData.color = body.color;

    const res = await updateGrupo(adminDc, updateData);
    return NextResponse.json({ id, ...updateData });
  } catch (error: any) {
    console.error('Error procesando PATCH /api/grupos/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
