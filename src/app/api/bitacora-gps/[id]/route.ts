import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await prisma.relevamientoGPS.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json({ error: 'Relevamiento GPS no encontrado' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowedFields = [
      'lineaNumero',
      'ramal',
      'sentido',
      'interno',
      'patente',
      'chofer',
      'notas',
      'estado',
    ];

    const dataToUpdate: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        dataToUpdate[key] = body[key];
      }
    }

    if (dataToUpdate.sentido) {
      const s = dataToUpdate.sentido.toUpperCase();
      dataToUpdate.sentido = s.includes('VUELTA') ? 'VUELTA' : s.includes('IDA') ? 'IDA' : null;
    }

    const updated = await prisma.relevamientoGPS.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.relevamientoGPS.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
