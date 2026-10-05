import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/frecuencias
 * Listar líneas de transporte con sus frecuencias calculadas y demoras.
 * Filtros: search (nombre/número/ramal), categoria, inspector
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoria = searchParams.get('categoria') || '';
    const inspector = searchParams.get('inspector') || '';
    const soloInspeccionadas = searchParams.get('inspeccionadas') === '1';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = { activo: true };
    if (categoria && categoria !== 'TODAS') {
      where.categoria = { equals: categoria.toUpperCase() };
    }
    if (inspector) {
      where.inspectorId = inspector;
    }
    if (soloInspeccionadas) {
      where.frecuenciaCalculada = { not: null };
    }
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { numero: { contains: search, mode: 'insensitive' } },
        { subcategoria: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      prisma.lineaTransporte.findMany({
        where,
        orderBy: [{ numero: 'asc' }, { nombre: 'asc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          nombre: true,
          numero: true,
          color: true,
          categoria: true,
          subcategoria: true,
          sentido: true,
          frecuenciaCalculada: true,
          frecuenciaEsperada: true,
          tiempoDemoraPromedio: true,
          ultimaInspeccion: true,
          inspectorId: true,
        },
      }),
      prisma.lineaTransporte.count({ where }),
    ]);

    return NextResponse.json({ items, totalCount, status: 'ok' }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error fetching frecuencias:', error?.message);
    return NextResponse.json(
      { error: error.message, status: 'error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/frecuencias
 * Recibir datos de inspección humana y calcular frecuencias reales.
 *
 * Cuerpo:
 * {
 *   lineaId: string,              // ID de LineaTransporte (traza/ramal)
 *   inspectorId?: string,
 *   vehiculosObservados: number,  // vehículos vistos
 *   tiempoTranscurrido: number,   // minutos de observación
 *   horaProgramada?: string,      // "HH:MM" o decimal
 *   horaLlegadaReal?: string,     // "HH:MM" o decimal
 *   atrasos?: number,             // cantidad de retrasos observados
 *   frecuenciaEsperada?: number,  // programada (viajes/hora), opcional
 *   observaciones?: string
 * }
 */
export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400, headers: corsHeaders });
    }

    const {
      lineaId,
      inspectorId,
      vehiculosObservados,
      tiempoTranscurrido,
      horaProgramada,
      horaLlegadaReal,
      atrasos,
      frecuenciaEsperada,
      observaciones,
    } = body;

    if (!lineaId || vehiculosObservados === undefined || tiempoTranscurrido === undefined) {
      return NextResponse.json(
        { error: 'Datos incompletos: lineaId, vehiculosObservados y tiempoTranscurrido son obligatorios' },
        { status: 400, headers: corsHeaders }
      );
    }

    const toMinutes = (v: any): number | null => {
      if (v === undefined || v === null || v === '') return null;
      const s = String(v).trim();
      if (s.includes(':')) {
        const [h, m] = s.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
      }
      const n = parseFloat(s);
      return isNaN(n) ? null : n * 60;
    };

    const horasObservadas = Math.max(Number(tiempoTranscurrido), 1) / 60;
    const frecuenciaReal = Number((Number(vehiculosObservados) / horasObservadas).toFixed(2));

    const progMin = toMinutes(horaProgramada);
    const realMin = toMinutes(horaLlegadaReal);
    const tiempoDemora = progMin !== null && realMin !== null ? Math.round(realMin - progMin) : 0;

    const nAtrasos = Number(atrasos || 0);
    const promedioDemora = nAtrasos > 0 ? Math.round(Math.abs(tiempoDemora) / nAtrasos) : Math.abs(tiempoDemora);

    const lineaActualizada = await prisma.lineaTransporte.update({
      where: { id: lineaId },
      data: {
        frecuenciaCalculada: frecuenciaReal,
        ...(frecuenciaEsperada !== undefined && frecuenciaEsperada !== null && frecuenciaEsperada !== ''
          ? { frecuenciaEsperada: Number(frecuenciaEsperada) }
          : {}),
        tiempoDemoraPromedio: promedioDemora,
        ultimaInspeccion: new Date(),
        ...(inspectorId ? { inspectorId: String(inspectorId) } : {}),
        ...(observaciones ? { descripcion: String(observaciones) } : {}),
      },
      select: {
        id: true,
        nombre: true,
        numero: true,
        frecuenciaCalculada: true,
        frecuenciaEsperada: true,
        tiempoDemoraPromedio: true,
        ultimaInspeccion: true,
        inspectorId: true,
      },
    });

    return NextResponse.json({
      status: 'calculado',
      frecuenciaReal,
      tiempoDemoraMinutos: tiempoDemora,
      promedioDemoraPorAtraso: promedioDemora,
      vehiculosObservados: Number(vehiculosObservados),
      tiempoTranscurridoMin: Number(tiempoTranscurrido),
      lineaActualizada,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error in POST /api/frecuencias:', error?.message);
    return NextResponse.json(
      { error: error.message, status: 'error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
