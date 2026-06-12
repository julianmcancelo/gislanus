import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { requestNumber, applicantName, geoData, streets } = await req.json();

    if (!requestNumber || !applicantName || !geoData) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    const route = await prisma.transportRoute.create({
      data: {
        requestNumber,
        applicantName,
        geoData,
        streets,
      },
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transport route:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
