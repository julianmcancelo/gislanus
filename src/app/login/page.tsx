'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const { loginWithEmail, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrEstado, setQrEstado] = useState<'cargando' | 'listo' | 'escaneado' | 'aprobado' | 'rechazado' | 'expirado'>('cargando');

  useEffect(() => {
    if (user) router.push('/bienvenida');
  }, [user, router]);

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
            router.push('/bienvenida');
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
      router.push('/bienvenida');
    } catch {
      setError('Credenciales incorrectas.');
    } finally {
      setLoadingEmail(false);
    }
  };

  const qrUrl = sessionId && typeof window !== 'undefined'
    ? `${window.location.origin}/qr?sid=${sessionId}`
    : null;

  const qrStateConfig = {
    cargando:  { label: 'Generando código...', color: '#94a3b8', dot: '#e2e8f0' },
    listo:     { label: 'Escaneá para acceder desde el móvil', color: '#64748b', dot: '#22c55e' },
    escaneado: { label: 'Esperando aprobación del administrador...', color: '#d97706', dot: '#f59e0b' },
    aprobado:  { label: 'Aprobado — iniciando sesión...', color: '#16a34a', dot: '#22c55e' },
    rechazado: { label: 'Acceso rechazado', color: '#dc2626', dot: '#ef4444' },
    expirado:  { label: 'Expirado — renovando código...', color: '#9333ea', dot: '#a855f7' },
  };
  const qCfg = qrStateConfig[qrEstado];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>

      {/* ── Top bar ── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', letterSpacing: '-0.3px' }}>GIS Lanús</span>
        <span style={{ marginLeft: 4, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Sistema de Información Geográfica</span>
      </header>

      {/* ── Content ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 900, display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* ── Login card ── */}
          <div style={{
            flex: 1, background: '#fff', borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            {/* Card header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
            }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                Iniciar sesión
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                Ingresá tus credenciales para acceder al sistema
              </p>
            </div>

            {/* Card body */}
            <div style={{ padding: '24px' }}>
              {error && (
                <div style={{
                  background: '#fef2f2', color: '#b91c1c',
                  border: '1px solid #fecaca', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, marginBottom: 18,
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #d1d5db', borderRadius: 8,
                      padding: '9px 12px', fontSize: 14, color: '#111827',
                      outline: 'none', background: '#fff',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#2563eb')}
                    onBlur={e => (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #d1d5db', borderRadius: 8,
                      padding: '9px 12px', fontSize: 14, color: '#111827',
                      outline: 'none', background: '#fff',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#2563eb')}
                    onBlur={e => (e.target.style.borderColor = '#d1d5db')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingEmail}
                  style={{
                    marginTop: 2,
                    background: loadingEmail ? '#93c5fd' : '#2563eb',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 20px', fontSize: 14, fontWeight: 600,
                    cursor: loadingEmail ? 'not-allowed' : 'pointer',
                    width: '100%', transition: 'background 0.15s',
                  }}
                >
                  {loadingEmail ? 'Verificando...' : 'Acceder'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>o</span>
                <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
              </div>

              <button
                onClick={async () => {
                  setLoadingGoogle(true); setError('');
                  try { await loginWithGoogle(); router.push('/bienvenida'); }
                  catch { setError('Error al iniciar sesión con Google.'); }
                  finally { setLoadingGoogle(false); }
                }}
                type="button"
                disabled={loadingGoogle || loadingEmail}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
                  padding: '9px 20px', color: '#374151', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fff'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {loadingGoogle ? 'Conectando...' : 'Continuar con Google'}
              </button>
            </div>

            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #f1f5f9',
              background: '#fafafa',
              fontSize: 11, color: '#9ca3af', textAlign: 'center',
            }}>
              Acceso restringido · Solo personal autorizado
            </div>
          </div>

          {/* ── QR card ── */}
          <div style={{
            width: 240, flexShrink: 0,
            background: '#fff', borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: qCfg.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Acceso móvil</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Escaneá el QR desde tu celular</p>
            </div>

            <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                position: 'relative',
                padding: 8, borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#fff',
                opacity: qrEstado === 'cargando' || qrEstado === 'expirado' ? 0.35 : 1,
                transition: 'opacity 0.3s',
              }}>
                {qrUrl
                  ? <QRCodeSVG value={qrUrl} size={120} bgColor="#ffffff" fgColor="#0f172a" />
                  : <div style={{ width: 120, height: 120, background: '#f1f5f9', borderRadius: 4 }} />
                }
                {(qrEstado === 'escaneado' || qrEstado === 'aprobado') && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 10,
                    background: 'rgba(248,250,252,0.88)', backdropFilter: 'blur(2px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                      stroke={qrEstado === 'aprobado' ? '#16a34a' : '#d97706'}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {qrEstado === 'aprobado'
                        ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                        : <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>
                      }
                    </svg>
                  </div>
                )}
              </div>

              <p style={{ margin: 0, fontSize: 11, color: qCfg.color, fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
                {qCfg.label}
              </p>

              {qrEstado === 'rechazado' && (
                <button onClick={crearSesion} style={{
                  background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
                  borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                }}>
                  Nuevo código
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        padding: '12px 32px', borderTop: '1px solid #e2e8f0',
        background: '#fff', fontSize: 11, color: '#9ca3af', textAlign: 'center',
      }}>
        GIS Lanús · Sistema de Información Geográfica
      </footer>
    </div>
  );
}
