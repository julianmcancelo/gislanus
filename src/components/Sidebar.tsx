'use client';
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Layers, Info, LogIn, LogOut, Truck, Bus, Settings, MapPin,
  Shield, User, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';

interface Capa {
  id: string;
  nombre: string;
  active: boolean;
  color: string;
  grupo?: { nombre: string };
  subGrupo?: { nombre: string };
  subSubGrupo?: { nombre: string } | null;
  numeroSolicitud?: string;
  estado?: string;
  nombreSolicitante?: string;
  empresaSolicitante?: string;
  fechaCreacion?: string;
  tipoCarga?: string;
  origenNombre?: string;
  destinoNombre?: string;
  datosGeo?: any;
}

interface SidebarProps {
  capas: Capa[];
  alternarCapa: (id: string) => void;
  activeTab: 'layers' | 'info' | null;
  setActiveTab: (tab: 'layers' | 'info' | null) => void;
}

type SubgrupoData = { capasDirectas: Capa[]; subsubgrupos: Record<string, Capa[]> };
type GroupedData  = { capasDirectas: Capa[]; subgrupos: Record<string, SubgrupoData> };

const ESTADO_CONFIG: Record<string, { bg: string; dot: string; label: string; short: string }> = {
  PENDIENTE: { bg: '#fef9c3', dot: '#ca8a04', label: 'Pendiente', short: 'PEND' },
  APROBADO:  { bg: '#dcfce7', dot: '#16a34a', label: 'Aprobado',  short: 'APRO' },
  RECHAZADO: { bg: '#fee2e2', dot: '#dc2626', label: 'Rechazado', short: 'RECH' },
  BORRADOR:  { bg: '#f1f5f9', dot: '#94a3b8', label: 'Borrador',  short: 'BORR' },
  VENCIDO:   { bg: '#ffedd5', dot: '#ea580c', label: 'Vencido',   short: 'VENC' },
};
function getEstado(e?: string) {
  const k = (e ?? '').toUpperCase();
  return ESTADO_CONFIG[k] ?? { bg: '#f1f5f9', dot: '#94a3b8', label: e || '—', short: '—' };
}

/* ── Toggle switch ── */
function Toggle({ active, color, onChange }: { active: boolean; color: string; onChange: () => void }) {
  return (
    <label className={styles.toggle} onClick={e => e.stopPropagation()}>
      <input type="checkbox" className={styles.toggleInput} checked={active} onChange={onChange} />
      <span className={styles.toggleSlider} style={active ? { background: color } : {}} />
    </label>
  );
}

/* ── Capa row ── */
function CapaRow({ capa, onToggle }: { capa: Capa; onToggle: () => void }) {
  return (
    <div className={styles.capaRow} onClick={onToggle} title={capa.nombre}>
      <div className={styles.capaColorBar} style={{ background: capa.color, opacity: capa.active ? 1 : 0.25 }} />
      <span className={`${styles.capaName} ${capa.active ? styles.capaNameActive : ''}`}>
        {capa.nombre}
      </span>
      <Toggle active={capa.active} color={capa.color} onChange={onToggle} />
    </div>
  );
}

/* ── Solicitud row ── */
function SolicitudRow({ capa, onToggle }: { capa: Capa; onToggle: () => void }) {
  const cfg = getEstado(capa.estado);
  const route = [capa.origenNombre, capa.destinoNombre].filter(Boolean).join(' → ');
  return (
    <div className={styles.solicitudRow} onClick={onToggle}
      title={`#${capa.numeroSolicitud} · ${cfg.label}${route ? ' · ' + route : ''}`}
      style={{ opacity: capa.active ? 1 : 0.55 }}>
      <div className={styles.estadoDot} style={{ background: cfg.dot }} />
      <span className={styles.solicitudNum}>#{capa.numeroSolicitud}</span>
      <span className={styles.solicitudRoute}>{route || capa.tipoCarga || '—'}</span>
      <span className={styles.estadoBadge} style={{ background: cfg.bg, color: cfg.dot }}>
        {cfg.short}
      </span>
      <Toggle active={capa.active} color={cfg.dot} onChange={onToggle} />
    </div>
  );
}

