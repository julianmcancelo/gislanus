'use client';
import React, { useState, useMemo } from 'react';
import { Layers, Info, LogIn, LogOut, Truck, Settings, MapPin, Shield, User, ExternalLink } from 'lucide-react';
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
}

interface SidebarProps {
  capas: Capa[];
  alternarCapa: (id: string) => void;
  activeTab: 'layers' | 'info' | null;
  setActiveTab: (tab: 'layers' | 'info' | null) => void;
}

type SubgrupoData = {
  capasDirectas: Capa[];
  subsubgrupos: Record<string, Capa[]>;
};

type GroupedData = {
  capasDirectas: Capa[];
  subgrupos: Record<string, SubgrupoData>;
};

const ESTADO_CONFIG: Record<string, { bg: string; dot: string; label: string; short: string }> = {
  PENDIENTE: { bg: '#fef9c3', dot: '#ca8a04', label: 'Pendiente', short: 'PEND' },
  APROBADO:  { bg: '#dcfce7', dot: '#16a34a', label: 'Aprobado',  short: 'APRO' },
  RECHAZADO: { bg: '#fee2e2', dot: '#dc2626', label: 'Rechazado', short: 'RECH' },
  BORRADOR:  { bg: '#f1f5f9', dot: '#94a3b8', label: 'Borrador',  short: 'BORR' },
  VENCIDO:   { bg: '#ffedd5', dot: '#ea580c', label: 'Vencido',   short: 'VENC' },
};

function getEstado(estado?: string) {
  const key = (estado ?? '').toUpperCase();
  return ESTADO_CONFIG[key] ?? { bg: '#f1f5f9', dot: '#94a3b8', label: estado || '—', short: '—' };
}

