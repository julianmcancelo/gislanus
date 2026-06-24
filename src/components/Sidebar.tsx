'use client';
import React, { useState, useMemo } from 'react';
import { Menu, Layers, Info, LogIn, LogOut } from 'lucide-react';
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
}

interface SidebarProps {
  capas: Capa[];
  alternarCapa: (id: string) => void;
  activeTab: 'layers' | 'info' | null;
  setActiveTab: (tab: 'layers' | 'info' | null) => void;
}

type GroupedData = {
  capasDirectas: Capa[];
  subgrupos: Record<string, Capa[]>;
};

export default function Sidebar({ capas, alternarCapa, activeTab, setActiveTab }: SidebarProps) {
  const { user, dbUser, logout } = useAuth();
  const router = useRouter();
  // Store expanded state using keys like 'GrupoName' or 'GrupoName|SubGrupoName'
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Group capas logically
  const { grupos, general } = useMemo(() => {
    const groups: Record<string, GroupedData> = {};
    const generalCapas: Capa[] = [];

    capas.forEach(capa => {
      if (capa.grupo && capa.grupo.nombre) {
        const gName = capa.grupo.nombre;
        if (!groups[gName]) {
          groups[gName] = { capasDirectas: [], subgrupos: {} };
        }
        
        if (capa.subGrupo && capa.subGrupo.nombre) {
          const sgName = capa.subGrupo.nombre;
          if (!groups[gName].subgrupos[sgName]) {
            groups[gName].subgrupos[sgName] = [];
          }
          groups[gName].subgrupos[sgName].push(capa);
        } else {
          groups[gName].capasDirectas.push(capa);
        }
      } else {
        generalCapas.push(capa);
      }
    });

    return { grupos: groups, general: generalCapas };
  }, [capas]);

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  const setLayerActive = (capasToToggle: Capa[], active: boolean) => {
    capasToToggle.forEach(capa => {
      if (capa.active !== active) alternarCapa(capa.id);
    });
  };

  const handleGroupCheckbox = (gName: string, active: boolean) => {
    const data = grupos[gName];
    const allCapas = [
      ...data.capasDirectas,
      ...Object.values(data.subgrupos).flat()
    ];
    setLayerActive(allCapas, active);
  };

  const handleSubGroupCheckbox = (gName: string, sgName: string, active: boolean) => {
    const data = grupos[gName].subgrupos[sgName];
    setLayerActive(data, active);
  };

  return (
    <div className={styles.sidebarContainer}>
      {/* Dark narrow vertical strip */}
      <div className={styles.navStrip}>
        <div 
          className={`${styles.navIcon} ${activeTab === null ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab(activeTab === null ? 'layers' : null)}
          title="Menú"
        >
          <Menu size={20} />
        </div>
        <div 
          className={`${styles.navIcon} ${activeTab === 'layers' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab('layers')}
          title="Capas"
        >
          <Layers size={20} />
        </div>
        <div style={{ flex: 1 }}></div>
        <div 
          className={`${styles.navIcon} ${activeTab === 'info' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab('info')}
          title="Información"
        >
          <Info size={20} />
        </div>
        <div 
          className={styles.navIcon}
          onClick={() => user ? logout() : router.push('/login')}
          title={user ? "Cerrar Sesión" : "Iniciar Sesión"}
        >
          {user ? <LogOut size={20} color="#ef4444" /> : <LogIn size={20} />}
        </div>
      </div>

      {/* Expanding Panel */}
      <div className={`${styles.panel} ${activeTab ? styles.panelOpen : ''}`}>
        {activeTab === 'layers' && (
          <div className={styles.panelContent}>
            <h3 className={styles.panelTitle}>Capas Disponibles</h3>
            
            <div className={styles.layersList}>
              {/* Render Groups */}
              {Object.entries(grupos).map(([gName, gData]) => {
                const isGroupExpanded = expandedNodes[gName];
                
                const allCapas = [...gData.capasDirectas, ...Object.values(gData.subgrupos).flat()];
                const allActive = allCapas.every(l => l.active);
                const someActive = allCapas.some(l => l.active) && !allActive;

                return (
                  <div key={gName} className={styles.layerGroup}>
                    <div className={styles.groupHeader}>
                      <button 
                        className={styles.expandBtn}
                        onClick={() => toggleNode(gName)}
                      >
                        {isGroupExpanded ? '▼' : '▶'}
                      </button>
                      <input 
                        type="checkbox" 
                        checked={allCapas.length > 0 && allActive}
                        ref={input => { if (input) input.indeterminate = someActive; }}
                        onChange={(e) => handleGroupCheckbox(gName, e.target.checked)}
                        className={styles.groupCheckbox}
                      />
                      <span className={styles.groupName} onClick={() => toggleNode(gName)}>
                        {gName}
                      </span>
                    </div>

                    {isGroupExpanded && (
                      <div className={styles.groupItems}>
                        {/* Sub-groups */}
                        {Object.entries(gData.subgrupos).map(([sgName, sgCapas]) => {
                          const sgKey = `${gName}|${sgName}`;
                          const isSgExpanded = expandedNodes[sgKey];
                          const sgAllActive = sgCapas.every(l => l.active);
                          const sgSomeActive = sgCapas.some(l => l.active) && !sgAllActive;

                          return (
                            <div key={sgKey} className={styles.subLayerGroup} style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '16px' }}>
                              <div className={styles.groupHeader} style={{ background: 'transparent', padding: '4px 8px', borderBottom: 'none' }}>
                                <button 
                                  className={styles.expandBtn}
                                  onClick={() => toggleNode(sgKey)}
                                >
                                  {isSgExpanded ? '▼' : '▶'}
                                </button>
                                <input 
                                  type="checkbox" 
                                  checked={sgCapas.length > 0 && sgAllActive}
                                  ref={input => { if (input) input.indeterminate = sgSomeActive; }}
                                  onChange={(e) => handleSubGroupCheckbox(gName, sgName, e.target.checked)}
                                  className={styles.groupCheckbox}
                                />
                                <span className={styles.subGroupName} onClick={() => toggleNode(sgKey)} style={{ color: '#475569', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
                                  {sgName}
                                </span>
                              </div>

                              {isSgExpanded && (
                                <div className={styles.groupItems} style={{ paddingLeft: '4px', paddingTop: 0, paddingBottom: 0 }}>
                                  {sgCapas.map(capa => {
                                    const parts = capa.nombre.split(' - ');
                                    const subName = parts.slice(1).join(' - ') || capa.nombre;
                                    return (
                                      <label key={capa.id} className={styles.layerToggle}>
                                        <input
                                          type="checkbox"
                                          checked={capa.active}
                                          onChange={() => alternarCapa(capa.id)}
                                        />
                                        <span className={styles.layerName}>{subName}</span>
                                        <span 
                                          className={styles.layerIcon} 
                                          style={{ backgroundColor: capa.color }}
                                        ></span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Direct Capas in Group */}
                        {gData.capasDirectas.length > 0 && (
                          <div style={{ marginTop: '5px' }}>
                            {gData.capasDirectas.map(capa => {
                              const parts = capa.nombre.split(' - ');
                              const subName = parts.slice(1).join(' - ') || capa.nombre;
                              return (
                                <label key={capa.id} className={styles.layerToggle}>
                                  <input
                                    type="checkbox"
                                    checked={capa.active}
                                    onChange={() => alternarCapa(capa.id)}
                                  />
                                  <span className={styles.layerName}>{subName}</span>
                                  <span 
                                    className={styles.layerIcon} 
                                    style={{ backgroundColor: capa.color }}
                                  ></span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Render General Layers */}
              {general.length > 0 && (
                <div className={styles.layerGroup} style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 10px', color: '#888' }}>Otras Capas</h4>
                  {general.map(capa => (
                    <label key={capa.id} className={styles.layerToggle}>
                      <input
                        type="checkbox"
                        checked={capa.active}
                        onChange={() => alternarCapa(capa.id)}
                      />
                      <span className={styles.layerName}>{capa.nombre}</span>
                      <span 
                        className={styles.layerIcon} 
                        style={{ backgroundColor: capa.color }}
                      ></span>
                    </label>
                  ))}
                </div>
              )}
              
              {capas.length === 0 && (
                <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No hay capas cargadas.</p>
              )}
            </div>
            
            <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              {(dbUser?.rol === 'SUPER_ADMIN' || dbUser?.rol === 'ADMINISTRADOR' || dbUser?.rol === 'USUARIO') && (
                <a 
                  href="/transporte-pesado" 
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#8B5CF6',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    width: '80%',
                    textAlign: 'center'
                  }}
                >
                  Transporte Pesado (Asistente)
                </a>
              )}
              
              {(dbUser?.rol === 'SUPER_ADMIN' || dbUser?.rol === 'ADMINISTRADOR') && (
                <a 
                  href="/admin" 
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#0284c7',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    width: '80%',
                    textAlign: 'center'
                  }}
                >
                  Panel de Control
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className={styles.panelContent}>
            <h3 className={styles.panelTitle}>Información</h3>
            <p style={{ lineHeight: '1.6', color: '#444' }}>
              Plataforma del <strong>Municipio de Lanús</strong> para visualización y gestión del Sistema de Información Geográfica.
            </p>
            <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '20px' }}>
              Utiliza el panel de capas para visualizar diferentes redes y marcadores, o el panel de administración para subir nuevos archivos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
