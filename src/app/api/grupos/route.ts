import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authGuard';
import { adminDc } from '@/lib/dataconnectAdmin';
import { listGrupos, createGrupo } from '@/lib/dataconnect-admin';

export async function GET() {
  try {
    const res = await listGrupos(adminDc);
    // Sort client side to match Prisma orderBy: { nombre: 'asc' }
    const grupos = res.data.grupos.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
    return NextResponse.json(grupos);
  } catch (error: any) {
    console.error('Error procesando GET /api/grupos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const { nombre, color } = body;
    
    const res = await createGrupo(adminDc, {
      nombre,
      color: color || '#10B981',
      visibilidad: 'PUBLIC',
      rolesPermitidos: []
    });
    
    return NextResponse.json({ id: res.data.grupo_insert.id, nombre, color });
  } catch (error: any) {
    console.error('Error procesando POST /api/grupos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
