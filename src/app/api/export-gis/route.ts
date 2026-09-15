import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

export async function GET(req: Request) {
  const authRes = await requirePermission(req, 'accesoAdmin');
  if (authRes.error) return authRes.error;

  try {
    const [grupos, subGrupos, capas, lineasTransporte, rutasTransporte, reclamos, usuarios, rolesPermisos] = await Promise.all([
      prisma.grupo.findMany({ include: { subGrupos: true } }),
      prisma.subGrupo.findMany(),
      prisma.capa.findMany(),
      prisma.lineaTransporte.findMany(),
      prisma.rutaTransporte.findMany(),
      prisma.reclamo.findMany(),
      prisma.usuario.findMany({ select: { id: true, email: true, nombre: true, rol: true, creadoEn: true } }),
      prisma.rolPermisos.findMany(),
    ]);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      summary: {
        gruposCount: grupos.length,
        subGruposCount: subGrupos.length,
        capasCount: capas.length,
        lineasCount: lineasTransporte.length,
        rutasCount: rutasTransporte.length,
        reclamosCount: reclamos.length,
        usuariosCount: usuarios.length,
      },
      data: {
        grupos,
        subGrupos,
        capas: capas.map(c => {
          let parsedGeo = c.datosGeo;
          try { if (typeof c.datosGeo === 'string') parsedGeo = JSON.parse(c.datosGeo); } catch {}
          return { ...c, datosGeo: parsedGeo };
        }),
        lineasTransporte: lineasTransporte.map(l => {
          let parsedGeo = l.datosGeo;
          try { if (typeof l.datosGeo === 'string') parsedGeo = JSON.parse(l.datosGeo); } catch {}
          return { ...l, datosGeo: parsedGeo };
        }),
        rutasTransporte: rutasTransporte.map(r => {
          let parsedGeo = r.datosGeo;
          try { if (typeof r.datosGeo === 'string') parsedGeo = JSON.parse(r.datosGeo); } catch {}
          return { ...r, datosGeo: parsedGeo };
        }),
        reclamos,
        usuarios,
        rolesPermisos,
      },
    };

    const fileName = `gislanus-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting GIS data:', error);
    return NextResponse.json({ error: 'Error al exportar datos de GIS' }, { status: 500 });
  }
}
