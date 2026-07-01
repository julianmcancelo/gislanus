import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';

export async function POST(req: Request) {
  try {
    // Validar permisos del usuario (requiere permiso editarReclamos para guardar sincronizaciones)
    const guard = await requirePermission(req, 'editarReclamos');
    if (guard.error) return guard.error;

    const body = await req.json();
    let { reclamos, satToken } = body;

    // Si se provee satToken, el servidor de Next.js descarga los reclamos directamente (evitando bloqueos de CORS del navegador)
    if (satToken && (!reclamos || reclamos.length === 0)) {
      try {
        const response = await fetch('https://sat.lanus.gob.ar/apisat/v2/reclamos?limit=1000', {
          headers: {
            'Authorization': `Bearer ${satToken}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        reclamos = data.reclamos || data;
      } catch (e: any) {
        console.error('Error fetching claims from SAT in backend:', e);
        return NextResponse.json({ error: `Error al conectar con la API de SAT: ${e.message}` }, { status: 502 });
      }
    }

    if (!reclamos || !Array.isArray(reclamos)) {
      return NextResponse.json({ error: 'Se requiere una lista de reclamos o un token de sesión de SAT válido' }, { status: 400 });
    }

    let upsertedCount = 0;

    // Ejecutar upserts
    for (const item of reclamos) {
      if (!item.id || !item.lat || !item.lng) continue;

      const idStr = String(item.id);
      const numeroStr = item.numero || `REC-${idStr}`;
      const latVal = parseFloat(item.lat);
      const lngVal = parseFloat(item.lng);

      if (isNaN(latVal) || isNaN(lngVal)) continue;

      // Mapear campos anidados de la respuesta real del SAT
      const motivoId = item.motivo?.id ? parseInt(item.motivo.id) : (item.motivoId ? parseInt(item.motivoId) : 0);
      const motivoNombre = item.motivo?.nombre || item.motivoNombre || 'Otro';
      const ciudadano = item.vecino?.nombre || item.ciudadano || item.nombreCiudadano || null;
      const dniCiudadano = item.vecino?.dni ? String(item.vecino.dni) : (item.dniCiudadano ? String(item.dniCiudadano) : null);
      const estado = (item.estado || 'NUEVO').toUpperCase();
      const prioridad = (item.prioridad || 'MEDIA').toUpperCase();

      await prisma.reclamo.upsert({
        where: { id: idStr },
        update: {
          numero: numeroStr,
          titulo: item.titulo || motivoNombre || 'Reclamo',
          descripcion: item.descripcion || item.observaciones || item.detalle || null,
          estado: estado,
          prioridad: prioridad,
          lat: latVal,
          lng: lngVal,
          direccion: item.direccion || item.calle || null,
          ciudadano: ciudadano,
          dniCiudadano: dniCiudadano,
          fecha: item.fecha || item.fechaCreacion || item.creadoEn || null,
          motivoId: motivoId,
          motivoNombre: motivoNombre,
          canalEntrada: item.canalEntrada || item.origen || null,
        },
        create: {
          id: idStr,
          numero: numeroStr,
          titulo: item.titulo || motivoNombre || 'Reclamo',
          descripcion: item.descripcion || item.observaciones || item.detalle || null,
          estado: estado,
          prioridad: prioridad,
          lat: latVal,
          lng: lngVal,
          direccion: item.direccion || item.calle || null,
          ciudadano: ciudadano,
          dniCiudadano: dniCiudadano,
          fecha: item.fecha || item.fechaCreacion || item.creadoEn || null,
          motivoId: motivoId,
          motivoNombre: motivoNombre,
          canalEntrada: item.canalEntrada || item.origen || null,
        }
      });

      upsertedCount++;
    }

    return NextResponse.json({ success: true, count: upsertedCount });
  } catch (error: any) {
    console.error('Error syncing reclamos:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
