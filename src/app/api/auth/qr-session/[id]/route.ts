import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';
import { createCustomToken } from '@/lib/firebaseAdminFull';

// PC polling: GET ?poll=1 (sin auth) | Admin: GET (con auth)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const isPoll = url.searchParams.get('poll') === '1';

  const sesion = await prisma.sesionQR.findUnique({ where: { id } });
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });

  // Expiración
  if (sesion.estado === 'PENDIENTE' && sesion.expiraEn < new Date()) {
    await prisma.sesionQR.update({ where: { id }, data: { estado: 'EXPIRADO' } });
    return NextResponse.json({ estado: 'EXPIRADO' });
  }

  if (isPoll) {
    return NextResponse.json({ estado: sesion.estado, customToken: sesion.customToken ?? undefined });
  }

  // Admin view completo
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;
  return NextResponse.json(sesion);
}

// Celular envía sus datos (accion: 'solicitar')
// Admin aprueba/rechaza/bloquea (accion: 'aprobar' | 'rechazar' | 'bloquear')
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { accion } = body;

  const sesion = await prisma.sesionQR.findUnique({ where: { id } });
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 });

  // Celular solicita — sin autenticación requerida
  if (accion === 'solicitar') {
    if (sesion.estado !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Esta sesión QR ya fue usada o expiró.' }, { status: 400 });
    }
    if (sesion.expiraEn < new Date()) {
      return NextResponse.json({ error: 'El código QR expiró. Pedí uno nuevo.' }, { status: 400 });
    }

    const fingerprint = body.deviceFingerprint || null;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

    // Verificar si el dispositivo está bloqueado
    if (fingerprint) {
      const bloqueado = await prisma.dispositivoBloqueado.findUnique({ where: { fingerprint } });
      if (bloqueado) return NextResponse.json({ bloqueado: true, error: 'Dispositivo bloqueado.' }, { status: 403 });
    }

    // Verificar si este dispositivo ya fue aprobado antes → auto-aprobar
    if (fingerprint) {
      const aprobadaAntes = await prisma.sesionQR.findFirst({
        where: { deviceFingerprint: fingerprint, estado: 'APROBADO' },
        orderBy: { revisadoEn: 'desc' },
      });

      if (aprobadaAntes?.email) {
        const emailAprobado = aprobadaAntes.email;
        let usuario = await prisma.usuario.findUnique({ where: { email: emailAprobado } });
        if (!usuario) {
          usuario = await prisma.usuario.create({
            data: { firebaseUid: `qr_${id}`, email: emailAprobado, nombre: aprobadaAntes.nombre || emailAprobado, rol: 'USUARIO' },
          });
        }
        let customToken: string;
        try {
          customToken = await createCustomToken(usuario.firebaseUid);
        } catch (e: any) {
          return NextResponse.json({ error: `Error generando token: ${e.message}` }, { status: 500 });
        }
        await prisma.sesionQR.update({
          where: { id },
          data: { estado: 'APROBADO', nombre: aprobadaAntes.nombre, email: emailAprobado, deviceFingerprint: fingerprint, deviceInfo: body.deviceInfo || null, ipCelular: ip, customToken, revisadoEn: new Date() },
        });
        return NextResponse.json({ ok: true, autoAprobado: true });
      }
    }

    // Dispositivo nuevo — espera aprobación del admin
    await prisma.sesionQR.update({
      where: { id },
      data: {
        estado: 'ESCANEADO',
        nombre: body.nombre,
        email: body.email?.toLowerCase(),
        deviceFingerprint: fingerprint,
        deviceInfo: body.deviceInfo || null,
        ipCelular: ip,
      },
    });
    return NextResponse.json({ ok: true, autoAprobado: false });
  }

  // Acciones de admin
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  if (accion === 'rechazar') {
    await prisma.sesionQR.update({ where: { id }, data: { estado: 'RECHAZADO', revisadoEn: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'bloquear') {
    if (sesion.deviceFingerprint) {
      await prisma.dispositivoBloqueado.upsert({
        where: { fingerprint: sesion.deviceFingerprint },
        create: { fingerprint: sesion.deviceFingerprint, email: sesion.email || undefined },
        update: {},
      });
    }
    await prisma.sesionQR.update({ where: { id }, data: { estado: 'BLOQUEADO', revisadoEn: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (accion === 'aprobar') {
    if (!sesion.email) return NextResponse.json({ error: 'La sesión no tiene email.' }, { status: 400 });

    let usuario = await prisma.usuario.findUnique({ where: { email: sesion.email } });
    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          firebaseUid: `qr_${id}`,
          email: sesion.email,
          nombre: sesion.nombre || sesion.email,
          rol: 'USUARIO',
        },
      });
    }

    let customToken: string;
    try {
      customToken = await createCustomToken(usuario.firebaseUid);
    } catch (e: any) {
      return NextResponse.json(
        { error: `No se pudo generar el token. Verificá FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY. Detalle: ${e.message}` },
        { status: 500 }
      );
    }

    await prisma.sesionQR.update({
      where: { id },
      data: { estado: 'APROBADO', customToken, revisadoEn: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  const { id } = await params;
  await prisma.sesionQR.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
