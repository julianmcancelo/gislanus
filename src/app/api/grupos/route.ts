import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function GET() {
  try {
    const grupos = await prisma.grupo.findMany({
      orderBy: { nombre: 'asc' }
    });
    return NextResponse.json(grupos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const { nombre, color } = body;
    const grupo = await prisma.grupo.create({
      data: {
        nombre,
        color: color || '#10B981'
      }
    });
    return NextResponse.json(grupo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
