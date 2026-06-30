'use client';
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Shield, Check, X, Loader2, Save } from 'lucide-react';

const ROL_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin',   color: '#7c3aed', bg: '#f5f3ff' },
  ADMINISTRADOR: { label: 'Administrador', color: '#2563eb', bg: '#eff6ff' },
  OPERADOR:      { label: 'Operador',      color: '#0891b2', bg: '#ecfeff' },
  CHOFER:        { label: 'Chofer',        color: '#16a34a', bg: '#f0fdf4' },
  VECINO:        { label: 'Vecino',        color: '#d97706', bg: '#fffbeb' },
  PENDIENTE:     { label: 'Pendiente',     color: '#9ca3af', bg: '#f9fafb' },
};

const PERMISOS_LABELS: { key: keyof NonNullable<ReturnType<typeof useAuth>['dbUser']>['permisos']; label: string; desc: string }[] = [
  { key: 'accesoAdmin',      label: 'Panel de administración',  desc: 'Ver y gestionar el panel de control' },
  { key: 'verCapas',         label: 'Ver capas GIS',            desc: 'Acceder a las capas del mapa' },
  { key: 'editarCapas',      label: 'Editar capas GIS',         desc: 'Crear, modificar y eliminar capas' },
  { key: 'verLineas',        label: 'Ver líneas de transporte',  desc: 'Ver trazas de colectivos' },
  { key: 'editarLineas',     label: 'Editar líneas',            desc: 'Crear y modificar trazas' },
  { key: 'verRutas',         label: 'Ver solicitudes pesado',   desc: 'Ver permisos de transporte pesado' },
  { key: 'editarRutas',      label: 'Crear solicitudes',        desc: 'Presentar solicitudes de transporte pesado' },
  { key: 'gestionarGrupos',  label: 'Gestionar grupos',         desc: 'Administrar grupos y subgrupos de capas' },
  { key: 'gestionarUsuarios',label: 'Gestionar usuarios',       desc: 'Cambiar roles y permisos de usuarios' },
];

export default function PerfilPage() {
  const { user, dbUser, loading } = useAuth();
  const router = useRouter();
  const [nombre, setNombre] = useState(dbUser?.nombre || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveNombre = async () => {
    if (!nombre.trim() || nombre.trim() === dbUser?.nombre) return;
    setSaving(true);
    try {
      const token = await user?.getIdToken();
      await fetch('/api/usuarios/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <Loader2 className="animate-spin" size={36} color="#2563eb" />
      </div>
    );
  }

  if (!dbUser) { router.push('/login'); return null; }

  const rolCfg = ROL_LABEL[dbUser.rol] ?? { label: dbUser.rol, color: '#64748b', bg: '#f1f5f9' };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => router.push('/')}
            style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> Volver al mapa
          </button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Mi perfil</h1>
        </div>

        {/* Card principal */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          {/* Avatar header */}
          <div style={{ background: 'linear-gradient(135deg, #1e2535 0%, #1a2d50 100%)', padding: '28px 28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={26} color="#93c5fd" />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>
                  {dbUser.nombre || user?.email?.split('@')[0]}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{user?.email}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ background: rolCfg.bg, color: rolCfg.color, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 9999, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {rolCfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Editar nombre */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid #f3f4f6' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Nombre para mostrar
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                style={{ flex: 1, padding: '9px 12px', fontSize: 14, border: '1px solid #d1d5db', borderRadius: 8, outline: 'none', color: '#111827' }}
                onFocus={e => (e.target.style.borderColor = '#2563eb')}
                onBlur={e => (e.target.style.borderColor = '#d1d5db')}
              />
              <button
                onClick={handleSaveNombre}
                disabled={saving || nombre.trim() === dbUser.nombre}
                style={{ padding: '9px 16px', background: saved ? '#16a34a' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: nombre.trim() === dbUser.nombre ? 0.4 : 1 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
                {saved ? 'Guardado' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Info de cuenta */}
          <div style={{ padding: '16px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</p>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 500 }}>{user?.email}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rol</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: rolCfg.color }}>{rolCfg.label}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Miembro desde</p>
              <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
                {dbUser.creadoEn ? new Date(dbUser.creadoEn).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ID de usuario</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{dbUser.id?.slice(0, 16)}…</p>
            </div>
          </div>
        </div>

        {/* Permisos */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={14} color="#2563eb" />
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Permisos asignados</h2>
          </div>
          <div style={{ padding: '8px 0' }}>
            {PERMISOS_LABELS.map(({ key, label, desc }) => {
              const tiene = dbUser.rol === 'SUPER_ADMIN' || !!(dbUser.permisos?.[key]);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tiene ? '#dcfce7' : '#f3f4f6' }}>
                    {tiene
                      ? <Check size={12} color="#16a34a" strokeWidth={2.5} />
                      : <X size={12} color="#9ca3af" strokeWidth={2.5} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 600, color: tiene ? '#0f172a' : '#9ca3af' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
