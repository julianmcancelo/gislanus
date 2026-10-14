'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, Plus, MapPin, Bus, Navigation, Calendar, Clock, 
  Trash2, Printer, Search, Filter, CheckCircle2, ChevronRight, ArrowLeft,
  Loader2, RefreshCw, Layers, Shield, FileText, Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import FichaDesvioModal from '@/components/FichaDesvioModal';

// Carga dinámica del mapa de desvíos para evitar errores SSR con Leaflet
const DesvioMapEditor = dynamic(() => import('@/components/DesvioMapEditor'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '480px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px' }}>
      <Loader2 className="animate-spin" size={36} color="#2563eb" />
    </div>
  ),
});

export default function DesviosPage() {
  const router = useRouter();
  const { user, dbUser, getIdToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'gestionar' | 'nuevo'>('gestionar');
  const [intervenciones, setIntervenciones] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modal de impresión de ficha técnica
  const [selectedIntervencion, setSelectedIntervencion] = useState<any | null>(null);

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
  }>>({});
  const [lineaActivaParaTrazar, setLineaActivaParaTrazar] = useState<any | null>(null);
  const [lineaGeojsonFull, setLineaGeojsonFull] = useState<any | null>(null);
  const [modoMapa, setModoMapa] = useState<'marcar_corte' | 'trazar_desvio'>('marcar_corte');

  const [isSaving, setIsSaving] = useState(false);

  const fetchIntervenciones = async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/desvios?estado=${filtroEstado}`);
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
  }, [filtroEstado]);

  // Al cambiar las coordenadas del corte, disparamos el análisis espacial automático
  useEffect(() => {
    if (!corteCoords) return;

    const analizarAfectacion = async () => {
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
    };

    analizarAfectacion();
  }, [corteCoords, radioMetros]);

  // Cargar geometría de la línea seleccionada bajo demanda (ultra rápido)
  const handleSeleccionarLineaParaTrazar = async (linea: any) => {
    setLineaActivaParaTrazar(linea);
    setModoMapa('trazar_desvio');
    try {
      const res = await fetch(`/api/lineas-transporte/${linea.id}`);
      if (res.ok) {
        const found = await res.json();
        if (found?.datosGeo) {
          setLineaGeojsonFull(typeof found.datosGeo === 'string' ? JSON.parse(found.datosGeo) : found.datosGeo);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDesvioCalculado = (geojson: any, callesText: string) => {
    if (!lineaActivaParaTrazar) return;

    setDesviosMap(prev => ({
      ...prev,
      [lineaActivaParaTrazar.id]: {
        ...(prev[lineaActivaParaTrazar.id] || { paradasAnuladas: '', paradasProvisorias: '' }),
        geojson,
        callesDesvio: callesText,
      },
    }));
  };

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

  const intervencionesFiltradas = intervenciones.filter(item => {
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

        {/* Selector de Solapas */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px' }}>
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
        </div>
      </header>

      {/* Contenido Principal Full-Screen */}
      <main style={{ height: 'calc(100vh - 61px)', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* SOLAPA 1: GESTIONAR CORTES EXISTENTES */}
        {activeTab === 'gestionar' && (
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
            {/* Barra de Filtros */}
            <div style={{
              background: '#fff',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
                <Search size={18} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Buscar por código, calle o motivo de obra..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    width: '100%',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={16} color="#64748b" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Estado:</span>
                {['TODOS', 'PLANIFICADO', 'EN_CURSO', 'FINALIZADO'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFiltroEstado(st)}
                    style={{
                      background: filtroEstado === st ? '#1e293b' : '#f1f5f9',
                      color: filtroEstado === st ? '#fff' : '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Listado de Intervenciones */}
            {loadingList ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Loader2 className="animate-spin" size={36} color="#2563eb" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#64748b', fontSize: '14px' }}>Cargando intervenciones y desvíos viales...</p>
              </div>
            ) : intervencionesFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: '12px' }}>
                <AlertTriangle size={48} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>No hay cortes registrados</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Comenzá creando un nuevo corte programado para planificar los desvíos del transporte público.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px' }}>
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
                            {item.desvios.map((d: any, idx: number) => (
                              <span key={idx} style={{
                                background: '#1e293b',
                                color: '#fff',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}>
                                L.{d.lineaNumero} {d.ramal ? `(${d.ramal})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones de la tarjeta */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <button
                        onClick={() => setSelectedIntervencion(item)}
                        style={{
                          flex: 1,
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px',
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
                        Ficha Técnica & Desvío
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
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Calles Afectadas (Referencia)</label>
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
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
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
                      );
                    })}
                  </div>

                  {/* Formulario de indicaciones para la línea seleccionada */}
                  {lineaActivaParaTrazar && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                        Indicaciones para Línea {lineaActivaParaTrazar.numero}
                      </span>
                      
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
                corteCoords={corteCoords}
                setCorteCoords={setCorteCoords}
                radioMetros={radioMetros}
                lineaOriginalGeo={lineaGeojsonFull}
                onDesvioCalculado={handleDesvioCalculado}
                modo={modoMapa}
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

    </div>
  );
}
