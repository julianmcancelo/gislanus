import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';
import { createCustomToken } from '@/lib/firebaseAdminFull';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  const { id } = await params;
  const { accion } = await req.json();

  if (!['aprobar', 'rechazar', 'bloquear'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }

  try {
    const solicitud = await prisma.solicitudDispositivo.findUnique({ where: { id } });
    if (!solicitud) return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });

    if (accion === 'bloquear') {
      if (solicitud.deviceFingerprint) {
        await prisma.dispositivoBloqueado.upsert({
          where: { fingerprint: solicitud.deviceFingerprint },
          create: { fingerprint: solicitud.deviceFingerprint, email: solicitud.email },
          update: {},
        });
      }
      await prisma.solicitudDispositivo.update({
        where: { id },
        data: { estado: 'BLOQUEADO', revisadoEn: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (accion === 'rechazar') {
      await prisma.solicitudDispositivo.update({
        where: { id },
        data: { estado: 'RECHAZADO', revisadoEn: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    // APROBAR: buscar o crear usuario en DB y generar custom token
    let usuario = await prisma.usuario.findUnique({ where: { email: solicitud.email } });
    if (!usuario) {
      // Crear usuario placeholder — se completará cuando haga su primer login real
      const uid = `qr_${solicitud.id}`;
      usuario = await prisma.usuario.create({
        data: {
          firebaseUid: uid,
          email: solicitud.email,
          nombre: solicitud.nombre,
          rol: 'USUARIO',
        },
      });
    }

    const customToken = await createCustomToken(usuario.firebaseUid);

    await prisma.solicitudDispositivo.update({
      where: { id },
      data: { estado: 'APROBADO', customToken, revisadoEn: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR']);
  if (guard.error) return guard.error;

  const { id } = await params;
  try {
    await prisma.solicitudDispositivo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
