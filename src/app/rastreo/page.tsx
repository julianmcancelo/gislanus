'use client';
import React, { useState, useEffect, useRef } from 'react';
import { publicarPosicion, detenerTracking } from '@/lib/rtdb';
import { useAuth } from '@/context/AuthContext';
import AccessDenied from '@/components/AccessDenied';
import { Loader2 } from 'lucide-react';

const INTERVAL_MS = 5000; // publicar cada 5 segundos

const ROLES_RASTREO = ['SUPER_ADMIN', 'ADMINISTRADOR', 'OPERADOR', 'CHOFER'];

export default function RastreoPage() {
  const { user, dbUser, loading } = useAuth();
  const [activo, setActivo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [ultimaPos, setUltimaPos] = useState<{ lat: number; lng: number; vel?: number } | null>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<any>(null);

  // Pre-fill name from user
  useEffect(() => {
    if (dbUser?.email && !nombre) setNombre(dbUser.email.split('@')[0]);
    if (user?.uid && !vehiculoId) setVehiculoId(user.uid.slice(0, 8));
  }, [dbUser, user]);

  const publicar = () => {
    if (!navigator.geolocation) { setError('Tu navegador no soporta geolocalización.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed } = pos.coords;
        const vel = speed != null ? Math.round(speed * 3.6) : undefined; // m/s → km/h
        publicarPosicion(vehiculoId, { nombre, vehiculoId, lat, lng, velocidad: vel, activo: true });
        setUltimaPos({ lat, lng, vel });
        setError('');
      },
      (err) => setError(`Error GPS: ${err.message}`),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const iniciar = () => {
    if (!nombre.trim() || !vehiculoId.trim()) { setError('Completá el nombre y el ID del vehículo.'); return; }
    setActivo(true);
    publicar();
    intervalRef.current = setInterval(publicar, INTERVAL_MS);
  };

  const detener = () => {
    setActivo(false);
    clearInterval(intervalRef.current);
    detenerTracking(vehiculoId);
    setUltimaPos(null);
  };

  useEffect(() => () => { clearInterval(intervalRef.current); }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <Loader2 className="animate-spin" size={40} color="#60a5fa" />
      </div>
    );
  }

  if (!dbUser || !ROLES_RASTREO.includes(dbUser.rol)) {
    return <AccessDenied mensaje="Solo choferes y operadores pueden usar el módulo de rastreo GPS." rolRequerido="CHOFER / OPERADOR" />;
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: '#0f172a', padding: '24px',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: '16px', padding: '36px',
        maxWidth: '440px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
          📡 Rastreo en Vivo
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '28px' }}>
          Tu posición GPS se publicará en el mapa en tiempo real.
        </p>

        <label style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
          Nombre / Chofer
        </label>
        <input
          disabled={activo}
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Juan García"
          style={inputStyle}
        />

        <label style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'block', marginBottom: '4px', marginTop: '14px' }}>
          ID de Vehículo
        </label>
        <input
          disabled={activo}
          value={vehiculoId}
          onChange={e => setVehiculoId(e.target.value)}
          placeholder="unidad-27"
          style={inputStyle}
        />

        {error && (
          <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '12px', background: '#450a0a', padding: '8px 12px', borderRadius: '6px' }}>
            {error}
          </p>
        )}

        {ultimaPos && (
          <div style={{ marginTop: '16px', background: '#0f172a', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <div>📍 {ultimaPos.lat.toFixed(6)}, {ultimaPos.lng.toFixed(6)}</div>
            {ultimaPos.vel != null && <div>🚗 {ultimaPos.vel} km/h</div>}
            <div style={{ color: '#4ade80', marginTop: '4px' }}>● Publicando cada {INTERVAL_MS / 1000}s</div>
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', gap: '10px' }}>
          {!activo ? (
            <button onClick={iniciar} style={btnStyle('#16a34a')}>
              ▶ Iniciar rastreo
            </button>
          ) : (
            <button onClick={detener} style={btnStyle('#dc2626')}>
              ■ Detener rastreo
            </button>
          )}
          <a href="/" style={{ ...btnStyle('#334155'), textDecoration: 'none', textAlign: 'center' }}>
            ← Ver mapa
          </a>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9',
  fontSize: '0.95rem', boxSizing: 'border-box',
};

const btnStyle = (bg: string): React.CSSProperties => ({
  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
  background: bg, color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
});
