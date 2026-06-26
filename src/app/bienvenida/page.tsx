'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function BienvenidaPage() {
  const { user, dbUser } = useAuth();
  const router = useRouter();
  const [fase, setFase] = useState<'entrada' | 'bienvenida' | 'cargando' | 'salida'>('entrada');
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    // Fade in
    const t1 = setTimeout(() => setFase('bienvenida'), 100);
    // Barra de progreso
    const t2 = setTimeout(() => setFase('cargando'), 800);
    // Animar progreso
    const t3 = setTimeout(() => setProgreso(30), 900);
    const t4 = setTimeout(() => setProgreso(65), 1400);
    const t5 = setTimeout(() => setProgreso(90), 2000);
    const t6 = setTimeout(() => setProgreso(100), 2600);
    // Salida
    const t7 = setTimeout(() => setFase('salida'), 2800);
    const t8 = setTimeout(() => router.replace('/'), 3300);

    return () => [t1,t2,t3,t4,t5,t6,t7,t8].forEach(clearTimeout);
  }, [router]);

  const nombre = dbUser?.nombre || user?.displayName || user?.email?.split('@')[0] || 'Usuario';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.03); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gridMove { from { transform: translateY(0); } to { transform: translateY(40px); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 30px rgba(14,165,233,0.2); } 50% { box-shadow: 0 0 60px rgba(14,165,233,0.5); } }
      `}</style>

      {/* Grid animado de fondo */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.06,
      }}>
        <div style={{
          position: 'absolute', inset: '-40px',
          backgroundImage: 'linear-gradient(rgba(14,165,233,1) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          animation: 'gridMove 3s linear infinite',
        }} />
      </div>

      {/* Blur orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '20%', width: 300, height: 300, background: 'rgba(14,165,233,0.07)', borderRadius: '50%', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '20%', width: 250, height: 250, background: 'rgba(99,102,241,0.07)', borderRadius: '50%', filter: 'blur(80px)' }} />

      {/* Contenido */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        animation: fase === 'salida' ? 'fadeOut 0.5s ease forwards' : fase === 'bienvenida' ? 'fadeIn 0.6s ease forwards' : 'none',
        opacity: fase === 'entrada' ? 0 : 1,
      }}>
        {/* Ícono */}
        <div style={{
          margin: '0 auto 28px',
          width: 80, height: 80,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'glow 2s ease infinite',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <path d="M14 17.5h7M17.5 14v7"/>
          </svg>
        </div>

        {/* Bienvenida */}
        <p style={{ color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Bienvenido
        </p>
        <h1 style={{ color: '#f1f5f9', fontSize: 32, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 4 }}>
          {nombre}
        </h1>
        <p style={{ color: '#475569', fontSize: 13, marginBottom: 40 }}>
          Sistema de Gestión · Plataforma Interna
        </p>

        {/* Barra de progreso */}
        <div style={{ width: 280, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 600 }}>
              {progreso < 40 ? 'Verificando acceso...' : progreso < 80 ? 'Cargando datos...' : 'Iniciando plataforma...'}
            </span>
            <span style={{ color: '#0ea5e9', fontSize: 11, fontWeight: 700 }}>{progreso}%</span>
          </div>
          <div style={{ height: 4, background: '#1e293b', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progreso}%`,
              background: 'linear-gradient(90deg, #0ea5e9, #6366f1)',
              borderRadius: 9999,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 0 10px rgba(14,165,233,0.5)',
            }} />
          </div>
        </div>

        {/* Puntos animados */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 28 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#334155',
              animation: `pulse 1.4s ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
