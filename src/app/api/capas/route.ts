import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const capas = await prisma.capa.findMany();
    return NextResponse.json(capas);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const isDryRun = url.searchParams.get('dryRun') === 'true';

    const body = await req.json();

    // If it's an array, validate each item (bulk create logic used in AdminPage)
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      const { name, type, color, geoData } = item;

      // Validate name
      if (!name || typeof name !== 'string' || name.length > 150) {
        return NextResponse.json({ error: 'Nombre inválido o demasiado largo' }, { status: 400 });
      }

      // Validate color
      const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i;
      if (color && !hexColorRegex.test(color)) {
        return NextResponse.json({ error: 'Color inválido. Debe ser hexadecimal.' }, { status: 400 });
      }

      // Validate geoData basic structure (just checking if it's parsable or an object)
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

    // Since AdminPage sends an array of items to create, handle bulk create
    if (Array.isArray(body)) {
      const createdCapas = [];
      for (const item of body) {
        const capa = await prisma.capa.create({
          data: {
            nombre: item.name,
            tipo: item.type || 'geojson',
            color: item.color || '#3388ff',
            datosGeo: typeof item.geoData === 'string' ? item.geoData : JSON.stringify(item.geoData),
          },
        });
        createdCapas.push(capa);
      }
      return NextResponse.json(createdCapas, { status: 201 });
    } else {
      // Single create fallback
      const capa = await prisma.capa.create({
        data: {
          nombre: body.name,
          tipo: body.type || 'geojson',
          color: body.color || '#3388ff',
          datosGeo: typeof body.geoData === 'string' ? body.geoData : JSON.stringify(body.geoData),
        },
      });
      return NextResponse.json(capa, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
