'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './Admin.module.css';

const StaticMapPreview = dynamic(() => import('../../components/StaticMapPreview'), { ssr: false });

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('gis'); // 'gis' | 'solicitudes'
  
  // GIS State
  const [capas, setCapas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rutas State
  const [rutas, setRutas] = useState<any[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(true);
  
  // Edit & Bulk Delete State
  const [selectedCapas, setSelectedCapas] = useState<string[]>([]);
  const [editingCapa, setEditingCapa] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editColor, setEditColor] = useState('');

  // Form state
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#B71C1C');
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'url'
  const [url, setUrl] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState('geojson');
  const [fileName, setFileName] = useState('');

  // Preview state
  const [previewCapas, setPreviewCapas] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchCapas();
    fetchRutas();
  }, []);

  const fetchRutas = async () => {
    try {
      const res = await fetch('/api/rutas-transporte');
      const data = await res.json();
      setRutas(Array.isArray(data) ? data : []);
    } catch (e) {
      setRutas([]);
    }
    setLoadingRutas(false);
  };

  const fetchCapas = async () => {
    try {
      const res = await fetch('/api/capas');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCapas(data);
      } else {
        setCapas([]);
      }
    } catch (e) {
      setCapas([]);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setFileType(file.name.toLowerCase().endsWith('.kml') ? 'kml' : 'geojson');
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFileContent(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return alert('El nombre es obligatorio');
    
    setIsProcessing(true);
    const body: any = { name: nombre, color };
    
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
          
          // MapHub guarda los nombres de los grupos en un array a nivel raíz
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

             // Primero, intentamos sacar el nombre desde el mapa de grupos (MapHub)
             if (groupMap.has(key)) {
                displayNombre = groupMap.get(key)!;
             } 
             // Si no hay mapa de grupos, pero es un número, intentamos buscar el nombre en el feature
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
                grupo: nombre, // Default group name from user input
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

      // Fallback for KML or single layer GeoJSONs
      setPreviewCapas([{ id: 'mock-1', grupo: '', nombre, color, tipo: body.type, datosGeo: body.geoData }]);

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

  const handlePreviewGroupChange = (index: number, newGroup: string) => {
    const updated = [...previewCapas];
    updated[index].grupo = newGroup;
    setPreviewCapas(updated);
  };

  const handlePreviewColorChange = (index: number, newColor: string) => {
    const updated = [...previewCapas];
    updated[index].color = newColor;
    setPreviewCapas(updated);
  };

  const handleConfirmUpload = async () => {
    setIsProcessing(true);
    try {
      for (const capa of previewCapas) {
        const finalName = capa.grupo ? `${capa.grupo} - ${capa.nombre}` : capa.nombre;
        await fetch('/api/capas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: finalName,
            color: capa.color,
            type: capa.tipo,
            geoData: capa.datosGeo
          }),
        });
      }
      
      alert('Capa(s) guardada(s) correctamente');
      fetchCapas();
      setPreviewCapas([]);
      setNombre('');
      setUrl('');
      setFileContent('');
      setFileName('');
    } catch (err) {
      alert('Error de conexión');
    }
    setIsProcessing(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta capa?')) {
      await fetch(`/api/capas/${id}`, { method: 'DELETE' });
      fetchCapas();
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
      fetchCapas();
    }
  };

  const startEditing = (capa: any) => {
    setEditingCapa(capa.id);
    setEditNombre(capa.nombre);
    setEditColor(capa.color);
  };

  const saveEdit = async (id: string) => {
    try {
      await fetch(`/api/capas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre, color: editColor })
      });
      setEditingCapa(null);
      fetchCapas();
    } catch (e) {
      alert('Error al guardar cambios');
    }
  };

  const handleEstadoRuta = async (id: string, nuevoEstado: string) => {
    try {
      await fetch(`/api/rutas-transporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      fetchRutas();
    } catch (e) {
      alert('Error al actualizar el estado.');
    }
  };

  const handleDeleteRuta = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta solicitud de forma permanente?')) {
      try {
        await fetch(`/api/rutas-transporte/${id}`, { method: 'DELETE' });
        fetchRutas();
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
        <button 
          className={`${styles.tabButton} ${activeTab === 'gis' ? styles.active : ''}`}
          onClick={() => setActiveTab('gis')}
        >
          Gestión de Capas GIS
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'solicitudes' ? styles.active : ''}`}
          onClick={() => setActiveTab('solicitudes')}
        >
          Solicitudes de Transporte
        </button>
      </div>
      
      <div className={styles.mainContent}>
        {activeTab === 'gis' && (
          <div className={styles.gisGrid}>
            {previewCapas.length > 0 ? (
          <section className={styles.previewSection}>
            <h2>Previsualización de Grupos Extraídos</h2>
            <p>Se detectaron múltiples grupos. Puedes asignar un color y nombre a cada uno antes de guardarlos.</p>
            
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Color</th>
                  <th>Grupo (Menú Lateral)</th>
                  <th>Nombre de Sub-capa</th>
                  <th>Tipo Interno</th>
                </tr>
              </thead>
              <tbody>
                {previewCapas.map((capa, idx) => (
                  <tr key={capa.id}>
                    <td>
                      <input 
                        type="color" 
                        value={capa.color} 
                        onChange={(e) => handlePreviewColorChange(idx, e.target.value)} 
                        style={{ cursor: 'pointer', width: '40px', height: '40px', padding: '0', border: 'none' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={capa.grupo || ''} 
                        onChange={(e) => handlePreviewGroupChange(idx, e.target.value)} 
                        placeholder="Ej: Salud"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={capa.nombre} 
                        onChange={(e) => handlePreviewNameChange(idx, e.target.value)} 
                        placeholder="Ej: Hospitales"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </td>
                    <td>{capa.tipo?.toUpperCase() || 'GEOJSON'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button 
                onClick={handleConfirmUpload} 
                className={styles.submitBtn} 
                disabled={isProcessing}
              >
                {isProcessing ? 'Guardando...' : 'Confirmar y Guardar'}
              </button>
              <button 
                onClick={() => setPreviewCapas([])} 
                className={styles.deleteBtn}
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : (
          <section className={styles.formSection}>
            <h2>Agregar Nueva Capa</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Nombre Base de la Capa</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Zonas Escolares" required />
              </div>
              
              <div className={styles.formGroup}>
                <label>Color representativo predeterminado</label>
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
                  <input type="file" accept=".geojson,.json,.kml" onChange={handleFileChange} />
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
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={capas.length > 0 && selectedCapas.length === capas.length}
                    />
                  </th>
                  <th>Color</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {capas.map(capa => (
                  <tr key={capa.id} style={{ backgroundColor: selectedCapas.includes(capa.id) ? 'rgba(41, 182, 246, 0.1)' : 'transparent' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedCapas.includes(capa.id)}
                        onChange={() => handleSelectCapa(capa.id)}
                      />
                    </td>
                    <td>
                      {editingCapa === capa.id ? (
                        <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} style={{ width: '40px', height: '40px', border: 'none', padding: 0, cursor: 'pointer' }} />
                      ) : (
                        <span className={styles.colorDot} style={{ backgroundColor: capa.color }}></span>
                      )}
                    </td>
                    <td>
                      {editingCapa === capa.id ? (
                        <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: '#fff' }} />
                      ) : (
                        capa.nombre
                      )}
                    </td>
                    <td>{capa.tipo.toUpperCase()}</td>
                    <td>{new Date(capa.creadoEn).toLocaleDateString()}</td>
                    <td>
                      {editingCapa === capa.id ? (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button className={styles.approveBtn} onClick={() => saveEdit(capa.id)} style={{ padding: '6px 12px', fontSize: '0.9em' }}>Guardar</button>
                          <button className={styles.rejectBtn} onClick={() => setEditingCapa(null)} style={{ padding: '6px 12px', fontSize: '0.9em' }}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button className={styles.submitBtn} onClick={() => startEditing(capa)} style={{ padding: '6px 12px', fontSize: '0.9em', minWidth: '80px' }}>Editar</button>
                          <button className={styles.deleteBtn} onClick={() => handleDelete(capa.id)} style={{ padding: '6px 12px', fontSize: '0.9em', minWidth: '80px' }}>Eliminar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {capas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center' }}>No hay capas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
          </div>
        )}

        {activeTab === 'solicitudes' && (
          <section className={styles.fullSection}>
            <h2>Solicitudes de Transporte Pesado</h2>
            <p style={{ marginBottom: '20px', color: '#ccc' }}>
              Gestione las rutas propuestas por los choferes y transportistas.
            </p>
            {loadingRutas ? <p>Cargando solicitudes...</p> : (
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
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center' }}>No hay solicitudes de transporte.</td>
                      </tr>
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
