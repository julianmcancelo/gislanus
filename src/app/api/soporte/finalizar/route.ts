import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function POST(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR', 'OPERADOR']);
  if (guard.error) return guard.error;

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Falta userId' }, { status: 400 });
    }

    // Marcar como resueltos todos los chats activos de este usuario
    await prisma.chatSoporte.updateMany({
      where: { usuarioId: userId, resuelto: false },
      data: { resuelto: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error closing support session in Postgres:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
