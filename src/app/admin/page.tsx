'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import { kml } from '@tmcw/togeojson';
import styles from './Admin.module.css';
import toast, { Toaster } from 'react-hot-toast';
import { escucharNotificaciones, emitirCambioMapa, emitirCambioEstado } from '@/lib/rtdb';
import { ClipboardList, Clock, Map as MapIcon, Users, AlertTriangle, Bus, Smartphone, Search, Filter, Download, Loader2, FileText, Shield } from 'lucide-react';

const StaticMapPreview = dynamic(() => import('../../components/StaticMapPreview'), { ssr: false });
const LineaEditorMap = dynamic(() => import('../../components/LineaEditorMap'), { ssr: false });

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
  const { user, dbUser, loading: authLoading, getIdToken } = useAuth();

  const authFetch = async (input: string, init: RequestInit = {}) => {
    const token = await getIdToken();
    return fetch(input, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> || {}),
        'Authorization': `Bearer ${token}`,
      },
    });
  };
  const router = useRouter();

  // Protect route
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (dbUser && !(dbUser.permisos?.accesoAdmin || dbUser.rol === 'SUPER_ADMIN')) {
        router.push('/');
      }
    }
  }, [user, dbUser, authLoading, router]);

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'grupos' | 'capas' | 'solicitudes' | 'usuarios' | 'acceso-qr'
  const [solicitudesQr, setSolicitudesQr] = useState<any[]>([]);
  const [dispositivosBloqueados, setDispositivosBloqueados] = useState<any[]>([]);
  const [solicitudesQrPendientes, setSolicitudesQrPendientes] = useState(0);
  
  // Dashboard & GIS State
  const [capas, setCapas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [subgrupos, setSubgrupos] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [rutasSearchTerm, setRutasSearchTerm] = useState('');
  const [rutasFilterStatus, setRutasFilterStatus] = useState('TODAS');
  const [errorLineas, setErrorLineas] = useState<string | null>(null);
  const [previewRutaGeo, setPreviewRutaGeo] = useState<{ geo: any; numero: string } | null>(null);
  const [lineas, setLineas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [rolesPermisosData, setRolesPermisosData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Líneas editor state
  const [lineaEditorOpen, setLineaEditorOpen] = useState(false);
  const [editingLinea, setEditingLinea] = useState<any | null>(null);
  const [lineaFormNombre, setLineaFormNombre] = useState('');
  const [lineaFormNumero, setLineaFormNumero] = useState('');
  const [lineaFormColor, setLineaFormColor] = useState('#E53E3E');
  const [lineaFormDescripcion, setLineaFormDescripcion] = useState('');
  const [lineaFormCategoria, setLineaFormCategoria] = useState('NACIONAL');
  const [lineaFormSubcategoria, setLineaFormSubcategoria] = useState('');
  const [lineaFormSaving, setLineaFormSaving] = useState(false);
  const [selectedLineas, setSelectedLineas] = useState<string[]>([]);
  const [lineaFiltro, setLineaFiltro] = useState('');
  const [lineaFiltroCategoria, setLineaFiltroCategoria] = useState('');

  // Tree expand state for lineas
  const [expandedLineas, setExpandedLineas] = useState<Set<string>>(new Set());
  const [expandedRamales, setExpandedRamales] = useState<Set<string>>(new Set());

  // GeoJSON import modal
  const [lineaImportOpen, setLineaImportOpen] = useState(false);
  const [lineaImportCategoria, setLineaImportCategoria] = useState('NACIONAL');
  const [lineaImportSubcategoria, setLineaImportSubcategoria] = useState('');
  const [lineaImportPreview, setLineaImportPreview] = useState<any[]>([]);
  const [lineaImportSaving, setLineaImportSaving] = useState(false);

  // Bulk selection for rutas
  const [selectedRutas, setSelectedRutas] = useState<string[]>([]);

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

  // Escuchar nuevas solicitudes de transporte en tiempo real
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsub = escucharNotificaciones((notif) => {
      toast((t) => (
        <span>
          <strong>Nueva solicitud #{notif.numeroSolicitud}</strong><br/>
          {notif.nombreSolicitante}
          <button
            onClick={() => { setActiveTab('solicitudes'); toast.dismiss(t.id); fetchData(); }}
            style={{ marginLeft: '10px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
          >Ver</button>
        </span>
      ), { duration: 10000 });
      fetchData();
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSolicitudesQr = async () => {
    try {
      const [resSols, resBloq] = await Promise.all([
        authFetch('/api/auth/qr-session'),
        authFetch('/api/auth/qr-bloqueados'),
      ]);
      const sols = resSols.ok ? await resSols.json() : [];
      const bloq = resBloq.ok ? await resBloq.json() : [];
      setSolicitudesQr(Array.isArray(sols) ? sols : []);
      setSolicitudesQrPendientes((Array.isArray(sols) ? sols : []).filter((s: any) => s.estado === 'ESCANEADO').length);
      setDispositivosBloqueados(Array.isArray(bloq) ? bloq : []);
    } catch {}
  };

  const handleQrAccion = async (id: string, accion: 'aprobar' | 'rechazar' | 'bloquear') => {
    try {
      const res = await authFetch(`/api/auth/qr-session/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      toast.success(accion === 'aprobar' ? 'Acceso aprobado.' : accion === 'rechazar' ? 'Solicitud rechazada.' : 'Dispositivo bloqueado.');
      fetchSolicitudesQr();
    } catch (e: any) {
      toast.error(e.message || 'Error al procesar la solicitud.');
    }
  };

  const handleDesbloquear = async (id: string) => {
    try {
      const res = await authFetch(`/api/auth/qr-desbloquear/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Dispositivo desbloqueado.');
      fetchSolicitudesQr();
    } catch {
      toast.error('Error al desbloquear.');
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await authFetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        setRolesPermisosData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermisoChange = async (id: string, field: string, value: boolean) => {
    const rolToUpdate = rolesPermisosData.find(r => r.id === id);
    if (!rolToUpdate) return;
    
    // Optimistic update
    const prev = [...rolesPermisosData];
    setRolesPermisosData(prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    
    try {
      const res = await authFetch('/api/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rol: rolToUpdate.rol, [field]: value })
      });
      if (!res.ok) {
        throw new Error('Error al actualizar');
      }
      toast.success('Permiso actualizado. Aplicará en el próximo inicio de sesión.');
    } catch (err) {
      toast.error('Error al guardar el permiso');
      setRolesPermisosData(prev); // revert
    }
  };

  const fetchData = async () => {
    try {
      const [resCapas, resGrupos, resSubGrupos, resRutas, resUsuarios, resLineas] = await Promise.all([
        fetch('/api/capas'),
        fetch('/api/grupos'),
        fetch('/api/subgrupos'),
        fetch('/api/rutas-transporte'),
        authFetch('/api/usuarios'),
        fetch('/api/lineas-transporte'),
      ]);
      const dataCapas = await resCapas.json();
      const dataGrupos = await resGrupos.json();
      const dataSubGrupos = await resSubGrupos.json();
      const dataRutas = await resRutas.json();
      const dataUsuarios = await resUsuarios.json();
      const dataLineas = await resLineas.json();

      setCapas(Array.isArray(dataCapas) ? dataCapas : []);
      setGrupos(Array.isArray(dataGrupos) ? dataGrupos : []);
      setSubgrupos(Array.isArray(dataSubGrupos) ? dataSubGrupos : []);
      setRutas(Array.isArray(dataRutas) ? dataRutas : []);
      setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
      const lineasData: any[] = Array.isArray(dataLineas) ? dataLineas : [];
      setLineas(lineasData);
      
      // Auto-expand all lines so Category → Line → Ramal is visible by default
      setExpandedLineas(new Set(
        lineasData.map((l: any) => `${l.categoria || 'NACIONAL'}__${l.nombre}__${l.numero || ''}`)
      ));

      // Cargar roles si tiene permisos
      if (dbUser?.permisos?.gestionarUsuarios) {
        await fetchRoles();
      }
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
      await authFetch('/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: grupoNombre, color: grupoColor })
      });
      setGrupoNombre('');
      fetchData();
    } catch (e) {
      toast.error('Error al crear grupo');
    }
    setIsProcessing(false);
  };

  const saveEditGrupo = async (id: string) => {
    try {
      await authFetch(`/api/grupos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: grupoNombre, color: grupoColor })
      });
      setEditingGrupo(null);
      fetchData();
    } catch (e) {
      toast.error('Error al editar grupo');
    }
  };

  const handleDeleteGrupo = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este grupo?')) {
      await authFetch(`/api/grupos/${id}`, { method: 'DELETE' });
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
      await authFetch('/api/subgrupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: subGrupoNombre, color: subGrupoColor, grupoId: subGrupoParentId })
      });
      setSubGrupoNombre('');
      fetchData();
    } catch (e) {
      toast.error('Error al crear sub-grupo');
    }
    setIsProcessing(false);
  };

  const saveEditSubGrupo = async (id: string) => {
    try {
      await authFetch(`/api/subgrupos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: subGrupoNombre, color: subGrupoColor, grupoId: subGrupoParentId })
      });
      setEditingSubGrupo(null);
      fetchData();
    } catch (e) {
      toast.error('Error al editar sub-grupo');
    }
  };

  const handleDeleteSubGrupo = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este sub-grupo?')) {
      await authFetch(`/api/subgrupos/${id}`, { method: 'DELETE' });
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
        toast.error("Error procesando el archivo. Asegúrate que sea un KML, KMZ o GeoJSON válido.");
        setFileName('');
        setFileContent('');
      }
    }
  };

  const handleSubmitCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) { toast.error('El nombre es obligatorio'); return; }
    
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
        toast.error('Debes seleccionar un archivo');
        return;
      }
      body.geoData = fileContent;
      body.type = fileType;
    } else {
      if (!url) {
        setIsProcessing(false);
        toast.error('Debes ingresar una URL');
        return;
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
      toast.error('Error al parsear el archivo. Asegurate de que sea válido.');
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

  // Reduce coordinate precision to 6 decimals (~11cm accuracy) to shrink payload
  const simplifyGeoData = (geoData: string): string => {
    try {
      const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6;
      const processCoords = (coords: any): any => {
        if (typeof coords[0] === 'number') return coords.map(roundCoord);
        return coords.map(processCoords);
      };
      const obj = JSON.parse(geoData);
      const walk = (node: any): any => {
        if (!node) return node;
        if (node.coordinates) return { ...node, coordinates: processCoords(node.coordinates) };
        if (node.geometry) return { ...node, geometry: walk(node.geometry) };
        if (node.features) return { ...node, features: node.features.map(walk) };
        return node;
      };
      return JSON.stringify(walk(obj));
    } catch { return geoData; }
  };

  const handleConfirmUpload = async () => {
    setIsProcessing(true);
    try {
      for (const capa of previewCapas) {
        const geoData = simplifyGeoData(capa.datosGeo);
        const sizeKB = Math.round(geoData.length / 1024);
        if (sizeKB > 45000) {
          toast.error(`La capa "${capa.nombre}" es demasiado grande (${sizeKB} KB). Dividila en partes más pequeñas.`);
          continue;
        }
        await authFetch('/api/capas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: capa.nombre,
            color: capa.color,
            icono: capa.icono,
            type: capa.tipo,
            geoData,
            grupoId: capa.grupoId,
            subGrupoId: capa.subGrupoId
          }),
        });
      }

      toast.success('Capa(s) guardada(s) correctamente');
      emitirCambioMapa('capas');
      fetchData();
      setPreviewCapas([]);
      setNombre('');
      setUrl('');
      setFileContent('');
      setFileName('');
      setGrupoId('');
      setSubGrupoId('');
    } catch (err) {
      toast.error('Error de conexión');
    }
    setIsProcessing(false);
  };

  const handleDeleteCapa = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta capa?')) {
      await authFetch(`/api/capas/${id}`, { method: 'DELETE' });
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
        await authFetch(`/api/capas/${id}`, { method: 'DELETE' });
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
      await authFetch(`/api/capas/${id}`, {
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
      toast.error('Error al guardar cambios');
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
      toast.error('Error al cargar los registros.');
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
      await authFetch(`/api/capas/${selectedCapaForRecords.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geoData })
      });
    } catch (e) {
      toast.error('Error al guardar el registro en la base de datos.');
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
      await authFetch(`/api/rutas-transporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      // Notificar al solicitante en tiempo real si tiene userId
      const ruta = rutas.find((r: any) => r.id === id);
      if (ruta?.creadoPorId && (nuevoEstado === 'APROBADA' || nuevoEstado === 'RECHAZADA')) {
        emitirCambioEstado(ruta.creadoPorId, {
          solicitudId: id,
          numeroSolicitud: ruta.numeroSolicitud || id,
          nuevoEstado,
        });
      }
      fetchData();
    } catch (e) {
      toast.error('Error al actualizar el estado.');
    }
  };

  // ----- USUARIOS LOGIC -----
  const handleRoleChange = async (id: string, nuevoRol: string) => {
    try {
      const res = await authFetch(`/api/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol: nuevoRol })
      });
      if (res.ok) {
        fetchData();
      } else {
        toast.error('Error al actualizar el rol.');
      }
    } catch (e) {
      toast.error('Error de conexión al actualizar el rol.');
    }
  };

  const handleToggleRuta = async (id: string, activo: boolean) => {
    setRutas(prev => prev.map(r => r.id === id ? { ...r, activo } : r));
    try {
      const res = await authFetch('/api/rutas-transporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], activo }),
      });
      if (!res.ok) throw new Error();
      emitirCambioMapa('rutas');
    } catch {
      setRutas(prev => prev.map(r => r.id === id ? { ...r, activo: !activo } : r));
      toast.error('Error al actualizar la solicitud.');
    }
  };

  const handleBulkToggleRutas = async (activo: boolean) => {
    if (selectedRutas.length === 0) return;
    setRutas(prev => prev.map(r => selectedRutas.includes(r.id) ? { ...r, activo } : r));
    try {
      const res = await authFetch('/api/rutas-transporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRutas, activo }),
      });
      if (!res.ok) throw new Error();
      emitirCambioMapa('rutas');
      setSelectedRutas([]);
    } catch {
      setRutas(prev => prev.map(r => selectedRutas.includes(r.id) ? { ...r, activo: !activo } : r));
      toast.error('Error al actualizar las solicitudes.');
    }
  };

  const handleBulkStatusRutas = async (nuevoEstado: string) => {
    if (selectedRutas.length === 0) return;
    setRutas(prev => prev.map(r => selectedRutas.includes(r.id) ? { ...r, estado: nuevoEstado } : r));
    try {
      const res = await authFetch('/api/rutas-transporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRutas, estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error();
      emitirCambioMapa('rutas');
      setSelectedRutas([]);
      toast.success('Estados actualizados');
    } catch {
      toast.error('Error al actualizar estados.');
      fetchData();
    }
  };


  const COLOR_MAP: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', black: '#1f2937', brown: '#92400e',
    pink: '#ec4899', cyan: '#06b6d4', grey: '#6b7280', gray: '#6b7280',
  };

  const resolveColor = (raw?: string) => {
    if (!raw) return '#3b82f6';
    if (raw.startsWith('#')) return raw;
    return COLOR_MAP[raw.toLowerCase()] || '#3b82f6';
  };

  const handleLineaImportFiles = (files: FileList | null) => {
    if (!files) return;
    const previews: any[] = [];
    let pending = files.length;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const geo = JSON.parse(e.target?.result as string);
          const features: any[] = geo.type === 'FeatureCollection' ? geo.features
            : geo.type === 'Feature' ? [geo]
            : ['LineString', 'MultiLineString'].includes(geo.type)
              ? [{ type: 'Feature', properties: {}, geometry: geo }]
            : [];

          // Metadata de nivel raíz (formato profesional)
          const meta = geo.metadata || {};

          // ── Formato profesional (grupo/subgrupo/ramal/sentido) ─────────
          const tieneGrupos = features.some((f: any) => f.properties?.subgrupo);
          if (tieneGrupos) {
            // 1 registro por feature (ramal+sentido) para control granular
            // Ignorar features de vehículos/puntos — solo importar trazas LineString/MultiLineString
            features.forEach((f: any) => {
              if (!f.geometry) return;
              const gtype = f.geometry.type;
              if (gtype !== 'LineString' && gtype !== 'MultiLineString') return;
              if (f.properties?.tipo === 'vehiculo_activo') return;
              const p = f.properties || {};
              const numero = p.linea || meta.linea || p.ref || '';
              const nombre = p.linea_nombre || p.grupo || meta.nombre_linea
                || (numero ? `Línea ${numero}` : file.name.replace(/\.geojson$/i, ''));
              const ramalNombre = p.ramal ? `Ramal ${p.ramal}` : (p.subgrupo_detalle || p.subgrupo || '');
              const sentidoRaw = (p.sentido || p.sentido_label || '').trim();
              // Normalize to uppercase, strip emoji prefixes, preserve any value
              const sentidoNorm = sentidoRaw.replace(/^[\p{Emoji}\s]+/u, '').trim().toUpperCase() || null;
              const color = resolveColor(p.color_hex || p.color_ramal_orig || p.stroke);
              const partsDesc: string[] = [];
              if (p.operador) partsDesc.push(p.operador);
              if (p.ciudad) partsDesc.push(p.ciudad);
              if (p.cabecera_inicio && p.cabecera_fin) partsDesc.push(`${p.cabecera_inicio} ↔ ${p.cabecera_fin}`);
              if (p.distancia_km) partsDesc.push(`${p.distancia_km} km`);
              previews.push({
                nombre,
                numero,
                color,
                descripcion: partsDesc.join(' · '),
                subcategoriaAuto: ramalNombre,
                sentido: sentidoNorm,
                datosGeo: JSON.stringify(f),
              });
            });
          } else {
            // ── Formato simple ──────────────────────────────────────────────
            features.forEach((f: any) => {
              if (!f.geometry) return;
              const gtype = f.geometry.type;
              if (gtype !== 'LineString' && gtype !== 'MultiLineString') return;
              const p = f.properties || {};
              const numero = p.ref || p.linea || p.numero || meta.linea || '';
              const nombre = p.name || p.nombre || p.linea_nombre
                || (numero ? `Línea ${numero}` : file.name.replace(/\.geojson$/i, ''));
              const partsDesc: string[] = [];
              if (p.operator || p.operador) partsDesc.push(p.operator || p.operador);
              if (p.from && p.to) partsDesc.push(`${p.from} ↔ ${p.to}`);
              if (p.network) partsDesc.push(p.network);
              previews.push({
                nombre,
                numero,
                color: resolveColor(p.colour || p.color || p.stroke || p.color_hex),
                descripcion: partsDesc.join(' · ') || p.descripcion || '',
                subcategoriaAuto: '',
                datosGeo: JSON.stringify(f),
              });
            });
          }
        } catch { toast.error(`Error leyendo ${file.name}`); }
        pending--;
        if (pending === 0) setLineaImportPreview(prev => [...prev, ...previews]);
      };
      reader.readAsText(file);
    });
  };

  const handleConfirmLineaImport = async () => {
    if (lineaImportPreview.length === 0) return;
    setLineaImportSaving(true);
    let ok = 0, fail = 0;
    for (const item of lineaImportPreview) {
      try {
        const res = await authFetch('/api/lineas-transporte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: item.nombre,
            numero: item.numero || null,
            color: item.color,
            descripcion: item.descripcion || null,
            datosGeo: item.datosGeo,
            categoria: lineaImportCategoria,
            subcategoria: lineaImportSubcategoria.trim() || item.subcategoriaAuto || null,
            sentido: item.sentido || null,
          }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    setLineaImportSaving(false);
    toast.success(`${ok} líneas importadas${fail ? ` (${fail} fallaron)` : ''}.`);
    emitirCambioMapa('lineas');
    setLineaImportOpen(false);
    setLineaImportPreview([]);
    fetchData();
  };

  const openNewLinea = () => {
    setEditingLinea(null);
    setLineaFormNombre('');
    setLineaFormNumero('');
    setLineaFormColor('#E53E3E');
    setLineaFormDescripcion('');
    setLineaFormCategoria('NACIONAL');
    setLineaFormSubcategoria('');
    setLineaEditorOpen(true);
  };

  const openEditLinea = (linea: any) => {
    setEditingLinea(linea);
    setLineaFormNombre(linea.nombre);
    setLineaFormNumero(linea.numero || '');
    setLineaFormColor(linea.color || '#E53E3E');
    setLineaFormDescripcion(linea.descripcion || '');
    setLineaFormCategoria(linea.categoria || 'NACIONAL');
    setLineaFormSubcategoria(linea.subcategoria || '');
    setLineaEditorOpen(true);
  };

  const handleSaveLinea = async (geojson: any) => {
    if (!lineaFormNombre.trim()) { toast.error('El nombre de la línea es obligatorio.'); return; }
    setLineaFormSaving(true);
    try {
      const payload = {
        nombre: lineaFormNombre.trim(),
        numero: lineaFormNumero.trim() || null,
        color: lineaFormColor,
        descripcion: lineaFormDescripcion.trim() || null,
        categoria: lineaFormCategoria,
        subcategoria: lineaFormSubcategoria.trim() || null,
        datosGeo: JSON.stringify(geojson),
      };
      const res = editingLinea
        ? await authFetch(`/api/lineas-transporte/${editingLinea.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/lineas-transporte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error(await res.text());
      toast.success(editingLinea ? 'Línea actualizada.' : 'Línea creada.');
      emitirCambioMapa('lineas');
      setLineaEditorOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error('Error al guardar la línea.');
    } finally {
      setLineaFormSaving(false);
    }
  };

  const handleDeleteLinea = async (id: string) => {
    if (!confirm('¿Eliminar esta línea permanentemente?')) return;
    try {
      await authFetch(`/api/lineas-transporte/${id}`, { method: 'DELETE' });
      toast.success('Línea eliminada.');
      fetchData();
    } catch {
      toast.error('Error al eliminar la línea.');
    }
  };

  const handleToggleLinea = async (id: string, activo: boolean) => {
    // Optimistic update
    setLineas(prev => prev.map(l => l.id === id ? { ...l, activo } : l));
    try {
      await authFetch(`/api/lineas-transporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      emitirCambioMapa('lineas');
    } catch {
      // Revert on error
      setLineas(prev => prev.map(l => l.id === id ? { ...l, activo: !activo } : l));
      toast.error('Error al actualizar.');
    }
  };

  const handleBulkDeleteLineas = async () => {
    if (selectedLineas.length === 0) return;
    if (!confirm(`¿Eliminar ${selectedLineas.length} traza(s)? Esta acción no se puede deshacer.`)) return;
    const prev = lineas;
    setLineas(l => l.filter(x => !selectedLineas.includes(x.id)));
    try {
      const res = await authFetch('/api/lineas-transporte', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedLineas }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedLineas.length} traza(s) eliminada(s).`);
      setSelectedLineas([]);
      emitirCambioMapa('lineas');
    } catch {
      setLineas(prev);
      toast.error('Error al eliminar las trazas.');
    }
  };

  const handleBulkToggleLineas = async (activo: boolean) => {
    if (selectedLineas.length === 0) return;
    try {
      const res = await authFetch('/api/lineas-transporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedLineas, activo }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedLineas.length} línea(s) ${activo ? 'activadas' : 'desactivadas'}.`);
      setSelectedLineas([]);
      fetchData();
    } catch {
      toast.error('Error al actualizar las líneas.');
    }
  };

  const handleBulkToggleLineas_ids = async (ids: string[], activo: boolean) => {
    if (ids.length === 0) return;
    setLineas(prev => prev.map(l => ids.includes(l.id) ? { ...l, activo } : l));
    try {
      const res = await authFetch('/api/lineas-transporte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, activo }),
      });
      if (!res.ok) throw new Error();
      emitirCambioMapa('lineas');
    } catch {
      setLineas(prev => prev.map(l => ids.includes(l.id) ? { ...l, activo: !activo } : l));
      toast.error('Error al actualizar las líneas.');
    }
  };

  const handleDeleteRuta = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta solicitud de forma permanente?')) {
      try {
        await authFetch(`/api/rutas-transporte/${id}`, { method: 'DELETE' });
        fetchData();
      } catch (e) {
        toast.error('Error al eliminar la solicitud.');
      }
    }
  };

  const filteredRutas = rutas.filter(ruta => {
    const term = rutasSearchTerm.toLowerCase();
    const matchesSearch = !term || 
      (ruta.patente && ruta.patente.toLowerCase().includes(term)) ||
      (ruta.numeroSolicitud && ruta.numeroSolicitud.toString().includes(term));
    
    const matchesStatus = rutasFilterStatus === 'TODAS' || ruta.estado === rutasFilterStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.adminLayout}>
      <Toaster position="top-right" />
      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1>Administración GIS</h1>
        </div>
        <nav className={styles.sidebarMenu}>
          <button className={`${styles.menuItem} ${activeTab === 'dashboard' ? styles.active : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          {dbUser?.permisos?.gestionarGrupos && (
            <button className={`${styles.menuItem} ${activeTab === 'grupos' ? styles.active : ''}`} onClick={() => setActiveTab('grupos')}>
              Grupos
            </button>
          )}
          {dbUser?.permisos?.verCapas && (
            <button className={`${styles.menuItem} ${activeTab === 'capas' ? styles.active : ''}`} onClick={() => setActiveTab('capas')}>
              Capas
            </button>
          )}
          {dbUser?.permisos?.verRutas && (
            <button className={`${styles.menuItem} ${activeTab === 'solicitudes' ? styles.active : ''}`} onClick={() => setActiveTab('solicitudes')}>
              Transporte Pesado
            </button>
          )}
          {dbUser?.permisos?.verLineas && (
            <button className={`${styles.menuItem} ${activeTab === 'lineas' ? styles.active : ''}`} onClick={() => setActiveTab('lineas')}>
              Líneas de Colectivo
            </button>
          )}
          {dbUser?.permisos?.gestionarUsuarios && (
            <button className={`${styles.menuItem} ${activeTab === 'usuarios' ? styles.active : ''}`} onClick={() => setActiveTab('usuarios')}>
              Usuarios
            </button>
          )}
          {dbUser?.permisos?.gestionarUsuarios && (
            <button className={`${styles.menuItem} ${activeTab === 'roles' ? styles.active : ''}`} onClick={() => setActiveTab('roles')}>
              Roles y Permisos
            </button>
          )}
          {dbUser?.permisos?.accesoAdmin && (
            <button className={`${styles.menuItem} ${activeTab === 'acceso-qr' ? styles.active : ''}`} onClick={() => { setActiveTab('acceso-qr'); fetchSolicitudesQr(); }}>
              Acceso QR
              {solicitudesQrPendientes > 0 && (
                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 9999, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{solicitudesQrPendientes}</span>
              )}
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
          <section className={styles.fullSection} style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
            {loading ? (
              <p>Cargando dashboard...</p>
            ) : (
              <>
                <div className={styles.dashboardGrid}>
                  <div className={`${styles.statCard} ${styles.total}`}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel}>Total Solicitudes</span>
                      <span className={styles.statIcon}><ClipboardList size={20} /></span>
                    </div>
                    <div className={styles.statValue}>{rutas.length}</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.nuevos}`}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel}>Rutas Pendientes</span>
                      <span className={styles.statIcon}><Clock size={20} /></span>
                    </div>
                    <div className={styles.statValue}>{rutas.filter(r => r.estado === 'PENDIENTE').length}</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.proceso}`}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel}>Capas Activas</span>
                      <span className={styles.statIcon}><MapIcon size={20} /></span>
                    </div>
                    <div className={styles.statValue}>{capas.length}</div>
                  </div>
                  
                  <div className={`${styles.statCard} ${styles.resueltos}`}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel}>Usuarios Activos</span>
                      <span className={styles.statIcon}><Users size={20} /></span>
                    </div>
                    <div className={styles.statValue}>{usuarios.filter(u => u.rol !== 'PENDIENTE').length}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '2px', textTransform: 'uppercase' }}>Alertas y Datos Secundarios</span>
                </div>

                <div className={styles.dashboardGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <div className={`${styles.statCard} ${styles.alert}`} style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel} style={{ color: '#991b1b' }}>Usuarios Pendientes (Sin Acceso)</span>
                      <span className={styles.statIcon}><AlertTriangle size={20} color="#991b1b" /></span>
                    </div>
                    <div className={styles.statValue} style={{ color: '#991b1b' }}>{usuarios.filter(u => u.rol === 'PENDIENTE').length}</div>
                  </div>

                  <div className={`${styles.statCard} ${styles.purple}`} style={{ background: '#faf5ff', borderColor: '#e9d5ff' }}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel} style={{ color: '#6b21a8' }}>Líneas de Transporte</span>
                      <span className={styles.statIcon}><Bus size={20} color="#6b21a8" /></span>
                    </div>
                    <div className={styles.statValue} style={{ color: '#6b21a8' }}>{lineas.length}</div>
                  </div>

                  <div className={`${styles.statCard} ${styles.proceso}`} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                    <div className={styles.statHeader}>
                      <span className={styles.statLabel} style={{ color: '#92400e' }}>Accesos QR (Histórico)</span>
                      <span className={styles.statIcon}><Smartphone size={20} color="#92400e" /></span>
                    </div>
                    <div className={styles.statValue} style={{ color: '#92400e' }}>{solicitudesQr.length}</div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* GRUPOS TAB */}
        {activeTab === 'grupos' && dbUser?.permisos?.gestionarGrupos && (
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
        {activeTab === 'capas' && dbUser?.permisos?.verCapas && (
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
                                          <label style={{ fontSize: '0.85rem', color: '#64648b', fontWeight: 'bold', textTransform: 'capitalize' }}>{translatePropKey(k)}</label>
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

          {activeTab === 'solicitudes' && dbUser?.permisos?.verRutas && (
            <section className={styles.fullSection}>
              <h2>Solicitudes de Transporte Pesado</h2>
              <p className={styles.tabDescription}>Gestione las rutas propuestas por los choferes y transportistas.</p>

              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={rutas.length > 0 && selectedRutas.length === rutas.length}
                    onChange={e => setSelectedRutas(e.target.checked ? rutas.map(r => r.id) : [])}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#1d4ed8' }}
                    title="Seleccionar todas"
                  />
                  <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                    {selectedRutas.length > 0 ? `${selectedRutas.length} seleccionada${selectedRutas.length !== 1 ? 's' : ''}` : 'Seleccionar todas'}
                  </span>
                </div>
                {selectedRutas.length > 0 && (
                  <>
                    <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
                    <button
                      onClick={() => handleBulkToggleRutas(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '7px', border: '1.5px solid #86efac', background: '#f0fdf4', color: '#15803d', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5C1 6.5 3 2 6.5 2S12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                      Activar en mapa
                    </button>
                    <button
                      onClick={() => handleBulkToggleRutas(false)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '7px', border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 6.5C1 6.5 3 2 6.5 2S12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 2l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      Ocultar en mapa
                    </button>
                    <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 4px' }} />
                    <button
                      onClick={() => handleBulkStatusRutas('APROBADA')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '7px', border: '1.5px solid #60a5fa', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleBulkStatusRutas('RECHAZADA')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '7px', border: '1.5px solid #f87171', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                      Rechazar
                    </button>
                    <button
                      onClick={() => setSelectedRutas([])}
                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.78rem', padding: '6px 8px' }}>
                      Limpiar
                    </button>
                  </>
                )}
                
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                    <input 
                      type="text" 
                      placeholder="Buscar patente o N°..."
                      value={rutasSearchTerm}
                      onChange={(e) => setRutasSearchTerm(e.target.value)}
                      style={{ padding: '6px 12px 6px 30px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '160px' }}
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Filter size={14} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                    <select
                      value={rutasFilterStatus}
                      onChange={(e) => setRutasFilterStatus(e.target.value)}
                      style={{ padding: '6px 10px 6px 30px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                      <option value="TODAS">Todos los estados</option>
                      <option value="PENDIENTE">Pendientes</option>
                      <option value="APROBADA">Aprobadas</option>
                      <option value="RECHAZADA">Rechazadas</option>
                      <option value="BORRADOR">Borradores</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: '#6b7280' }}>
                Mostrando {filteredRutas.length} de {rutas.length} solicitudes
              </div>

              {loading ? <p>Cargando solicitudes...</p> : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '36px' }}></th>
                        <th>ID Solicitud</th>
                        <th>Solicitante</th>
                        <th>Datos Técnicos</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'center' }}>Visible</th>
                        <th>Mapa</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const groups = filteredRutas.reduce((acc, ruta) => {
                          const key = ruta.numeroSolicitud || ruta.id;
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(ruta);
                          return acc;
                        }, {} as Record<string, any[]>);
                        return Object.entries(groups).map(([groupKey, groupRoutesRaw]) => {
                          const groupRoutes = groupRoutesRaw as any[];
                          return (
                          <React.Fragment key={groupKey}>
                            {groupRoutes.length > 1 && (
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '2px solid #e2e8f0' }}>
                                <td colSpan={8} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <strong style={{ color: '#0f172a' }}>Solicitud: #{groupKey}</strong>
                                    <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{groupRoutes.length} recorridos</span>
                                    <button 
                                      onClick={() => {
                                        const ids = groupRoutes.map(r => r.id);
                                        const allSelected = ids.every(id => selectedRutas.includes(id));
                                        if (allSelected) {
                                          setSelectedRutas(prev => prev.filter(id => !ids.includes(id)));
                                        } else {
                                          setSelectedRutas(prev => Array.from(new Set([...prev, ...ids])));
                                        }
                                      }}
                                      style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#334155', fontWeight: 500 }}
                                    >
                                      {groupRoutes.every(r => selectedRutas.includes(r.id)) ? 'Deseleccionar grupo' : 'Seleccionar grupo'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {groupRoutes.map(ruta => (
                              <tr key={ruta.id} style={{ opacity: ruta.activo === false ? 0.5 : 1 }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedRutas.includes(ruta.id)}
                              onChange={e => setSelectedRutas(prev =>
                                e.target.checked ? [...prev, ruta.id] : prev.filter(id => id !== ruta.id)
                              )}
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontSize: '0.85rem' }}><strong>#{ruta.numeroSolicitud}</strong></div>
                            {ruta.idSolicitudWeb && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ID Web: {ruta.idSolicitudWeb}</div>}
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{new Date(ruta.creadoEn).toLocaleDateString()}</div>
                          </td>
                          <td style={{ padding: '6px 8px', fontSize: '0.8rem', fontWeight: 500, color: '#334155' }}>{ruta.nombreSolicitante}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '4px' }}><strong>Pat:</strong> {ruta.patente || '-'}</span>
                                <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '4px' }}><strong>Veh:</strong> {ruta.tipoVehiculo || '-'}</span>
                                <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '4px' }}><strong>Peso:</strong> {ruta.pesoToneladas ? `${ruta.pesoToneladas} Tn` : '-'}</span>
                              </div>
                              {ruta.aseguradora && <span style={{ fontSize: '0.7rem' }}><strong>Seg:</strong> {ruta.aseguradora} {ruta.nroSeguro ? `(${ruta.nroSeguro})` : ''}</span>}
                              {ruta.cargaPeligrosa && <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}><Shield size={10} /> Carga Peligrosa</span>}
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
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleRuta(ruta.id, ruta.activo === false)}
                              title={ruta.activo !== false ? 'Visible — clic para ocultar del mapa' : 'Oculta — clic para mostrar en el mapa'}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.73rem', transition: 'all 0.15s',
                                border: ruta.activo !== false ? '1.5px solid #86efac' : '1.5px dashed #d1d5db',
                                background: ruta.activo !== false ? '#f0fdf4' : '#f9fafb',
                                color: ruta.activo !== false ? '#15803d' : '#9ca3af',
                              }}>
                              {ruta.activo !== false ? (
                                <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M1 6.5C1 6.5 3 2 6.5 2S12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M1 1l11 11M5.3 4.3A3.5 3.5 0 0110.7 8M2.3 4.5C1.5 5.2 1 6.5 1 6.5s2 4.5 5.5 4.5c1 0 2-.3 2.8-.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              )}
                              {ruta.activo !== false ? 'Visible' : 'Oculta'}
                            </button>
                          </td>
                          <td>
                            <div className={styles.mapPreviewWrapper}>
                              <div style={{ cursor: 'pointer', position: 'relative' }} onClick={() => {
                                const relatedRutas = ruta.numeroSolicitud ? rutas.filter(r => r.numeroSolicitud === ruta.numeroSolicitud) : [ruta];
                                const features: any[] = [];
                                relatedRutas.forEach(r => {
                                  let g = r.datosGeo;
                                  if (typeof g === 'string') {
                                    try { g = JSON.parse(g); } catch { g = null; }
                                  }
                                  if (g) {
                                    if (g.type === 'FeatureCollection') {
                                      g.features.forEach((f: any) => features.push({ ...f, properties: { ...f.properties, patente: r.patente, destino: r.destinoDireccion } }));
                                    } else if (g.type === 'Feature') {
                                      features.push({ ...g, properties: { ...g.properties, patente: r.patente, destino: r.destinoDireccion } });
                                    } else {
                                      features.push({ type: 'Feature', geometry: g, properties: { patente: r.patente, destino: r.destinoDireccion } });
                                    }
                                  }
                                });
                                const combinedGeo = { type: 'FeatureCollection', features };
                                setPreviewRutaGeo({ geo: combinedGeo, numero: ruta.numeroSolicitud || ruta.patente || 'Sin ID' });
                              }}>
                                <StaticMapPreview geoData={
                                  typeof ruta.datosGeo === 'string' ?
                                    ((): any => { try { return JSON.parse(ruta.datosGeo); } catch { return null; } })()
                                    : ruta.datosGeo
                                } />
                                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(15, 23, 42, 0.8)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', pointerEvents: 'none', zIndex: 10, backdropFilter: 'blur(4px)' }}>
                                  <MapIcon size={12} /> Ampliar Mapa
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {ruta.estado === 'PENDIENTE' && (
                                <>
                                  <button style={{ padding: '4px 8px', fontSize: '0.7rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleEstadoRuta(ruta.id, 'APROBADA')}>Aprobar</button>
                                  <button style={{ padding: '4px 8px', fontSize: '0.7rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleEstadoRuta(ruta.id, 'RECHAZADA')}>Rechazar</button>
                                </>
                              )}
                              {ruta.estado !== 'PENDIENTE' && (
                                <>
                                  <button style={{ padding: '4px 8px', fontSize: '0.7rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleEstadoRuta(ruta.id, 'PENDIENTE')}>Reabrir</button>
                                  {ruta.enlaceDocumento && (
                                    <a href={ruta.enlaceDocumento} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', fontSize: '0.7rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }} title="Ver Documento Original">
                                      <FileText size={10} /> PDF
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              <button style={{ padding: '4px 8px', fontSize: '0.7rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => window.open(`/transporte-pesado?editId=${ruta.id}`, '_blank')}>
                                Editar
                              </button>
                              <button style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleDeleteRuta(ruta.id)}>Eliminar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                          </React.Fragment>
                          );
                        });
                      })()}
                      {rutas.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: 'center' }}>No hay solicitudes de transporte.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'lineas' && dbUser?.permisos?.verLineas && (
            <section className={styles.fullSection}>
              <h2>Líneas de Transporte Público</h2>
              <p className={styles.tabDescription}>Organizá y editá las trazas de todas las líneas agrupadas por jurisdicción.</p>

              {/* ── Editor full-screen overlay ── */}
              {lineaEditorOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#1a1a2e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#16213e', borderBottom: '1px solid #0f3460', flexShrink: 0, flexWrap: 'wrap' }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginRight: '4px' }}>
                      {editingLinea ? 'Editar línea' : 'Nueva línea'}
                    </span>
                    <input placeholder="Nombre *" value={lineaFormNombre} onChange={e => setLineaFormNombre(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #4b5563', fontSize: '0.9rem', minWidth: '150px', background: '#0f172a', color: '#f1f5f9' }} />
                    <input placeholder="Número (ej: 27)" value={lineaFormNumero} onChange={e => setLineaFormNumero(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #4b5563', fontSize: '0.9rem', width: '100px', background: '#0f172a', color: '#f1f5f9' }} />
                    <select value={lineaFormCategoria} onChange={e => setLineaFormCategoria(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #4b5563', fontSize: '0.9rem', background: '#0f172a', color: '#f1f5f9' }}>
                      <option value="NACIONAL">Nacional</option>
                      <option value="PROVINCIAL">Provincial</option>
                      <option value="MUNICIPAL">Municipal</option>
                    </select>
                    <input placeholder="Subcategoría (ej: Ramal Norte)" value={lineaFormSubcategoria} onChange={e => setLineaFormSubcategoria(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #4b5563', fontSize: '0.9rem', minWidth: '160px', background: '#0f172a', color: '#f1f5f9' }} />
                    <input placeholder="Descripción" value={lineaFormDescripcion} onChange={e => setLineaFormDescripcion(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #4b5563', fontSize: '0.9rem', minWidth: '160px', background: '#0f172a', color: '#f1f5f9' }} />
                    <label style={{ color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Color:
                      <input type="color" value={lineaFormColor} onChange={e => setLineaFormColor(e.target.value)}
                        style={{ width: '36px', height: '30px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                    </label>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: 'auto' }}>Clic en mapa → waypoints → ruta automática</span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <LineaEditorMap
                      lineaId={editingLinea?.id}
                      color={lineaFormColor}
                      initialGeo={editingLinea ? (() => { try { return JSON.parse(editingLinea.datosGeo); } catch { return null; } })() : undefined}
                      sessionId={`${user?.uid}-${Date.now()}`}
                      userInfo={{ uid: user?.uid || 'anon', email: dbUser?.email || '', nombre: dbUser?.email?.split('@')[0] || 'Admin' }}
                      onSave={handleSaveLinea}
                      onCancel={() => setLineaEditorOpen(false)}
                      isSaving={lineaFormSaving}
                    />
                  </div>
                </div>
              )}

              {/* ── Import modal ── */}
              {lineaImportOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '720px', maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>Importar GeoJSON</h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Líneas de transporte público</p>
                      </div>
                      <button onClick={() => { setLineaImportOpen(false); setLineaImportPreview([]); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </button>
                    </div>

                    {/* Drop zone */}
                    <label style={{ display: 'block', border: '2px dashed #bfdbfe', borderRadius: '10px', padding: '28px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: '18px', background: '#f8faff' }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); handleLineaImportFiles(e.dataTransfer.files); }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: '#3b82f6' }}>
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/><path d="M16 10v12M10 16l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ fontWeight: 600, color: '#1d4ed8', fontSize: '0.9rem' }}>Arrastrá archivos o hacé clic para seleccionar</div>
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '5px' }}>GeoJSON con LineString, MultiLineString o FeatureCollection · Múltiples archivos</div>
                      <input type="file" accept=".geojson,.json" multiple style={{ display: 'none' }}
                        onChange={e => handleLineaImportFiles(e.target.files)} />
                    </label>

                    {/* Categoría y subcategoría para el lote */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>Categoría del lote</label>
                        <select value={lineaImportCategoria} onChange={e => setLineaImportCategoria(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: '7px', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                          <option value="NACIONAL">Nacional</option>
                          <option value="PROVINCIAL">Provincial</option>
                          <option value="MUNICIPAL">Municipal</option>
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>Subcategoría (opcional)</label>
                        <input value={lineaImportSubcategoria} onChange={e => setLineaImportSubcategoria(e.target.value)}
                          placeholder="ej: Ramal Sur, Corredor Oeste…"
                          style={{ padding: '8px 12px', borderRadius: '7px', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                      </div>
                    </div>

                    {/* Preview list */}
                    {lineaImportPreview.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
                            {lineaImportPreview.length} traza{lineaImportPreview.length !== 1 ? 's' : ''} detectada{lineaImportPreview.length !== 1 ? 's' : ''}
                          </span>
                          <button onClick={() => setLineaImportPreview([])} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                            Limpiar todo
                          </button>
                        </div>
                        <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.81rem' }}>
                            <thead>
                              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre</th>
                                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nro.</th>
                                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ramal</th>
                                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sentido</th>
                                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</th>
                                <th style={{ width: '28px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineaImportPreview.map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                  <td style={{ padding: '6px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <input type="color" value={item.color}
                                        onChange={e => setLineaImportPreview(prev => prev.map((p, j) => j === i ? { ...p, color: e.target.value } : p))}
                                        style={{ width: '24px', height: '20px', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: 0 }} />
                                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color, display: 'inline-block', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)', flexShrink: 0 }} />
                                    </div>
                                  </td>
                                  <td style={{ padding: '6px 10px' }}>
                                    <input value={item.nombre}
                                      onChange={e => setLineaImportPreview(prev => prev.map((p, j) => j === i ? { ...p, nombre: e.target.value } : p))}
                                      style={{ border: '1px solid #e5e7eb', borderRadius: '5px', padding: '3px 7px', fontSize: '0.81rem', width: '100%', minWidth: '120px' }} />
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input value={item.numero}
                                      onChange={e => setLineaImportPreview(prev => prev.map((p, j) => j === i ? { ...p, numero: e.target.value } : p))}
                                      style={{ border: '1px solid #e5e7eb', borderRadius: '5px', padding: '3px 7px', fontSize: '0.81rem', width: '54px' }} />
                                  </td>
                                  <td style={{ padding: '6px 8px', fontSize: '0.78rem', color: '#6d28d9', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                    {item.subcategoriaAuto || lineaImportSubcategoria || <span style={{ color: '#d1d5db' }}>—</span>}
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {item.sentido ? (
                                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: item.sentido === 'IDA' ? '#eff6ff' : item.sentido === 'VUELTA' ? '#f5f3ff' : '#f9fafb', color: item.sentido === 'IDA' ? '#1d4ed8' : item.sentido === 'VUELTA' ? '#7c3aed' : '#374151', border: `1px solid ${item.sentido === 'IDA' ? '#bfdbfe' : item.sentido === 'VUELTA' ? '#ddd6fe' : '#e5e7eb'}` }}>
                                        {item.sentido}
                                      </span>
                                    ) : <span style={{ color: '#d1d5db', fontSize: '0.78rem' }}>—</span>}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#9ca3af', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                    {item.descripcion || <span style={{ color: '#d1d5db' }}>—</span>}
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <button onClick={() => setLineaImportPreview(prev => prev.filter((_, j) => j !== i))}
                                      style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid #f3f4f6', marginTop: '4px' }}>
                      <button onClick={() => { setLineaImportOpen(false); setLineaImportPreview([]); }}
                        style={{ padding: '9px 20px', borderRadius: '7px', border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                        Cancelar
                      </button>
                      <button
                        disabled={lineaImportPreview.length === 0 || lineaImportSaving}
                        onClick={handleConfirmLineaImport}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px', borderRadius: '7px', border: 'none', background: lineaImportPreview.length > 0 ? '#1d4ed8' : '#e5e7eb', color: lineaImportPreview.length > 0 ? '#fff' : '#9ca3af', fontWeight: 700, cursor: lineaImportPreview.length > 0 ? 'pointer' : 'not-allowed', fontSize: '0.875rem' }}>
                        {lineaImportSaving ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="20 14"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9v2.5A.5.5 0 002.5 12h9a.5.5 0 00.5-.5V9M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                        {lineaImportSaving ? 'Importando…' : `Importar ${lineaImportPreview.length} traza${lineaImportPreview.length !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Toolbar ── */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={openNewLinea} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '7px', border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', letterSpacing: '0.01em' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Nueva línea
                </button>
                <button onClick={() => setLineaImportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '7px', border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 9v2.5A.5.5 0 002.5 12h9a.5.5 0 00.5-.5V9M7 2v7M4.5 6.5L7 9l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Importar GeoJSON
                </button>
                <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '280px' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <input placeholder="Buscar por nombre o número…" value={lineaFiltro} onChange={e => setLineaFiltro(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', borderRadius: '7px', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', outline: 'none', background: '#fff' }} />
                </div>
                <select value={lineaFiltroCategoria} onChange={e => setLineaFiltroCategoria(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '7px', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                  <option value="">Todas las categorías</option>
                  <option value="NACIONAL">Nacional</option>
                  <option value="PROVINCIAL">Provincial</option>
                  <option value="MUNICIPAL">Municipal</option>
                </select>
                {selectedLineas.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
                    <span style={{ fontWeight: 600, color: '#1d4ed8', fontSize: '0.82rem' }}>{selectedLineas.length} seleccionadas</span>
                    <button onClick={() => handleBulkToggleLineas(true)} style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>Activar</button>
                    <button onClick={() => handleBulkToggleLineas(false)} style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}>Desactivar</button>
                    <button onClick={handleBulkDeleteLineas} style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#7f1d1d', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      Eliminar
                    </button>
                    <button onClick={() => setSelectedLineas([])} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.78rem', padding: '4px 6px' }}>Limpiar</button>
                  </div>
                )}
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lineas.length} trazas en total</span>
              </div>

              {/* ── Grouped table ── */}
              {loading ? <p>Cargando líneas…</p> : (() => {
                const filtered = lineas.filter(l =>
                  (!lineaFiltroCategoria || l.categoria === lineaFiltroCategoria) &&
                  (!lineaFiltro || l.nombre.toLowerCase().includes(lineaFiltro.toLowerCase()) || (l.numero || '').includes(lineaFiltro))
                );

                const CATS = ['NACIONAL', 'PROVINCIAL', 'MUNICIPAL'] as const;
                const CAT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
                  NACIONAL:   { label: 'Nacional',   color: '#1e40af', bg: 'linear-gradient(135deg,#1d4ed8,#1e40af)', border: '#bfdbfe' },
                  PROVINCIAL: { label: 'Provincial', color: '#6d28d9', bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: '#ddd6fe' },
                  MUNICIPAL:  { label: 'Municipal',  color: '#065f46', bg: 'linear-gradient(135deg,#059669,#065f46)', border: '#a7f3d0' },
                };

                // SVG helpers
                const IconChevron = ({ open }: { open: boolean }) => (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );
                const IconRoute = () => (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle cx="2.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M2.5 9V6.5A4 4 0 016.5 2.5H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                );
                const IconArrowRight = () => (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5h7M6 3l3 2.5L6 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );
                const IconArrowLeft = () => (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M9 5.5H2M5 3L2 5.5 5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );
                const IconArrowBoth = () => (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1 5.5h9M3 3.5L1 5.5l2 2M8 3.5l2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );
                const IconEye = () => (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M1 6.5C1 6.5 3 2 6.5 2S12 6.5 12 6.5 10 11 6.5 11 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                );
                const IconEyeOff = () => (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M1 1l11 11M5.3 4.3A3.5 3.5 0 0110.7 8M2.3 4.5C1.5 5.2 1 6.5 1 6.5s2 4.5 5.5 4.5c1 0 2-.3 2.8-.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                );
                const IconPencil = () => (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                );
                const IconTrash = () => (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4h8M5 4V2.5h2V4M4 4l.5 5.5h3L8 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );

                // Group: cat → lineaKey → ramal → [records]
                type LineaGroup = { nombre: string; numero: string | null; color: string; records: any[] };
                const grouped: Record<string, LineaGroup[]> = {};
                for (const cat of CATS) {
                  const catLineas = filtered.filter(l => (l.categoria || 'NACIONAL') === cat);
                  const byLinea: Record<string, LineaGroup> = {};
                  for (const l of catLineas) {
                    const key = `${l.nombre}__${l.numero || ''}`;
                    if (!byLinea[key]) byLinea[key] = { nombre: l.nombre, numero: l.numero || null, color: l.color, records: [] };
                    byLinea[key].records.push(l);
                  }
                  grouped[cat] = Object.values(byLinea).sort((a, b) => {
                    const na = parseInt(a.numero || '9999'), nb = parseInt(b.numero || '9999');
                    return na !== nb ? na - nb : a.nombre.localeCompare(b.nombre);
                  });
                }

                // Shared pill button style factory
                const pillBtn = (variant: 'show' | 'hide' | 'ghost') => ({
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '3px 10px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, transition: 'opacity 0.12s',
                  border: variant === 'show' ? '1px solid #86efac' : variant === 'hide' ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                  background: variant === 'show' ? '#f0fdf4' : variant === 'hide' ? '#fef2f2' : '#f9fafb',
                  color: variant === 'show' ? '#15803d' : variant === 'hide' ? '#b91c1c' : '#6b7280',
                });

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {CATS.map(cat => {
                      const meta = CAT_META[cat];
                      const catGroups = grouped[cat] || [];
                      if (catGroups.length === 0 && lineaFiltroCategoria && lineaFiltroCategoria !== cat) return null;
                      const catAllIds = catGroups.flatMap(g => g.records.map((r: any) => r.id));

                      return (
                        <div key={cat} style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: `1.5px solid ${meta.border}` }}>

                          {/* ── Level 1: Categoria header ── */}
                          <div style={{ background: meta.bg, color: '#fff', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input type="checkbox"
                              checked={catAllIds.length > 0 && catAllIds.every(id => selectedLineas.includes(id))}
                              onChange={e => setSelectedLineas(prev => e.target.checked ? [...new Set([...prev, ...catAllIds])] : prev.filter(id => !catAllIds.includes(id)))}
                              style={{ width: '15px', height: '15px', accentColor: '#fff', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.label}</div>
                              <div style={{ opacity: 0.75, fontSize: '0.75rem', marginTop: '1px' }}>{catGroups.length} {catGroups.length === 1 ? 'línea' : 'líneas'} · {catAllIds.length} trazas</div>
                            </div>
                            <button onClick={() => handleBulkToggleLineas_ids(catAllIds, true)}
                              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                              Activar todas
                            </button>
                            <button onClick={() => handleBulkToggleLineas_ids(catAllIds, false)}
                              style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                              Desactivar todas
                            </button>
                          </div>

                          {catGroups.length === 0 ? (
                            <div style={{ padding: '28px', color: '#9ca3af', textAlign: 'center', fontSize: '0.85rem', background: '#fafafa' }}>
                              No hay líneas cargadas en esta categoría
                            </div>
                          ) : (
                            <div style={{ background: '#fff' }}>
                              {catGroups.map((group, gi) => {
                                const lineaKey = `${cat}__${group.nombre}__${group.numero || ''}`;
                                const isLineaOpen = expandedLineas.has(lineaKey);
                                const lineaIds = group.records.map((r: any) => r.id);
                                const activeCount = group.records.filter((r: any) => r.activo !== false).length;
                                const statusColor = activeCount === lineaIds.length ? '#15803d' : activeCount === 0 ? '#b91c1c' : '#b45309';
                                const statusBg = activeCount === lineaIds.length ? '#f0fdf4' : activeCount === 0 ? '#fef2f2' : '#fffbeb';

                                // Group records by ramal (subcategoria)
                                const byRamal: Record<string, any[]> = {};
                                for (const r of group.records) {
                                  const ramal = r.subcategoria || '__sin_ramal__';
                                  if (!byRamal[ramal]) byRamal[ramal] = [];
                                  byRamal[ramal].push(r);
                                }
                                const ramalKeys = Object.keys(byRamal).sort();

                                return (
                                  <div key={lineaKey} style={{ borderTop: gi > 0 ? '1px solid #f3f4f6' : 'none' }}>

                                    {/* ── Level 2: Línea row ── */}
                                    <div
                                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', background: isLineaOpen ? '#f8fafc' : '#fff', cursor: 'pointer', userSelect: 'none', transition: 'background 0.12s' }}
                                      onClick={() => setExpandedLineas(prev => { const n = new Set(prev); n.has(lineaKey) ? n.delete(lineaKey) : n.add(lineaKey); return n; })}
                                    >
                                      <input type="checkbox"
                                        checked={lineaIds.every(id => selectedLineas.includes(id))}
                                        onChange={e => { e.stopPropagation(); setSelectedLineas(prev => e.target.checked ? [...new Set([...prev, ...lineaIds])] : prev.filter(id => !lineaIds.includes(id))); }}
                                        onClick={e => e.stopPropagation()}
                                        style={{ width: '14px', height: '14px', cursor: 'pointer', flexShrink: 0 }}
                                      />
                                      {/* Color swatch */}
                                      <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: group.color, flexShrink: 0, display: 'inline-block', boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }} />
                                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                                        {group.numero ? `Línea ${group.numero}` : group.nombre}
                                      </span>
                                      {group.numero && group.nombre !== `Línea ${group.numero}` && (
                                        <span style={{ color: '#6b7280', fontSize: '0.82rem', fontWeight: 400 }}>{group.nombre}</span>
                                      )}
                                      <span style={{ marginLeft: 'auto' }} />
                                      {/* Active badge */}
                                      <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: statusBg, color: statusColor, border: `1px solid ${statusColor}22` }}>
                                        {activeCount}/{lineaIds.length} activas
                                      </span>
                                      <button onClick={e => { e.stopPropagation(); handleBulkToggleLineas_ids(lineaIds, true); }}
                                        style={pillBtn('show')}>Activar</button>
                                      <button onClick={e => { e.stopPropagation(); handleBulkToggleLineas_ids(lineaIds, false); }}
                                        style={pillBtn('hide')}>Desactivar</button>
                                      <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}><IconChevron open={isLineaOpen} /></span>
                                    </div>

                                    {isLineaOpen && (
                                      <div style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                        {ramalKeys.map(ramalKey => {
                                          const ramalRecords = byRamal[ramalKey];
                                          const ramalLabel = ramalKey === '__sin_ramal__' ? null : ramalKey;
                                          const ramalExpandKey = `${lineaKey}__${ramalKey}`;
                                          const isRamalOpen = expandedRamales.has(ramalExpandKey);
                                          const ramalIds = ramalRecords.map((r: any) => r.id);

                                          return (
                                            <div key={ramalKey} style={{ borderTop: '1px solid #f1f5f9' }}>

                                              {/* ── Level 3: Ramal header ── */}
                                              {ramalLabel && (
                                                <div
                                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 18px 7px 44px', background: isRamalOpen ? '#f1f5f9' : '#f8fafc', cursor: 'pointer', userSelect: 'none', transition: 'background 0.12s' }}
                                                  onClick={() => setExpandedRamales(prev => { const n = new Set(prev); n.has(ramalExpandKey) ? n.delete(ramalExpandKey) : n.add(ramalExpandKey); return n; })}
                                                >
                                                  <span style={{ color: '#6d28d9', display: 'flex', alignItems: 'center' }}><IconRoute /></span>
                                                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{ramalLabel}</span>
                                                  <span style={{ fontSize: '0.73rem', color: '#9ca3af', fontWeight: 400 }}>{ramalRecords.length} traza{ramalRecords.length !== 1 ? 's' : ''}</span>
                                                  <span style={{ marginLeft: 'auto' }} />
                                                  <button onClick={e => { e.stopPropagation(); handleBulkToggleLineas_ids(ramalIds, true); }}
                                                    style={pillBtn('show')}>Activar</button>
                                                  <button onClick={e => { e.stopPropagation(); handleBulkToggleLineas_ids(ramalIds, false); }}
                                                    style={pillBtn('hide')}>Desactivar</button>
                                                  <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center' }}><IconChevron open={isRamalOpen} /></span>
                                                </div>
                                              )}

                                              {/* ── Level 4: Sentido rows ── */}
                                              {(!ramalLabel || isRamalOpen) && ramalRecords.map((linea: any, si: number) => {
                                                const sentido = (linea.sentido || '').toUpperCase();
                                                const isIda = sentido === 'IDA';
                                                const isVuelta = sentido === 'VUELTA';
                                                const isActive = linea.activo !== false;
                                                const indent = ramalLabel ? '68px' : '44px';
                                                // Human-readable label: capitalize first letter of each word
                                                const sentidoLabel = sentido
                                                  ? sentido.charAt(0) + sentido.slice(1).toLowerCase().replace(/_/g, ' ')
                                                  : 'Sin sentido';
                                                const sentidoColor = isIda ? '#1e40af' : isVuelta ? '#6d28d9' : '#374151';
                                                return (
                                                  <div key={linea.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    padding: `8px 18px 8px ${indent}`,
                                                    borderTop: si > 0 || ramalLabel ? '1px solid #e9ecef' : 'none',
                                                    background: isActive ? '#fff' : '#fafafa',
                                                    transition: 'background 0.12s',
                                                  }}>
                                                    <input type="checkbox"
                                                      checked={selectedLineas.includes(linea.id)}
                                                      onChange={e => setSelectedLineas(prev => e.target.checked ? [...prev, linea.id] : prev.filter(id => id !== linea.id))}
                                                      style={{ width: '13px', height: '13px', cursor: 'pointer', flexShrink: 0 }}
                                                    />
                                                    {/* Direction icon + label */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                                                      <span style={{ color: isIda ? '#1d4ed8' : isVuelta ? '#7c3aed' : '#6b7280', display: 'flex', alignItems: 'center' }}>
                                                        {isIda ? <IconArrowRight /> : isVuelta ? <IconArrowLeft /> : <IconArrowBoth />}
                                                      </span>
                                                      <span style={{ fontSize: '0.83rem', fontWeight: 600, color: sentidoColor }}>
                                                        {sentidoLabel}
                                                      </span>
                                                    </div>
                                                    {linea.descripcion && (
                                                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                                                        {linea.descripcion}
                                                      </span>
                                                    )}
                                                    <span style={{ marginLeft: 'auto' }} />
                                                    {/* Visibility toggle */}
                                                    <button
                                                      onClick={() => handleToggleLinea(linea.id, !isActive)}
                                                      title={isActive ? 'Visible — clic para ocultar del mapa' : 'Oculta — clic para mostrar en el mapa'}
                                                      style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                                                        fontWeight: 600, fontSize: '0.75rem', transition: 'all 0.15s',
                                                        border: isActive ? '1.5px solid #86efac' : '1.5px dashed #d1d5db',
                                                        background: isActive ? '#f0fdf4' : '#f9fafb',
                                                        color: isActive ? '#15803d' : '#9ca3af',
                                                        minWidth: '86px', justifyContent: 'center',
                                                      }}>
                                                      {isActive ? <IconEye /> : <IconEyeOff />}
                                                      {isActive ? 'Visible' : 'Oculta'}
                                                    </button>
                                                    {/* Edit */}
                                                    <button
                                                      onClick={() => openEditLinea(linea)}
                                                      title="Editar traza"
                                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '6px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                                      <IconPencil /> Editar
                                                    </button>
                                                    {/* Delete */}
                                                    <button
                                                      onClick={() => handleDeleteLinea(linea.id)}
                                                      title="Eliminar traza"
                                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', border: '1.5px solid #fecaca', background: '#fff5f5', color: '#ef4444', cursor: 'pointer' }}>
                                                      <IconTrash />
                                                    </button>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filtered.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0', fontSize: '0.875rem' }}>
                        No se encontraron líneas con ese filtro.
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

          {activeTab === 'usuarios' && dbUser?.permisos?.gestionarUsuarios && (
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
                              <option value="OPERADOR">OPERADOR (Editor de Trazas)</option>
                              <option value="ADMINISTRADOR">ADMINISTRADOR (Avanzado)</option>
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

          {activeTab === 'roles' && dbUser?.permisos?.gestionarUsuarios && (
            <section className={styles.fullSection}>
              <h2>Roles y Permisos</h2>
              <p className={styles.tabDescription}>
                Configurá los permisos dinámicos para cada rol del sistema. Los cambios aplicarán en el próximo inicio de sesión de los usuarios.
              </p>
              
              {loading ? (
                <p>Cargando roles...</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table} style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'left', minWidth: 150 }}>Rol</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Acceso Admin</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Ver Capas</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Editar Capas</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Ver Transp.</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Editar Transp.</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Ver Colectivos</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Editar Colectivos</th>
                        <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Gestión Usuarios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolesPermisosData.map((rolData: any) => (
                        <tr key={rolData.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>{rolData.rol}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.accesoAdmin} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'accesoAdmin', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.verCapas} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'verCapas', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.editarCapas} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'editarCapas', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.verRutas} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'verRutas', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.editarRutas} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'editarRutas', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.verLineas} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'verLineas', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.editarLineas} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'editarLineas', e.target.checked)} />
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <input type="checkbox" checked={rolData.gestionarUsuarios} disabled={rolData.rol === 'SUPER_ADMIN'} onChange={(e) => handlePermisoChange(rolData.id, 'gestionarUsuarios', e.target.checked)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── Acceso QR ── */}
          {activeTab === 'acceso-qr' && (
            <section className={styles.fullSection}>
              <h2>Acceso por QR</h2>
              <p className={styles.tabDescription}>
                Gestioná las solicitudes de acceso por código QR. Aprobá, rechazá o bloqueá dispositivos.
              </p>

              {/* Solicitudes */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                    Solicitudes
                    {solicitudesQrPendientes > 0 && (
                      <span style={{ marginLeft: 8, background: '#ef4444', color: '#fff', borderRadius: 9999, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{solicitudesQrPendientes} pendientes</span>
                    )}
                  </h3>
                  <button onClick={fetchSolicitudesQr} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                    Actualizar
                  </button>
                </div>

                {solicitudesQr.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>No hay solicitudes registradas.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Nombre', 'Email', 'Dispositivo', 'IP', 'Fecha', 'Estado', 'Acciones'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {solicitudesQr.map((s: any) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.nombre}</td>
                            <td style={{ padding: '8px 12px', color: '#4b5563' }}>{s.email}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.deviceInfo}>{s.deviceInfo || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{s.ipCelular || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(s.creadoEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
                                background: s.estado === 'ESCANEADO' ? '#fef9c3' : s.estado === 'APROBADO' ? '#dcfce7' : s.estado === 'BLOQUEADO' ? '#fee2e2' : '#f1f5f9',
                                color: s.estado === 'ESCANEADO' ? '#854d0e' : s.estado === 'APROBADO' ? '#166534' : s.estado === 'BLOQUEADO' ? '#dc2626' : '#4b5563',
                              }}>{s.estado}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {s.estado === 'ESCANEADO' && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleQrAccion(s.id, 'aprobar')} style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Aprobar</button>
                                  <button onClick={() => handleQrAccion(s.id, 'rechazar')} style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Rechazar</button>
                                  <button onClick={() => handleQrAccion(s.id, 'bloquear')} style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: '#7f1d1d', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Bloquear</button>
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

              {/* Dispositivos bloqueados */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>Dispositivos bloqueados</h3>
                {dispositivosBloqueados.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>No hay dispositivos bloqueados.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Fingerprint', 'Email', 'Fecha', 'Acción'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dispositivosBloqueados.map((d: any) => (
                          <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{d.fingerprint.slice(0, 16)}…</td>
                            <td style={{ padding: '8px 12px', color: '#4b5563' }}>{d.email || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#6b7280' }}>{new Date(d.creadoEn).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <button onClick={() => handleDesbloquear(d.id)} style={{ padding: '3px 10px', borderRadius: 5, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Desbloquear</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ── Modal de Vista Previa de Mapa ── */}
        {previewRutaGeo && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '90vw', maxWidth: '1000px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapIcon size={20} color="#3b82f6" /> Ruta: {previewRutaGeo.numero}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Vista detallada interactiva</p>
                </div>
                <button onClick={() => setPreviewRutaGeo(null)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', color: '#64748b', display: 'flex' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <StaticMapPreview geoData={previewRutaGeo.geo} interactive={true} height="100%" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
