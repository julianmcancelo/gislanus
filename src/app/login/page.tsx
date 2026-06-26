'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) {
    router.push('/');
    return null;
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      router.push('/');
    } catch {
      setError('Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Completá todos los campos.'); return; }
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      router.push('/');
    } catch {
      setError('Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0f172a', overflow: 'hidden' }}>

      {/* ── Left decorative panel ── */}
      <div style={{
        display: 'none',
        width: '50%',
        position: 'relative',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
      }} className="md-left-panel">
        <style>{`
          @media (min-width: 768px) { .md-left-panel { display: flex !important; } }
        `}</style>

        {/* grid bg */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(14,165,233,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div style={{ position: 'absolute', top: '25%', left: '30%', width: 240, height: 240, background: 'rgba(14,165,233,0.08)', borderRadius: '50%', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 180, height: 180, background: 'rgba(99,102,241,0.08)', borderRadius: '50%', filter: 'blur(60px)' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* abstract icon */}
          <div style={{
            margin: '0 auto 32px',
            width: 72, height: 72,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(14,165,233,0.3)',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <path d="M14 17.5h7M17.5 14v7"/>
            </svg>
          </div>

          <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 10 }}>
            Sistema de Gestión
          </h1>
          <p style={{ color: '#64748b', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 36 }}>
            Plataforma Interna · v2.0
          </p>

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

      {/* ── Right login panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 24,
          padding: '40px 40px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {/* mobile icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }} className="md-hide-icon">
            <style>{`@media (min-width: 768px) { .md-hide-icon { display: none !important; } }`}</style>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 17.5h7M17.5 14v7"/>
              </svg>
            </div>
          </div>

          <h2 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>
            Iniciar sesión
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 32 }}>
            Ingresá tus credenciales para continuar
          </p>

          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, textAlign: 'center' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  background: '#0f172a', border: '1px solid #334155', borderRadius: 12,
                  padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#0ea5e9')}
                onBlur={e => (e.target.style.borderColor = '#334155')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  background: '#0f172a', border: '1px solid #334155', borderRadius: 12,
                  padding: '12px 16px', color: '#f1f5f9', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#0ea5e9')}
                onBlur={e => (e.target.style.borderColor = '#334155')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                background: loading ? '#334155' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '13px 20px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#334155' }} />
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>o continuar con</span>
            <div style={{ flex: 1, height: 1, background: '#334155' }} />
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            disabled={loading}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#0f172a', border: '1px solid #334155', borderRadius: 12,
              padding: '12px 20px', color: '#cbd5e1', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'border-color 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = '#475569')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = '#334155')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          {/* QR access section */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>O escaneá para solicitar acceso</p>
            <div style={{ background: '#fff', padding: 10, borderRadius: 10, display: 'inline-block' }}>
              <QRCodeSVG
                value={typeof window !== 'undefined' ? `${window.location.origin}/qr` : '/qr'}
                size={100}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, color: '#334155', fontSize: 11 }}>
            Acceso restringido · Solo personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
