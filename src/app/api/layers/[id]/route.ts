import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const { name, color, geoData } = body;
    
    const { id } = await context.params;

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (color) dataToUpdate.color = color;
    if (geoData) dataToUpdate.geoData = typeof geoData === 'string' ? geoData : JSON.stringify(geoData);

    const updatedLayer = await prisma.layer.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedLayer);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update layer' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await prisma.layer.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete layer' }, { status: 500 });
  }
}
