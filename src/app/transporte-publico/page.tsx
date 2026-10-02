'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  MapPin, Truck, CheckCircle, ArrowRight, Loader2, Plus, Edit2, ArrowLeft, 
  List, LayoutDashboard, User, Shield, Info, Search, Filter, ExternalLink, 
  FileText, Route, Navigation, ClipboardList, Clock, Zap, ChevronUp, ChevronDown, 
  Bot, AlertTriangle, Wand2, Trash2, Pencil, Sparkles, Eye, EyeOff, RefreshCw, Smartphone
} from 'lucide-react';
import AccessDenied from '@/components/AccessDenied';
import { parseGeojsonToLines } from '@/utils/parseGeojsonLines';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';

// Dynamic import for Leaflet component to avoid SSR errors
const WizardMap = dynamic(() => import('../../components/WizardMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>
});

const StaticMapPreview = dynamic(() => import('../../components/StaticMapPreview'), {
  ssr: false,
  loading: () => <div style={{ height: '200px', width: '100%', backgroundColor: '#eee', borderRadius: '8px', marginBottom: '15px' }} />
});

import { useAuth } from '@/context/AuthContext';
import { emitirNuevaSolicitud, emitirCambioMapa } from '@/lib/rtdb';

const ROUTE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2'];

export default function TransportePublicoPage() {
  const geojsonInputRef = React.useRef<HTMLInputElement>(null);
  const [isImportingGeo, setIsImportingGeo] = useState(false);

  const handleGeojsonFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingGeo(true);
    const toastId = toast.loading(`Analizando ${file.name}...`);
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      const parsedLines = parseGeojsonToLines(geojson, file.name);

      if (parsedLines.length === 0) {
        throw new Error('No se encontraron trazas de recorrido LineString en el archivo');
      }

      toast.loading(`Importando ${parsedLines.length} trazas con empresas y sentidos...`, { id: toastId });

      const res = await authFetch('/api/lineas-transporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas: parsedLines })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar las líneas');

      toast.success(`¡Éxito! ${parsedLines.length} líneas y ramales importados correctamente.`, { id: toastId });
      emitirCambioMapa('lineas');
      fetchLineas();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al importar archivo GeoJSON', { id: toastId });
    } finally {
      setIsImportingGeo(false);
      if (geojsonInputRef.current) geojsonInputRef.current.value = '';
    }
  };

  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, dbUser, loading, getIdToken } = useAuth();
  
  // Navigation mode: 'gestionar' or 'crear'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'gestionar' | 'crear' | 'relevamientos'>(
    tabParam === 'relevamientos' ? 'relevamientos' : 'gestionar'
  );
  const [relevamientos, setRelevamientos] = useState<any[]>([]);
  const [loadingRelevamientos, setLoadingRelevamientos] = useState(false);
  const [isPromotingId, setIsPromotingId] = useState<string | null>(null);

  // Lines list state for management mode
  const [lineas, setLineas] = useState<any[]>([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<'TODAS' | 'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL'>('TODAS');
  const [isAutoPairing, setIsAutoPairing] = useState(false);
  const [expandedLineas, setExpandedLineas] = useState<Record<string, boolean>>({});
  const [selectedLineaId, setSelectedLineaId] = useState<string | null>(null);

  // Wizard state for 'crear' mode
  const [step, setStep] = useState(1);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [color, setColor] = useState('#E53E3E');
  const [categoria, setCategoria] = useState('MUNICIPAL');
  const [subcategoria, setSubcategoria] = useState('');
  const [sentido, setSentido] = useState('');
  const [descripcion, setDescripcion] = useState('');
  
  const [datosGeo, setDatosGeo] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedWaypoints, setSavedWaypoints] = useState<any[]>([]);

  // States for AI extraction in Step 2
  const [aiText, setAiText] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [preTracedFeatures, setPreTracedFeatures] = useState<any[]>([]);
  const [editingMetadataIdx, setEditingMetadataIdx] = useState<number | null>(null);
  const [tempMetadata, setTempMetadata] = useState({ name: '', description: '' });

  const authFetch = async (url: string, init?: RequestInit) => {
    let token = '';
    if (user) {
      token = await getIdToken();
    }
    const headers = new Headers(init?.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const fetchLineas = async () => {
    setLoadingLineas(true);
    try {
      const res = await fetch('/api/lineas-transporte', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLineas(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching lines:', e);
    } finally {
      setLoadingLineas(false);
    }
  };

  const fetchRelevamientos = async () => {
    setLoadingRelevamientos(true);
    try {
      const res = await fetch('/api/bitacora-gps');
      if (res.ok) {
        const data = await res.json();
        setRelevamientos(data.items || []);
      }
    } catch (e) {
      console.error('Error fetching relevamientos:', e);
    } finally {
      setLoadingRelevamientos(false);
    }
  };

  const handlePromoverRelevamiento = async (relId: string) => {
    setIsPromotingId(relId);
    try {
      const res = await fetch(`/api/bitacora-gps/${relId}/convertir-linea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipToLanus: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al promover');
      toast.success(data.message || 'Relevamiento promovido a Línea Oficial');
      emitirCambioMapa('lineas');
      fetchLineas();
      fetchRelevamientos();
    } catch (e: any) {
      toast.error(e.message || 'Error al promover a línea oficial');
    } finally {
      setIsPromotingId(null);
    }
  };

  const handleDeleteRelevamiento = async (relId: string) => {
    if (!confirm('¿Eliminar este relevamiento GPS?')) return;
    try {
      const res = await fetch(`/api/bitacora-gps/${relId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Relevamiento eliminado');
        fetchRelevamientos();
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  useEffect(() => {
    fetchLineas();
    fetchRelevamientos();
  }, []);

  const handleToggleSentido = async (id: string, currentSentido: string) => {
    const nextSentido = (currentSentido || '').toUpperCase() === 'VUELTA' ? 'IDA' : 'VUELTA';
    setLineas(prev => prev.map(l => l.id === id ? { ...l, sentido: nextSentido } : l));
    try {
      const res = await authFetch(`/api/lineas-transporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentido: nextSentido }),
      });
      if (!res.ok) throw new Error();
      emitirCambioMapa('lineas');
      toast.success(`Traza actualizada a ${nextSentido}`);
    } catch {
      setLineas(prev => prev.map(l => l.id === id ? { ...l, sentido: currentSentido } : l));
      toast.error('Error al actualizar sentido');
    }
  };

  const handleAutoPair = async () => {
    setIsAutoPairing(true);
    try {
      const res = await authFetch('/api/lineas-transporte', { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al emparejar');
      toast.success(data.message || 'Líneas emparejadas como Ida y Vuelta');
      emitirCambioMapa('lineas');
      fetchLineas();
    } catch (e: any) {
      toast.error(e.message || 'Error al emparejar trazas');
    } finally {
      setIsAutoPairing(false);
    }
  };

  const handleToggleActivo = async (id: string, activo: boolean) => {
    setLineas(prev => prev.map(l => l.id === id ? { ...l, activo } : l));
    try {
      const res = await authFetch(`/api/lineas-transporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      if (!res.ok) throw new Error();
      emitirCambioMapa('lineas');
    } catch {
      setLineas(prev => prev.map(l => l.id === id ? { ...l, activo: !activo } : l));
      toast.error('Error al actualizar visibilidad');
    }
  };

  const handleDeleteLinea = async (id: string) => {
    if (!confirm('¿Eliminar esta traza permanentemente?')) return;
    try {
      const res = await authFetch(`/api/lineas-transporte/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Traza eliminada');
      emitirCambioMapa('lineas');
      fetchLineas();
    } catch {
      toast.error('Error al eliminar traza');
    }
  };

  const statsCategorias = useMemo(() => {
    let nac = 0, prov = 0, mun = 0;
    lineas.forEach(l => {
      const cat = (l.categoria || 'NACIONAL').toUpperCase();
      if (cat === 'NACIONAL') nac++;
      else if (cat === 'PROVINCIAL') prov++;
      else mun++;
    });
    return { todas: lineas.length, nacional: nac, provincial: prov, municipal: mun };
  }, [lineas]);

  // Group lines by Line number / name & ramal
  const groupedLineas = useMemo(() => {
    const filtered = lineas.filter(l => {
      const cat = (l.categoria || 'NACIONAL').toUpperCase();
      if (categoriaFilter !== 'TODAS' && cat !== categoriaFilter) return false;

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        (l.nombre && l.nombre.toLowerCase().includes(q)) ||
        (l.numero && String(l.numero).toLowerCase().includes(q)) ||
        (l.subcategoria && l.subcategoria.toLowerCase().includes(q)) ||
        (l.descripcion && l.descripcion.toLowerCase().includes(q)) ||
        (l.sentido && l.sentido.toLowerCase().includes(q)) ||
        (l.categoria && l.categoria.toLowerCase().includes(q))
      );
    });

    const groups: Record<string, { lineaLabel: string; numero: string | null; color: string; categoria: string; records: any[] }> = {};
    
    filtered.forEach(l => {
      const num = l.numero ? String(l.numero).replace(/^0+/, '') : '';
      const lineaLabel = num ? `Línea ${num}` : (l.nombre || 'Línea de Transporte');
      const cat = (l.categoria || 'NACIONAL').toUpperCase();
      const key = `${cat}|${lineaLabel}`;
      
      if (!groups[key]) {
        groups[key] = {
          lineaLabel,
          numero: num || null,
          color: l.color || '#2563eb',
          categoria: cat,
          records: [],
        };
      }
      groups[key].records.push(l);
    });

    return Object.entries(groups).sort(([, a], [, b]) => {
      const numA = parseInt(a.numero || '99999', 10);
      const numB = parseInt(b.numero || '99999', 10);
      if (numA !== numB) return numA - numB;
      return a.lineaLabel.localeCompare(b.lineaLabel);
    });
  }, [lineas, searchFilter, categoriaFilter]);

  const handleAITrace = async () => {
    if (!aiText.trim()) return;
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const res = await authFetch('/api/parse-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, index: preTracedFeatures.length, description: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el texto.');
      
      if (Array.isArray(data)) {
        setPreTracedFeatures(prev => [...prev, ...data]);
      } else {
        const feats = data.features || (data.feature ? [data.feature] : []);
        if (feats.length === 0) throw new Error('No se generaron recorridos');
        setPreTracedFeatures(prev => [...prev, ...feats]);
      }
      setAiText('');
    } catch (err: any) {
      setAiError(err.message || 'No se pudo procesar el texto.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const startEditMetadata = (idx: number) => {
    const feature = preTracedFeatures[idx];
    if (!feature) return;
    setTempMetadata({
      name: feature.properties?.name || `Recorrido ${idx + 1}`,
      description: feature.properties?.description || ''
    });
    setEditingMetadataIdx(idx);
  };

  const saveMetadata = (idx: number) => {
    setPreTracedFeatures(prev => prev.map((f, i) => {
      if (i === idx) {
        return {
          ...f,
          properties: {
            ...f.properties,
            name: tempMetadata.name,
            description: tempMetadata.description
          }
        };
      }
      return f;
    }));
    setEditingMetadataIdx(null);
  };

  const deleteFeature = (idx: number) => {
    setPreTracedFeatures(prev => prev.filter((_, i) => i !== idx));
  };

  const addManualFeature = () => {
    const newIdx = preTracedFeatures.length;
    setPreTracedFeatures(prev => [...prev, {
      type: 'Feature',
      properties: { name: `Ramal ${newIdx + 1}`, description: '', color: ROUTE_COLORS[newIdx % ROUTE_COLORS.length] },
    }]);
    setTempMetadata({ name: `Ramal ${newIdx + 1}`, description: '' });
    setEditingMetadataIdx(newIdx);
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    if (!datosGeo) {
      alert("Debes dibujar el recorrido en el mapa antes de finalizar.");
      return;
    }
    if (!nombre) {
      alert("El nombre de la línea es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      let featuresToSave = [];
      if (datosGeo && datosGeo.type === 'FeatureCollection' && Array.isArray(datosGeo.features)) {
        featuresToSave = datosGeo.features;
      } else if (datosGeo && datosGeo.type === 'Feature') {
        featuresToSave = [datosGeo];
      }

      if (featuresToSave.length === 0) {
        throw new Error('No hay trazos geográficos para guardar.');
      }

      for (const feature of featuresToSave) {
        const individualGeo = {
          type: 'FeatureCollection',
          features: [feature]
        };

        const res = await authFetch('/api/lineas-transporte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            numero,
            color: feature.properties?.color || color,
            categoria,
            subcategoria: feature.properties?.name || subcategoria || 'Ramal Principal',
            sentido: sentido || null,
            descripcion: feature.properties?.description || descripcion || '',
            datosGeo: individualGeo
          })
        });

        if (!res.ok) throw new Error('Error al guardar uno de los ramales.');
      }
      
      emitirCambioMapa('lineas');
      fetchLineas();
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Hubo un error al guardar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeoDataUpdate = (geo: any, waypoints: any) => {
    setDatosGeo(geo);
    setSavedWaypoints(waypoints);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>;

  const isSuperAdmin = dbUser?.rol === 'SUPER_ADMIN';
  if (!user || (!isSuperAdmin && !dbUser?.permisos?.editarLineas)) {
    return <AccessDenied 
      mensaje="No tenés permiso para gestionar líneas de transporte público. Contactá a un administrador."
    />;
  }

  if (isSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '24px', padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2 style={{ color: '#0f172a', fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px' }}>Línea Guardada con Éxito</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '32px' }}>
            La línea de transporte público ha sido registrada y ya se encuentra activa y visible en el panel principal.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => { setIsSuccess(false); setStep(1); setActiveTab('gestionar'); }} style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1, boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }}>Ver Líneas</button>
            <button onClick={() => { setIsSuccess(false); setStep(1); }} style={{ padding: '12px 24px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600, cursor: 'pointer', flex: 1 }}>Cargar otra línea</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      {/* SIDEBAR PANEL */}
      <div style={{ width: '460px', background: '#ffffff', display: 'flex', flexDirection: 'column', color: '#0f172a', zIndex: 10, boxShadow: '4px 0 24px rgba(15,23,42,0.06)', position: 'relative', borderRight: '1px solid rgba(226,232,240,0.8)' }}>
        
        {/* Top bar */}
        <div style={{ height: 52, borderBottom: '1px solid #f1f5f9', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-lanus.png" alt="Lanús" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Transporte Público</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Gestión de Líneas y Sentidos</div>
            </div>
          </div>
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <ArrowLeft size={12} /> Mapa
          </button>
        </div>

        {/* Tab selector */}
        <div style={{ display: 'flex', padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('gestionar')}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              border: activeTab === 'gestionar' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
              background: activeTab === 'gestionar' ? '#eff6ff' : '#fff',
              color: activeTab === 'gestionar' ? '#1d4ed8' : '#64748b'
            }}
          >
            <List size={13} /> Líneas ({lineas.length})
          </button>
          <button
            onClick={() => { setActiveTab('relevamientos'); fetchRelevamientos(); }}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              border: activeTab === 'relevamientos' ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
              background: activeTab === 'relevamientos' ? '#e0f2fe' : '#fff',
              color: activeTab === 'relevamientos' ? '#0369a1' : '#64748b'
            }}
          >
            <Smartphone size={13} /> GPS Móvil ({relevamientos.length})
          </button>
          <button
            onClick={() => setActiveTab('crear')}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              border: activeTab === 'crear' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
              background: activeTab === 'crear' ? '#eff6ff' : '#fff',
              color: activeTab === 'crear' ? '#1d4ed8' : '#64748b'
            }}
          >
            <Plus size={13} /> Nueva
          </button>
        </div>

        {/* ── MODE: GESTIONAR TRAZAS Y SENTIDOS ── */}
        {activeTab === 'gestionar' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Category Filter Pills */}
            <div style={{ padding: '8px 16px 0', background: '#fff', display: 'flex', gap: '6px', overflowX: 'auto' }}>
              {(['TODAS', 'NACIONAL', 'PROVINCIAL', 'MUNICIPAL'] as const).map(cat => {
                const count = cat === 'TODAS' ? statsCategorias.todas : (cat === 'NACIONAL' ? statsCategorias.nacional : (cat === 'PROVINCIAL' ? statsCategorias.provincial : statsCategorias.municipal));
                const isSelected = categoriaFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoriaFilter(cat)}
                    style={{
                      padding: '5px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap', border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#f8fafc',
                      color: isSelected ? '#1d4ed8' : '#64748b', transition: 'all 0.15s ease'
                    }}
                  >
                    {cat === 'TODAS' ? 'Todas' : cat.charAt(0) + cat.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>

            {/* Toolbar: Search + Actions */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: '#fff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="Filtrar por línea, ramal u operador..."
                    style={{
                      width: '100%', padding: '7px 10px 7px 30px', fontSize: '0.8rem',
                      borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none',
                      background: '#f8fafc', color: '#1e293b'
                    }}
                  />
                </div>
                <button
                  onClick={fetchLineas}
                  disabled={loadingLineas}
                  title="Refrescar lista"
                  style={{
                    padding: '7px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: '#fff', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}
                >
                  <RefreshCw size={14} className={loadingLineas ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Action buttons bar */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                type="file"
                ref={geojsonInputRef}
                accept=".geojson,.json"
                style={{ display: 'none' }}
                onChange={handleGeojsonFileUpload}
              />
              <button
                type="button"
                onClick={() => geojsonInputRef.current?.click()}
                disabled={isImportingGeo}
                title="Importar un archivo GeoJSON con recorridos de colectivos (detecta automáticamente empresas, líneas, ramales y sentidos)"
                style={{
                  padding: '7px 10px', borderRadius: '8px',
                  border: '1.5px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 700, cursor: isImportingGeo ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  boxShadow: '0 1px 2px rgba(37,99,235,0.08)'
                }}
              >
                <Upload size={13} color="#2563eb" />
                {isImportingGeo ? 'Importando...' : '📥 Importar GeoJSON'}
              </button>

              <button
                  type="button"
                  onClick={handleAutoPair}
                  disabled={isAutoPairing}
                  title="Corrige automáticamente cualquier par de trazas que tengan doble Ida, asignando una a Ida y otra a Vuelta"
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: '8px',
                    border: '1px solid #ddd6fe', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                    color: '#6d28d9', fontSize: '0.72rem', fontWeight: 700, cursor: isAutoPairing ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    boxShadow: '0 1px 2px rgba(109,40,217,0.06)'
                  }}
                >
                  <Sparkles size={13} color="#7c3aed" />
                  {isAutoPairing ? 'Emparejando...' : '✨ Auto-corregir Pares'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const allOpen = Object.keys(expandedLineas).length > 0 && Object.values(expandedLineas).every(v => v);
                    const next: Record<string, boolean> = {};
                    groupedLineas.forEach(([key]) => { next[key] = !allOpen; });
                    setExpandedLineas(next);
                  }}
                  style={{
                    padding: '7px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#475569', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  {Object.values(expandedLineas).some(Boolean) ? 'Colapsar todo' : 'Expandir todo'}
                </button>
              </div>
            </div>

            {/* List of lines */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}>
              {loadingLineas && (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
                  Cargando trazas de transporte...
                </div>
              )}

              {!loadingLineas && groupedLineas.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  <Route size={28} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                  <div>No se encontraron líneas con los filtros actuales.</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Probá cambiando la categoría o limpiando la búsqueda.</div>
                </div>
              )}

              {!loadingLineas && groupedLineas.map(([groupKey, group]) => {
                const isOpen = expandedLineas[groupKey] === true;
                const catBadgeColor = group.categoria === 'NACIONAL' ? '#0284c7' : (group.categoria === 'PROVINCIAL' ? '#16a34a' : '#d97706');
                const catBgColor = group.categoria === 'NACIONAL' ? '#e0f2fe' : (group.categoria === 'PROVINCIAL' ? '#dcfce7' : '#fef3c7');

                return (
                  <div
                    key={groupKey}
                    style={{
                      background: '#fff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      flexShrink: 0,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Line header */}
                    <div
                      onClick={() => setExpandedLineas(prev => ({ ...prev, [groupKey]: !isOpen }))}
                      style={{
                        padding: '11px 14px',
                        background: isOpen ? '#f8fafc' : '#fff',
                        borderBottom: isOpen ? '1px solid #f1f5f9' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background 0.15s ease',
                        minHeight: '48px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Number badge */}
                      <div style={{
                        width: 34, height: 28, borderRadius: 6, background: group.color || '#2563eb',
                        color: '#fff', fontWeight: 900, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                      }}>
                        {group.numero || '#'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                            {group.lineaLabel}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: catBadgeColor, background: catBgColor, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                            {group.categoria}
                          </span>
                        </div>
                      </div>

                      <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>
                        {group.records.length} ramal{group.records.length !== 1 ? 'es' : ''}
                      </span>
                      <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', marginLeft: 4, flexShrink: 0 }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>

                    {/* Traces inside this line */}
                    {isOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
                        {group.records.map((l: any, idx: number) => {
                          const sentido = (l.sentido || '').toUpperCase();
                          const isIda = sentido === 'IDA';
                          const isVuelta = sentido === 'VUELTA';
                          const isActive = l.activo !== false;
                          const isSelectedRow = selectedLineaId === l.id;

                          return (
                            <div
                              key={l.id}
                              onClick={() => setSelectedLineaId(prev => prev === l.id ? null : l.id)}
                              style={{
                                padding: '10px 14px',
                                borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: isSelectedRow ? '#eff6ff' : isActive ? '#fff' : '#f8fafc',
                                borderLeft: isSelectedRow ? `3px solid ${l.color || group.color || '#2563eb'}` : '3px solid transparent',
                                opacity: isActive ? 1 : 0.65,
                                minHeight: '44px',
                                boxSizing: 'border-box',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color || group.color || '#2563eb', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.82rem', fontWeight: isSelectedRow ? 800 : 700, color: isSelectedRow ? '#1d4ed8' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {l.subcategoria || l.nombre || 'Ramal Principal'}
                                  </span>
                                </div>
                                {l.descripcion && (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {l.descripcion}
                                  </div>
                                )}
                              </div>

                              {/* 1-Click Interactive Sentido Toggle Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleSentido(l.id, l.sentido)}
                                title="Clic para alternar entre IDA y VUELTA"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s ease',
                                  background: isIda ? '#eff6ff' : isVuelta ? '#f5f3ff' : '#f8fafc',
                                  border: `1.5px solid ${isIda ? '#bfdbfe' : isVuelta ? '#ddd6fe' : '#e2e8f0'}`,
                                  minWidth: '82px', justifyContent: 'center', flexShrink: 0
                                }}
                              >
                                {isIda ? <ArrowRight size={11} color="#2563eb" /> : isVuelta ? <ArrowLeft size={11} color="#7c3aed" /> : <Route size={11} color="#64748b" />}
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isIda ? '#1d4ed8' : isVuelta ? '#6d28d9' : '#475569' }}>
                                  {isIda ? 'IDA —' : isVuelta ? 'VUELTA ╌' : 'S/SENTIDO'}
                                </span>
                              </button>

                              {/* Visibility eye toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleActivo(l.id, !isActive)}
                                title={isActive ? 'Visible (clic para ocultar)' : 'Oculta (clic para mostrar)'}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: isActive ? '#16a34a' : '#94a3b8', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0
                                }}
                              >
                                {isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                              </button>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteLinea(l.id)}
                                title="Eliminar traza"
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: '#cbd5e1', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MODE: ASISTENTE NUEVA LÍNEA (WIZARD) ── */}
        {activeTab === 'crear' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* STEPPER */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[{ n: 1, label: 'Datos' }, { n: 2, label: 'Ramal' }, { n: 3, label: 'Traza' }].map(({ n, label }, idx) => (
                  <React.Fragment key={n}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: step > n ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : step === n ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#f1f5f9',
                        border: step >= n ? 'none' : '1.5px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: step >= n ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 10,
                        boxShadow: step === n ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
                        transition: 'all 0.25s ease', flexShrink: 0
                      }}>
                        {step > n ? <CheckCircle size={12} color="#fff" strokeWidth={3} /> : n}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: step >= n ? '#2563eb' : '#94a3b8' }}>{label}</span>
                    </div>
                    {idx < 2 && (
                      <div style={{ flex: 1, height: 2, background: step > n ? '#2563eb' : '#e2e8f0', margin: '0 4px', marginBottom: 14, transition: 'background 0.3s' }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* FORM STEPS */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f8fafc' }}>
              {step === 1 && (
                <div className="fade-in">
                  <div style={{ border: 'none', borderLeft: '3px solid #2563eb', borderRadius: '0 10px 10px 0', padding: '10px 14px 8px', marginBottom: '14px', background: '#f8faff' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Información Base</div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nombre de la Línea *</label>
                    <input 
                      value={nombre} onChange={e => setNombre(e.target.value)}
                      placeholder="ej: Línea 271"
                      style={{ width: '100%', padding: '10px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '0.9rem', outline: 'none' }}
                    />
                  </div>

                  <div style={{ marginBottom: '12px', display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Número</label>
                      <input 
                        value={numero} onChange={e => setNumero(e.target.value)}
                        placeholder="ej: 271"
                        style={{ width: '100%', padding: '10px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '0.9rem', outline: 'none' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input 
                          type="color" value={color} onChange={e => setColor(e.target.value)}
                          style={{ width: '38px', height: '38px', padding: '2px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                        />
                        <input 
                          value={color} onChange={e => setColor(e.target.value)}
                          style={{ flex: 1, padding: '10px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '0.9rem', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Jurisdicción / Categoría *</label>
                    <select 
                      value={categoria} onChange={e => setCategoria(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '0.9rem', outline: 'none' }}
                    >
                      <option value="MUNICIPAL">Municipal</option>
                      <option value="PROVINCIAL">Provincial</option>
                      <option value="NACIONAL">Nacional</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sentido Inicial</label>
                    <select 
                      value={sentido} onChange={e => setSentido(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '0.9rem', outline: 'none' }}
                    >
                      <option value="IDA">IDA (Sentido principal)</option>
                      <option value="VUELTA">VUELTA (Sentido regreso)</option>
                    </select>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="fade-in">
                  <div style={{ border: 'none', borderLeft: '3px solid #2563eb', borderRadius: '0 10px 10px 0', padding: '10px 14px', marginBottom: '14px', background: '#f8faff' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Gestión de Ramales</div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                      Pegá el texto de la resolución para extraer automáticamente los ramales con IA o cargalos a mano.
                    </p>
                  </div>

                  <div style={{ background: '#f8faff', padding: '12px', borderRadius: '8px', border: '1px solid #e0e7ff', marginBottom: '14px' }}>
                    <textarea
                      value={aiText}
                      onChange={e => { setAiText(e.target.value); if (aiError) setAiError(null); }}
                      placeholder="Escribí o pegá la resolución acá..."
                      style={{ width: '100%', height: 70, padding: '8px', fontSize: '0.8rem', borderRadius: '6px', border: '1.5px solid #e2e8f0', resize: 'vertical', outline: 'none', color: '#0f172a', boxSizing: 'border-box', background: '#fff' }}
                    />
                    <button
                      onClick={handleAITrace}
                      disabled={isGeneratingAI || !aiText.trim()}
                      style={{ width: '100%', marginTop: 6, padding: '8px', fontSize: '0.8rem', fontWeight: 700, background: isGeneratingAI || !aiText.trim() ? '#e5e7eb' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: isGeneratingAI || !aiText.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: '6px', cursor: isGeneratingAI || !aiText.trim() ? 'not-allowed' : 'pointer' }}>
                      {isGeneratingAI ? 'Procesando...' : 'Extraer Ramales con IA'}
                    </button>
                    {aiError && (
                      <div style={{ marginTop: 6, padding: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#b91c1c' }}>
                        {aiError}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={addManualFeature}
                    style={{ width: '100%', background: '#fff', color: '#2563eb', border: '1.5px dashed #bfdbfe', padding: '8px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: '14px' }}
                  >
                    <Plus size={14} /> Añadir Ramal Manualmente
                  </button>

                  {/* Lista de Ramales */}
                  {preTracedFeatures.map((f, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${f.properties?.color || '#2563eb'}`, borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{f.properties.name || `Ramal ${i + 1}`}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => startEditMetadata(i)} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}><Pencil size={12} /></button>
                          <button onClick={() => deleteFeature(i)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="fade-in">
                  <div style={{ border: 'none', borderLeft: '3px solid #16a34a', borderRadius: '0 10px 10px 0', padding: '10px 14px', marginBottom: '14px', background: '#f0fdf4' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Trazado Geográfico</div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Dibujá la traza exacta de este ramal en el mapa interactivo de la derecha.</p>
                  </div>
                  
                  <div style={{ padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Estado del trazado:</span>
                    {datosGeo ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#16a34a', fontSize: '0.8rem', fontWeight: 700, background: '#dcfce7', padding: '3px 8px', borderRadius: '14px' }}>
                        <CheckCircle size={12} /> Listo
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#d97706', fontSize: '0.8rem', fontWeight: 700, background: '#fef3c7', padding: '3px 8px', borderRadius: '14px' }}>
                        <AlertTriangle size={12} /> Pendiente
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', background: '#fafbfd' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {step > 1 && (
                  <button 
                    onClick={handlePrev}
                    style={{ padding: '10px 16px', borderRadius: '8px', background: '#fff', border: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ArrowLeft size={16} /> Atrás
                  </button>
                )}
                
                {step < 3 ? (
                  <button 
                    onClick={handleNext}
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    Siguiente <ArrowRight size={16} />
                  </button>
                ) : (
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '8px', background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                    {isSubmitting ? 'Guardando...' : 'Finalizar y Guardar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAP AREA */}
      <div style={{ flex: 1, position: 'relative', background: '#f1f5f9' }}>
        <WizardMap 
          onComplete={handleGeoDataUpdate}
          initialWaypoints={savedWaypoints}
          initialFeatures={preTracedFeatures}
          allLines={lineas.filter((l: any) => l.activo !== false)}
          selectedLineId={selectedLineaId}
        />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in {
          animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
