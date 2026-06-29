import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const roles = await prisma.rolPermisos.findMany({
      orderBy: { rol: 'asc' }
    });
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const { id, rol, ...permisos } = data;

    if (!id || !rol) {
      return NextResponse.json({ error: 'Faltan datos requeridos (id, rol)' }, { status: 400 });
    }

    if (rol === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No se pueden modificar los permisos de SUPER_ADMIN' }, { status: 403 });
    }

    const updatedRole = await prisma.rolPermisos.update({
      where: { id },
      data: permisos
    });

    return NextResponse.json(updatedRole);
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
