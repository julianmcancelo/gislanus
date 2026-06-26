import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  try {
    const solicitud = await prisma.solicitudDispositivo.findUnique({
      where: { id },
      select: { estado: true, customToken: true },
    });
    if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

    return NextResponse.json({ estado: solicitud.estado, customToken: solicitud.customToken });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
