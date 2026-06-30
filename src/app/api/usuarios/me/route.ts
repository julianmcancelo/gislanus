import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyIdToken } from '@/lib/firebaseAdmin';

export async function PATCH(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const decoded = await verifyIdToken(authHeader.slice(7));
  if (!decoded) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    const { nombre } = await req.json();
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.trim().length > 80) {
      return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
    }

    const updated = await prisma.usuario.update({
      where: { firebaseUid: decoded.uid },
      data: { nombre: nombre.trim() },
      select: { id: true, nombre: true, email: true, rol: true },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
