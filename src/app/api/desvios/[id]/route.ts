import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const intervencion = await prisma.intervencionVial.findUnique({
      where: { id },
      include: { desvios: true },
    });

    if (!intervencion) {
      return NextResponse.json({ error: 'Intervención vial no encontrada' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(intervencion, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    const body = await req.json();

    const dataToUpdate: any = {};
    if (body.estado !== undefined) dataToUpdate.estado = body.estado;
    if (body.titulo !== undefined) dataToUpdate.titulo = body.titulo;
    if (body.tipo !== undefined) dataToUpdate.tipo = body.tipo;
    if (body.tipoCorte !== undefined) dataToUpdate.tipoCorte = body.tipoCorte;
    if (body.motivo !== undefined) dataToUpdate.motivo = body.motivo;
    if (body.areaResponsable !== undefined) dataToUpdate.areaResponsable = body.areaResponsable;
    if (body.callesAfectadas !== undefined) dataToUpdate.callesAfectadas = body.callesAfectadas;
    if (body.fechaInicio !== undefined) dataToUpdate.fechaInicio = new Date(body.fechaInicio);
    if (body.fechaFinEstimada !== undefined) dataToUpdate.fechaFinEstimada = body.fechaFinEstimada ? new Date(body.fechaFinEstimada) : null;
    if (body.fechaFinReal !== undefined) dataToUpdate.fechaFinReal = body.fechaFinReal ? new Date(body.fechaFinReal) : null;
    if (body.datosGeo !== undefined) dataToUpdate.datosGeo = typeof body.datosGeo === 'string' ? body.datosGeo : JSON.stringify(body.datosGeo);

    const updated = await prisma.intervencionVial.update({
      where: { id },
      data: dataToUpdate,
      include: { desvios: true },
    });

    return NextResponse.json(updated, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  try {
    const { id } = await params;
    await prisma.intervencionVial.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, message: 'Intervención vial eliminada correctamente' }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
