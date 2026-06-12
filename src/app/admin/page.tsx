'use client';
import React, { useState, useEffect } from 'react';
import styles from './Admin.module.css';

export default function AdminPage() {
  const [layers, setLayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState('#B71C1C');
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'url'
  const [url, setUrl] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState('geojson');
  const [fileName, setFileName] = useState('');

  // Preview state
  const [previewLayers, setPreviewLayers] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchLayers();
  }, []);

  const fetchLayers = async () => {
    const res = await fetch('/api/layers');
    const data = await res.json();
    setLayers(data);
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
    if (!name) return alert('El nombre es obligatorio');
    
    setIsProcessing(true);
    const body: any = { name, color };
    
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
      // First, do a dryRun to preview the extracted layers
      const res = await fetch('/api/layers?dryRun=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        const generated = await res.json();
        setPreviewLayers(generated);
      } else {
        alert('Error al procesar el archivo');
      }
    } catch (err) {
      alert('Error en la conexión al servidor');
    }
    setIsProcessing(false);
  };

  const handlePreviewNameChange = (index: number, newName: string) => {
    const updated = [...previewLayers];
    updated[index].name = newName;
    setPreviewLayers(updated);
  };

  const handlePreviewColorChange = (index: number, newColor: string) => {
    const updated = [...previewLayers];
    updated[index].color = newColor;
    setPreviewLayers(updated);
  };

  const handleConfirmUpload = async () => {
    setIsProcessing(true);
    try {
      // Clean up mock IDs from dryRun
      const payload = previewLayers.map(({ id, ...rest }) => rest);
      
      const res = await fetch('/api/layers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // Send array for bulk create
      });
      
      if (res.ok) {
        alert('Capa(s) guardada(s) correctamente');
        fetchLayers();
        setPreviewLayers([]);
        setName('');
        setUrl('');
        setFileContent('');
        setFileName('');
      } else {
        alert('Error al guardar capas');
      }
    } catch (err) {
      alert('Error de conexión');
    }
    setIsProcessing(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta capa?')) {
      await fetch(`/api/layers/${id}`, { method: 'DELETE' });
      fetchLayers();
    }
  };

  return (
    <div className={styles.adminContainer}>
      <header className={styles.header}>
        <h1>Administración de Capas GIS - Lanús</h1>
        <a href="/" className={styles.backButton}>Ir al Mapa</a>
      </header>
      
      <div className={styles.mainContent}>
        {previewLayers.length > 0 ? (
          <section className={styles.previewSection}>
            <h2>Previsualización de Grupos Extraídos</h2>
            <p>Se detectaron múltiples grupos. Puedes asignar un color y nombre a cada uno antes de guardarlos.</p>
            
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Color</th>
                  <th>Nombre a Guardar</th>
                  <th>Tipo Interno</th>
                </tr>
              </thead>
              <tbody>
                {previewLayers.map((layer, idx) => (
                  <tr key={layer.id}>
                    <td>
                      <input 
                        type="color" 
                        value={layer.color} 
                        onChange={(e) => handlePreviewColorChange(idx, e.target.value)} 
                        style={{ cursor: 'pointer', width: '40px', height: '40px', padding: '0', border: 'none' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={layer.name} 
                        onChange={(e) => handlePreviewNameChange(idx, e.target.value)} 
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                      />
                    </td>
                    <td>{layer.type.toUpperCase()}</td>
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
                onClick={() => setPreviewLayers([])} 
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
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Zonas Escolares" required />
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
          <h2>Capas Registradas</h2>
          {loading ? <p>Cargando...</p> : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Color</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {layers.map(layer => (
                  <tr key={layer.id}>
                    <td>
                      <span className={styles.colorDot} style={{ backgroundColor: layer.color }}></span>
                    </td>
                    <td>{layer.name}</td>
                    <td>{layer.type.toUpperCase()}</td>
                    <td>{new Date(layer.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(layer.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {layers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>No hay capas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
