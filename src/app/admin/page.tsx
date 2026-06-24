'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';
import styles from './Admin.module.css';

const StaticMapPreview = dynamic(() => import('../../components/StaticMapPreview'), { ssr: false });

const translatePropKey = (key: string) => {
  const k = key.toLowerCase();
  if (k === 'marker-color') return 'Color del Marcador (HEX)';
  if (k === 'marker-symbol') return 'Icono / Símbolo';
  if (k === 'title' || k === 'name' || k === 'nombre') return 'Título / Nombre';
  if (k === 'description') return 'Descripción';
  if (k === 'group') return 'ID de Grupo';
  return key;
};

export default function AdminPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // Protect route
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (dbUser && dbUser.rol !== 'SUPER_ADMIN' && dbUser.rol !== 'ADMINISTRADOR') {
        router.push('/');
      }
    }
  }, [user, dbUser, authLoading, router]);

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'grupos' | 'capas' | 'solicitudes' | 'usuarios'
  
  // Dashboard & GIS State
  const [capas, setCapas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [subgrupos, setSubgrupos] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit & Bulk Delete State
  const [selectedCapas, setSelectedCapas] = useState<string[]>([]);
  const [editingCapa, setEditingCapa] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editGrupoId, setEditGrupoId] = useState<string>('');
  const [editSubGrupoId, setEditSubGrupoId] = useState<string>('');
  const [editColor, setEditColor] = useState('');
  const [editIcono, setEditIcono] = useState('');

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
  const [icono, setIcono] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [subGrupoId, setSubGrupoId] = useState('');
  const [uploadType, setUploadType] = useState('file'); // 'file' or 'url'
  const [url, setUrl] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState('geojson');
  const [fileName, setFileName] = useState('');
  const [visibilidad, setVisibilidad] = useState('PUBLIC');
  const [rolesPermitidos, setRolesPermitidos] = useState<string[]>([]);

  const commonIcons = [
    { value: '', label: 'Sin Icono (Punto)' },
    { value: 'MapPin', label: 'Marcador Clásico' },
    { value: 'School', label: 'Colegio / Escuela' },
    { value: 'Hospital', label: 'Hospital / Salud' },
    { value: 'Bus', label: 'Colectivo / Bus' },
    { value: 'Car', label: 'Automóvil / Tránsito' },
    { value: 'AlertTriangle', label: 'Alerta / Peligro' },
    { value: 'Info', label: 'Información' },
    { value: 'TreePine', label: 'Árbol / Plaza' },
    { value: 'Building', label: 'Edificio Público' }
  ];

  // Preview state
  const [previewCapas, setPreviewCapas] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Records View State
  const [selectedCapaForRecords, setSelectedCapaForRecords] = useState<any | null>(null);
  const [capaRecords, setCapaRecords] = useState<any[]>([]);
  const [editingRecordIndex, setEditingRecordIndex] = useState<number | null>(null);
  const [editRecordProps, setEditRecordProps] = useState<any>({});
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resCapas, resGrupos, resSubGrupos, resRutas, resUsuarios] = await Promise.all([
        fetch('/api/capas'),
        fetch('/api/grupos'),
        fetch('/api/subgrupos'),
        fetch('/api/rutas-transporte'),
        fetch('/api/usuarios')
      ]);
      const dataCapas = await resCapas.json();
      const dataGrupos = await resGrupos.json();
      const dataSubGrupos = await resSubGrupos.json();
      const dataRutas = await resRutas.json();
      const dataUsuarios = await resUsuarios.json();

      setCapas(Array.isArray(dataCapas) ? dataCapas : []);
      setGrupos(Array.isArray(dataGrupos) ? dataGrupos : []);
      setSubgrupos(Array.isArray(dataSubGrupos) ? dataSubGrupos : []);
      setRutas(Array.isArray(dataRutas) ? dataRutas : []);
      setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
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
    const body: any = { 
      name: nombre, 
      color, 
      icono: icono || null, 
      grupoId: grupoId || null, 
      subGrupoId: subGrupoId || null,
      visibilidad,
      rolesPermitidos
    };
    
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
                icono: icono || null,
                tipo: 'geojson',
                datosGeo: JSON.stringify({ type: 'FeatureCollection', features })
             };
          });
          
          setPreviewCapas(generatedCapas);
          setIsProcessing(false);
          return;
        }
      }

      setPreviewCapas([{ id: 'mock-1', grupoId: grupoId || null, subGrupoId: subGrupoId || null, nombre, color, icono: icono || null, tipo: body.type, datosGeo: body.geoData }]);

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
            icono: capa.icono,
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
    setEditIcono(capa.icono || '');
  };

  const saveEditCapa = async (id: string) => {
    try {
      await fetch(`/api/capas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: editNombre.trim(), 
          color: editColor, 
          icono: editIcono || null,
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

  // ----- RECORDS LOGIC -----
  const handleViewRecords = async (capa: any) => {
    setSelectedCapaForRecords(capa);
    setLoadingRecords(true);
    try {
      const res = await fetch(`/api/capas/${capa.id}`);
      const data = await res.json();
      if (data.datosGeo) {
        let parsed = typeof data.datosGeo === 'string' ? JSON.parse(data.datosGeo) : data.datosGeo;
        if (parsed?.features) {
          setCapaRecords(parsed.features);
        } else if (parsed?.type === 'Feature') {
          setCapaRecords([parsed]);
        } else {
          setCapaRecords([]);
        }
      } else {
        setCapaRecords([]);
      }
    } catch (e) {
      alert('Error al cargar los registros.');
    }
    setLoadingRecords(false);
  };

  const startEditingRecord = (index: number) => {
    setEditingRecordIndex(index);
    setEditRecordProps({ ...(capaRecords[index].properties || {}) });
  };

  const handleEditRecordPropChange = (key: string, value: string) => {
    setEditRecordProps({ ...editRecordProps, [key]: value });
  };

  const saveEditRecord = async (index: number) => {
    const updatedFeatures = [...capaRecords];
    updatedFeatures[index].properties = editRecordProps;
    setCapaRecords(updatedFeatures);
    setEditingRecordIndex(null);

    // Patch to DB
    const geoData = { type: 'FeatureCollection', features: updatedFeatures };
    try {
      await fetch(`/api/capas/${selectedCapaForRecords.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geoData })
      });
      // Option: show toast
    } catch (e) {
      alert('Error al guardar el registro en la base de datos.');
    }
  };

  const handleCloseRecords = () => {
    setSelectedCapaForRecords(null);
    setCapaRecords([]);
    setEditingRecordIndex(null);
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

  // ----- USUARIOS LOGIC -----
  const handleRoleChange = async (id: string, nuevoRol: string) => {
    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: nuevoRol })
      });
      if (res.ok) {
        fetchData(); // Reload users
      } else {
        alert('Error al actualizar el rol.');
      }
    } catch (e) {
      alert('Error de conexión al actualizar el rol.');
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
    <div className={styles.adminLayout}>
      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1>Administración GIS</h1>
        </div>
        <nav className={styles.sidebarMenu}>
          <button className={`${styles.menuItem} ${activeTab === 'dashboard' ? styles.active : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          {dbUser?.rol === 'SUPER_ADMIN' && (
            <>
              <button className={`${styles.menuItem} ${activeTab === 'grupos' ? styles.active : ''}`} onClick={() => setActiveTab('grupos')}>
                Grupos
              </button>
              <button className={`${styles.menuItem} ${activeTab === 'capas' ? styles.active : ''}`} onClick={() => setActiveTab('capas')}>
                Capas
              </button>
            </>
          )}
          <button className={`${styles.menuItem} ${activeTab === 'solicitudes' ? styles.active : ''}`} onClick={() => setActiveTab('solicitudes')}>
            Transporte Pesado
          </button>
          {dbUser?.rol === 'SUPER_ADMIN' && (
            <button className={`${styles.menuItem} ${activeTab === 'usuarios' ? styles.active : ''}`} onClick={() => setActiveTab('usuarios')}>
              Usuarios
            </button>
          )}
        </nav>
        <a href="/" className={styles.backButton}>← Volver al Mapa</a>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={styles.contentArea}>
        <h1 className={styles.pageTitle}>Panel de Control</h1>
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
        {activeTab === 'grupos' && dbUser?.rol === 'SUPER_ADMIN' && (
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
                  <div key={g.id} style={{ marginBottom: '20px', background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {editingGrupo === g.id ? (
                          <input type="color" value={grupoColor} onChange={e => setGrupoColor(e.target.value)} style={{ width: '30px', height: '30px', border: 'none', padding: 0, cursor: 'pointer' }} />
                        ) : (
                          <span className={styles.colorDot} style={{ backgroundColor: g.color }}></span>
                        )}
                        {editingGrupo === g.id ? (
                          <input type="text" value={grupoNombre} onChange={e => setGrupoNombre(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: '1rem' }} />
                        ) : (
                          <strong style={{ fontSize: '1.2rem', color: '#334155' }}>{g.nombre}</strong>
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
                              <tr key={sg.id}>
                                <td style={{ width: '40px' }}>
                                  {editingSubGrupo === sg.id ? (
                                    <input type="color" value={subGrupoColor} onChange={e => setSubGrupoColor(e.target.value)} style={{ width: '25px', height: '25px', border: 'none', padding: 0 }} />
                                  ) : (
                                    <span className={styles.colorDot} style={{ backgroundColor: sg.color, width: '15px', height: '15px' }}></span>
                                  )}
                                </td>
                                <td>
                                  {editingSubGrupo === sg.id ? (
                                    <input type="text" value={subGrupoNombre} onChange={e => setSubGrupoNombre(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155' }} />
                                  ) : (
                                    <span style={{ color: '#475569', fontWeight: 500 }}>{sg.nombre}</span>
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
                <p style={{ textAlign: 'center', color: '#64748b' }}>No hay grupos creados todavía.</p>
              )}
            </section>
          </div>
        )}

        {/* CAPAS TAB */}
        {activeTab === 'capas' && dbUser?.rol === 'SUPER_ADMIN' && (
          <>
            {selectedCapaForRecords ? (
              <section className={styles.fullSection} style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ margin: 0 }}>Registros de Capa: {selectedCapaForRecords.nombre}</h2>
                  <button onClick={handleCloseRecords} className={styles.deleteBtn} style={{ background: '#64748b' }}>Volver a Capas</button>
                </div>
                {loadingRecords ? <p>Cargando registros...</p> : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Identificador / Nombre</th>
                          <th>Detalles</th>
                          <th style={{ width: '200px' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capaRecords.map((rec, idx) => {
                          const props = rec.properties || {};
                          const rawName = props.nombre || props.name || props.Nombre || props.Name || props.title || props.Title || props.ESTABLECIM || props.Establecim || props.escuela || props.Escuela || '- Sin Nombre -';
                          return (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              {editingRecordIndex === idx ? (
                                <td colSpan={2}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px', background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    {Object.keys(editRecordProps).map(k => {
                                      const isDesc = k.toLowerCase().includes('desc');
                                      return (
                                        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: isDesc ? '1 / -1' : 'auto' }}>
                                          <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', textTransform: 'capitalize' }}>{translatePropKey(k)}</label>
                                          {isDesc ? (
                                            <textarea 
                                              value={editRecordProps[k] || ''} 
                                              onChange={e => handleEditRecordPropChange(k, e.target.value)}
                                              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                                            />
                                          ) : (
                                            <input 
                                              type="text" 
                                              value={editRecordProps[k] || ''} 
                                              onChange={e => handleEditRecordPropChange(k, e.target.value)}
                                              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              ) : (
                                <>
                                  <td style={{ fontWeight: 'bold' }}>{rawName}</td>
                                  <td>
                                    <div style={{ fontSize: '0.8rem', color: '#475569', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {Object.keys(props).map(k => `${k}: ${props[k]}`).join(' | ')}
                                    </div>
                                  </td>
                                </>
                              )}
                              <td>
                                {editingRecordIndex === idx ? (
                                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button className={styles.submitBtn} onClick={() => saveEditRecord(idx)} style={{ padding: '6px 12px' }}>Guardar</button>
                                    <button className={styles.deleteBtn} onClick={() => setEditingRecordIndex(null)} style={{ padding: '6px 12px', background: '#64748b' }}>Cancelar</button>
                                  </div>
                                ) : (
                                  <button className={styles.submitBtn} onClick={() => startEditingRecord(idx)} style={{ padding: '6px 12px', background: 'white', color: '#29B6F6', border: '1px solid #29B6F6', boxShadow: 'none' }}>Editar Datos</button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {capaRecords.length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: 'center' }}>No hay registros o formato inválido.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : (
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
                    <label>Icono del Marcador</label>
                    <select value={icono} onChange={e => setIcono(e.target.value)}>
                      {commonIcons.map(ic => <option key={ic.value} value={ic.value}>{ic.label}</option>)}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Visibilidad</label>
                    <select value={visibilidad} onChange={e => setVisibilidad(e.target.value)}>
                      <option value="PUBLIC">Público (Todos)</option>
                      <option value="PRIVATE">Privado (Solo roles permitidos)</option>
                    </select>
                  </div>

                  {visibilidad === 'PRIVATE' && (
                    <div className={styles.formGroup}>
                      <label>Roles Permitidos</label>
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', padding: '10px 0' }}>
                        {['ADMINISTRADOR', 'USUARIO'].map(role => (
                          <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={rolesPermitidos.includes(role)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setRolesPermitidos([...rolesPermitidos, role]);
                                } else {
                                  setRolesPermitidos(rolesPermitidos.filter(r => r !== role));
                                }
                              }}
                              style={{ width: '18px', height: '18px', accentColor: '#0ea5e9' }}
                            />
                            {role === 'USUARIO' ? 'Usuario (Básico)' : 'Administrador'}
                          </label>
                        ))}
                      </div>
                      <small style={{color: '#94a3b8', marginTop: '5px'}}>*SUPER_ADMIN siempre tiene acceso.</small>
                    </div>
                  )}

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
                      <label>URL Externa</label>
                      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://maphub.net/..." />
                    </div>
                  )}
                  <div style={{ marginTop: '20px' }}>
                    <button type="submit" className={styles.submitBtn} disabled={isProcessing}>
                      {isProcessing ? 'Procesando...' : 'Previsualizar / Agregar a lista'}
                    </button>
                  </div>
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
                            <th>Icono</th>
                            <th>Ubicación</th>
                            <th>Nombre</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {capas.map(capa => (
                            <tr key={capa.id} style={{ backgroundColor: selectedCapas.includes(capa.id) ? '#f0f6fc' : 'transparent' }}>
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
                                  <select value={editIcono} onChange={e => setEditIcono(e.target.value)} style={{ width: '100px', padding: '5px' }}>
                                    {commonIcons.map(ic => <option key={ic.value} value={ic.value}>{ic.label}</option>)}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: '0.9rem', color: '#646970' }}>{capa.icono || 'Punto'}</span>
                                )}
                              </td>
                              <td>
                                {editingCapa === capa.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <select value={editGrupoId} onChange={e => {
                                      setEditGrupoId(e.target.value);
                                      setEditSubGrupoId('');
                                    }} style={{ width: '100%', padding: '5px' }}>
                                      <option value="">- Grupo -</option>
                                      {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                                    </select>
                                    {editGrupoId && subgrupos.filter(sg => sg.grupoId === editGrupoId).length > 0 && (
                                      <select value={editSubGrupoId} onChange={e => setEditSubGrupoId(e.target.value)} style={{ width: '100%', padding: '5px' }}>
                                        <option value="">- Sub-grupo -</option>
                                        {subgrupos.filter(sg => sg.grupoId === editGrupoId).map(sg => <option key={sg.id} value={sg.id}>{sg.nombre}</option>)}
                                      </select>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ fontWeight: '600' }}>{capa.grupo ? capa.grupo.nombre : '-'}</div>
                                    {capa.subGrupo && <div style={{ fontSize: '0.8rem', color: '#646970' }}>↳ {capa.subGrupo.nombre}</div>}
                                  </div>
                                )}
                              </td>
                              <td>
                                {editingCapa === capa.id ? (
                                  <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} style={{ width: '100%', padding: '5px' }} />
                                ) : (
                                  capa.nombre
                                )}
                              </td>
                              <td>
                                {editingCapa === capa.id ? (
                                  <div style={{ display: 'flex', gap: '5px' }}>
                                    <button className={styles.submitBtn} onClick={() => saveEditCapa(capa.id)} style={{ padding: '4px 8px' }}>Guardar</button>
                                    <button className={styles.rejectBtn} onClick={() => setEditingCapa(null)} style={{ padding: '4px 8px' }}>Cancelar</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    <button className={styles.submitBtn} onClick={() => handleViewRecords(capa)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Registros</button>
                                    <button className={styles.submitBtn} onClick={() => startEditingCapa(capa)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Editar</button>
                                    <button className={styles.deleteBtn} onClick={() => handleDeleteCapa(capa.id)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Eliminar</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {capas.length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center' }}>No hay capas registradas.</td></tr>
                          )}
                        </tbody>
                      </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          )}

          {activeTab === 'solicitudes' && (
            <section className={styles.fullSection}>
              <h2>Solicitudes de Transporte Pesado</h2>
              <p className={styles.tabDescription}>Gestione las rutas propuestas por los choferes y transportistas.</p>
              {loading ? <p>Cargando solicitudes...</p> : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID Solicitud</th>
                        <th>Solicitante</th>
                        <th>Datos Técnicos</th>
                        <th>Estado</th>
                        <th>Mapa</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rutas.map(ruta => (
                        <tr key={ruta.id}>
                          <td>
                            <strong>#{ruta.numeroSolicitud}</strong>
                            {ruta.idSolicitudWeb && <div style={{ fontSize: '0.8rem', color: '#888' }}>ID Web: {ruta.idSolicitudWeb}</div>}
                            <br/><small style={{color:'#646970'}}>{new Date(ruta.creadoEn).toLocaleDateString()}</small>
                            <div style={{ fontSize: '0.8rem', color: '#646970', marginTop: '4px' }}>
                              {ruta.vigenciaDesde && <span>Vigencia: {ruta.vigenciaDesde} - {ruta.vigenciaHasta || '?'}</span>}
                            </div>
                          </td>
                          <td>{ruta.nombreSolicitante}</td>
                          <td>
                            <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                              <div><strong>Patente:</strong> {ruta.patente || '-'}</div>
                              <div><strong>Vehículo:</strong> {ruta.tipoVehiculo || '-'}</div>
                              <div><strong>Peso:</strong> {ruta.pesoToneladas ? `${ruta.pesoToneladas} Tn` : '-'}</div>
                              {ruta.aseguradora && <div><strong>Seguro:</strong> {ruta.aseguradora} {ruta.nroSeguro ? `(${ruta.nroSeguro})` : ''}</div>}
                              {ruta.cargaPeligrosa && <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>Carga Peligrosa</div>}
                            </div>
                          </td>
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
                              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                <button className={styles.approveBtn} onClick={() => handleEstadoRuta(ruta.id, 'APROBADA')}>Aprobar</button>
                                <button className={styles.rejectBtn} onClick={() => handleEstadoRuta(ruta.id, 'RECHAZADA')}>Rechazar</button>
                              </div>
                            )}
                            {ruta.estado !== 'PENDIENTE' && (
                              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                                <button className={styles.submitBtn} style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleEstadoRuta(ruta.id, 'PENDIENTE')}>Reabrir</button>
                              </div>
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

          {activeTab === 'usuarios' && dbUser?.rol === 'SUPER_ADMIN' && (
            <section className={styles.fullSection}>
              <h2>Gestión de Usuarios</h2>
              <p className={styles.tabDescription}>
                Control total sobre los accesos a la plataforma. Asigne roles, eleve permisos y audite las cuentas registradas.
              </p>
              {loading ? <p>Cargando usuarios...</p> : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Email / Cuenta</th>
                        <th>Fecha de Registro</th>
                        <th>Rol Actual</th>
                        <th>Modificar Rol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id} style={{ backgroundColor: u.rol === 'PENDIENTE' ? '#fcf0f1' : 'transparent' }}>
                          <td>
                            <strong>{u.email}</strong>
                            {u.email === user?.email && <span style={{ marginLeft: '10px', fontSize: '0.7rem', color: '#fff', background: '#2271b1', padding: '2px 6px', borderRadius: '2px', fontWeight: 'bold' }}>TÚ</span>}
                          </td>
                          <td><small style={{color:'#646970'}}>{new Date(u.creadoEn).toLocaleDateString()}</small></td>
                          <td>
                            <span className={`${styles.badge} ${
                              u.rol === 'PENDIENTE' ? styles.badgePendiente : 
                              u.rol === 'SUPER_ADMIN' ? styles.badgeAprobada : 
                              u.rol === 'ADMINISTRADOR' ? styles.badgeAprobada : 
                              styles.badgeNormal
                            }`}>
                              {u.rol}
                            </span>
                          </td>
                          <td>
                            <select 
                              value={u.rol} 
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={u.email === user?.email}
                              style={{ 
                                padding: '6px', 
                                borderRadius: '4px', 
                                border: '1px solid #8c8f94', 
                                background: '#fff', 
                                color: '#2c3338',
                                cursor: u.email === user?.email ? 'not-allowed' : 'pointer',
                                outline: 'none',
                                maxWidth: '200px',
                                opacity: u.email === user?.email ? 0.6 : 1,
                              }}
                            >
                              <option value="PENDIENTE">BLOQUEADO / PENDIENTE</option>
                              <option value="VECINO">VECINO (Público)</option>
                              <option value="CHOFER">CHOFER (Rutas)</option>
                              <option value="ADMINISTRADOR">ADMINISTRADOR (Capas)</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN (Total)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {usuarios.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#646970' }}>No hay usuarios registrados en el sistema.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
