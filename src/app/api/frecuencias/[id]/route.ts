import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const frecuenciaSelect = {
  id: true,
  nombre: true,
  numero: true,
  color: true,
  categoria: true,
  subcategoria: true,
  sentido: true,
  descripcion: true,
  frecuenciaCalculada: true,
  frecuenciaEsperada: true,
  tiempoDemoraPromedio: true,
  ultimaInspeccion: true,
  inspectorId: true,
};

/**
 * GET /api/frecuencias/[id]
 * Obtener la frecuencia de una traza/ramal por ID
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const frecuencia = await prisma.lineaTransporte.findUnique({
      where: { id },
      select: frecuenciaSelect,
    });

    if (!frecuencia) {
      return NextResponse.json(
        { error: 'Frecuencia no encontrada' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ status: 'ok', data: frecuencia }, {
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('Error fetching frecuencia:', error?.message);
    return NextResponse.json(
      { error: error.message, status: 'error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/frecuencias/[id]
 * Actualizar frecuencia manualmente con validación de inspector
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission(req, 'editarLineas');
    if (guard.error) return guard.error;

    const { id } = await params;
    const body = await req.json();

    const data: any = { ultimaInspeccion: new Date() };
    if (body.frecuenciaCalculada !== undefined) data.frecuenciaCalculada = body.frecuenciaCalculada === null ? null : Number(body.frecuenciaCalculada);
    if (body.frecuenciaEsperada !== undefined) data.frecuenciaEsperada = body.frecuenciaEsperada === null ? null : Number(body.frecuenciaEsperada);
    if (body.tiempoDemoraPromedio !== undefined) data.tiempoDemoraPromedio = body.tiempoDemoraPromedio === null ? null : Number(body.tiempoDemoraPromedio);
    if (body.inspectorId !== undefined) data.inspectorId = body.inspectorId || null;
    if (body.observaciones !== undefined) data.descripcion = body.observaciones || null;

    const lineaActualizada = await prisma.lineaTransporte.update({
      where: { id },
      data,
      select: frecuenciaSelect,
    });

    return NextResponse.json({
      status: 'actualizado',
      linea: lineaActualizada,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error updating frecuencia:', error?.message);
    return NextResponse.json(
      { error: error.message, status: 'error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
