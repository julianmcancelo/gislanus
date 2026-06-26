'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const { loginWithEmail, user } = useAuth();
  const router = useRouter();
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // QR session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrEstado, setQrEstado] = useState<'cargando' | 'listo' | 'escaneado' | 'aprobado' | 'rechazado' | 'expirado'>('cargando');

  if (user) { router.push('/'); return null; }

  const crearSesion = useCallback(async () => {
    setQrEstado('cargando');
    try {
      const res = await fetch('/api/auth/qr-session', { method: 'POST' });
      const data = await res.json();
      setSessionId(data.id);
      setQrEstado('listo');
    } catch {
      setQrEstado('cargando');
    }
  }, []);

  useEffect(() => { crearSesion(); }, [crearSesion]);

  // Polling QR
  useEffect(() => {
    if (!sessionId || qrEstado === 'aprobado' || qrEstado === 'cargando') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-session/${sessionId}?poll=1`);
        const data = await res.json();

        if (data.estado === 'ESCANEADO' && qrEstado === 'listo') {
          setQrEstado('escaneado');
        } else if (data.estado === 'APROBADO' && data.customToken) {
          clearInterval(interval);
          setQrEstado('aprobado');
          try {
            await signInWithCustomToken(auth, data.customToken);
            router.push('/');
          } catch {
            setError('Error al iniciar sesión con QR. Intentá de nuevo.');
            crearSesion();
          }
        } else if (data.estado === 'RECHAZADO') {
          clearInterval(interval);
          setQrEstado('rechazado');
          setTimeout(crearSesion, 3000);
        } else if (data.estado === 'EXPIRADO') {
          clearInterval(interval);
          setQrEstado('expirado');
          setTimeout(crearSesion, 1500);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, qrEstado, router, crearSesion]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Completá todos los campos.'); return; }
    setLoadingEmail(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      router.push('/');
    } catch {
      setError('Credenciales incorrectas.');
    } finally {
      setLoadingEmail(false);
    }
  };

  const qrUrl = sessionId && typeof window !== 'undefined'
    ? `${window.location.origin}/qr?sid=${sessionId}`
    : null;

  const qrLabel: Record<typeof qrEstado, string> = {
    cargando:  'Generando código...',
    listo:     'Escaneá para acceder',
    escaneado: 'Esperando aprobación...',
    aprobado:  'Aprobado — iniciando sesión...',
    rechazado: 'Acceso rechazado',
    expirado:  'Expirado — renovando...',
  };

  const qrColor: Record<typeof qrEstado, string> = {
    cargando:  '#475569',
    listo:     '#94a3b8',
    escaneado: '#f59e0b',
    aprobado:  '#22c55e',
    rechazado: '#f87171',
    expirado:  '#f97316',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a', overflow: 'hidden' }}>

      {/* ── Left panel ── */}
      <div style={{
        display: 'none',
        width: '50%',
        position: 'relative',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
      }} className="md-left-panel">
        <style>{`@media (min-width: 768px) { .md-left-panel { display: flex !important; } }`}</style>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(14,165,233,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div style={{ position: 'absolute', top: '25%', left: '30%', width: 240, height: 240, background: 'rgba(14,165,233,0.08)', borderRadius: '50%', filter: 'blur(70px)' }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ margin: '0 auto 32px', width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(14,165,233,0.3)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>
            </svg>
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 10 }}>Sistema de Gestión</h1>
          <p style={{ color: '#64748b', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 36 }}>Plataforma Interna · v2.0</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            {['Acceso seguro por roles', 'Datos centralizados en tiempo real', 'Gestión territorial integrada'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 13 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 24, padding: '40px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }} className="md-hide-icon">
            <style>{`@media (min-width: 768px) { .md-hide-icon { display: none !important; } }`}</style>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>
              </svg>
            </div>
          </div>

          <h2 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>Iniciar sesión</h2>
          <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 32 }}>Ingresá tus credenciales para continuar</p>

          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, textAlign: 'center' }}>{error}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Correo electrónico</label>
              <input type="email" placeholder="usuario@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#0ea5e9')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contraseña</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = '#0ea5e9')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <button type="submit" disabled={loadingEmail} style={{ marginTop: 4, background: loadingEmail ? '#334155' : 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: loadingEmail ? 'not-allowed' : 'pointer', opacity: loadingEmail ? 0.7 : 1 }}>
              {loadingEmail ? 'Verificando...' : 'Acceder'}
            </button>
          </form>

          {/* QR section */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <p style={{ color: '#475569', fontSize: 11, margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acceso por dispositivo móvil</p>

            <div style={{ position: 'relative', background: '#fff', padding: 10, borderRadius: 12, display: 'inline-block', opacity: qrEstado === 'cargando' || qrEstado === 'expirado' ? 0.4 : 1, transition: 'opacity 0.3s' }}>
              {qrUrl
                ? <QRCodeSVG value={qrUrl} size={110} bgColor="#ffffff" fgColor="#0f172a" />
                : <div style={{ width: 110, height: 110, background: '#e2e8f0', borderRadius: 4 }} />
              }
              {(qrEstado === 'escaneado' || qrEstado === 'aprobado') && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={qrEstado === 'aprobado' ? '#22c55e' : '#f59e0b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {qrEstado === 'aprobado'
                      ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                      : <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>
                    }
                  </svg>
                </div>
              )}
            </div>

            <p style={{ color: qrColor[qrEstado], fontSize: 12, margin: 0, fontWeight: 600 }}>
              {qrLabel[qrEstado]}
            </p>

            {qrEstado === 'rechazado' && (
              <button onClick={crearSesion} style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                Nuevo código
              </button>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, color: '#334155', fontSize: 11 }}>Acceso restringido · Solo personal autorizado</p>
        </div>
      </div>
    </div>
  );
}
