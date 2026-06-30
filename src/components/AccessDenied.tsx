'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldOff, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  mensaje?: string;
  rolRequerido?: string;
}

export default function AccessDenied({ mensaje, rolRequerido }: AccessDeniedProps) {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: '48px 40px',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <ShieldOff size={30} color="#dc2626" />
        </div>

        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
          Acceso restringido
        </h2>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
          {mensaje || 'No tenés los permisos necesarios para ver esta sección.'}
        </p>
        {rolRequerido && (
          <p style={{ margin: '0 0 28px', fontSize: 13, color: '#94a3b8' }}>
            Rol requerido: <strong style={{ color: '#475569' }}>{rolRequerido}</strong>
          </p>
        )}
        {!rolRequerido && <div style={{ marginBottom: 28 }} />}

        <button
          onClick={() => router.push('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 20px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
          <ArrowLeft size={15} /> Volver al mapa
        </button>
      </div>
    </div>
  );
}
