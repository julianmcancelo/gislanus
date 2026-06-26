import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitirCambioMapa } from '@/lib/rtdb';

export async function POST(req: Request) {
  try {
    const { nombre, email, deviceFingerprint, deviceInfo, ipAddress } = await req.json();

    if (!nombre?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nombre y email son requeridos.' }, { status: 400 });
    }

    // Check if device is blocked
    if (deviceFingerprint) {
      const bloqueado = await prisma.dispositivoBloqueado.findUnique({
        where: { fingerprint: deviceFingerprint },
      });
      if (bloqueado) {
        return NextResponse.json({ error: 'Este dispositivo ha sido bloqueado.', bloqueado: true }, { status: 403 });
      }
    }

    const solicitud = await prisma.solicitudDispositivo.create({
      data: {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        deviceFingerprint: deviceFingerprint || null,
        deviceInfo: deviceInfo || null,
        ipAddress: ipAddress || null,
      },
    });

    // Notify admins via RTDB
    try {
      await emitirCambioMapa('qr_solicitudes' as any);
    } catch {}

    return NextResponse.json({ solicitudId: solicitud.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const solicitudes = await prisma.solicitudDispositivo.findMany({
      orderBy: { creadoEn: 'desc' },
    });
    return NextResponse.json(solicitudes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
