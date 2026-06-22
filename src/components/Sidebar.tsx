'use client';
import React, { useState, useMemo } from 'react';
import { Menu, Layers, Info } from 'lucide-react';
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
          <Menu size={22} />
        </div>
        <div 
          className={`${styles.navIcon} ${activeTab === 'layers' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab('layers')}
          title="Capas"
        >
          <Layers size={22} />
        </div>
        <div style={{ flex: 1 }}></div>
        <div 
          className={`${styles.navIcon} ${activeTab === 'info' ? styles.navIconActive : ''}`}
          onClick={() => setActiveTab('info')}
          title="Información"
        >
          <Info size={22} />
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
                            <div key={sgKey} className={styles.subLayerGroup} style={{ borderLeft: '2px solid #29B6F6', marginLeft: '12px', marginTop: '5px', marginBottom: '5px' }}>
                              <div className={styles.groupHeader} style={{ background: 'transparent', padding: '8px 12px', borderBottom: 'none' }}>
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
                                <div className={styles.groupItems} style={{ paddingLeft: '15px', paddingTop: 0 }}>
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
            
            <div style={{ marginTop: '30px', textAlign: 'center' }}>
              <a 
                href="/admin" 
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#29B6F6',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                Administrar Capas
              </a>
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
