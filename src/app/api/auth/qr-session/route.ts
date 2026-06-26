import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

// PC crea una sesión QR nueva
export async function POST() {
  const expiraEn = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
  const sesion = await prisma.sesionQR.create({
    data: { expiraEn },
  });
  return NextResponse.json({ id: sesion.id });
}

// Admin lista todas las sesiones
export async function GET(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  const sesiones = await prisma.sesionQR.findMany({
    orderBy: { creadoEn: 'desc' },
    take: 50,
  });
  return NextResponse.json(sesiones);
}
