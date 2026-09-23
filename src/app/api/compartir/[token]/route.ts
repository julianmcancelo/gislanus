import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    let enlace;
    try {
      enlace = await prisma.enlaceCompartido.findUnique({
        where: { token },
      });
    } catch (dbErr: any) {
      if (dbErr.code === 'P2021' || dbErr.message?.includes('does not exist')) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS public."EnlaceCompartido" (
            id TEXT PRIMARY KEY,
            token TEXT UNIQUE NOT NULL,
            titulo TEXT NOT NULL DEFAULT 'Vista Personalizada GIS',
            descripcion TEXT,
            "capasPermitidas" TEXT[] NOT NULL DEFAULT '{}',
            "permitirReclamos" BOOLEAN NOT NULL DEFAULT false,
            "creadoPor" TEXT,
            "expiraEn" TIMESTAMP(3),
            "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        enlace = await prisma.enlaceCompartido.findUnique({
          where: { token },
        });
      } else {
        throw dbErr;
      }
    }

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
