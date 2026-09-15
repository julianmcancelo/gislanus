import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

export async function POST(req: Request) {
  const authRes = await requirePermission(req, 'accesoAdmin');
  if (authRes.error) return authRes.error;

  const allowedOwnerEmails = ['jcancelo.dev@gmail.com', 'julianmcancelo@gmail.com'];
  if (!authRes.user || !allowedOwnerEmails.includes(authRes.user.email.toLowerCase())) {
    return NextResponse.json(
      { error: 'Acceso denegado. Solo jcancelo.dev@gmail.com tiene permisos para importar informacion GIS.' },
      { status: 403 }
    );
  }

  try {
    const payload = await req.json();
    const importData = payload.data || payload;

    if (!importData) {
      return NextResponse.json({ error: 'Estructura de archivo JSON invalida' }, { status: 400 });
    }

    let gruposImportados = 0;
    let subGruposImportados = 0;
    let capasImportadas = 0;
    let lineasImportadas = 0;
    let rutasImportadas = 0;
    let reclamosImportados = 0;

    if (Array.isArray(importData.grupos)) {
      for (const g of importData.grupos) {
        const { capas, subGrupos, ...gData } = g;
        // Buscar por id o por nombre por la restricción @unique de nombre
        const existing = await prisma.grupo.findFirst({
          where: {
            OR: [
              ...(gData.id ? [{ id: gData.id }] : []),
              ...(gData.nombre ? [{ nombre: gData.nombre }] : []),
            ]
          }
        });

        if (existing) {
          await prisma.grupo.update({
            where: { id: existing.id },
            data: {
              nombre: gData.nombre,
              color: gData.color,
              visibilidad: gData.visibilidad,
              rolesPermitidos: gData.rolesPermitidos || []
            },
          });
        } else {
          await prisma.grupo.create({
            data: {
              ...(gData.id ? { id: gData.id } : {}),
              nombre: gData.nombre,
              color: gData.color || '#10B981',
              visibilidad: gData.visibilidad || 'PUBLIC',
              rolesPermitidos: gData.rolesPermitidos || []
            },
          });
        }
        gruposImportados++;
      }
    }

    if (Array.isArray(importData.subGrupos)) {
      for (const sg of importData.subGrupos) {
        const { capas, grupo, ...sgData } = sg;
        if (sgData.grupoId) {
          const existingSg = sgData.id ? await prisma.subGrupo.findUnique({ where: { id: sgData.id } }) : null;
          if (existingSg) {
            await prisma.subGrupo.update({
              where: { id: existingSg.id },
              data: { nombre: sgData.nombre, color: sgData.color, grupoId: sgData.grupoId },
            });
          } else {
            await prisma.subGrupo.create({
              data: {
                ...(sgData.id ? { id: sgData.id } : {}),
                nombre: sgData.nombre,
                color: sgData.color || '#10B981',
                grupoId: sgData.grupoId
              },
            });
          }
          subGruposImportados++;
        }
      }
    }

    if (Array.isArray(importData.capas)) {
      for (const c of importData.capas) {
        const { grupo, subGrupo, ...cData } = c;
        const geoStr = typeof cData.datosGeo === 'object' ? JSON.stringify(cData.datosGeo) : (cData.datosGeo || '{}');
        await prisma.capa.upsert({
          where: {id: cData.id},
          update: {
            nombre: cData.nombre,
            tipo: cData.tipo || 'geojson',
            color: cData.color,
            icono: cData.icono,
            datosGeo: geoStr,
            visibilidad: cData.visibilidad,
            rolesPermitidos: cData.rolesPermitidos || [],
            grupoId: cData.grupoId || null,
            subGrupoId: cData.subGrupoId || null,
          },
          create: {
            id: cData.id,
            nombre: cData.nombre,
            tipo: cData.tipo || 'geojson',
            color: cData.color || '#10B981',
            icono: cData.icono,
            datosGeo: geoStr,
            visibilidad: cData.visibilidad || 'PUBLIC',
            rolesPermitidos: cData.rolesPermitidos || [],
            grupoId: cData.grupoId || null,
            subGrupoId: cData.subGrupoId || null,
          },
        });
        capasImportadas++;
      }
    }

    if (Array.isArray(importData.lineasTransporte)) {
      for (const l of importData.lineasTransporte) {
        const geoStr = typeof l.datosGeo === 'object' ? JSON.stringify(l.datosGeo) : (l.datosGeo || '{}');
        await prisma.lineaTransporte.upsert({
          where: {id: l.id},
          update: {nombre: l.nombre, numero: l.numero, color: l.color, descripcion: l.descripcion, categoria: l.categoria, subcategoria: l.subcategoria, sentido: l.sentido, activo: l.activo ?? true, datosGeo: geoStr },
          create: {id: l.id, nombre: l.nombre, numero: l.numero, color: l.color || '#E53E3E', descripcion: l.descripcion, categoria: l.categoria || 'NACIONAL', subcategoria: l.subcategoria, sentido: l.sentido, activo: l.activo ?? true, datosGeo: geoStr },
        });
        lineasImportadas++;
      }
    }

    if (Array.isArray(importData.rutasTransporte)) {
      for (const r of importData.rutasTransporte) {
        const geoStr = typeof r.datosGeo === 'object' ? JSON.stringify(r.datosGeo) : (r.datosGeo || '{}');
        await prisma.rutaTransporte.upsert({
          where: {id: r.id},
          update: {...r, datosGeo: geoStr},
          create: {...r, datosGeo: geoStr},
        });
        rutasImportadas++;
      }
    }

    return NextResponse.json({
      message: 'Importacin completada con xito',
      summary: {
        grupos: gruposImportados,
        subGrupos: subGruposImportados,
        capas: capasImportadas,
        lineas: lineasImportadas,
        rutas: rutasImportadas,
        reclamos: reclamosImportados,
      }
    });
  } catch (error: any) {
    console.error('Error importing GIS data:', error);
    return NextResponse.json( { error: error.message || 'Error al importar datos GIS' }, { status: 500 });
  }
}
