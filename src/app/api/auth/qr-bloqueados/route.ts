import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function GET(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const bloqueados = await prisma.dispositivoBloqueado.findMany({
      orderBy: { creadoEn: 'desc' },
    });
    return NextResponse.json(bloqueados);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
