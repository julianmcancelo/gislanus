'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type Estado = 'form' | 'enviando' | 'esperando' | 'aprobado' | 'rechazado' | 'bloqueado' | 'expirado' | 'error';

async function buildFingerprint(): Promise<{ hash: string; info: string }> {
  // GPU via WebGL
  let gpu = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
    }
  } catch {}

  // Canvas fingerprint
  let canvasFp = '';
  try {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 50;
    const ctx = c.getContext('2d')!;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60'; ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069'; ctx.font = '11pt Arial'; ctx.fillText('Llave', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.font = '18pt Arial'; ctx.fillText('QR', 4, 45);
    canvasFp = c.toDataURL().slice(-40);
  } catch {}

  const ua = navigator.userAgent;
  const signals = [
    ua,
    navigator.language,
    (navigator.languages || []).join(','),
    String(navigator.hardwareConcurrency || ''),
    String((navigator as any).deviceMemory || ''),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(new Date().getTimezoneOffset()),
    navigator.platform || '',
    String(navigator.maxTouchPoints || 0),
    gpu,
    canvasFp,
  ].join('|||');

  const encoded = new TextEncoder().encode(signals);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Info legible para el admin
  const model = ua.match(/\(([^)]+)\)/)?.[1]?.split(';').slice(0, 2).join(' ') || ua.slice(0, 60);
  const info = `${model} | ${screen.width}x${screen.height} | ${Intl.DateTimeFormat().resolvedOptions().timeZone} | GPU: ${gpu.slice(0, 40) || 'N/A'}`;

  return { hash, info };
}

const STORAGE_KEY = 'qr_identity';

function QrForm() {
  const params = useSearchParams();
  const sid = params.get('sid');

  const [estado, setEstado] = useState<Estado>('form');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  // Al montar: si ya tiene identidad guardada, enviar automáticamente
  useEffect(() => {
    if (!sid) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { nombre: n, email: em } = JSON.parse(saved);
        if (n && em) enviarSolicitud(n, em);
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  // Polling mientras espera
  useEffect(() => {
    if (estado !== 'esperando' || !sid) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-session/${sid}?poll=1`);
        const data = await res.json();
        if (data.estado === 'APROBADO') { clearInterval(interval); setEstado('aprobado'); }
        else if (data.estado === 'RECHAZADO') { clearInterval(interval); setEstado('rechazado'); }
        else if (data.estado === 'BLOQUEADO') { clearInterval(interval); setEstado('bloqueado'); }
        else if (data.estado === 'EXPIRADO') { clearInterval(interval); setEstado('expirado'); }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [estado, sid]);

  const enviarSolicitud = async (n: string, em: string) => {
    if (!sid) return;
    setEstado('enviando');
    setError('');

    const { hash, info } = await buildFingerprint();

    try {
      const res = await fetch(`/api/auth/qr-session/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'solicitar', nombre: n, email: em.toLowerCase(), deviceFingerprint: hash, deviceInfo: info }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.bloqueado) { setEstado('bloqueado'); return; }
        // Si el QR expiró u otro error, limpiar identidad y mostrar form
        setError(data.error || 'Error al enviar.');
        setEstado('form');
        return;
      }
      // Guardar identidad para próximas veces
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nombre: n, email: em }));
      setEstado('esperando');
    } catch {
      setError('Error de conexión.');
      setEstado('form');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) { setError('Completá todos los campos.'); return; }
    await enviarSolicitud(nombre.trim(), email.trim());
  };

  const s = {
    page: { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' } as React.CSSProperties,
    card: { background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 360, textAlign: 'center' as const },
    title: { color: '#f1f5f9', fontSize: 20, fontWeight: 800, marginBottom: 6 },
    sub: { color: '#64748b', fontSize: 13, marginBottom: 24 },
    label: { display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, textAlign: 'left' as const },
    input: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '11px 14px', color: '#f1f5f9', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 },
    btn: { width: '100%', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  };

  if (!sid) return (
    <div style={s.page}><div style={s.card}>
      <h2 style={{ ...s.title, color: '#f87171' }}>Código inválido</h2>
      <p style={s.sub}>Este QR no es válido. Escaneá el código desde la pantalla de login.</p>
    </div></div>
  );

  if (estado === 'enviando') return (
    <div style={s.page}><div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      <p style={s.sub}>Enviando...</p>
    </div></div>
  );

  if (estado === 'esperando') return (
    <div style={s.page}><div style={s.card}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
      </svg>
      <h2 style={s.title}>Solicitud enviada</h2>
      <p style={s.sub}>El administrador debe aprobar tu acceso.<br/>Podés cerrar esta pantalla.</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
      <p style={{ color: '#334155', fontSize: 11, marginTop: 20 }}>La sesión se abrirá en la computadora automáticamente.</p>
    </div></div>
  );

  if (estado === 'aprobado') return (
    <div style={s.page}><div style={s.card}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <h2 style={{ ...s.title, color: '#22c55e' }}>Acceso aprobado</h2>
      <p style={s.sub}>La sesión se abrió en la computadora.<br/>Podés cerrar esta pantalla.</p>
    </div></div>
  );

  if (estado === 'rechazado') return (
    <div style={s.page}><div style={s.card}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h2 style={{ ...s.title, color: '#f87171' }}>Acceso denegado</h2>
      <p style={s.sub}>Tu solicitud fue rechazada. Contactá al administrador.</p>
      <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setEstado('form'); setNombre(''); setEmail(''); }} style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
        Usar otra cuenta
      </button>
    </div></div>
  );

  if (estado === 'bloqueado') return (
    <div style={s.page}><div style={s.card}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
      <h2 style={{ ...s.title, color: '#f97316' }}>Dispositivo bloqueado</h2>
      <p style={s.sub}>Este dispositivo no tiene permiso de acceso.</p>
    </div></div>
  );

  if (estado === 'expirado') return (
    <div style={s.page}><div style={s.card}>
      <h2 style={{ ...s.title, color: '#f97316' }}>QR expirado</h2>
      <p style={s.sub}>El código QR venció. Pedile a quien necesita acceso que refresque la pantalla de login.</p>
    </div></div>
  );

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
        </div>
        <h2 style={s.title}>Verificar identidad</h2>
        <p style={s.sub}>Tu celular actúa como llave de acceso.<br/>Ingresá tus datos para que el admin apruebe.</p>

        <form onSubmit={handleSubmit}>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 14 }}>{error}</div>}
          <label style={s.label}>Nombre completo</label>
          <input style={s.input} type="text" placeholder="Ej: Juan Pérez" value={nombre} onChange={e => setNombre(e.target.value)} />
          <label style={s.label}>Correo electrónico</label>
          <input style={s.input} type="email" placeholder="usuario@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit" style={s.btn}>Confirmar identidad</button>
        </form>

        <p style={{ color: '#475569', fontSize: 11, marginTop: 20 }}>La sesión se abrirá en la computadora, no en este dispositivo.</p>
      </div>
    </div>
  );
}

export default function QrPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a' }} />}>
      <QrForm />
    </Suspense>
  );
}
