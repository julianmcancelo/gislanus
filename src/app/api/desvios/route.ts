import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado'); // PLANIFICADO | EN_CURSO | FINALIZADO | etc.

    const where: any = {};
    if (estado && estado !== 'TODOS') {
      where.estado = estado;
    }

    const intervenciones = await prisma.intervencionVial.findMany({
      where,
      include: {
        desvios: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });

    return NextResponse.json(intervenciones, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error fetching intervenciones:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: Request) {
  const guard = await requirePermission(req, 'editarLineas');
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const {
      titulo,
      tipo,
      tipoCorte = 'TOTAL',
      motivo,
      areaResponsable,
      callesAfectadas,
      fechaInicio,
      fechaFinEstimada,
      estado = 'PLANIFICADO',
      datosGeo,
      desvios = [],
    } = body;

    if (!titulo || !tipo || !fechaInicio || !datosGeo) {
      return NextResponse.json(
        { error: 'Título, tipo, fecha de inicio y geometría del corte son obligatorios' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Generar código único para el corte (ej: CORTE-2026-0012)
    const year = new Date().getFullYear();
    const count = await prisma.intervencionVial.count();
    const codigo = `CORTE-${year}-${String(count + 1).padStart(4, '0')}`;

    const nuevaIntervencion = await prisma.intervencionVial.create({
      data: {
        codigo,
        titulo,
        tipo,
        tipoCorte,
        motivo,
        areaResponsable,
        callesAfectadas,
        fechaInicio: new Date(fechaInicio),
        fechaFinEstimada: fechaFinEstimada ? new Date(fechaFinEstimada) : null,
        estado,
        datosGeo: typeof datosGeo === 'string' ? datosGeo : JSON.stringify(datosGeo),
        creadoPorId: guard.user?.id || null,
        creadoPorNombre: guard.user?.email || null,
        desvios: {
          create: desvios.map((d: any) => ({
            lineaId: d.lineaId || null,
            lineaNumero: d.lineaNumero || '',
            ramal: d.ramal || null,
            sentido: d.sentido || 'IDA',
            datosGeoDesvio: typeof d.datosGeoDesvio === 'string' ? d.datosGeoDesvio : JSON.stringify(d.datosGeoDesvio || {}),
            callesDesvio: d.callesDesvio || null,
            paradasAnuladas: d.paradasAnuladas || null,
            paradasProvisorias: d.paradasProvisorias || null,
            activo: d.activo !== false,
          })),
        },
      },
      include: {
        desvios: true,
      },
    });

    return NextResponse.json(nuevaIntervencion, { status: 201, headers: corsHeaders });
  } catch (error: any) {
    console.error('Error creating intervencion vial:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
