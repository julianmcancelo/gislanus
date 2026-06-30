'use client';
import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { escucharCambiosEstado, NotificacionEstado } from '@/lib/rtdb';

type Toast = NotificacionEstado & { key: string; id: number };

export default function NotificacionToast() {
  const { dbUser } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  useEffect(() => {
    if (!dbUser?.id) return;
    const unsub = escucharCambiosEstado(dbUser.id, (notif) => {
      const toast: Toast = { ...notif, id: ++nextId };
      setToasts(prev => [...prev, toast]);
      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 8000);
    });
    return unsub;
  }, [dbUser?.id]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 10,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {toasts.map(toast => {
        const aprobada = toast.nuevoEstado === 'APROBADA';
        return (
          <div key={toast.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: '#fff', border: `1px solid ${aprobada ? '#bbf7d0' : '#fecaca'}`,
            borderLeft: `4px solid ${aprobada ? '#16a34a' : '#dc2626'}`,
            borderRadius: 12, padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 300, maxWidth: 360,
            animation: 'slideIn 0.25s ease',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: aprobada ? '#dcfce7' : '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {aprobada
                ? <CheckCircle size={18} color="#16a34a" />
                : <XCircle size={18} color="#dc2626" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {aprobada ? 'Solicitud aprobada' : 'Solicitud rechazada'}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                Tu solicitud <strong style={{ color: '#374151' }}>#{toast.numeroSolicitud}</strong> fue{' '}
                <span style={{ fontWeight: 700, color: aprobada ? '#16a34a' : '#dc2626' }}>
                  {aprobada ? 'aprobada' : 'rechazada'}
                </span>{' '}por el administrador.
              </p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  );
}
