import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { uid, email, nombre } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'Faltan datos de usuario' }, { status: 400 });
    }

    // El super admin definido
    const SUPER_ADMIN_EMAIL = 'julianmcancelo@gmail.com';

    // Buscar si el usuario ya existe
    let usuario = await prisma.usuario.findUnique({
      where: { firebaseUid: uid },
    });

    if (!usuario) {
      // Intentar buscar por email (por si inició sesión con otro método)
      usuario = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuario) {
        // Actualizar el UID si no lo tenía bien
        usuario = await prisma.usuario.update({
          where: { email },
          data: { firebaseUid: uid },
        });
      }
    }

    if (!usuario) {
      // Crear el usuario nuevo
      const rolInicial = email.toLowerCase() === SUPER_ADMIN_EMAIL ? 'SUPER_ADMIN' : 'PENDIENTE';
      
      usuario = await prisma.usuario.create({
        data: {
          firebaseUid: uid,
          email,
          nombre: nombre || email.split('@')[0],
          rol: rolInicial,
        },
      });
    } else {
      // Si el usuario existe pero es el super admin y por alguna razón no tiene el rol, forzarlo
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL && usuario.rol !== 'SUPER_ADMIN') {
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: { rol: 'SUPER_ADMIN' },
        });
      }
    }

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Error sincronizando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
