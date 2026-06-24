import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(req: Request, context: any) {
  try {
    const { id } = context.params;
    const body = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Falta ID' }, { status: 400 });
    }

    const { rol } = body;
    
    if (!rol) {
      return NextResponse.json({ error: 'Falta rol' }, { status: 400 });
    }

    const updatedUser = await prisma.usuario.update({
      where: { id },
      data: { rol },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