/* ── Transporte group (por empresa/solicitante) ── */
function TransporteGroup({ capas, onToggle, expandedSols, toggleSol }: {
  capas: Capa[]; onToggle: (id: string) => void;
  expandedSols: Record<string, boolean>; toggleSol: (k: string) => void;
}) {
  const byOwner = useMemo(() => {
    const map: Record<string, Capa[]> = {};
    capas.forEach(c => {
      const key = c.empresaSolicitante || c.nombreSolicitante || 'Sin datos';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [capas]);

  return (
    <>
      {Object.entries(byOwner).map(([owner, items]) => {
        const multi = items.length > 1;
        const isOpen = expandedSols[owner] !== false;
        const activeCount = items.filter(c => c.active).length;
        return (
          <div key={owner} style={{ marginBottom: multi ? 3 : 1 }}>
            {multi ? (
              <>
                <div className={styles.ownerHeader} onClick={() => toggleSol(owner)}>
                  {isOpen
                    ? <ChevronDown size={10} color="#94a3b8" />
                    : <ChevronRight size={10} color="#94a3b8" />}
                  <span className={styles.ownerName}>{owner}</span>
                  <span className={`${styles.badge} ${styles.badgeGray}`}>{activeCount}/{items.length}</span>
                </div>
                {isOpen && (
                  <div style={{ paddingLeft: 8 }}>
                    {items.map(c => <SolicitudRow key={c.id} capa={c} onToggle={() => onToggle(c.id)} />)}
                  </div>
                )}
              </>
            ) : (
              <SolicitudRow capa={items[0]} onToggle={() => onToggle(items[0].id)} />
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Sidebar principal ── */
export default function Sidebar({ capas, alternarCapa, activeTab, setActiveTab }: SidebarProps) {
  const { user, dbUser, logout } = useAuth();
  const router = useRouter();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ 'Solicitudes Transporte Pesado': true });
  const [expandedSols, setExpandedSols] = useState<Record<string, boolean>>({});
  const [confirmLogout, setConfirmLogout] = useState(false);

  const toggleSol  = (k: string) => setExpandedSols(p => ({ ...p, [k]: p[k] === false }));
  const toggleNode = (k: string) => setExpandedNodes(p => ({ ...p, [k]: !p[k] }));

  const { grupos, general } = useMemo(() => {
    const groups: Record<string, GroupedData> = {};
    const generalCapas: Capa[] = [];
    capas.forEach(capa => {
      if (capa.grupo?.nombre) {
        const gn = capa.grupo.nombre;
        if (!groups[gn]) groups[gn] = { capasDirectas: [], subgrupos: {} };
        if (capa.subGrupo?.nombre) {
          const sn = capa.subGrupo.nombre;
          if (!groups[gn].subgrupos[sn]) groups[gn].subgrupos[sn] = { capasDirectas: [], subsubgrupos: {} };
          if (capa.subSubGrupo?.nombre) {
            const ssn = capa.subSubGrupo.nombre;
            if (!groups[gn].subgrupos[sn].subsubgrupos[ssn]) groups[gn].subgrupos[sn].subsubgrupos[ssn] = [];
            groups[gn].subgrupos[sn].subsubgrupos[ssn].push(capa);
          } else {
            groups[gn].subgrupos[sn].capasDirectas.push(capa);
          }
        } else {
          groups[gn].capasDirectas.push(capa);
        }
      } else {
        generalCapas.push(capa);
      }
    });
    return { grupos: groups, general: generalCapas };
  }, [capas]);

  const flattenGroup    = (gn: string) => {
    const d = grupos[gn];
    return [...d.capasDirectas, ...Object.values(d.subgrupos).flatMap(sg => [...sg.capasDirectas, ...Object.values(sg.subsubgrupos).flat()])];
  };
  const flattenSubGroup = (gn: string, sn: string) => {
    const sg = grupos[gn].subgrupos[sn];
    return [...sg.capasDirectas, ...Object.values(sg.subsubgrupos).flat()];
  };
  const toggleAll       = (gn: string, v: boolean) => flattenGroup(gn).forEach(c => { if (c.active !== v) alternarCapa(c.id); });
  const toggleSubAll    = (gn: string, sn: string, v: boolean) => flattenSubGroup(gn, sn).forEach(c => { if (c.active !== v) alternarCapa(c.id); });
  const toggleSubSubAll = (gn: string, sn: string, ssn: string, v: boolean) => grupos[gn].subgrupos[sn].subsubgrupos[ssn].forEach(c => { if (c.active !== v) alternarCapa(c.id); });

  const isSuperAdmin        = dbUser?.rol === 'SUPER_ADMIN';
  const canAccessTransporte = isSuperAdmin || (dbUser?.permisos?.verRutas ?? false);
  const canAccessLineas     = isSuperAdmin || (dbUser?.permisos?.editarLineas ?? false);
  const canAccessAdmin      = isSuperAdmin || (dbUser?.permisos?.accesoAdmin ?? false);

  return (
    <div className={styles.sidebarContainer}>

      {/* ── Nav strip ── */}
      <div className={styles.navStrip}>
        <div className={`${styles.navIcon} ${activeTab === 'layers' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab(activeTab === 'layers' ? null : 'layers')} title="Capas">
          <Layers size={16} />
        </div>
        <div className={`${styles.navIcon} ${activeTab === 'info' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab(activeTab === 'info' ? null : 'info')} title="Información">
          <Info size={16} />
        </div>

        <div style={{ flex: 1 }} />
        <div className={styles.navDivider} />

        {canAccessTransporte && (
          <div className={styles.navIcon} onClick={() => router.push('/transporte-pesado')} title="Transporte Pesado">
            <Truck size={16} />
          </div>
        )}
        {canAccessLineas && (
          <div className={styles.navIcon} onClick={() => router.push('/transporte-publico')} title="Transporte Público">
            <Bus size={16} />
          </div>
        )}
        {canAccessAdmin && (
          <div className={styles.navIcon} onClick={() => router.push('/admin')} title="Panel de Control">
            <Settings size={16} />
          </div>
        )}

        <div className={styles.navDivider} />

        {user && (
          <div className={styles.navIcon} onClick={() => router.push('/perfil')} title="Mi perfil">
            <User size={16} />
          </div>
        )}
        <div className={styles.navIcon}
          onClick={() => user ? setConfirmLogout(true) : router.push('/login')}
          title={user ? 'Cerrar Sesión' : 'Iniciar Sesión'}>
          {user ? <LogOut size={16} color="#f87171" /> : <LogIn size={16} />}
        </div>
      </div>

      {/* ── Modal logout (Portal → document.body) ── */}
      {confirmLogout && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setConfirmLogout(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(5,10,20,0.6)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, width: 340,
              boxShadow: '0 40px 80px rgba(0,0,0,0.32)',
              overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(145deg, #0c1525 0%, #1a2d50 100%)', padding: '28px 24px 22px', position: 'relative' }}>
              <button
                onClick={() => setConfirmLogout(false)}
                style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}
              >✕</button>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <LogOut size={22} color="#f87171" />
              </div>
              <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1.05rem', color: '#f1f5f9', letterSpacing: '-0.01em' }}>Cerrar sesión</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>GIS Lanús — Sistema de Información Geográfica</p>
            </div>

            {/* User info chip */}
            <div style={{ margin: '20px 24px 0', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                  {(dbUser?.nombre || user?.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dbUser?.nombre || 'Usuario'}
                </p>
                <p style={{ margin: 0, fontSize: '0.71rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 24px 24px' }}>
              <p style={{ margin: '0 0 20px', fontSize: '0.83rem', color: '#64748b', lineHeight: 1.65 }}>
                ¿Estás seguro que querés salir? Tendrás que volver a iniciar sesión para acceder a la plataforma.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setConfirmLogout(false)}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 10,
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                    color: '#475569', fontWeight: 600, fontSize: '0.83rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { logout(); setConfirmLogout(false); }}
                  style={{
                    flex: 1.4, padding: '11px 0', borderRadius: 10, border: 'none',
                    background: '#dc2626', color: '#fff',
                    fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    boxShadow: '0 4px 16px rgba(220,38,38,0.25)',
                  }}
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Panel expandible ── */}
      <div className={`${styles.panel} ${activeTab ? styles.panelOpen : ''}`}>

        {/* ── Capas ── */}
        {activeTab === 'layers' && (
          <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>
                <Layers size={14} color="#64748b" />
              </div>
              <h3 className={styles.panelTitle}>Capas</h3>
              <span className={`${styles.badge} ${styles.badgeGray}`}>{capas.length}</span>
            </div>

            <div className={styles.panelBody}>
              {Object.entries(grupos).map(([gName, gData]) => {
                const isOpen      = expandedNodes[gName];
                const allCapas    = flattenGroup(gName);
                const allActive   = allCapas.length > 0 && allCapas.every(l => l.active);
                const someActive  = allCapas.some(l => l.active) && !allActive;
                const isTransporte = gName === 'Solicitudes Transporte Pesado';
                const activeCount = allCapas.filter(c => c.active).length;

                return (
                  <div key={gName} className={styles.layerGroup}>
                    <div className={styles.groupHeader} onClick={() => toggleNode(gName)}>
                      <span className={styles.groupChevron}>
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      {!isTransporte && (
                        <input type="checkbox" className={styles.groupCheckbox}
                          checked={allActive}
                          ref={el => { if (el) el.indeterminate = someActive; }}
                          onChange={e => { e.stopPropagation(); toggleAll(gName, e.target.checked); }}
                          onClick={e => e.stopPropagation()} />
                      )}
                      <span className={styles.groupName}>{gName}</span>
                      <span className={`${styles.badge} ${isTransporte ? styles.badgeBlue : styles.badgeGray}`}>
                        {isTransporte ? `${activeCount}/${allCapas.length}` : allCapas.length}
                      </span>
                    </div>

                    {isOpen && (
                      <div className={styles.groupItems}>
                        {isTransporte ? (
                          <TransporteGroup capas={allCapas} onToggle={alternarCapa} expandedSols={expandedSols} toggleSol={toggleSol} />
                        ) : (
                          <>
                            {Object.entries(gData.subgrupos).map(([sgName, sgData]) => {
                              const sgKey       = `${gName}|${sgName}`;
                              const sgOpen      = expandedNodes[sgKey];
                              const sgCapas     = flattenSubGroup(gName, sgName);
                              const sgAllActive = sgCapas.every(l => l.active);
                              const sgSome      = sgCapas.some(l => l.active) && !sgAllActive;
                              const hasSsg      = Object.keys(sgData.subsubgrupos).length > 0;

                              return (
                                <div key={sgKey} className={styles.subGroup}>
                                  <div className={styles.subGroupHeader} onClick={() => toggleNode(sgKey)}>
                                    {sgOpen
                                      ? <ChevronDown size={10} color="#b0bec5" />
                                      : <ChevronRight size={10} color="#b0bec5" />}
                                    <input type="checkbox" className={styles.groupCheckbox}
                                      checked={sgAllActive}
                                      ref={el => { if (el) el.indeterminate = sgSome; }}
                                      onChange={e => { e.stopPropagation(); toggleSubAll(gName, sgName, e.target.checked); }}
                                      onClick={e => e.stopPropagation()} />
                                    <span className={styles.subGroupName}>{sgName}</span>
                                    <span className={`${styles.badge} ${styles.badgeGray}`}>{sgCapas.length}</span>
                                  </div>

                                  {sgOpen && (
                                    <div style={{ paddingLeft: 9 }}>
                                      {hasSsg ? (
                                        Object.entries(sgData.subsubgrupos).map(([ssgName, ssgCapas]) => {
                                          const ssgKey       = `${sgKey}|${ssgName}`;
                                          const ssgOpen      = expandedNodes[ssgKey] !== false;
                                          const ssgAllActive = ssgCapas.every(l => l.active);
                                          const ssgSome      = ssgCapas.some(l => l.active) && !ssgAllActive;
                                          return (
                                            <div key={ssgKey} style={{ marginBottom: 2 }}>
                                              <div className={styles.ramalHeader} onClick={() => toggleNode(ssgKey)}>
                                                {ssgOpen
                                                  ? <ChevronDown size={9} color="#b0bec5" />
                                                  : <ChevronRight size={9} color="#b0bec5" />}
                                                <input type="checkbox" className={styles.groupCheckbox}
                                                  checked={ssgAllActive}
                                                  ref={el => { if (el) el.indeterminate = ssgSome; }}
                                                  onChange={e => { e.stopPropagation(); toggleSubSubAll(gName, sgName, ssgName, e.target.checked); }}
                                                  onClick={e => e.stopPropagation()} />
                                                <span className={styles.ramalName}>{ssgName}</span>
                                                <span className={`${styles.badge} ${styles.badgeGray}`}>{ssgCapas.length}</span>
                                              </div>
                                              {ssgOpen && (
                                                <div style={{ paddingLeft: 7 }}>
                                                  {ssgCapas.map(c => <CapaRow key={c.id} capa={c} onToggle={() => alternarCapa(c.id)} />)}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        sgData.capasDirectas.map(c => <CapaRow key={c.id} capa={c} onToggle={() => alternarCapa(c.id)} />)
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {gData.capasDirectas.map(c => <CapaRow key={c.id} capa={c} onToggle={() => alternarCapa(c.id)} />)}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {general.length > 0 && (
                <div className={styles.layerGroup}>
                  <div className={styles.groupHeader} onClick={() => toggleNode('__general')}>
                    <span className={styles.groupChevron}>
                      {expandedNodes['__general'] !== false ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <span className={styles.groupName}>Otras capas</span>
                    <span className={`${styles.badge} ${styles.badgeGray}`}>{general.length}</span>
                  </div>
                  {expandedNodes['__general'] !== false && (
                    <div className={styles.groupItems}>
                      {general.map(c => <CapaRow key={c.id} capa={c} onToggle={() => alternarCapa(c.id)} />)}
                    </div>
                  )}
                </div>
              )}

              {capas.length === 0 && (
                <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 24, fontSize: '0.78rem' }}>
                  No hay capas disponibles.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Info ── */}
        {activeTab === 'info' && (
          <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderIcon}>
                <Info size={14} color="#64748b" />
              </div>
              <h3 className={styles.panelTitle}>Sistema GIS</h3>
            </div>

            <div className={styles.panelBody}>
              {/* Card institucional */}
              <div style={{
                background: 'linear-gradient(135deg,#0c1220 0%,#1a2d50 100%)',
                borderRadius: 10, padding: '13px', position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(56,189,248,0.05)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <MapPin size={13} color="#7dd3fc" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.77rem', fontWeight: 800, color: '#f1f5f9' }}>GIS Lanús</p>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#475569' }}>Sistema de Información Geográfica</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b', lineHeight: 1.6 }}>
                  Plataforma centralizada para la gestión de datos geoespaciales e información territorial.
                </p>
              </div>

              {/* Sesión */}
              {user && (
                <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                  <div style={{
                    padding: '7px 11px', background: '#fafbfc',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', gap: 5
                  }}>
                    <User size={11} color="#b0bec5" />
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#b0bec5', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Sesión activa</span>
                  </div>
                  <div style={{ padding: '9px 11px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                      {dbUser?.nombre || user.email?.split('@')[0]}
                    </p>
                    <p style={{ margin: '0 0 7px', fontSize: '0.67rem', color: '#94a3b8' }}>{user.email}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Shield size={9} color="#0ea5e9" />
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                        color: dbUser?.rol === 'SUPER_ADMIN' ? '#7c3aed' : dbUser?.rol === 'ADMINISTRADOR' ? '#0ea5e9' : '#16a34a'
                      }}>
                        {dbUser?.rol === 'SUPER_ADMIN' ? 'Super Admin' : dbUser?.rol === 'ADMINISTRADOR' ? 'Administrador' : dbUser?.rol === 'USUARIO' ? 'Usuario' : dbUser?.rol}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Accesos rápidos */}
              {(canAccessTransporte || canAccessAdmin || canAccessLineas) && (
                <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                  <div style={{
                    padding: '7px 11px', background: '#fafbfc',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    fontSize: '0.6rem', fontWeight: 700, color: '#b0bec5',
                    textTransform: 'uppercase', letterSpacing: '0.09em'
                  }}>
                    Accesos rápidos
                  </div>
                  {canAccessTransporte && (
                    <a href="/transporte-pesado" style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                      borderBottom: (canAccessAdmin || canAccessLineas) ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      textDecoration: 'none', background: 'transparent', transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(124,58,237,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Truck size={12} color="#7c3aed" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.73rem', fontWeight: 600, color: '#1e293b' }}>Transporte Pesado</p>
                        <p style={{ margin: 0, fontSize: '0.64rem', color: '#94a3b8' }}>Permisos de circulación</p>
                      </div>
                      <ExternalLink size={10} color="#d1d5db" />
                    </a>
                  )}
                  {canAccessLineas && (
                    <a href="/transporte-publico" style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                      borderBottom: canAccessAdmin ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      textDecoration: 'none', background: 'transparent', transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(34,197,94,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bus size={12} color="#16a34a" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.73rem', fontWeight: 600, color: '#1e293b' }}>Transporte Público</p>
                        <p style={{ margin: 0, fontSize: '0.64rem', color: '#94a3b8' }}>Carga de ramales</p>
                      </div>
                      <ExternalLink size={10} color="#d1d5db" />
                    </a>
                  )}
                  {canAccessAdmin && (
                    <a href="/admin" style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                      textDecoration: 'none', background: 'transparent', transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(2,132,199,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Settings size={12} color="#0284c7" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.73rem', fontWeight: 600, color: '#1e293b' }}>Panel de Control</p>
                        <p style={{ margin: 0, fontSize: '0.64rem', color: '#94a3b8' }}>Capas, usuarios y permisos</p>
                      </div>
                      <ExternalLink size={10} color="#d1d5db" />
                    </a>
                  )}
                  {canAccessHeavyTransport && (
                    <a href="/instalar-asistente" style={{
                      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                      textDecoration: 'none', background: 'transparent', transition: 'background 0.1s'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(139,92,246,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Settings size={12} color="#8b5cf6" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.73rem', fontWeight: 600, color: '#1e293b' }}>Asistente Mágico</p>
                        <p style={{ margin: 0, fontSize: '0.64rem', color: '#94a3b8' }}>Instalar atajo inteligente</p>
                      </div>
                      <ExternalLink size={10} color="#d1d5db" />
                    </a>
                  )}
                </div>
              )}

              <p style={{ fontSize: '0.6rem', color: '#d1d5db', textAlign: 'center', marginTop: 'auto', paddingTop: 8, lineHeight: 1.7 }}>
                GIS Lanús · v2.0
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
