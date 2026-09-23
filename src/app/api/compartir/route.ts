import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { titulo, descripcion, capasPermitidas, permitirReclamos } = body;

    if (!Array.isArray(capasPermitidas) || capasPermitidas.length === 0) {
      return NextResponse.json(
        { error: 'Debes seleccionar al menos 1 capa o recurso para compartir.' },
        { status: 400 }
      );
    }

    const token = crypto.randomBytes(16).toString('hex');

    let enlace;
    try {
      enlace = await prisma.enlaceCompartido.create({
        data: {
          token,
          titulo: titulo || 'Vista Personalizada GIS',
          descripcion: descripcion || null,
          capasPermitidas,
          permitirReclamos: Boolean(permitirReclamos),
        },
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
        enlace = await prisma.enlaceCompartido.create({
          data: {
            token,
            titulo: titulo || 'Vista Personalizada GIS',
            descripcion: descripcion || null,
            capasPermitidas,
            permitirReclamos: Boolean(permitirReclamos),
          },
        });
      } else {
        throw dbErr;
      }
    }

    return NextResponse.json({
      token: enlace.token,
      url: `/v/${enlace.token}`,
      id: enlace.id,
    });
  } catch (err: any) {
    console.error('Error al crear enlace compartido:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
