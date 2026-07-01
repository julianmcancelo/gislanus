import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { verifyIdToken } from './firebaseAdmin';

type GuardResult =
  | { error: NextResponse; user?: never }
  | { user: { id: string; rol: string; email: string }; error?: never };

export async function requireRole(req: Request, allowedRoles: string[]): Promise<GuardResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const token = authHeader.slice(7);

  // Bypass mode for local development
  if (token === 'bypass-token' && process.env.NEXT_PUBLIC_BYPASS_FIREBASE === 'true' && process.env.NODE_ENV === 'development') {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'julianmcancelo@gmail.com';
    const user = await prisma.usuario.findUnique({
      where: { email: superAdminEmail },
      select: { id: true, rol: true, email: true },
    });
    if (user && allowedRoles.includes(user.rol)) return { user };
    return { error: NextResponse.json({ error: 'Sin permisos (bypass)' }, { status: 403 }) };
  }

  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  }

  const user = await prisma.usuario.findUnique({
    where: { firebaseUid: decoded.uid },
    select: { id: true, rol: true, email: true },
  });

  if (!user || !allowedRoles.includes(user.rol)) {
    return { error: NextResponse.json({ error: 'Sin permisos suficientes' }, { status: 403 }) };
  }

  return { user };
}

export async function requirePermission(req: Request, requiredPermission: keyof Omit<import('@prisma/client').RolPermisos, 'id' | 'rol'>): Promise<GuardResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const token = authHeader.slice(7);

  // Bypass mode for local development
  if (token === 'bypass-token' && process.env.NEXT_PUBLIC_BYPASS_FIREBASE === 'true' && process.env.NODE_ENV === 'development') {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'julianmcancelo@gmail.com';
    const user = await prisma.usuario.findUnique({
      where: { email: superAdminEmail },
      select: { id: true, rol: true, email: true },
    });
    if (user) return { user };
    return { error: NextResponse.json({ error: 'Sin permisos (bypass)' }, { status: 403 }) };
  }

  const decoded = await verifyIdToken(token);
  if (!decoded) {
    return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
  }

  const user = await prisma.usuario.findUnique({
    where: { firebaseUid: decoded.uid },
    select: { id: true, rol: true, email: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 }) };
  }

  if (user.rol === 'SUPER_ADMIN') {
    return { user };
  }

  const rolPermisos = await prisma.rolPermisos.findUnique({
    where: { rol: user.rol }
  });

  if (!rolPermisos || !rolPermisos[requiredPermission]) {
    return { error: NextResponse.json({ error: 'Sin permisos suficientes' }, { status: 403 }) };
  }

  return { user };
}