/* ── Fila compacta para capas genéricas ── */
function CapaRow({ capa, onToggle }: { capa: Capa; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      title={capa.nombre}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '5px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        borderLeft: `3px solid ${capa.active ? capa.color : '#e2e8f0'}`,
        marginBottom: '2px',
        background: capa.active ? 'rgba(248,250,252,0.9)' : 'transparent',
        opacity: capa.active ? 1 : 0.55,
        transition: 'all 0.12s',
      }}
    >
      <span style={{
        width: 9, height: 9, borderRadius: '3px',
        background: capa.color, flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
      <span style={{
        fontSize: '0.78rem', color: '#334155', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {capa.nombre}
      </span>
      <span style={{
        width: 14, height: 14, borderRadius: '3px', flexShrink: 0,
        border: `2px solid ${capa.active ? capa.color : '#cbd5e1'}`,
        background: capa.active ? capa.color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {capa.active && <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '1px', display: 'block' }} />}
      </span>
    </div>
  );
}

/* ── Fila compacta para solicitudes de transporte ── */
function SolicitudRow({ capa, onToggle }: { capa: Capa; onToggle: () => void }) {
  const cfg = getEstado(capa.estado);
  const route = [capa.origenNombre, capa.destinoNombre].filter(Boolean).join(' → ');

  return (
    <div
      onClick={onToggle}
      title={`#${capa.numeroSolicitud} · ${cfg.label}${route ? ' · ' + route : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
        background: capa.active ? '#fff' : 'transparent',
        borderLeft: `3px solid ${capa.color}`,
        marginBottom: '3px',
        opacity: capa.active ? 1 : 0.5,
        transition: 'background 0.12s, opacity 0.12s',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, fontSize: '0.74rem', color: '#1e293b', flexShrink: 0 }}>
        #{capa.numeroSolicitud}
      </span>
      <span style={{
        fontSize: '0.69rem', color: '#64748b',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
      }}>
        {route || capa.tipoCarga || ''}
      </span>
      <span style={{
        background: cfg.bg, color: cfg.dot,
        borderRadius: '4px', padding: '0 5px',
        fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.05em', flexShrink: 0,
      }}>
        {cfg.short}
      </span>
    </div>
  );
}

/* ── Grupo agrupado por solicitante/empresa ── */
function TransporteGroup({ capas, onToggle, expandedSols, toggleSol }: {
  capas: Capa[];
  onToggle: (id: string) => void;
  expandedSols: Record<string, boolean>;
  toggleSol: (key: string) => void;
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
          <div key={owner} style={{ marginBottom: multi ? '5px' : '2px' }}>
            {multi ? (
              <>
                <div
                  onClick={() => toggleSol(owner)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '4px 8px', cursor: 'pointer',
                    borderRadius: '5px', background: '#f1f5f9', marginBottom: '3px',
                  }}
                >
                  <span style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{isOpen ? '▼' : '▶'}</span>
                  <span style={{
                    fontSize: '0.71rem', fontWeight: 700, color: '#334155',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {owner}
                  </span>
                  <span style={{
                    fontSize: '0.61rem', background: '#e2e8f0', color: '#475569',
                    borderRadius: '999px', padding: '0 6px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {activeCount}/{items.length}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ paddingLeft: '10px' }}>
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
  const toggleSol = (key: string) => setExpandedSols(prev => ({ ...prev, [key]: prev[key] === false }));

  const { grupos, general } = useMemo(() => {
    const groups: Record<string, GroupedData> = {};
    const generalCapas: Capa[] = [];
    capas.forEach(capa => {
      if (capa.grupo?.nombre) {
        const gName = capa.grupo.nombre;
        if (!groups[gName]) groups[gName] = { capasDirectas: [], subgrupos: {} };
        if (capa.subGrupo?.nombre) {
          const sgName = capa.subGrupo.nombre;
          if (!groups[gName].subgrupos[sgName]) groups[gName].subgrupos[sgName] = { capasDirectas: [], subsubgrupos: {} };
          if (capa.subSubGrupo?.nombre) {
            const ssgName = capa.subSubGrupo.nombre;
            if (!groups[gName].subgrupos[sgName].subsubgrupos[ssgName]) groups[gName].subgrupos[sgName].subsubgrupos[ssgName] = [];
            groups[gName].subgrupos[sgName].subsubgrupos[ssgName].push(capa);
          } else {
            groups[gName].subgrupos[sgName].capasDirectas.push(capa);
          }
        } else {
          groups[gName].capasDirectas.push(capa);
        }
      } else {
        generalCapas.push(capa);
      }
    });
    return { grupos: groups, general: generalCapas };
  }, [capas]);

  const toggleNode = (key: string) => setExpandedNodes(prev => ({ ...prev, [key]: !prev[key] }));

  const flattenGroup = (gName: string): Capa[] => {
    const data = grupos[gName];
    return [
      ...data.capasDirectas,
      ...Object.values(data.subgrupos).flatMap(sg => [
        ...sg.capasDirectas,
        ...Object.values(sg.subsubgrupos).flat(),
      ]),
    ];
  };

  const flattenSubGroup = (gName: string, sgName: string): Capa[] => {
    const sg = grupos[gName].subgrupos[sgName];
    return [...sg.capasDirectas, ...Object.values(sg.subsubgrupos).flat()];
  };

  const toggleAll = (gName: string, active: boolean) => {
    flattenGroup(gName).forEach(c => { if (c.active !== active) alternarCapa(c.id); });
  };

  const toggleSubAll = (gName: string, sgName: string, active: boolean) => {
    flattenSubGroup(gName, sgName).forEach(c => { if (c.active !== active) alternarCapa(c.id); });
  };

  const toggleSubSubAll = (gName: string, sgName: string, ssgName: string, active: boolean) => {
    grupos[gName].subgrupos[sgName].subsubgrupos[ssgName].forEach(c => { if (c.active !== active) alternarCapa(c.id); });
  };

  // Usar los nuevos permisos dinámicos (o fallback a super_admin por las dudas)
  const isSuperAdmin = dbUser?.rol === 'SUPER_ADMIN';
  const canAccessTransporte = isSuperAdmin || (dbUser?.permisos?.verRutas ?? false);
  const canAccessAdmin = isSuperAdmin || (dbUser?.permisos?.accesoAdmin ?? false);

  return (
    <div className={styles.sidebarContainer}>
      {/* Franja vertical de iconos */}
      <div className={styles.navStrip}>
        <div className={`${styles.navIcon} ${activeTab === 'layers' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab(activeTab === 'layers' ? null : 'layers')} title="Capas">
          <Layers size={18} />
        </div>
        <div className={`${styles.navIcon} ${activeTab === 'info' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab(activeTab === 'info' ? null : 'info')} title="Información">
          <Info size={18} />
        </div>

        <div style={{ flex: 1 }} />

        {canAccessTransporte && (
          <div className={styles.navIcon} onClick={() => router.push('/transporte-pesado')} title="Transporte Pesado">
            <Truck size={18} />
          </div>
        )}
        {canAccessAdmin && (
          <div className={styles.navIcon} onClick={() => router.push('/admin')} title="Panel de Control">
            <Settings size={18} />
          </div>
        )}
        <div className={styles.navIcon}
          onClick={() => user ? setConfirmLogout(true) : router.push('/login')}
          title={user ? 'Cerrar Sesión' : 'Iniciar Sesión'}>
          {user ? <LogOut size={18} color="#f87171" /> : <LogIn size={18} />}
        </div>
      </div>

      {/* Confirmación de cierre de sesión */}
      {confirmLogout && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto',
          }}
          onClick={() => setConfirmLogout(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '300px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Franja superior */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              padding: '24px 24px 20px',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '10px',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '14px',
              }}>
                <LogOut size={18} color="#f87171" />
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#f8fafc', letterSpacing: '-0.01em' }}>
                Cerrar sesión
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                {dbUser?.nombre || user?.email}
              </p>
            </div>

            {/* Cuerpo */}
            <div style={{ padding: '20px 24px 24px' }}>
              <p style={{ margin: '0 0 20px', fontSize: '0.84rem', color: '#475569', lineHeight: 1.6 }}>
                ¿Estás seguro que querés salir de la plataforma?
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setConfirmLogout(false)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: '8px',
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                    color: '#475569', fontWeight: 600, fontSize: '0.84rem',
                    cursor: 'pointer', transition: 'background 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { logout(); setConfirmLogout(false); }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: '#fff', fontWeight: 700, fontSize: '0.84rem',
                    cursor: 'pointer', transition: 'opacity 0.15s',
                    boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
                    fontFamily: 'inherit',
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel expandible */}
      <div className={`${styles.panel} ${activeTab ? styles.panelOpen : ''}`}>

        {/* ── Panel Capas ── */}
        {activeTab === 'layers' && (
          <div className={styles.panelContent}>
            <h3 className={styles.panelTitle}>Capas</h3>

            <div className={styles.layersList}>
              {Object.entries(grupos).map(([gName, gData]) => {
                const isOpen = expandedNodes[gName];
                const allCapas = flattenGroup(gName);
                const allActive = allCapas.length > 0 && allCapas.every(l => l.active);
                const someActive = allCapas.some(l => l.active) && !allActive;
                const isTransporte = gName === 'Solicitudes Transporte Pesado';
                const activeCount = allCapas.filter(c => c.active).length;

                return (
                  <div key={gName} className={styles.layerGroup}>
                    {/* Level 1: Grupo header */}
                    <div className={styles.groupHeader} onClick={() => toggleNode(gName)}>
                      <span className={styles.expandChevron}>{isOpen ? '▾' : '▸'}</span>
                      {!isTransporte && (
                        <input type="checkbox" checked={allActive}
                          ref={el => { if (el) el.indeterminate = someActive; }}
                          onChange={e => { e.stopPropagation(); toggleAll(gName, e.target.checked); }}
                          onClick={e => e.stopPropagation()} className={styles.groupCheckbox} />
                      )}
                      <span className={styles.groupName}>{gName}</span>
                      <span className={isTransporte ? styles.badgeBlue : styles.badgeGray}>
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
                              const sgKey = `${gName}|${sgName}`;
                              const sgOpen = expandedNodes[sgKey];
                              const sgCapas = flattenSubGroup(gName, sgName);
                              const sgAllActive = sgCapas.every(l => l.active);
                              const sgSome = sgCapas.some(l => l.active) && !sgAllActive;
                              const hasSsg = Object.keys(sgData.subsubgrupos).length > 0;

                              return (
                                <div key={sgKey} className={styles.subGroup}>
                                  {/* Level 2: Subgrupo header (línea) */}
                                  <div className={styles.subGroupHeader} onClick={() => toggleNode(sgKey)}>
                                    <span className={styles.expandChevron} style={{ fontSize: '0.6rem' }}>{sgOpen ? '▾' : '▸'}</span>
                                    <input type="checkbox" checked={sgAllActive}
                                      ref={el => { if (el) el.indeterminate = sgSome; }}
                                      onChange={e => { e.stopPropagation(); toggleSubAll(gName, sgName, e.target.checked); }}
                                      onClick={e => e.stopPropagation()} className={styles.groupCheckbox} />
                                    <span className={styles.subGroupName}>{sgName}</span>
                                    <span className={styles.badgeGray}>{sgCapas.length}</span>
                                  </div>

                                  {sgOpen && (
                                    <div style={{ paddingLeft: '8px' }}>
                                      {hasSsg ? (
                                        Object.entries(sgData.subsubgrupos).map(([ssgName, ssgCapas]) => {
                                          const ssgKey = `${sgKey}|${ssgName}`;
                                          const ssgOpen = expandedNodes[ssgKey] !== false;
                                          const ssgAllActive = ssgCapas.every(l => l.active);
                                          const ssgSome = ssgCapas.some(l => l.active) && !ssgAllActive;

                                          return (
                                            <div key={ssgKey} style={{ marginBottom: '2px' }}>
                                              {/* Level 3: Sub-subgrupo header (ramal) */}
                                              <div
                                                onClick={() => toggleNode(ssgKey)}
                                                style={{
                                                  display: 'flex', alignItems: 'center', gap: '4px',
                                                  padding: '3px 6px', borderRadius: '4px', cursor: 'pointer',
                                                  background: '#f1f5f9', marginBottom: '2px',
                                                }}>
                                                <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>{ssgOpen ? '▾' : '▸'}</span>
                                                <input type="checkbox" checked={ssgAllActive}
                                                  ref={el => { if (el) el.indeterminate = ssgSome; }}
                                                  onChange={e => { e.stopPropagation(); toggleSubSubAll(gName, sgName, ssgName, e.target.checked); }}
                                                  onClick={e => e.stopPropagation()} className={styles.groupCheckbox} />
                                                <span style={{ fontSize: '0.69rem', fontWeight: 600, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ssgName}</span>
                                                <span className={styles.badgeGray}>{ssgCapas.length}</span>
                                              </div>
                                              {ssgOpen && (
                                                <div style={{ paddingLeft: '8px' }}>
                                                  {ssgCapas.map(capa => (
                                                    <CapaRow key={capa.id} capa={capa} onToggle={() => alternarCapa(capa.id)} />
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        sgData.capasDirectas.map(capa => (
                                          <CapaRow key={capa.id} capa={capa} onToggle={() => alternarCapa(capa.id)} />
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {gData.capasDirectas.map(capa => (
                              <CapaRow key={capa.id} capa={capa} onToggle={() => alternarCapa(capa.id)} />
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Capas generales sin grupo */}
              {general.length > 0 && (
                <div className={styles.layerGroup}>
                  <div className={styles.groupHeader} onClick={() => toggleNode('__general')}>
                    <span className={styles.expandChevron}>{expandedNodes['__general'] !== false ? '▾' : '▸'}</span>
                    <span className={styles.groupName}>Otras capas</span>
                    <span className={styles.badgeGray}>{general.length}</span>
                  </div>
                  {expandedNodes['__general'] !== false && (
                    <div className={styles.groupItems}>
                      {general.map(capa => (
                        <CapaRow key={capa.id} capa={capa} onToggle={() => alternarCapa(capa.id)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {capas.length === 0 && (
                <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '24px', fontSize: '0.82rem' }}>
                  No hay capas disponibles.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Panel Info ── */}
        {activeTab === 'info' && (
          <div className={styles.panelContent}>
            <h3 className={styles.panelTitle}>Sistema GIS</h3>

            {/* Encabezado institucional */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '14px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(56,189,248,0.08)',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '8px',
                  background: 'rgba(56,189,248,0.15)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <MapPin size={16} color="#38bdf8" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.02em' }}>
                    GIS Lanús
                  </p>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>
                    Sistema de Información Geográfica
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Plataforma municipal del <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Municipio de Lanús</span> para
                la gestión y visualización de datos geoespaciales.
              </p>
            </div>

            {/* Sesión activa */}
            {user && (
              <div style={{
                border: '1px solid #e8edf3',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '14px',
              }}>
                <div style={{
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <User size={13} color="#64748b" />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Sesión activa
                  </span>
                </div>
                <div style={{ padding: '12px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                    {dbUser?.nombre || user.email?.split('@')[0]}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: '#64748b' }}>
                    {user.email}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={11} color="#0ea5e9" />
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      color: dbUser?.rol === 'SUPER_ADMIN' ? '#7c3aed' :
                             dbUser?.rol === 'ADMINISTRADOR' ? '#0ea5e9' : '#16a34a',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {dbUser?.rol === 'SUPER_ADMIN' ? 'Super Administrador' :
                       dbUser?.rol === 'ADMINISTRADOR' ? 'Administrador' :
                       dbUser?.rol === 'OPERADOR' ? 'Operador' :
                       dbUser?.rol === 'USUARIO' ? 'Usuario' : dbUser?.rol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Atajos rápidos */}
            <div style={{
              border: '1px solid #e8edf3',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '14px',
            }}>
              <div style={{
                padding: '10px 12px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '0.68rem', fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Accesos rápidos
              </div>
              {canAccessTransporte && (
                <a href="/transporte-pesado" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  borderBottom: canAccessAdmin ? '1px solid #f1f5f9' : 'none',
                  textDecoration: 'none',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '7px',
                    background: 'rgba(139,92,246,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Truck size={14} color="#7c3aed" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
                      Transporte Pesado
                    </p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8' }}>
                      Asistente de permisos de circulación
                    </p>
                  </div>
                  <ExternalLink size={12} color="#cbd5e1" />
                </a>
              )}
              {canAccessAdmin && (
                <a href="/admin" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  textDecoration: 'none',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                  background: 'transparent',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '7px',
                    background: 'rgba(2,132,199,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Settings size={14} color="#0284c7" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
                      Panel de Control
                    </p>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8' }}>
                      Gestión de capas, usuarios y permisos
                    </p>
                  </div>
                  <ExternalLink size={12} color="#cbd5e1" />
                </a>
              )}
            </div>

            {/* Pie */}
            <p style={{ fontSize: '0.65rem', color: '#cbd5e1', textAlign: 'center', marginTop: 'auto', paddingTop: '8px', lineHeight: 1.6 }}>
              Municipio de Lanús · Secretaría de Obras Públicas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
