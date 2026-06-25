import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function GET(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { creadoEn: 'desc' },
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    console.error('Error fetching usuarios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
