import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const subgrupos = await prisma.subGrupo.findMany({
      include: {
        grupo: true
      }
    });
    return NextResponse.json(subgrupos);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch sub-grupos' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, color, grupoId } = body;

    if (!nombre || !grupoId) {
      return NextResponse.json({ error: 'Nombre and grupoId are required' }, { status: 400 });
    }

    const newSubGrupo = await prisma.subGrupo.create({
      data: {
        nombre,
        color: color || '#10B981',
        grupoId
      }
    });

    return NextResponse.json(newSubGrupo, { status: 201 });
  } catch (error) {
    console.error("Error creating SubGrupo:", error);
    return NextResponse.json({ error: 'Failed to create sub-grupo' }, { status: 500 });
  }
}
