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
