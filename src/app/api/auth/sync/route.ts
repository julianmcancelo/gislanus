import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { uid, email, nombre } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'Faltan datos de usuario' }, { status: 400 });
    }

    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'julianmcancelo@gmail.com';

    // Asegurar que los roles básicos existan en la tabla RolPermisos
    const rolesBasicos = [
      { rol: 'SUPER_ADMIN', accesoAdmin: true, verCapas: true, editarCapas: true, verLineas: true, editarLineas: true, verRutas: true, editarRutas: true, verReclamos: true, editarReclamos: true, gestionarGrupos: true, gestionarUsuarios: true },
      { rol: 'ADMINISTRADOR', accesoAdmin: true, verCapas: true, editarCapas: true, verLineas: true, editarLineas: true, verRutas: true, editarRutas: true, verReclamos: true, editarReclamos: true, gestionarGrupos: true, gestionarUsuarios: false },
      { rol: 'OPERADOR', accesoAdmin: true, verCapas: true, editarCapas: false, verLineas: true, editarLineas: false, verRutas: true, editarRutas: false, verReclamos: true, editarReclamos: false, gestionarGrupos: false, gestionarUsuarios: false },
      { rol: 'CHOFER', accesoAdmin: false, verCapas: false, editarCapas: false, verLineas: false, editarLineas: false, verRutas: true, editarRutas: false, verReclamos: false, editarReclamos: false, gestionarGrupos: false, gestionarUsuarios: false },
      { rol: 'VECINO', accesoAdmin: false, verCapas: true, editarCapas: false, verLineas: true, editarLineas: false, verRutas: false, editarRutas: false, verReclamos: false, editarReclamos: false, gestionarGrupos: false, gestionarUsuarios: false },
      { rol: 'PENDIENTE', accesoAdmin: false, verCapas: false, editarCapas: false, verLineas: false, editarLineas: false, verRutas: false, editarRutas: false, verReclamos: false, editarReclamos: false, gestionarGrupos: false, gestionarUsuarios: false }
    ];

    for (const r of rolesBasicos) {
      const existe = await prisma.rolPermisos.findUnique({ where: { rol: r.rol } });
      if (!existe) {
        await prisma.rolPermisos.create({ data: r });
      }
    }

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

    // Obtener los permisos del rol del usuario
    const permisos = await prisma.rolPermisos.findUnique({
      where: { rol: usuario.rol }
    });

    return NextResponse.json({ ...usuario, permisos });
  } catch (error) {
    console.error('Error sincronizando usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
