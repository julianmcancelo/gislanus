import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authGuard';
import { adminDc } from '@/lib/dataconnectAdmin';
import { listCapas, createCapa } from '@/lib/dataconnect-admin';

// Allow large GeoJSON uploads (up to 50MB)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function resolveUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const { verifyIdToken } = await import('@/lib/firebaseAdmin');
    const decoded = await verifyIdToken(authHeader.slice(7));
    if (!decoded) return null;
    
    // We would need to fetch the user from Firebase Data Connect, 
    // but for now we just return the decoded token and we'll check roles from it.
    // If we need roles, we should query them.
    const { getUsuario } = await import('@/lib/dataconnect-admin');
    const userRes = await getUsuario(adminDc, { firebaseUid: decoded.uid });
    return userRes.data.usuario;
  } catch { return null; }
}

export async function GET(req: Request) {
  const user = await resolveUser(req);
  const isAdmin = user && ['SUPER_ADMIN', 'ADMINISTRADOR'].includes(user.rol);

  try {
    const capasRes = await listCapas(adminDc);
    const capas = capasRes.data.capas;

    const filtradas = isAdmin
      ? capas
      : capas.filter((c: any) => {
          if (c.visibilidad === 'PRIVATE') return false;
          if (c.visibilidad === 'PUBLIC') return true;
          // RESTRICTED: solo si el usuario tiene el rol permitido
          return user != null && Array.isArray(c.rolesPermitidos) && c.rolesPermitidos.includes(user.rol);
        });

    // Transform DataConnect Timestamp to ISO String to match Prisma output
    const mapped = filtradas.map((c: any) => ({
      ...c,
      creadoEn: c.creadoEn ? new Date(c.creadoEn).toISOString() : null,
      actualizadoEn: c.actualizadoEn ? new Date(c.actualizadoEn).toISOString() : null,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error procesando GET /api/capas:', error);
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
        const res = await createCapa(adminDc, {
          nombre: item.name,
          tipo: item.type || 'geojson',
          color: item.color || '#3388ff',
          icono: item.icono || null,
          datosGeo: typeof item.geoData === 'string' ? item.geoData : JSON.stringify(item.geoData),
          grupoId: item.grupoId || null,
          subGrupoId: item.subGrupoId || null,
          visibilidad: item.visibilidad || 'PUBLIC',
          rolesPermitidos: item.rolesPermitidos || [],
        });
        createdCapas.push({ id: res.data.capa_insert.id });
      }
      return NextResponse.json(createdCapas, { status: 201 });
    } else {
      const res = await createCapa(adminDc, {
        nombre: body.name,
        tipo: body.type || 'geojson',
        color: body.color || '#3388ff',
        icono: body.icono || null,
        datosGeo: typeof body.geoData === 'string' ? body.geoData : JSON.stringify(body.geoData),
        grupoId: body.grupoId || null,
        subGrupoId: body.subGrupoId || null,
        visibilidad: body.visibilidad || 'PUBLIC',
        rolesPermitidos: body.rolesPermitidos || [],
      });
      return NextResponse.json({ id: res.data.capa_insert.id }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error procesando POST /api/capas:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
