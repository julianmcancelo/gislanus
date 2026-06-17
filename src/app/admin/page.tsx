'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';
import styles from './Admin.module.css';

const StaticMapPreview = dynamic(() => import('../../components/StaticMapPreview'), { ssr: false });

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'grupos' | 'capas' | 'solicitudes'
  
  // Dashboard & GIS State
  const [capas, setCapas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [subgrupos, setSubgrupos] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit & Bulk Delete State
  const [selectedCapas, setSelectedCapas] = useState<string[]>([]);
  const [editingCapa, setEditingCapa] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editGrupoId, setEditGrupoId] = useState<string>('');
  const [editSubGrupoId, setEditSubGrupoId] = useState<string>('');
  const [editColor, setEditColor] = useState('');

  // Grupo Form State
  const [grupoNombre, setGrupoNombre] = useState('');
  const [grupoColor, setGrupoColor] = useState('#10B981');
  const [editingGrupo, setEditingGrupo] = useState<string | null>(null);

  // SubGrupo Form State
  const [subGrupoNombre, setSubGrupoNombre] = useState('');
  const [subGrupoColor, setSubGrupoColor] = useState('#10B981');
  const [subGrupoParentId, setSubGrupoParentId] = useState('');
  const [editingSubGrupo, setEditingSubGrupo] = useState<string | null>(null);

  // Capa Form state
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#B71C1C');
  const [grupoId, setGrupoId] = useState('');
  const [subGrupoId, setSubGrupoId] = useState('');
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'url'
  const [url, setUrl] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState('geojson');
  const [fileName, setFileName] = useState('');

  // Preview state
  const [previewCapas, setPreviewCapas] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resCapas, resGrupos, resSubGrupos, resRutas] = await Promise.all([
        fetch('/api/capas'),
        fetch('/api/grupos'),
        fetch('/api/subgrupos'),
        fetch('/api/rutas-transporte')
      ]);
      const dataCapas = await resCapas.json();
      const dataGrupos = await resGrupos.json();
      const dataSubGrupos = await resSubGrupos.json();
      const dataRutas = await resRutas.json();

      setCapas(Array.isArray(dataCapas) ? dataCapas : []);
      setGrupos(Array.isArray(dataGrupos) ? dataGrupos : []);
      setSubgrupos(Array.isArray(dataSubGrupos) ? dataSubGrupos : []);
      setRutas(Array.isArray(dataRutas) ? dataRutas : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // ----- GRUPOS LOGIC -----
  const handleAddGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grupoNombre) return;
    setIsProcessing(true);
    try {
      await fetch('/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: grupoNombre, color: grupoColor })
      });
      setGrupoNombre('');
      fetchData();
    } catch (e) {
      alert('Error al crear grupo');
    }
    setIsProcessing(false);
  };

  const saveEditGrupo = async (id: string) => {
    try {
      await fetch(`/api/grupos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: grupoNombre, color: grupoColor })
      });
      setEditingGrupo(null);
      fetchData();
    } catch (e) {
      alert('Error al editar grupo');
    }
  };

  const handleDeleteGrupo = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este grupo?')) {
      await fetch(`/api/grupos/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const startEditingGrupo = (g: any) => {
    setEditingGrupo(g.id);
    setGrupoNombre(g.nombre);
    setGrupoColor(g.color);
  };

  // ----- SUBGRUPOS LOGIC -----
  const handleAddSubGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subGrupoNombre || !subGrupoParentId) return;
    setIsProcessing(true);
    try {
      await fetch('/api/subgrupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: subGrupoNombre, color: subGrupoColor, grupoId: subGrupoParentId })
      });
      setSubGrupoNombre('');
      fetchData();
    } catch (e) {
      alert('Error al crear sub-grupo');
    }
    setIsProcessing(false);
  };

  const saveEditSubGrupo = async (id: string) => {
    try {
      await fetch(`/api/subgrupos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: subGrupoNombre, color: subGrupoColor, grupoId: subGrupoParentId })
      });
      setEditingSubGrupo(null);
      fetchData();
    } catch (e) {
      alert('Error al editar sub-grupo');
    }
  };

  const handleDeleteSubGrupo = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este sub-grupo?')) {
      await fetch(`/api/subgrupos/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const startEditingSubGrupo = (sg: any) => {
    setEditingSubGrupo(sg.id);
    setSubGrupoNombre(sg.nombre);
    setSubGrupoColor(sg.color);
    setSubGrupoParentId(sg.grupoId);
  };

  // ----- CAPAS LOGIC -----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      
      const isKmz = file.name.toLowerCase().endsWith('.kmz');
      const isKml = file.name.toLowerCase().endsWith('.kml');
      setFileType('geojson'); // KML/KMZ will be converted to GeoJSON

      try {
        if (isKmz) {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          
          const kmlFile = Object.values(loadedZip.files).find(f => f.name.toLowerCase().endsWith('.kml'));
          if (!kmlFile) throw new Error('No se encontró archivo .kml dentro del .kmz');
          
          const kmlText = await kmlFile.async('text');
          const parser = new DOMParser();
          const kmlDom = parser.parseFromString(kmlText, 'text/xml');
          const geoJsonObj = kml(kmlDom);
          setFileContent(JSON.stringify(geoJsonObj));
          
        } else if (isKml) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              const parser = new DOMParser();
              const kmlDom = parser.parseFromString(event.target.result as string, 'text/xml');
              const geoJsonObj = kml(kmlDom);
              setFileContent(JSON.stringify(geoJsonObj));
            }
          };
          reader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setFileContent(event.target.result as string);
            }
          };
          reader.readAsText(file);
        }
      } catch (err) {
        console.error(err);
        alert("Error procesando el archivo. Asegúrate que sea un KML, KMZ o GeoJSON válido.");
        setFileName('');
        setFileContent('');
      }
    }
  };

  const handleSubmitCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return alert('El nombre es obligatorio');
    
    setIsProcessing(true);
    const body: any = { name: nombre, color, grupoId: grupoId || null, subGrupoId: subGrupoId || null };
    
    if (uploadType === 'file') {
      if (!fileContent) {
        setIsProcessing(false);
        return alert('Debes seleccionar un archivo');
      }
      body.geoData = fileContent;
      body.type = fileType;
    } else {
      if (!url) {
        setIsProcessing(false);
        return alert('Debes ingresar una URL');
      }
      body.url = url;
      body.type = url.toLowerCase().endsWith('.kml') ? 'kml' : 'geojson';
    }

    try {
      if (body.type === 'geojson') {
        let geoDataObj = typeof body.geoData === 'string' ? JSON.parse(body.geoData) : body.geoData;
        
        if (geoDataObj.type === 'FeatureCollection' && Array.isArray(geoDataObj.features)) {
          const sublayers: Record<string, any[]> = {};
          
          const groupMap = new Map<string, string>();
          if (Array.isArray(geoDataObj.groups)) {
             geoDataObj.groups.forEach((g: any) => {
                if (g.id && (g.title || g.name)) {
                   groupMap.set(String(g.id), g.title || g.name);
                }
             });
          }
          
          geoDataObj.features.forEach((feature: any) => {
             const props = feature.properties || {};
             const groupKey = props.group || props.layer || props.folder || feature.geometry?.type || 'Capa Principal';
             const stringKey = String(groupKey);
             if (!sublayers[stringKey]) sublayers[stringKey] = [];
             sublayers[stringKey].push(feature);
          });

          const generatedCapas = Object.entries(sublayers).map(([key, features], idx) => {
             let subColor = color;
             let displayNombre = key;

             if (groupMap.has(key)) {
                displayNombre = groupMap.get(key)!;
             } 
             else if (/^\d+$/.test(key) || key === 'Capa Principal') {
                const namedFeature = features.find(f => f.properties?.title || f.properties?.name || f.properties?.nombre || f.properties?.layer);
                if (namedFeature) {
                   displayNombre = namedFeature.properties.title || namedFeature.properties.name || namedFeature.properties.nombre || namedFeature.properties.layer;
                }
             }

             const coloredFeature = features.find(f => f.properties?.stroke || f.properties?.fill || f.properties?.color);
             if (coloredFeature) {
                subColor = coloredFeature.properties.stroke || coloredFeature.properties.fill || coloredFeature.properties.color;
             }

             return {
                id: `mock-${idx}`,
                grupoId: grupoId || null,
                subGrupoId: subGrupoId || null,
                nombre: displayNombre !== 'Capa Principal' && displayNombre !== 'Point' && displayNombre !== 'LineString' && displayNombre !== 'Polygon' && displayNombre !== 'MultiPolygon' ? displayNombre : `Sub-Capa ${idx + 1} (${features.length} elementos)`,
                color: subColor,
                tipo: 'geojson',
                datosGeo: JSON.stringify({ type: 'FeatureCollection', features })
             };
          });
          
          setPreviewCapas(generatedCapas);
          setIsProcessing(false);
          return;
        }
      }

      setPreviewCapas([{ id: 'mock-1', grupoId: grupoId || null, subGrupoId: subGrupoId || null, nombre, color, tipo: body.type, datosGeo: body.geoData }]);

    } catch (err) {
      alert('Error al parsear el archivo. Asegurate de que sea válido.');
    }
    setIsProcessing(false);
  };

  const handlePreviewNameChange = (index: number, newName: string) => {
    const updated = [...previewCapas];
    updated[index].nombre = newName;
    setPreviewCapas(updated);
  };

  const handlePreviewColorChange = (index: number, newColor: string) => {
    const updated = [...previewCapas];
    updated[index].color = newColor;
    setPreviewCapas(updated);
  };

  const handlePreviewSubGrupoChange = (index: number, newSubGrupoId: string) => {
    const updated = [...previewCapas];
    updated[index].subGrupoId = newSubGrupoId || null;
    setPreviewCapas(updated);
  };

  const handleConfirmUpload = async () => {
    setIsProcessing(true);
    try {
      for (const capa of previewCapas) {
        await fetch('/api/capas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: capa.nombre,
            color: capa.color,
            type: capa.tipo,
            geoData: capa.datosGeo,
            grupoId: capa.grupoId,
            subGrupoId: capa.subGrupoId
          }),
        });
      }
      
      alert('Capa(s) guardada(s) correctamente');
      fetchData();
      setPreviewCapas([]);
      setNombre('');
      setUrl('');
      setFileContent('');
      setFileName('');
      setGrupoId('');
      setSubGrupoId('');
    } catch (err) {
      alert('Error de conexión');
    }
    setIsProcessing(false);
  };

  const handleDeleteCapa = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta capa?')) {
      await fetch(`/api/capas/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleSelectCapa = (id: string) => {
    setSelectedCapas(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCapas(capas.map(c => c.id));
    } else {
      setSelectedCapas([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCapas.length === 0) return;
    if (confirm(`¿Seguro que deseas eliminar ${selectedCapas.length} capa(s)?`)) {
      for (const id of selectedCapas) {
        await fetch(`/api/capas/${id}`, { method: 'DELETE' });
      }
      setSelectedCapas([]);
      fetchData();
    }
  };

  const startEditingCapa = (capa: any) => {
    setEditingCapa(capa.id);
    setEditNombre(capa.nombre);
    setEditGrupoId(capa.grupoId || '');
    setEditSubGrupoId(capa.subGrupoId || '');
    setEditColor(capa.color);
  };

  const saveEditCapa = async (id: string) => {
    try {
      await fetch(`/api/capas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: editNombre.trim(), 
          color: editColor, 
          grupoId: editGrupoId || null,
          subGrupoId: editSubGrupoId || null
        })
      });
      setEditingCapa(null);
      fetchData();
    } catch (e) {
      alert('Error al guardar cambios');
    }
  };

  // ----- RUTAS LOGIC -----
  const handleEstadoRuta = async (id: string, nuevoEstado: string) => {
    try {
      await fetch(`/api/rutas-transporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      fetchData();
    } catch (e) {
      alert('Error al actualizar el estado.');
    }
  };

  const handleDeleteRuta = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta solicitud de forma permanente?')) {
      try {
        await fetch(`/api/rutas-transporte/${id}`, { method: 'DELETE' });
        fetchData();
      } catch (e) {
        alert('Error al eliminar la solicitud.');
      }
    }
  };

  return (
    <div className={styles.adminContainer}>
      <header className={styles.header}>
        <h1>Administración de Capas GIS - Lanús</h1>
        <a href="/" className={styles.backButton}>Ir al Mapa</a>
      </header>
      
      <div className={styles.tabsContainer}>
        <button className={`${styles.tabButton} ${activeTab === 'dashboard' ? styles.active : ''}`} onClick={() => setActiveTab('dashboard')}>
          Dashboard
        </button>
        <button className={`${styles.tabButton} ${activeTab === 'grupos' ? styles.active : ''}`} onClick={() => setActiveTab('grupos')}>
          Grupos & Sub-grupos
        </button>
        <button className={`${styles.tabButton} ${activeTab === 'capas' ? styles.active : ''}`} onClick={() => setActiveTab('capas')}>
          Capas
        </button>
        <button className={`${styles.tabButton} ${activeTab === 'solicitudes' ? styles.active : ''}`} onClick={() => setActiveTab('solicitudes')}>
          Transporte Pesado
        </button>
      </div>
      
      <div className={styles.mainContent}>
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <section className={styles.fullSection}>
            <h2>Resumen General</h2>
            {loading ? <p>Cargando estadísticas...</p> : (
              <div className={styles.dashboardGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{grupos.length}</div>
                  <div className={styles.statLabel}>Grupos Creados</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{subgrupos.length}</div>
                  <div className={styles.statLabel}>Sub-grupos Creados</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{capas.length}</div>
                  <div className={styles.statLabel}>Capas Activas</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statValue}>{rutas.filter(r => r.estado === 'PENDIENTE').length}</div>
                  <div className={styles.statLabel}>Rutas Pendientes</div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* GRUPOS TAB */}
        {activeTab === 'grupos' && (
          <div className={styles.gruposGrid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <section className={styles.formSection}>
                <h2>Agregar Grupo Principal</h2>
                <form onSubmit={handleAddGrupo} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>Nombre del Grupo</label>
                    <input type="text" value={grupoNombre} onChange={e => setGrupoNombre(e.target.value)} placeholder="Ej. Zonas Escolares" required disabled={editingGrupo !== null} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Color representativo predeterminado</label>
                    <input type="color" value={grupoColor} onChange={e => setGrupoColor(e.target.value)} disabled={editingGrupo !== null} />
                  </div>
                  <button type="submit" className={styles.submitBtn} disabled={isProcessing || editingGrupo !== null}>
                    Crear Grupo
                  </button>
                </form>
              </section>

              <section className={styles.formSection}>
                <h2>Agregar Sub-grupo</h2>
                <form onSubmit={handleAddSubGrupo} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>Grupo Padre</label>
                    <select value={subGrupoParentId} onChange={e => setSubGrupoParentId(e.target.value)} required disabled={editingSubGrupo !== null}>
                      <option value="">-- Seleccionar Padre --</option>
                      {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Nombre del Sub-grupo</label>
                    <input type="text" value={subGrupoNombre} onChange={e => setSubGrupoNombre(e.target.value)} placeholder="Ej. Escuelas Primarias" required disabled={editingSubGrupo !== null} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Color representativo predeterminado</label>
                    <input type="color" value={subGrupoColor} onChange={e => setSubGrupoColor(e.target.value)} disabled={editingSubGrupo !== null} />
                  </div>
                  <button type="submit" className={styles.submitBtn} disabled={isProcessing || editingSubGrupo !== null || grupos.length === 0}>
                    Crear Sub-grupo
                  </button>
                </form>
              </section>
            </div>
            
            <section className={styles.listSection}>
              <h2 style={{ margin: 0, marginBottom: '15px' }}>Estructura de Grupos</h2>
              {grupos.map(g => {
                const sgs = subgrupos.filter(sg => sg.grupoId === g.id);
                return (
                  <div key={g.id} style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {editingGrupo === g.id ? (
                          <input type="color" value={grupoColor} onChange={e => setGrupoColor(e.target.value)} style={{ width: '30px', height: '30px', border: 'none', padding: 0, cursor: 'pointer' }} />
                        ) : (
                          <span className={styles.colorDot} style={{ backgroundColor: g.color }}></span>
                        )}
                        {editingGrupo === g.id ? (
                          <input type="text" value={grupoNombre} onChange={e => setGrupoNombre(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }} />
                        ) : (
                          <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{g.nombre}</strong>
                        )}
                      </div>
                      <div>
                        {editingGrupo === g.id ? (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button className={styles.approveBtn} onClick={() => saveEditGrupo(g.id)}>Guardar</button>
                            <button className={styles.rejectBtn} onClick={() => setEditingGrupo(null)}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button className={styles.submitBtn} onClick={() => startEditingGrupo(g)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Editar</button>
                            <button className={styles.deleteBtn} onClick={() => handleDeleteGrupo(g.id)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Eliminar</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Subgrupos */}
                    {sgs.length > 0 && (
                      <div style={{ paddingLeft: '40px' }}>
                        <table className={styles.table} style={{ marginTop: '10px' }}>
                          <tbody>
                            {sgs.map(sg => (
                              <tr key={sg.id} style={{ background: 'rgba(0,0,0,0.1)' }}>
                                <td style={{ width: '40px' }}>
                                  {editingSubGrupo === sg.id ? (
                                    <input type="color" value={subGrupoColor} onChange={e => setSubGrupoColor(e.target.value)} style={{ width: '25px', height: '25px', border: 'none', padding: 0 }} />
                                  ) : (
                                    <span className={styles.colorDot} style={{ backgroundColor: sg.color, width: '15px', height: '15px' }}></span>
                                  )}
                                </td>
                                <td>
                                  {editingSubGrupo === sg.id ? (
                                    <input type="text" value={subGrupoNombre} onChange={e => setSubGrupoNombre(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }} />
                                  ) : (
                                    <span style={{ color: '#ccc' }}>{sg.nombre}</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {editingSubGrupo === sg.id ? (
                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                      <button className={styles.approveBtn} onClick={() => saveEditSubGrupo(sg.id)}>Guardar</button>
                                      <button className={styles.rejectBtn} onClick={() => setEditingSubGrupo(null)}>Cancelar</button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                      <button className={styles.submitBtn} onClick={() => startEditingSubGrupo(sg)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Editar</button>
                                      <button className={styles.deleteBtn} onClick={() => handleDeleteSubGrupo(sg.id)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Eliminar</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {grupos.length === 0 && (
                <p style={{ textAlign: 'center' }}>No hay grupos.</p>
              )}
            </section>
          </div>
        )}

        {/* CAPAS TAB */}
        {activeTab === 'capas' && (
          <div className={styles.gisGrid}>
            {previewCapas.length > 0 ? (
              <section className={styles.previewSection}>
                <h2>Previsualización de Grupos Extraídos</h2>
                <p>Se detectaron múltiples capas internas. Verificá los detalles antes de guardarlas.</p>
                
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Color</th>
                      <th>Sub-grupo de destino</th>
                      <th>Nombre de Sub-capa</th>
                      <th>Tipo Interno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCapas.map((capa, idx) => (
                      <tr key={capa.id}>
                        <td>
                          <input 
                            type="color" value={capa.color} onChange={(e) => handlePreviewColorChange(idx, e.target.value)} 
                            style={{ cursor: 'pointer', width: '40px', height: '40px', padding: '0', border: 'none' }}
                          />
                        </td>
                        <td>
                          <select 
                            value={capa.subGrupoId || ''} 
                            onChange={(e) => handlePreviewSubGrupoChange(idx, e.target.value)}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', background: '#333', color: 'white' }}
                          >
                            <option value="">- N/A -</option>
                            {subgrupos.filter(sg => sg.grupoId === capa.grupoId).map(sg => (
                              <option key={sg.id} value={sg.id}>{sg.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input 
                            type="text" value={capa.nombre} onChange={(e) => handlePreviewNameChange(idx, e.target.value)} 
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                        </td>
                        <td>{capa.tipo?.toUpperCase() || 'GEOJSON'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                  <button onClick={handleConfirmUpload} className={styles.submitBtn} disabled={isProcessing}>
                    {isProcessing ? 'Guardando...' : 'Confirmar y Guardar'}
                  </button>
                  <button onClick={() => setPreviewCapas([])} className={styles.deleteBtn}>
                    Cancelar
                  </button>
                </div>
              </section>
            ) : (
              <section className={styles.formSection}>
                <h2>Agregar Nueva Capa</h2>
                <form onSubmit={handleSubmitCapa} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>Nombre Base de la Capa</label>
                    <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Zonas Escolares" required />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Grupo / Categoría</label>
                    <select value={grupoId} onChange={e => {
                      setGrupoId(e.target.value);
                      setSubGrupoId(''); // reset subgrupo when grupo changes
                    }}>
                      <option value="">-- Sin Grupo --</option>
                      {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>

                  {grupoId && subgrupos.filter(sg => sg.grupoId === grupoId).length > 0 && (
                    <div className={styles.formGroup}>
                      <label>Sub-grupo (Opcional)</label>
                      <select value={subGrupoId} onChange={e => setSubGrupoId(e.target.value)}>
                        <option value="">-- Sin Sub-grupo --</option>
                        {subgrupos.filter(sg => sg.grupoId === grupoId).map(sg => <option key={sg.id} value={sg.id}>{sg.nombre}</option>)}
                      </select>
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label>Color representativo</label>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Fuente de Datos</label>
                    <select value={uploadType} onChange={e => setUploadType(e.target.value)}>
                      <option value="file">Subir Archivo (.geojson, .kml)</option>
                      <option value="url">URL Externa (Maphub, etc.)</option>
                    </select>
                  </div>

                  {uploadType === 'file' ? (
                    <div className={styles.formGroup}>
                      <label>Seleccionar Archivo</label>
                      <input type="file" accept=".geojson,.json,.kml,.kmz" onChange={handleFileChange} />
                      {fileName && <small>Archivo seleccionado: {fileName}</small>}
                    </div>
                  ) : (
                    <div className={styles.formGroup}>
                      <label>URL del GeoJSON / KML</label>
                      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  )}

                  <button type="submit" className={styles.submitBtn} disabled={isProcessing}>
                    {isProcessing ? 'Procesando archivo...' : 'Procesar Capa'}
                  </button>
                </form>
              </section>
            )}

            <section className={styles.listSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0 }}>Capas Registradas</h2>
                {selectedCapas.length > 0 && (
                  <button className={styles.deleteBtn} onClick={handleBulkDelete}>
                    Eliminar {selectedCapas.length} seleccionadas
                  </button>
                )}
              </div>
              {loading ? <p>Cargando...</p> : (
                <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input type="checkbox" onChange={handleSelectAll} checked={capas.length > 0 && selectedCapas.length === capas.length} />
                      </th>
                      <th>Color</th>
                      <th>Ubicación</th>
                      <th>Nombre</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capas.map(capa => (
                      <tr key={capa.id} style={{ backgroundColor: selectedCapas.includes(capa.id) ? 'rgba(41, 182, 246, 0.1)' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedCapas.includes(capa.id)} onChange={() => handleSelectCapa(capa.id)} />
                        </td>
                        <td>
                          {editingCapa === capa.id ? (
                            <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} style={{ width: '40px', height: '40px', border: 'none', padding: 0 }} />
                          ) : (
                            <span className={styles.colorDot} style={{ backgroundColor: capa.color }}></span>
                          )}
                        </td>
                        <td>
                          {editingCapa === capa.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              <select value={editGrupoId} onChange={e => {
                                setEditGrupoId(e.target.value);
                                setEditSubGrupoId('');
                              }} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }}>
                                <option value="">- Grupo -</option>
                                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                              </select>
                              {editGrupoId && subgrupos.filter(sg => sg.grupoId === editGrupoId).length > 0 && (
                                <select value={editSubGrupoId} onChange={e => setEditSubGrupoId(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }}>
                                  <option value="">- Sub-grupo -</option>
                                  {subgrupos.filter(sg => sg.grupoId === editGrupoId).map(sg => <option key={sg.id} value={sg.id}>{sg.nombre}</option>)}
                                </select>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{capa.grupo ? capa.grupo.nombre : '-'}</div>
                              {capa.subGrupo && <div style={{ fontSize: '0.8rem', color: '#ccc' }}>↳ {capa.subGrupo.nombre}</div>}
                            </div>
                          )}
                        </td>
                        <td>
                          {editingCapa === capa.id ? (
                            <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }} />
                          ) : (
                            capa.nombre
                          )}
                        </td>
                        <td>
                          {editingCapa === capa.id ? (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button className={styles.approveBtn} onClick={() => saveEditCapa(capa.id)} style={{ padding: '6px 12px' }}>Guardar</button>
                              <button className={styles.rejectBtn} onClick={() => setEditingCapa(null)} style={{ padding: '6px 12px' }}>Cancelar</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button className={styles.submitBtn} onClick={() => startEditingCapa(capa)} style={{ padding: '6px 12px' }}>Editar</button>
                              <button className={styles.deleteBtn} onClick={() => handleDeleteCapa(capa.id)} style={{ padding: '6px 12px' }}>Eliminar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {capas.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center' }}>No hay capas registradas.</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* RUTAS TAB */}
        {activeTab === 'solicitudes' && (
          <section className={styles.fullSection}>
            <h2>Solicitudes de Transporte Pesado</h2>
            <p style={{ marginBottom: '20px', color: '#ccc' }}>Gestione las rutas propuestas por los choferes y transportistas.</p>
            {loading ? <p>Cargando solicitudes...</p> : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID Solicitud</th>
                      <th>Solicitante</th>
                      <th>Estado</th>
                      <th>Mapa</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rutas.map(ruta => (
                      <tr key={ruta.id}>
                        <td><strong>#{ruta.numeroSolicitud}</strong><br/><small style={{color:'#888'}}>{new Date(ruta.creadoEn).toLocaleDateString()}</small></td>
                        <td>{ruta.nombreSolicitante}</td>
                        <td>
                          <span className={`${styles.badge} ${
                            ruta.estado === 'PENDIENTE' ? styles.badgePendiente : 
                            ruta.estado === 'APROBADA' ? styles.badgeAprobada : styles.badgeRechazada
                          }`}>
                            {ruta.estado}
                          </span>
                        </td>
                        <td>
                          <div className={styles.mapPreviewWrapper}>
                            <StaticMapPreview geoData={
                              typeof ruta.datosGeo === 'string' ? 
                                ((): any => { try { return JSON.parse(ruta.datosGeo); } catch { return null; } })() 
                                : ruta.datosGeo
                            } />
                          </div>
                        </td>
                        <td>
                          {ruta.estado === 'PENDIENTE' && (
                            <>
                              <button className={styles.approveBtn} onClick={() => handleEstadoRuta(ruta.id, 'APROBADA')}>Aprobar</button>
                              <button className={styles.rejectBtn} onClick={() => handleEstadoRuta(ruta.id, 'RECHAZADA')}>Rechazar</button>
                            </>
                          )}
                          {ruta.estado !== 'PENDIENTE' && (
                            <button className={styles.approveBtn} onClick={() => handleEstadoRuta(ruta.id, 'PENDIENTE')}>Reabrir</button>
                          )}
                          <button className={styles.deleteBtn} onClick={() => handleDeleteRuta(ruta.id)}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                    {rutas.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center' }}>No hay solicitudes de transporte.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
