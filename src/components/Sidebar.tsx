'use client';
import React, { useState, useMemo } from 'react';
import { Menu, Layers, Info } from 'lucide-react';
import styles from './Sidebar.module.css';

interface Capa {
  id: string;
  nombre: string;
  active: boolean;
  color: string;
}

interface SidebarProps {
  capas: Capa[];
  alternarCapa: (id: string) => void;
  activeTab: 'layers' | 'info' | null;
  setActiveTab: (tab: 'layers' | 'info' | null) => void;
}

export default function Sidebar({ capas, alternarCapa, activeTab, setActiveTab }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Group capas by base name
  const groupedCapas = useMemo(() => {
    const groups: Record<string, Capa[]> = {};
    const general: Capa[] = [];

    capas.forEach(capa => {
      if (capa.nombre.includes(' - ')) {
        const parts = capa.nombre.split(' - ');
        const baseName = parts[0];
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(capa);
      } else {
        general.push(capa);
      }
    });

    return { groups, general };
  }, [capas]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleGroupCheckbox = (groupName: string, active: boolean) => {
    const group = groupedCapas.groups[groupName];
    group.forEach(capa => {
      if (capa.active !== active) alternarCapa(capa.id);
    });
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
              {Object.entries(groupedCapas.groups).map(([groupName, groupCapas]) => {
                const isExpanded = expandedGroups[groupName];
                const allActive = groupCapas.every(l => l.active);
                const someActive = groupCapas.some(l => l.active) && !allActive;

                return (
                  <div key={groupName} className={styles.layerGroup}>
                    <div className={styles.groupHeader}>
                      <button 
                        className={styles.expandBtn}
                        onClick={() => toggleGroup(groupName)}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                      <input 
                        type="checkbox" 
                        checked={allActive}
                        ref={input => { if (input) input.indeterminate = someActive; }}
                        onChange={(e) => handleGroupCheckbox(groupName, e.target.checked)}
                        className={styles.groupCheckbox}
                      />
                      <span className={styles.groupName} onClick={() => toggleGroup(groupName)}>
                        {groupName}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className={styles.groupItems}>
                        {groupCapas.map(capa => {
                          const parts = capa.nombre.split(' - ');
                          const subName = parts.slice(1).join(' - ');
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

              {/* Render General Layers */}
              {groupedCapas.general.length > 0 && (
                <div className={styles.layerGroup} style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 10px', color: '#888' }}>Otras Capas</h4>
                  {groupedCapas.general.map(capa => (
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
