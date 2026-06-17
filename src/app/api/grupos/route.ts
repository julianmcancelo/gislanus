import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
