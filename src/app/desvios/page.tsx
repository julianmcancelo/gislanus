'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, Plus, MapPin, Bus, Navigation, Calendar, Clock, 
  Trash2, Printer, Search, Filter, CheckCircle2, ChevronRight, ArrowLeft,
  Loader2, RefreshCw, Layers, Shield, FileText, Info, Sparkles, Wand2,
  LayoutGrid, Map as MapIcon, Check, Eye
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import FichaDesvioModal from '@/components/FichaDesvioModal';
import ImportadorPlanObrasModal from '@/components/ImportadorPlanObrasModal';
import { sugerirPuntosDesvio } from '@/utils/autoDetour';

// Carga dinámica del mapa de desvíos para evitar errores SSR con Leaflet
const DesvioMapEditor = dynamic(() => import('@/components/DesvioMapEditor'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '480px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px' }}>
      <Loader2 className="animate-spin" size={36} color="#2563eb" />
    </div>
  ),
});

// Carga dinámica del mapa interactivo de resumen
const DesviosOverviewMap = dynamic(() => import('@/components/DesviosOverviewMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px' }}>
      <Loader2 className="animate-spin" size={36} color="#2563eb" />
    </div>
  ),
});

export default function DesviosPage() {
  const router = useRouter();
  const { user, dbUser, getIdToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'gestionar' | 'nuevo'>('gestionar');
  const [vistaModo, setVistaModo] = useState<'split' | 'grid'>('split');
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedLineaRecorrido, setSelectedLineaRecorrido] = useState<{
    id: string;
    numero: string;
    nombre?: string;
    color?: string;
    coordinates: [number, number][][];
  } | null>(null);
  const [intervenciones, setIntervenciones] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroLote, setFiltroLote] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modal de impresión de ficha técnica
  const [selectedIntervencion, setSelectedIntervencion] = useState<any | null>(null);
  const [showImportadorObras, setShowImportadorObras] = useState(false);
  const [isGeocodificandoIA, setIsGeocodificandoIA] = useState(false);

  // Estados del Wizard de creación
  const [step, setStep] = useState<number>(1);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('BACHEO');
  const [tipoCorte, setTipoCorte] = useState('TOTAL');
  const [motivo, setMotivo] = useState('');
  const [areaResponsable, setAreaResponsable] = useState('Obras Públicas y Tránsito');
  const [callesAfectadas, setCallesAfectadas] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 16));
  const [fechaFinEstimada, setFechaFinEstimada] = useState('');
  
  // Georreferenciación del corte
  const [corteCoords, setCorteCoords] = useState<[number, number] | null>(null);
  const [radioMetros, setRadioMetros] = useState<number>(75);
  const [isAnalizando, setIsAnalizando] = useState(false);
  const [lineasAfectadas, setLineasAfectadas] = useState<any[]>([]);

  // Configuración de desvíos para cada línea afectada
  const [desviosMap, setDesviosMap] = useState<Record<string, {
    geojson: any;
    callesDesvio: string;
    paradasAnuladas: string;
    paradasProvisorias: string;
    waypoints?: [number, number][];
  }>>({});
  const [lineaActivaParaTrazar, setLineaActivaParaTrazar] = useState<any | null>(null);
  const [lineaGeojsonFull, setLineaGeojsonFull] = useState<any | null>(null);
  const [modoMapa, setModoMapa] = useState<'marcar_corte' | 'trazar_desvio'>('marcar_corte');
  const [waypointsAutoSugeridos, setWaypointsAutoSugeridos] = useState<[number, number][] | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const fetchIntervenciones = async () => {
    setLoadingList(true);
    try {
      const loteParam = filtroLote !== 'TODOS' ? `&lote=${encodeURIComponent(filtroLote)}` : '';
      const res = await fetch(`/api/desvios?estado=${filtroEstado}${loteParam}`);
      if (res.ok) {
        const data = await res.json();
        setIntervenciones(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar las intervenciones');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchIntervenciones();
  }, [filtroEstado, filtroLote]);
  // Cargar parámetros de URL si viene desde un punto de bacheo/obra del mapa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const lat = params.get('lat');
      const lng = params.get('lng');
      const nombre = params.get('nombre') || params.get('calle');
      if (lat && lng) {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          setCorteCoords([parsedLat, parsedLng]);
          if (nombre) {
            setTitulo('Obra Pavimentación: ' + decodeURIComponent(nombre));
            setCallesAfectadas(decodeURIComponent(nombre));
          }
          setActiveTab('nuevo');
          setStep(1);
          toast.success('Punto de obra cargado en el planificador de desvíos');
        }
      }
    }
  }, []);


  // Geocodificación inteligente con IA y delimitación estricta de Lanús
  const handleGeocodificarConIA = async () => {
    const textoABuscar = callesAfectadas || titulo;
    if (!textoABuscar || textoABuscar.trim().length < 3) {
      toast.error('Ingrese una intersección o calle en Lanús para ubicar');
      return;
    }
    setIsGeocodificandoIA(true);
    try {
      const res = await fetch('/api/obras/analizar-proximidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ubicacionTexto: textoABuscar }),
      });
      const data = await res.json();
      if (res.ok && data.coords) {
        setCorteCoords([data.coords.lat, data.coords.lng]);
        toast.success(`Ubicación detectada con IA: ${data.nombre || textoABuscar}`);
      } else {
        toast.error(data.error || 'No se pudo geolocalizar la intersección dentro de Lanús');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al consultar geocodificación IA');
    } finally {
      setIsGeocodificandoIA(false);
    }
  };

  // Al cambiar las coordenadas del corte, disparamos el análisis espacial automático (con debounce para evitar llamadas redundantes)
  useEffect(() => {
    if (!corteCoords) return;

    const timer = setTimeout(async () => {
      setIsAnalizando(true);
      try {
        const res = await fetch('/api/desvios/analizar-afectacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: corteCoords[0],
            lng: corteCoords[1],
            radioMetros,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setLineasAfectadas(data.lineasAfectadas || []);
          if (data.lineasAfectadas?.length > 0) {
            toast.success(`Se detectaron ${data.lineasAfectadas.length} líneas de transporte afectadas por el corte`);
          } else {
            toast('No se detectaron líneas de colectivo circulando por esta zona exacta', { icon: 'ℹ️' });
          }
        }
      } catch (e) {
        console.error('Error analizando afectacion:', e);
      } finally {
        setIsAnalizando(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [corteCoords, radioMetros]);

  // Cargar geometría de la línea seleccionada bajo demanda (ultra rápido)
  const handleSeleccionarLineaParaTrazar = async (linea: any) => {
    setLineaActivaParaTrazar(linea);
    setModoMapa('trazar_desvio');
    // Si la línea ya tenía waypoints guardados, restaurarlos; sino inicializar vacío
    const waypointsGuardados = desviosMap[linea.id]?.waypoints;
    setWaypointsAutoSugeridos(waypointsGuardados && waypointsGuardados.length > 0 ? waypointsGuardados : null);
    try {
      if (linea.datosGeo) {
        const parsed = typeof linea.datosGeo === 'string' ? JSON.parse(linea.datosGeo) : linea.datosGeo;
        setLineaGeojsonFull(parsed);
        return parsed;
      }
      const res = await fetch(`/api/lineas-transporte/${linea.id}`);
      if (res.ok) {
        const found = await res.json();
        if (found?.datosGeo) {
          const parsed = typeof found.datosGeo === 'string' ? JSON.parse(found.datosGeo) : found.datosGeo;
          setLineaGeojsonFull(parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  // Cálculo inteligente de desvío automático evitando el corte
  const handleAutoSugerirDesvio = async (linea: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!corteCoords) {
      toast.error('Primero defina el punto del corte en el mapa');
      return;
    }

    const toastId = toast.loading(`Calculando desvío automático para Línea ${linea.numero}...`);
    try {
      const geo = await handleSeleccionarLineaParaTrazar(linea);
      if (!geo) {
        toast.error('No se encontró la traza de la línea para desviar', { id: toastId });
        return;
      }

      const puntos = sugerirPuntosDesvio(geo, corteCoords, radioMetros);
      if (!puntos || puntos.length < 2) {
        toast.error('No se pudo determinar un desvío automático con la traza disponible', { id: toastId });
        return;
      }

      setWaypointsAutoSugeridos(puntos);
      toast.success(`✨ Desvío automático calculado y proyectado en el mapa`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Error al sugerir desvío automático', { id: toastId });
    }
  };

  const handleDesvioCalculado = React.useCallback((geojson: any, callesText: string, waypoints?: [number, number][]) => {
    setDesviosMap(prev => {
      if (!lineaActivaParaTrazar) return prev;
      return {
        ...prev,
        [lineaActivaParaTrazar.id]: {
          ...(prev[lineaActivaParaTrazar.id] || { paradasAnuladas: '', paradasProvisorias: '' }),
          geojson,
          callesDesvio: callesText,
          waypoints: waypoints || prev[lineaActivaParaTrazar.id]?.waypoints,
        },
      };
    });
  }, [lineaActivaParaTrazar]);

  const handleGuardarIntervencion = async () => {
    if (!titulo.trim() || !corteCoords) {
      toast.error('Complete el título y marque la ubicación del corte en el mapa');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Guardando planificación de desvío...');

    try {
      const token = await getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Geometría GeoJSON del corte
      const datosGeo = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [corteCoords[1], corteCoords[0]],
        },
        properties: {
          titulo,
          tipo,
          tipoCorte,
          radioMetros,
          callesAfectadas,
        },
      };

      // Array de desvíos procesados
      const desviosPayload = lineasAfectadas.map(l => {
        const cfg = desviosMap[l.id] || { geojson: null, callesDesvio: '', paradasAnuladas: '', paradasProvisorias: '' };
        return {
          lineaId: l.id,
          lineaNumero: l.numero,
          ramal: l.ramal,
          sentido: l.sentido,
          datosGeoDesvio: cfg.geojson || { type: 'LineString', coordinates: [] },
          callesDesvio: cfg.callesDesvio || 'Desvío alternativo por calles paralelas',
          paradasAnuladas: cfg.paradasAnuladas,
          paradasProvisorias: cfg.paradasProvisorias,
          activo: true,
        };
      });

      const res = await fetch('/api/desvios', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          titulo,
          tipo,
          tipoCorte,
          motivo,
          areaResponsable,
          callesAfectadas,
          fechaInicio,
          fechaFinEstimada: fechaFinEstimada || null,
          datosGeo,
          desvios: desviosPayload,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar');
      }

      const nueva = await res.json();
      toast.success('¡Corte y desvíos planificados exitosamente!', { id: toastId });
      
      // Reset de formulario
      setTitulo('');
      setMotivo('');
      setCallesAfectadas('');
      setCorteCoords(null);
      setLineasAfectadas([]);
      setDesviosMap({});
      setLineaActivaParaTrazar(null);
      setLineaGeojsonFull(null);
      setStep(1);

      setActiveTab('gestionar');
      fetchIntervenciones();
      setSelectedIntervencion(nueva); // Abrir automáticamente para imprimir
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al guardar', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteIntervencion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de que querés eliminar esta intervención y todos sus desvíos?')) return;

    const toastId = toast.loading('Eliminando intervención...');
    try {
      const token = await getIdToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/desvios/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Error al eliminar');

      toast.success('Intervención eliminada', { id: toastId });
      fetchIntervenciones();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar', { id: toastId });
    }
  };

  const handleLimpiarTodo = async () => {
    if (!confirm('⚠️ ¿Estás seguro de que deseas ELIMINAR TODOS los cortes y desvíos registrados? Esta acción no se puede deshacer.')) return;
    const toastId = toast.loading('Limpiando todos los cortes...');
    try {
      const token = await getIdToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/desvios?limpiarTodo=true', {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Error al limpiar cortes');
      const data = await res.json();
      toast.success(`Se eliminaron ${data.count || 0} cortes correctamente`, { id: toastId });
      fetchIntervenciones();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar', { id: toastId });
    }
  };

  const handleEliminarLote = async (loteNombre: string) => {
    if (!confirm(`¿Eliminar todas las obras del grupo/lote "${loteNombre}"?`)) return;
    const toastId = toast.loading(`Eliminando lote ${loteNombre}...`);
    try {
      const token = await getIdToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/desvios?lote=${encodeURIComponent(loteNombre)}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) throw new Error('Error al eliminar lote');
      toast.success(`Lote "${loteNombre}" eliminado con éxito`, { id: toastId });
      if (filtroLote === loteNombre) setFiltroLote('TODOS');
      fetchIntervenciones();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar lote', { id: toastId });
    }
  };

  const handleCambiarEstado = async (id: string, nuevoEstado: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = await getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/desvios/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (!res.ok) throw new Error('Error al actualizar estado');

      toast.success(`Estado actualizado a ${nuevoEstado}`);
      fetchIntervenciones();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  // Función para ver el recorrido de una línea al hacer clic en el chip L.xx
  const handleVerRecorridoLinea = async (lineaId?: string, lineaNumero?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Si ya está seleccionada la misma línea, deseleccionarla
    if (selectedLineaRecorrido && (selectedLineaRecorrido.id === lineaId || selectedLineaRecorrido.numero === String(lineaNumero))) {
      setSelectedLineaRecorrido(null);
      toast('Recorrido de línea ocultado', { icon: 'ℹ️' });
      return;
    }

    const toastId = toast.loading(`Cargando recorrido de Línea ${lineaNumero || ''}...`);
    try {
      let lineaData: any = null;
      if (lineaId) {
        const res = await fetch(`/api/lineas-transporte/${lineaId}`);
        if (res.ok) lineaData = await res.json();
      }

      if (!lineaData && lineaNumero) {
        const res = await fetch('/api/lineas-transporte');
        if (res.ok) {
          const todas = await res.json();
          lineaData = todas.find((l: any) => String(l.numero) === String(lineaNumero) && l.activo);
        }
      }

      if (!lineaData || !lineaData.datosGeo) {
        toast.error(`No se encontró el trazado GPS para la Línea ${lineaNumero}`, { id: toastId });
        return;
      }

      const parsed = typeof lineaData.datosGeo === 'string' ? JSON.parse(lineaData.datosGeo) : lineaData.datosGeo;
      const segments: [number, number][][] = [];

      const extractCoords = (geom: any) => {
        if (!geom) return;
        if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
          const seg: [number, number][] = geom.coordinates
            .filter((c: any) => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]))
            .map((c: any) => [Number(c[1]), Number(c[0])]);
          if (seg.length >= 2) segments.push(seg);
        } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
          geom.coordinates.forEach((line: any) => {
            const seg: [number, number][] = line
              .filter((c: any) => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1]))
              .map((c: any) => [Number(c[1]), Number(c[0])]);
            if (seg.length >= 2) segments.push(seg);
          });
        }
      };

      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        parsed.features.forEach((f: any) => extractCoords(f.geometry));
      } else if (parsed.type === 'Feature') {
        extractCoords(parsed.geometry);
      } else {
        extractCoords(parsed);
      }

      if (segments.length === 0) {
        toast.error(`La traza de la Línea ${lineaNumero} no contiene coordenadas válidas`, { id: toastId });
        return;
      }

      setSelectedLineaRecorrido({
        id: lineaData.id,
        numero: String(lineaData.numero),
        nombre: lineaData.nombre,
        color: lineaData.color || '#2563eb',
        coordinates: segments,
      });

      // Si no estamos en vista split, pasar automáticamente a split para ver el mapa
      if (vistaModo !== 'split') {
        setVistaModo('split');
      }

      toast.success(`Mostrando recorrido de Línea ${lineaData.numero} en el mapa`, { id: toastId });
    } catch (err: any) {
      console.error('Error cargando recorrido:', err);
      toast.error('Error al cargar la traza de la línea', { id: toastId });
    }
  };

  // Extraer lista de lotes/grupos de carga únicos
  const lotesDisponibles = React.useMemo(() => {
    const setLotes = new Set<string>();
    intervenciones.forEach(item => {
      if (item.areaResponsable && item.areaResponsable.trim()) {
        setLotes.add(item.areaResponsable.trim());
      }
    });
    return Array.from(setLotes);
  }, [intervenciones]);

  // Métricas y KPIs calculados en tiempo real
  const stats = React.useMemo(() => {
    let enCurso = 0;
    let planificados = 0;
    let finalizados = 0;
    const lineasSet = new Set<string>();

    intervenciones.forEach((item) => {
      const st = item.estado || 'PLANIFICADO';
      if (st === 'EN_CURSO') enCurso++;
      else if (st === 'FINALIZADO') finalizados++;
      else planificados++;

      if (Array.isArray(item.desvios)) {
        item.desvios.forEach((d: any) => {
          if (d.lineaNumero) lineasSet.add(String(d.lineaNumero));
        });
      }
    });

    return {
      total: intervenciones.length,
      enCurso,
      planificados,
      finalizados,
      totalLineasAfectadas: lineasSet.size,
    };
  }, [intervenciones]);

  const intervencionesFiltradas = intervenciones.filter(item => {
    if (filtroLote !== 'TODOS' && item.areaResponsable !== filtroLote) {
      return false;
    }
    if (!busqueda) return true;
    const term = busqueda.toLowerCase();
    return (
      item.codigo?.toLowerCase().includes(term) ||
      item.titulo?.toLowerCase().includes(term) ||
      item.callesAfectadas?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Top Navbar */}
      <header style={{
        background: '#0f172a',
        color: '#fff',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            Volver al GIS
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚧 Planificador de Desvíos Viales & Transporte
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              Gestión de Obras, Eventos e Intervenciones con Ruteo Provisorio de Colectivos · Lanús
            </p>
          </div>
        </div>

        {/* Selector de Solapas y Acciones IA */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('gestionar')}
            style={{
              background: activeTab === 'gestionar' ? '#2563eb' : 'transparent',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={15} />
            Cortes y Desvíos Activos ({intervenciones.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('nuevo');
              setStep(1);
            }}
            style={{
              background: activeTab === 'nuevo' ? '#2563eb' : 'transparent',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={15} />
            Nuevo Corte & Planificar Desvíos
          </button>
          <button
            onClick={() => setShowImportadorObras(true)}
            style={{
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.4)',
            }}
          >
            <Sparkles size={15} />
            Cargar Plan de Pavimentación (IA)
          </button>
        </div>
      </header>

      {/* Contenido Principal Full-Screen */}
      <main style={{ height: 'calc(100vh - 58px)', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* SOLAPA 1: GESTIONAR CORTES EXISTENTES */}
        {activeTab === 'gestionar' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '10px 14px', maxWidth: '1750px', margin: '0 auto', width: '100%' }}>
            
            {/* KPI STATS BAR MODERNA (COMPACTA) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '8px',
              marginBottom: '8px',
            }}>
              {/* Card 1: Total */}
              <div style={{
                background: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: '6px' }}>
                  <Layers size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Intervenciones</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{stats.total}</div>
                </div>
              </div>

              {/* Card 2: En Curso */}
              <div style={{
                background: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ background: '#dcfce7', color: '#16a34a', padding: '6px', borderRadius: '6px' }}>
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Obras en Ejecución</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#14532d' }}>{stats.enCurso}</div>
                </div>
              </div>

              {/* Card 3: Planificados */}
              <div style={{
                background: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #fed7aa',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ background: '#ffedd5', color: '#ea580c', padding: '6px', borderRadius: '6px' }}>
                  <Clock size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>Planificadas / Pendientes</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#7c2d12' }}>{stats.planificados}</div>
                </div>
              </div>

              {/* Card 4: Líneas Colectivos Afectadas */}
              <div style={{
                background: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}>
                <div style={{ background: '#f1f5f9', color: '#0284c7', padding: '6px', borderRadius: '6px' }}>
                  <Bus size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Líneas Afectadas</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0c4a6e' }}>{stats.totalLineasAfectadas}</div>
                </div>
              </div>
            </div>

            {/* Barra de Filtros y Selector de Modo de Vista */}
            <div style={{
              background: '#fff',
              padding: '8px 14px',
              borderRadius: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              flexWrap: 'wrap',
              gap: '8px',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Buscar por código, calle o motivo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '5px 10px',
                    width: '100%',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Filter size={15} color="#64748b" />
                
                {/* Selector de Grupo / Tanda de Carga */}
                {lotesDisponibles.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>Lote:</span>
                    <select
                      value={filtroLote}
                      onChange={(e) => setFiltroLote(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'pointer',
                        outline: 'none',
                        maxWidth: '200px',
                      }}
                    >
                      <option value="TODOS">Todos los grupos ({intervenciones.length})</option>
                      {lotesDisponibles.map((lote) => {
                        const count = intervenciones.filter(i => i.areaResponsable === lote).length;
                        return (
                          <option key={lote} value={lote}>
                            {lote} ({count})
                          </option>
                        );
                      })}
                    </select>
                    {filtroLote !== 'TODOS' && (
                      <button
                        type="button"
                        onClick={() => handleEliminarLote(filtroLote)}
                        style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                        title="Eliminar este grupo de obras completo"
                      >
                        <Trash2 size={11} /> Borrar
                      </button>
                    )}
                  </div>
                )}

                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Estado:</span>
                {['TODOS', 'PLANIFICADO', 'EN_CURSO', 'FINALIZADO'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFiltroEstado(st)}
                    style={{
                      background: filtroEstado === st ? '#1e293b' : '#f1f5f9',
                      color: filtroEstado === st ? '#fff' : '#475569',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}

                {/* Switcher Modo de Vista: Split Map vs Grid */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', gap: '2px', marginLeft: '4px' }}>
                  <button
                    onClick={() => setVistaModo('split')}
                    style={{
                      background: vistaModo === 'split' ? '#fff' : 'transparent',
                      color: vistaModo === 'split' ? '#2563eb' : '#64748b',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: vistaModo === 'split' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                    title="Vista combinada: Mapa y Lista"
                  >
                    <MapIcon size={12} />
                    Mapa
                  </button>
                  <button
                    onClick={() => setVistaModo('grid')}
                    style={{
                      background: vistaModo === 'grid' ? '#fff' : 'transparent',
                      color: vistaModo === 'grid' ? '#2563eb' : '#64748b',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: vistaModo === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                    title="Vista en tarjetas cuadrícula"
                  >
                    <LayoutGrid size={12} />
                    Tarjetas
                  </button>
                </div>

                {intervenciones.length > 0 && (
                  <button
                    type="button"
                    onClick={handleLimpiarTodo}
                    style={{
                      background: '#fff',
                      color: '#ef4444',
                      border: '1px solid #fca5a5',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      marginLeft: '4px',
                    }}
                    title="Vaciar todos los cortes cargados"
                  >
                    <Trash2 size={11} /> Limpiar Todo
                  </button>
                )}
              </div>
            </div>

            {/* Listado / Vista interactiva */}
            {loadingList ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 className="animate-spin" size={36} color="#2563eb" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#64748b', fontSize: '14px' }}>Cargando intervenciones y desvíos viales...</p>
              </div>
            ) : intervencionesFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <AlertTriangle size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>No hay cortes registrados</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Comenzá creando un nuevo corte programado o importá el Plan de Pavimentación con IA.
                </p>
              </div>
            ) : vistaModo === 'split' ? (
              /* VISTA SPLIT: LISTA LATERAL + MAPA INTERACTIVO SINCRONIZADO */
              <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {/* Columna Izquierda: Lista scrolleable de tarjetas */}
                <div style={{
                  width: '420px',
                  maxWidth: '42%',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '4px',
                }}>
                  {intervencionesFiltradas.map((item) => {
                    const isSelected = item.id === selectedMapId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMapId(item.id)}
                        style={{
                          background: '#fff',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          padding: '10px 12px',
                          boxShadow: isSelected ? '0 3px 12px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 800, 
                            color: '#2563eb', 
                            background: '#eff6ff', 
                            border: '1px solid #bfdbfe', 
                            padding: '1px 6px', 
                            borderRadius: '4px' 
                          }}>
                            {item.codigo}
                          </span>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: item.estado === 'EN_CURSO' ? '#16a34a' : (item.estado === 'PLANIFICADO' ? '#ca8a04' : '#64748b'),
                            background: item.estado === 'EN_CURSO' ? '#dcfce7' : (item.estado === 'PLANIFICADO' ? '#fef9c3' : '#f1f5f9'),
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}>
                            {item.estado}
                          </span>
                        </div>

                        <div>
                          <h4 style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                            {item.titulo}
                          </h4>
                          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={12} color="#ef4444" />
                            {item.callesAfectadas || 'Lanús'}
                          </p>
                        </div>

                        {item.areaResponsable && (
                          <div style={{ fontSize: '10px', color: '#475569', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                            <strong>Lote:</strong> {item.areaResponsable}
                          </div>
                        )}

                        {/* Colectivos Afectados */}
                        {item.desvios && item.desvios.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <Bus size={12} color="#2563eb" />
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#334155' }}>Líneas:</span>
                            {item.desvios.map((d: any, idx: number) => {
                              const estaActiva = selectedLineaRecorrido?.id === d.lineaId || selectedLineaRecorrido?.numero === String(d.lineaNumero);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => handleVerRecorridoLinea(d.lineaId, d.lineaNumero, e)}
                                  style={{
                                    background: estaActiva ? '#2563eb' : '#1e293b',
                                    color: '#fff',
                                    fontSize: '9px',
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    border: estaActiva ? '1px solid #93c5fd' : '1px solid transparent',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    boxShadow: estaActiva ? '0 0 0 2px rgba(37,99,235,0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={`Ver recorrido de Línea ${d.lineaNumero} en el mapa`}
                                >
                                  L.{d.lineaNumero}
                                  {estaActiva ? ' ✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Acciones */}
                        <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '6px', alignItems: 'center' }}>
                          <select
                            value={item.estado}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleCambiarEstado(item.id, e.target.value, e as any)}
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="PLANIFICADO">PLANIFICADO</option>
                            <option value="EN_CURSO">EN CURSO</option>
                            <option value="FINALIZADO">FINALIZADO</option>
                            <option value="CANCELADO">CANCELADO</option>
                          </select>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIntervencion(item);
                            }}
                            style={{
                              flex: 1,
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '5px',
                              padding: '4px 6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <Printer size={12} />
                            Ficha Técnica
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteIntervencion(item.id, e);
                            }}
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '5px',
                              padding: '4px 6px',
                              cursor: 'pointer',
                            }}
                            title="Eliminar corte"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Columna Derecha: Mapa Interactivo Global de Cortes */}
                <div style={{ flex: 1, height: '100%', borderRadius: '14px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                  <DesviosOverviewMap
                    intervenciones={intervencionesFiltradas}
                    selectedId={selectedMapId}
                    onSelectIntervencion={(item) => setSelectedMapId(item.id)}
                    onOpenFicha={(item) => setSelectedIntervencion(item)}
                    selectedLineaRecorrido={selectedLineaRecorrido}
                    onClearLineaRecorrido={() => setSelectedLineaRecorrido(null)}
                  />
                </div>
              </div>
            ) : (
              /* VISTA GRID: TARJETAS EN CUADRÍCULA COMPLETA */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px', overflowY: 'auto' }}>
                {intervencionesFiltradas.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '18px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 800, 
                          color: '#2563eb', 
                          background: '#eff6ff', 
                          border: '1px solid #bfdbfe', 
                          padding: '2px 8px', 
                          borderRadius: '4px' 
                        }}>
                          {item.codigo}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: item.estado === 'EN_CURSO' ? '#16a34a' : (item.estado === 'PLANIFICADO' ? '#ca8a04' : '#64748b'),
                          background: item.estado === 'EN_CURSO' ? '#dcfce7' : (item.estado === 'PLANIFICADO' ? '#fef9c3' : '#f1f5f9'),
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}>
                          {item.estado}
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                        {item.titulo}
                      </h3>
                      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#64748b' }}>
                        📍 {item.callesAfectadas || 'Zona delimitada en GIS'}
                      </p>

                      {item.areaResponsable && (
                        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '10px', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <strong>Grupo / Empresa:</strong> {item.areaResponsable}
                        </div>
                      )}

                      {/* Resumen de colectivos afectados */}
                      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                          <Bus size={14} color="#2563eb" />
                          Líneas Desviadas ({item.desvios?.length || 0}):
                        </div>
                        {(!item.desvios || item.desvios.length === 0) ? (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin desvíos registrados</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {item.desvios.map((d: any, idx: number) => {
                              const estaActiva = selectedLineaRecorrido?.id === d.lineaId || selectedLineaRecorrido?.numero === String(d.lineaNumero);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => handleVerRecorridoLinea(d.lineaId, d.lineaNumero, e)}
                                  style={{
                                    background: estaActiva ? '#2563eb' : '#1e293b',
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    border: estaActiva ? '1px solid #93c5fd' : '1px solid transparent',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    boxShadow: estaActiva ? '0 0 0 2px rgba(37,99,235,0.3)' : 'none',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={`Ver recorrido de Línea ${d.lineaNumero} en el mapa`}
                                >
                                  L.{d.lineaNumero} {d.ramal ? `(${d.ramal})` : ''}
                                  {estaActiva ? ' ✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones de la tarjeta */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', alignItems: 'center' }}>
                      <select
                        value={item.estado}
                        onChange={(e) => handleCambiarEstado(item.id, e.target.value, e as any)}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                        title="Cambiar estado de la intervención"
                      >
                        <option value="PLANIFICADO">PLANIFICADO</option>
                        <option value="EN_CURSO">EN CURSO</option>
                        <option value="FINALIZADO">FINALIZADO</option>
                        <option value="CANCELADO">CANCELADO</option>
                      </select>

                      <button
                        onClick={() => setSelectedIntervencion(item)}
                        style={{
                          flex: 1,
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <Printer size={14} />
                        Ficha Técnica & Mapa
                      </button>

                      <button
                        onClick={(e) => handleDeleteIntervencion(item.id, e)}
                        style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '7px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Eliminar intervención y desvíos"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SOLAPA 2: NUEVO CORTE & PLANIFICAR DESVÍOS (WIZARD FULL-SCREEN MAP) */}
        {activeTab === 'nuevo' && (
          <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, overflow: 'hidden' }}>
            
            {/* Panel Lateral Flotante: Formulario y Pasos */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              bottom: '16px',
              width: '420px',
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(12px)',
              padding: '22px',
              borderRadius: '16px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <span style={{ background: '#2563eb', color: '#fff', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                  {step}
                </span>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  {step === 1 ? '1. Datos de la Obra / Corte' : '2. Planificar Desvíos de Colectivo'}
                </h2>
              </div>

              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Título o Denominación de la Obra *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Bacheo y repavimentación Av. 25 de Mayo"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Tipo de Evento</label>
                      <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                      >
                        <option value="BACHEO">Bacheo / Asfalto</option>
                        <option value="AGUA_GAS">Agua / Gas / Redes</option>
                        <option value="EVENTO">Evento Cultural / Deportivo</option>
                        <option value="MANTENIMIENTO">Mantenimiento Urbano</option>
                        <option value="SINIESTRO">Siniestro / Emergencia</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Tipo de Corte</label>
                      <select
                        value={tipoCorte}
                        onChange={(e) => setTipoCorte(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                      >
                        <option value="TOTAL">Corte Total</option>
                        <option value="PARCIAL">Corte Parcial</option>
                        <option value="REDUCCION_CALZADA">Reducción de Calzada</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Calles Afectadas (Referencia)</label>
                      <button
                        type="button"
                        onClick={handleGeocodificarConIA}
                        disabled={isGeocodificandoIA}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#2563eb',
                          cursor: isGeocodificandoIA ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isGeocodificandoIA ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        Ubicar con IA
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Ej: Av. 25 de Mayo e/ San Martín y Melo"
                      value={callesAfectadas}
                      onChange={(e) => setCallesAfectadas(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Inicio Programado</label>
                      <input
                        type="datetime-local"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Fin Estimado</label>
                      <input
                        type="datetime-local"
                        value={fechaFinEstimada}
                        onChange={(e) => setFechaFinEstimada(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Radio de Impacto del Corte: {radioMetros} metros
                    </label>
                    <input
                      type="range"
                      min="30"
                      max="200"
                      step="10"
                      value={radioMetros}
                      onChange={(e) => setRadioMetros(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Estado de detección de líneas */}
                  <div style={{
                    background: corteCoords ? '#eff6ff' : '#f8fafc',
                    border: '1px solid',
                    borderColor: corteCoords ? '#bfdbfe' : '#e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                      {corteCoords ? '📍 Ubicación seleccionada en mapa' : '👉 Marque el punto de corte en el mapa'}
                    </span>
                    {isAnalizando ? (
                      <p style={{ margin: 0, fontSize: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Loader2 className="animate-spin" size={14} /> Analizando líneas de transporte afectadas...
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                        {lineasAfectadas.length > 0
                          ? `✅ Se detectaron ${lineasAfectadas.length} líneas afectadas para desviar.`
                          : 'No hay líneas de colectivo que pasen por este radio.'}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!titulo || !corteCoords}
                    onClick={() => setStep(2)}
                    style={{
                      marginTop: '10px',
                      background: (!titulo || !corteCoords) ? '#cbd5e1' : '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: (!titulo || !corteCoords) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    Siguiente: Planificar Desvíos ({lineasAfectadas.length})
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Líneas Afectadas</span>
                    <button
                      onClick={() => setStep(1)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      ← Editar datos corte
                    </button>
                  </div>

                  {/* Listado de colectivos para trazar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                    {lineasAfectadas.map((linea) => {
                      const isSelected = lineaActivaParaTrazar?.id === linea.id;
                      const hasDesvio = !!desviosMap[linea.id]?.geojson;

                      return (
                        <div
                          key={linea.id}
                          onClick={() => handleSeleccionarLineaParaTrazar(linea)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                            background: isSelected ? '#eff6ff' : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ background: '#1e293b', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                                  Línea {linea.numero}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                                  {linea.ramal}
                                </span>
                              </div>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>
                                Sentido: {linea.sentido}
                              </span>
                            </div>

                            {hasDesvio ? (
                              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={13} /> Trazado
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                                Sin trazar
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                            <button
                              type="button"
                              onClick={(e) => handleAutoSugerirDesvio(linea, e)}
                              style={{
                                flex: 1,
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                boxShadow: '0 1px 3px rgba(59, 130, 246, 0.3)'
                              }}
                              title="Calcular y desviar automáticamente evitando la zona del corte"
                            >
                              <Wand2 size={13} /> Sugerir Desvío Automático
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Formulario de indicaciones para la línea seleccionada */}
                  {lineaActivaParaTrazar && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                          Indicaciones para Línea {lineaActivaParaTrazar.numero}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleAutoSugerirDesvio(lineaActivaParaTrazar, e)}
                          style={{
                            background: '#dbeafe',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Sparkles size={11} /> Recalcular automático
                        </button>
                      </div>
                      
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                          Itinerario sugerido (o calculado automáticamente en el mapa)
                        </label>
                        <textarea
                          rows={2}
                          value={desviosMap[lineaActivaParaTrazar.id]?.callesDesvio || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDesviosMap(prev => ({
                              ...prev,
                              [lineaActivaParaTrazar.id]: {
                                ...(prev[lineaActivaParaTrazar.id] || { geojson: null, paradasAnuladas: '', paradasProvisorias: '' }),
                                callesDesvio: val,
                              },
                            }));
                          }}
                          placeholder="Ej: Desvía por Ministro Brin, Carlos Tejedor, retoma..."
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '2px' }}>
                            🚫 Paradas Anuladas
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: 25 de Mayo y Melo"
                            value={desviosMap[lineaActivaParaTrazar.id]?.paradasAnuladas || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDesviosMap(prev => ({
                                ...prev,
                                [lineaActivaParaTrazar.id]: {
                                  ...(prev[lineaActivaParaTrazar.id] || { geojson: null, callesDesvio: '', paradasProvisorias: '' }),
                                  paradasAnuladas: val,
                                },
                              }));
                            }}
                            style={{ width: '100%', padding: '4px 6px', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '11px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 700, color: '#166534', display: 'block', marginBottom: '2px' }}>
                            🚏 Paradas Provisorias
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Brin y Tejedor"
                            value={desviosMap[lineaActivaParaTrazar.id]?.paradasProvisorias || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDesviosMap(prev => ({
                                ...prev,
                                [lineaActivaParaTrazar.id]: {
                                  ...(prev[lineaActivaParaTrazar.id] || { geojson: null, callesDesvio: '', paradasAnuladas: '' }),
                                  paradasProvisorias: val,
                                },
                              }));
                            }}
                            style={{ width: '100%', padding: '4px 6px', border: '1px solid #bbf7d0', borderRadius: '4px', fontSize: '11px' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botón Final de Guardado */}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleGuardarIntervencion}
                    style={{
                      marginTop: '12px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Finalizar y Publicar Plan de Desvío
                  </button>
                </div>
              )}

            </div>

            {/* Mapa Interactivo de Pantalla Completa */}
            <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <DesvioMapEditor
                key={lineaActivaParaTrazar?.id || 'sin-linea'}
                lineaId={lineaActivaParaTrazar?.id}
                corteCoords={corteCoords}
                setCorteCoords={setCorteCoords}
                radioMetros={radioMetros}
                lineaOriginalGeo={lineaGeojsonFull}
                onDesvioCalculado={handleDesvioCalculado}
                modo={modoMapa}
                waypointsForzados={waypointsAutoSugeridos}
              />
            </div>

          </div>
        )}

      </main>

      {/* Modal de Impresión / Ficha Técnica Oficial */}
      {selectedIntervencion && (
        <FichaDesvioModal
          intervencion={selectedIntervencion}
          onClose={() => setSelectedIntervencion(null)}
        />
      )}

      {/* Modal de Carga de Plan de Pavimentación con IA de OpenAI */}
      <ImportadorPlanObrasModal
        isOpen={showImportadorObras}
        onClose={() => setShowImportadorObras(false)}
        onImportadoExitoso={() => {
          fetchIntervenciones();
          toast.success('Puntos del Plan de Pavimentación importados y procesados con IA');
        }}
      />

    </div>
  );
}
