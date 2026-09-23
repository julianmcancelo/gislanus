import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    const enlace = await prisma.enlaceCompartido.findUnique({
      where: { token },
    });

    if (!enlace) {
      return NextResponse.json({ error: 'Enlace no encontrado o expirado' }, { status: 404 });
    }

    if (enlace.expiraEn && new Date() > new Date(enlace.expiraEn)) {
      return NextResponse.json({ error: 'Este enlace ha expirado' }, { status: 410 });
    }

    return NextResponse.json(enlace);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
