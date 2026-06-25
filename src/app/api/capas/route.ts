import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

// Allow large GeoJSON uploads (up to 50MB)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const capas = await prisma.capa.findMany({
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        color: true,
        icono: true,
        grupoId: true,
        subGrupoId: true,
        creadoEn: true,
        actualizadoEn: true,
        visibilidad: true,
        rolesPermitidos: true,
        grupo: true,
        subGrupo: true
      }
    });
    return NextResponse.json(capas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dryRun') === 'true';

    const body = await req.json();

    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      const { name, type, color, geoData } = item;

      if (!name || typeof name !== 'string' || name.length > 150) {
        return NextResponse.json({ error: 'Nombre inválido o demasiado largo' }, { status: 400 });
      }

      const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i;
      if (color && !hexColorRegex.test(color)) {
        return NextResponse.json({ error: 'Color inválido. Debe ser hexadecimal.' }, { status: 400 });
      }

      if (!geoData) {
        return NextResponse.json({ error: 'Faltan datos geográficos' }, { status: 400 });
      }

      let parsedGeo;
      if (typeof geoData === 'string') {
        try {
          parsedGeo = JSON.parse(geoData);
        } catch {
          return NextResponse.json({ error: 'Datos geográficos no son un JSON válido' }, { status: 400 });
        }
      } else {
        parsedGeo = geoData;
      }

      if (!parsedGeo.type || (parsedGeo.type !== 'FeatureCollection' && parsedGeo.type !== 'Feature')) {
        return NextResponse.json({ error: 'Formato GeoJSON inválido' }, { status: 400 });
      }
    }

    if (isDryRun) {
      return NextResponse.json({ success: true, preview: true });
    }

    if (Array.isArray(body)) {
      const createdCapas = [];
      for (const item of body) {
        const capa = await prisma.capa.create({
          data: {
            nombre: item.name,
            tipo: item.type || 'geojson',
            color: item.color || '#3388ff',
            icono: item.icono || null,
            datosGeo: typeof item.geoData === 'string' ? item.geoData : JSON.stringify(item.geoData),
            grupoId: item.grupoId || null,
            subGrupoId: item.subGrupoId || null,
            visibilidad: item.visibilidad || 'PUBLIC',
            rolesPermitidos: item.rolesPermitidos || [],
          },
        });
        createdCapas.push(capa);
      }
      return NextResponse.json(createdCapas, { status: 201 });
    } else {
      const capa = await prisma.capa.create({
        data: {
          nombre: body.name,
          tipo: body.type || 'geojson',
          color: body.color || '#3388ff',
          icono: body.icono || null,
          datosGeo: typeof body.geoData === 'string' ? body.geoData : JSON.stringify(body.geoData),
          grupoId: body.grupoId || null,
          subGrupoId: body.subGrupoId || null,
          visibilidad: body.visibilidad || 'PUBLIC',
          rolesPermitidos: body.rolesPermitidos || [],
        },
      });
      return NextResponse.json(capa, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error procesando POST /api/capas:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
