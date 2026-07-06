import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authGuard';

export async function POST(req: Request) {
  const guard = await requireRole(req, ['SUPER_ADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VECINO', 'PENDIENTE']);
  if (guard.error) return guard.error;

  try {
    const { userId, text, image, senderId, senderName, senderRole } = await req.json();

    if (!userId || (!text && !image)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // 1. Obtener o crear la sesión de chat activa para este usuario
    let chat = await prisma.chatSoporte.findFirst({
      where: { usuarioId: userId, resuelto: false },
    });

    if (!chat) {
      chat = await prisma.chatSoporte.create({
        data: {
          usuarioId: userId,
          resuelto: false,
        },
      });
    }

    // 2. Crear el mensaje
    const nuevoMensaje = await prisma.mensajeSoporte.create({
      data: {
        chatId: chat.id,
        remitenteId: senderId,
        remitenteNombre: senderName,
        remitenteRol: senderRole,
        texto: text || '',
        imagen: image || null,
      },
    });

    return NextResponse.json(nuevoMensaje);
  } catch (error) {
    console.error('Error saving support message in Postgres:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
