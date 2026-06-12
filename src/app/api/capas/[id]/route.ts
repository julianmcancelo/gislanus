import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.capa.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Solo actualizamos los campos que nos manden
    const updateData: any = {};
    if (body.nombre) updateData.nombre = body.nombre;
    if (body.color) updateData.color = body.color;
    if (body.geoData) updateData.datosGeo = typeof body.geoData === 'string' ? body.geoData : JSON.stringify(body.geoData);

    const updated = await prisma.capa.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
