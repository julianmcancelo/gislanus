'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type Estado = 'form' | 'esperando' | 'aprobado' | 'rechazado' | 'bloqueado' | 'error';

export default function QrSolicitudPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>('form');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Polling while waiting for admin approval
  useEffect(() => {
    if (estado !== 'esperando' || !solicitudId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-status?id=${solicitudId}`);
        const data = await res.json();

        if (data.estado === 'APROBADO' && data.customToken) {
          clearInterval(interval);
          setEstado('aprobado');
          try {
            await signInWithCustomToken(auth, data.customToken);
            setTimeout(() => router.push('/'), 1500);
          } catch {
            setEstado('error');
            setError('Error al iniciar sesión. Contactá al administrador.');
          }
        } else if (data.estado === 'RECHAZADO') {
          clearInterval(interval);
          setEstado('rechazado');
        } else if (data.estado === 'BLOQUEADO') {
          clearInterval(interval);
          setEstado('bloqueado');
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [estado, solicitudId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) { setError('Completá todos los campos.'); return; }
    setLoading(true);
    setError('');

    // Get browser fingerprint
    let fingerprint: string | null = null;
    try {
      const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      fingerprint = result.visitorId;
    } catch {}

    const deviceInfo = `${navigator.userAgent} | ${screen.width}x${screen.height} | ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

    try {
      const res = await fetch('/api/auth/qr-solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          deviceFingerprint: fingerprint,
          deviceInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.bloqueado) { setEstado('bloqueado'); return; }
        setError(data.error || 'Error al enviar la solicitud.');
        return;
      }
      setSolicitudId(data.solicitudId);
      setEstado('esperando');
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 380, textAlign: 'center' as const },
    title: { color: '#f1f5f9', fontSize: 20, fontWeight: 800, marginBottom: 6 },
    sub: { color: '#64748b', fontSize: 13, marginBottom: 28 },
    label: { display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, textAlign: 'left' as const },
    input: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '11px 14px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 },
    btn: { width: '100%', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
    icon: { fontSize: 48, marginBottom: 16 },
  };

  if (estado === 'esperando') return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ ...s.icon }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h2 style={s.title}>Solicitud enviada</h2>
        <p style={{ ...s.sub, marginBottom: 0 }}>Esperando aprobación del administrador...</p>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
      </div>
    </div>
  );

  if (estado === 'aprobado') return (
    <div style={s.page}>
      <div style={s.card}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h2 style={{ ...s.title, color: '#22c55e' }}>Acceso aprobado</h2>
        <p style={s.sub}>Ingresando al sistema...</p>
      </div>
    </div>
  );

  if (estado === 'rechazado') return (
    <div style={s.page}>
      <div style={s.card}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h2 style={{ ...s.title, color: '#f87171' }}>Acceso denegado</h2>
        <p style={s.sub}>Tu solicitud fue rechazada. Contactá al administrador.</p>
        <button style={{ ...s.btn, background: '#334155' }} onClick={() => setEstado('form')}>Intentar de nuevo</button>
      </div>
    </div>
  );

  if (estado === 'bloqueado') return (
    <div style={s.page}>
      <div style={s.card}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        <h2 style={{ ...s.title, color: '#f97316' }}>Dispositivo bloqueado</h2>
        <p style={s.sub}>Este dispositivo no tiene permiso de acceso.</p>
      </div>
    </div>
  );

  if (estado === 'error') return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={{ ...s.title, color: '#f87171' }}>Error</h2>
        <p style={s.sub}>{error}</p>
        <button style={{ ...s.btn, background: '#334155' }} onClick={() => { setEstado('form'); setError(''); }}>Volver</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/>
          </svg>
        </div>
        <h2 style={s.title}>Solicitar acceso</h2>
        <p style={s.sub}>Completá tus datos para que el administrador apruebe tu acceso.</p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 14 }}>
              {error}
            </div>
          )}
          <label style={s.label}>Nombre completo</label>
          <input style={s.input} type="text" placeholder="Ej: Juan Pérez" value={nombre} onChange={e => setNombre(e.target.value)} />
          <label style={s.label}>Correo electrónico</label>
          <input style={s.input} type="email" placeholder="usuario@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Enviando...' : 'Solicitar acceso'}
          </button>
        </form>

        <p style={{ color: '#475569', fontSize: 11, marginTop: 20 }}>Acceso restringido · Solo personal autorizado</p>
      </div>
    </div>
  );
}
