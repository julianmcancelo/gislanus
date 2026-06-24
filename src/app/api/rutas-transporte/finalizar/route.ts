import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { numeroSolicitud } = await req.json();

    if (!numeroSolicitud) {
      return NextResponse.json({ error: 'Falta el número de solicitud' }, { status: 400 });
    }

    const updated = await prisma.rutaTransporte.updateMany({
      where: {
        numeroSolicitud,
        estado: 'BORRADOR'
      },
      data: {
        estado: 'PENDIENTE'
      }
    });

    return NextResponse.json({ success: true, count: updated.count }, { status: 200 });
  } catch (error: any) {
    console.error('Error finalizando solicitud:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
