import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Falta ID' }, { status: 400 });
    }

    const { rol } = body;

    if (!rol) {
      return NextResponse.json({ error: 'Falta rol' }, { status: 400 });
    }

    const usuarioDestino = await prisma.usuario.findUnique({
      where: { id },
      select: { rol: true }
    });

    if (!usuarioDestino) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const esSuperAdmin = guard.user.rol === 'SUPER_ADMIN';

    if (rol === 'SUPER_ADMIN' && !esSuperAdmin) {
      return NextResponse.json({ error: 'Solo un SUPER_ADMIN puede asignar el rol de SUPER_ADMIN' }, { status: 403 });
    }

    if (usuarioDestino.rol === 'SUPER_ADMIN' && !esSuperAdmin) {
      return NextResponse.json({ error: 'Solo un SUPER_ADMIN puede modificar a otro SUPER_ADMIN' }, { status: 403 });
    }

    const updatedUser = await prisma.usuario.update({
      where: { id },
      data: { rol },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
