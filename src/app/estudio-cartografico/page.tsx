'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Palette, MapPin, Route, Square, Check, X,
  Trash2, Download, Save, Layers, Loader2, Sparkles, Plus, AlertCircle,
  ArrowLeft, Eye, EyeOff, Shield, Bus, School, Hospital, AlertTriangle, RefreshCw, Filter
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { emitirCambioMapa } from '@/lib/rtdb';

import ImportadorPlanObrasModal from '@/components/ImportadorPlanObrasModal';
import ModalDetallePuntoObra from '@/components/ModalDetallePuntoObra';

const StandaloneStudioMap = dynamic(() => import('@/components/StandaloneStudioMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8' }}>
      <Loader2 className="animate-spin" size={36} color="#38bdf8" />
      <span style={{ marginTop: 12, fontSize: '13px', fontWeight: 600 }}>Cargando Estudio Cartográfico de Lanús...</span>
    </div>
  ),
});

const CATEGORIAS = [
  { id: 'EDUCACION', label: 'Escuelas / Colegios', icon: 'School', color: '#2563eb' },
  { id: 'SALUD', label: 'Hospitales / Salitas', icon: 'Hospital', color: '#dc2626' },
  { id: 'SEGURIDAD', label: 'Comisarías / Control', icon: 'Shield', color: '#475569' },
  { id: 'OBRAS', label: 'Obras & Mantenimiento', icon: 'AlertTriangle', color: '#f59e0b' },
  { id: 'TRANSPORTE', label: 'Trazas & Puntos de Colectivo', icon: 'Bus', color: '#059669' },
  { id: 'GENERAL', label: 'Punto de Interés General', icon: 'MapPin', color: '#7c3aed' },
];

export default function EstudioCartograficoPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();

  // Modal de Importador de Obras Inteligente
  const [showImportadorObras, setShowImportadorObras] = useState(false);
  // Modal de inspección de impacto en líneas de colectivo al hacer click
  const [inspeccionandoElemento, setInspeccionandoElemento] = useState<any | null>(null);

  // Estados de dibujo
  const [activeDrawMode, setActiveDrawMode] = useState<'marker' | 'line' | 'polygon' | null>(null);
  const [elementosDibujados, setElementosDibujados] = useState<any[]>([]);
  const [selectedElementoIdx, setSelectedElementoIdx] = useState<number | null>(null);

  // Formulario del elemento activo o siguiente
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoria, setFormCategoria] = useState('GENERAL');
  const [formColor, setFormColor] = useState('#2563eb');
  const [formIcono, setFormIcono] = useState('MapPin');

  // Guardado como NUEVA CAPA aislada
  const [nombreNuevaCapa, setNombreNuevaCapa] = useState('');
  const [grupoDestino, setGrupoDestino] = useState('Cartografía y Obras Especiales');
  const [gruposExistentes, setGruposExistentes] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mostrarRedTransporte, setMostrarRedTransporte] = useState(false);

  // Filtro por empresa/contratista (LÁZARO, KAVOS, USIMIX, TODAS)
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('TODAS');

  const handleToggleVisibilidadElemento = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setElementosDibujados(prev => prev.map((el, i) => {
      if (i === idx) {
        return { ...el, visible: el.visible === false ? true : false };
      }
      return el;
    }));
  };

  const handleToggleAllVisibilidad = (visible: boolean) => {
    setElementosDibujados(prev => prev.map(el => ({ ...el, visible })));
  };

  // Cargar grupos existentes para clasificar ordenadamente la nueva capa
  useEffect(() => {
    fetch('/api/grupos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setGruposExistentes(data);
      })
      .catch(console.error);
  }, []);

  const handleStartDraw = (mode: 'marker' | 'line' | 'polygon') => {
    if (activeDrawMode === mode) {
      setActiveDrawMode(null);
    } else {
      setActiveDrawMode(mode);
    }
  };

  const handleElementCreated = (shape: string, layer: any, geo: any) => {
    const nuevoElemento = {
      shape,
      layer,
      geo,
      nombre: formNombre.trim() || (shape === 'Marker' ? `Punto #${elementosDibujados.length + 1}` : shape === 'Line' ? `Traza #${elementosDibujados.length + 1}` : `Zona #${elementosDibujados.length + 1}`),
      descripcion: formDescripcion.trim(),
      categoria: formCategoria,
      color: formColor,
      icono: formIcono,
    };

    setElementosDibujados(prev => {
      const next = [...prev, nuevoElemento];
      setSelectedElementoIdx(next.length - 1);
      return next;
    });

    toast.success('¡Elemento incorporado al diseño!', { icon: '✏️' });
  };

  const handleRemoveElemento = (idx: number) => {
    const el = elementosDibujados[idx];
    if (el?.layer) {
      try {
        el.layer.remove();
      } catch {}
    }
    setElementosDibujados(prev => prev.filter((_, i) => i !== idx));
    if (selectedElementoIdx === idx) {
      setSelectedElementoIdx(null);
    }
  };

  // Exportar directo como archivo GeoJSON
  const handleExportGeoJSON = () => {
    const aExportar = elementosDibujados.filter(el => el.visible !== false);
    if (aExportar.length === 0) {
      toast.error('No hay elementos tildados para exportar');
      return;
    }

    const featureCollection = {
      type: 'FeatureCollection',
      features: aExportar.map((el, i) => ({
        type: 'Feature',
        geometry: el.geo.geometry,
        properties: {
          id: `elemento_${i + 1}`,
          nombre: el.nombre,
          descripcion: el.descripcion,
          categoria: el.categoria,
          color: el.color,
          icono: el.icono,
          fecha: new Date().toISOString(),
        },
      })),
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(nombreNuevaCapa || 'estudio_cartografico').toLowerCase().replace(/\s+/g, '_')}_lanus.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Archivo GeoJSON exportado con éxito (${aExportar.length} elementos)`);
  };

  // Guardar como NUEVA Capa en la Base de Datos Municipal (aislado)
  const handleGuardarComoNuevaCapa = async () => {
    const aGuardar = elementosDibujados.filter(el => el.visible !== false);
    if (aGuardar.length === 0) {
      toast.error('Debe tener al menos un elemento tildado para guardar');
      return;
    }

    if (!nombreNuevaCapa.trim()) {
      toast.error('Por favor indique el nombre de la nueva capa (ej: "Bacheo y Pavimentación Lanús")');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Creando nueva capa en la base de datos municipal...');

    try {
      const token = await getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const newFeatures = aGuardar.map((el, i) => ({
        type: 'Feature',
        geometry: el.geo.geometry,
        properties: {
          nombre: el.nombre || `Elemento ${i + 1}`,
          name: el.nombre || `Elemento ${i + 1}`,
          descripcion: el.descripcion || '',
          categoria: el.categoria || 'GENERAL',
          color: el.color || formColor,
          icono: el.icono || 'MapPin',
          creadoEn: new Date().toISOString(),
        },
      }));

      // Buscar si el grupo existe o asignarlo
      let grupoId: string | null = null;
      const matched = gruposExistentes.find(g => g.nombre.toLowerCase() === grupoDestino.toLowerCase());
      if (matched) {
        grupoId = matched.id;
      }

      const res = await fetch('/api/capas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: nombreNuevaCapa.trim(),
          type: 'geojson',
          color: formColor,
          icono: formIcono,
          grupoId,
          geoData: {
            type: 'FeatureCollection',
            features: newFeatures,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar la capa');
      }

      emitirCambioMapa('capas');
      toast.success(`🎉 ¡Nueva capa "${nombreNuevaCapa}" creada y publicada en el GIS!`, { id: toastId });
      
      // Limpiar tras guardar
      elementosDibujados.forEach(el => {
        if (el?.layer) {
          try { el.layer.remove(); } catch {}
        }
      });
      setElementosDibujados([]);
      setSelectedElementoIdx(null);
      setNombreNuevaCapa('');

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al guardar nueva capa', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
      <Toaster position="top-right" />

      {/* Barra de Encabezado Superior */}
      <header style={{
        background: '#0f172a',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        height: '60px',
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
            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 800, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎨 Estudio Cartográfico & Diseño de Capas
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
              Dibujá y diseñá puntos de interés, colegios, trazas y polígonos sobre Lanús
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Botón de Importación Inteligente de Obras */}
          <button
            type="button"
            onClick={() => setShowImportadorObras(true)}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
            }}
          >
            <Sparkles size={14} color="#fef08a" />
            Importar Plan de Obras (IA)
          </button>

          {/* Interruptor Red de Transporte de Fondo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.06)', padding: '6px 14px', borderRadius: '8px' }}>
            <Bus size={15} color="#38bdf8" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>Ver colectivos</span>
            <input
              type="checkbox"
              checked={mostrarRedTransporte}
              onChange={(e) => setMostrarRedTransporte(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </div>
        </div>
      </header>

      {/* Contenedor Principal: Panel Lateral Izquierdo + Mapa Full-Screen */}
      <main style={{ height: 'calc(100vh - 60px)', width: '100vw', display: 'flex', position: 'relative', overflow: 'hidden' }}>
        
        {/* Panel Lateral de Edición y Creación */}
        <div style={{
          width: '420px',
          height: '100%',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '20px',
          gap: '18px',
        }}>

          {/* PASO 1: HERRAMIENTAS DE DIBUJO */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              1. Herramientas de Dibujo en Vivo
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleStartDraw('marker')}
                style={{
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: activeDrawMode === 'marker' ? '#2563eb' : '#e2e8f0',
                  background: activeDrawMode === 'marker' ? '#eff6ff' : '#f8fafc',
                  color: activeDrawMode === 'marker' ? '#1d4ed8' : '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
              >
                <MapPin size={20} color={activeDrawMode === 'marker' ? '#2563eb' : '#64748b'} />
                Punto / Hito
              </button>

              <button
                type="button"
                onClick={() => handleStartDraw('line')}
                style={{
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: activeDrawMode === 'line' ? '#2563eb' : '#e2e8f0',
                  background: activeDrawMode === 'line' ? '#eff6ff' : '#f8fafc',
                  color: activeDrawMode === 'line' ? '#1d4ed8' : '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
              >
                <Route size={20} color={activeDrawMode === 'line' ? '#2563eb' : '#64748b'} />
                Traza / Línea
              </button>

              <button
                type="button"
                onClick={() => handleStartDraw('polygon')}
                style={{
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: activeDrawMode === 'polygon' ? '#2563eb' : '#e2e8f0',
                  background: activeDrawMode === 'polygon' ? '#eff6ff' : '#f8fafc',
                  color: activeDrawMode === 'polygon' ? '#1d4ed8' : '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
              >
                <Square size={20} color={activeDrawMode === 'polygon' ? '#2563eb' : '#64748b'} />
                Área / Zona
              </button>
            </div>
            {activeDrawMode && (
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>
                💡 Hacé clic sobre el mapa para ubicar o trazar la figura.
              </p>
            )}
          </div>

          {/* PASO 2: ATRIBUTOS Y CATEGORÍA */}
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
              2. Atributos & Categoría del Elemento
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Nombre o Identificador
                </label>
                <input
                  type="text"
                  placeholder="Ej: Escuela N° 12, Traza Especial Turno Noche, etc."
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Categoría
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setFormCategoria(cat);
                      const found = CATEGORIAS.find(c => c.id === cat);
                      if (found) {
                        setFormColor(found.color);
                        setFormIcono(found.icon);
                      }
                    }}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    {CATEGORIAS.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '60px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Color
                  </label>
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '2px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Observaciones / Motivo Laboral
                </label>
                <textarea
                  placeholder="Detalle o información de referencia técnica o laboral..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* PASO 3: ELEMENTOS DISEÑADOS EN ESTA SESIÓN */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                3. Elementos Diseñados ({elementosDibujados.length})
              </span>
              {elementosDibujados.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportGeoJSON}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={13} /> Exportar GeoJSON
                </button>
              )}
            </div>

            {elementosDibujados.length === 0 ? (
              <div style={{ padding: '18px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Aún no has dibujado ningún elemento. Seleccioná una herramienta arriba para comenzar a trazar.
                </span>
              </div>
            ) : (
              <>
                {/* Filtro por empresa y acciones rápidas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  {/* Chips de filtro */}
                  <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                    {['TODAS', 'LÁZARO', 'KAVOS', 'USIMIX'].map(emp => (
                      <button
                        key={emp}
                        type="button"
                        onClick={() => setEmpresaFiltro(emp)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: empresaFiltro === emp ? '#2563eb' : '#e2e8f0',
                          background: empresaFiltro === emp ? '#eff6ff' : '#ffffff',
                          color: empresaFiltro === emp ? '#1d4ed8' : '#64748b',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {emp}
                      </button>
                    ))}
                  </div>

                  {/* Acciones tildar / destildar todas */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                      Mostrando {elementosDibujados.filter(el => el.visible !== false && (empresaFiltro === 'TODAS' || el.geo?.properties?.empresa === empresaFiltro)).length} de {elementosDibujados.length}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleAllVisibilidad(true)}
                        style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Tildar todas
                      </button>
                      <span style={{ color: '#cbd5e1', fontSize: '10px' }}>•</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllVisibilidad(false)}
                        style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Destildar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de elementos interactivos con checkbox individual */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {elementosDibujados.map((el, idx) => {
                    const emp = el.geo?.properties?.empresa || '';
                    if (empresaFiltro !== 'TODAS' && emp !== empresaFiltro) return null;
                    const isVisible = el.visible !== false;

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedElementoIdx(idx);
                          setFormNombre(el.nombre || '');
                          setFormDescripcion(el.descripcion || '');
                          setFormColor(el.color || '#ea580c');
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: selectedElementoIdx === idx ? '#eff6ff' : isVisible ? '#fff' : '#f8fafc',
                          border: '1px solid',
                          borderColor: selectedElementoIdx === idx ? '#3b82f6' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          opacity: isVisible ? 1 : 0.5,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          {/* Checkbox para tildar y destildar en el mapa */}
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => handleToggleVisibilidadElemento(idx, e as any)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: el.color || '#2563eb', flexShrink: 0 }}
                            title={isVisible ? 'Destildar para ocultar del mapa' : 'Tildar para mostrar en el mapa'}
                          />
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: el.color, flexShrink: 0 }} />
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {el.nombre}
                            </span>
                            {emp && (
                              <span style={{ fontSize: '9px', fontWeight: 700, color: el.color || '#64748b' }}>
                                {emp} {el.geo?.properties?.zona ? `· ${el.geo.properties.zona}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspeccionandoElemento(el);
                            }}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            title="Ver qué líneas de colectivo pasan sobre este punto o chocan cerca"
                          >
                            <Bus size={12} />
                            Líneas
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleVisibilidadElemento(idx, e)}
                            style={{ background: 'none', border: 'none', color: isVisible ? '#2563eb' : '#94a3b8', cursor: 'pointer', padding: '3px' }}
                            title={isVisible ? 'Ocultar del mapa' : 'Mostrar en el mapa'}
                          >
                            {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveElemento(idx);
                            }}
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '3px' }}
                            title="Eliminar elemento"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* PASO 4: GUARDADO EXCLUSIVO COMO NUEVA CAPA AISLADA */}
          <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              4. Guardar como Nueva Capa Aislada
            </span>
            <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#15803d' }}>
              Los elementos se guardarán en su propia capa independiente, sin mezclarse ni alterar capas preexistentes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#166534', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Nueva Capa
                </label>
                <input
                  type="text"
                  placeholder="Ej: Relevamiento Escuelas y Puntos Críticos 2026"
                  value={nombreNuevaCapa}
                  onChange={(e) => setNombreNuevaCapa(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #86efac', background: '#fff' }}
                />
              </div>

              <button
                type="button"
                disabled={isSaving || elementosDibujados.length === 0}
                onClick={handleGuardarComoNuevaCapa}
                style={{
                  background: elementosDibujados.length === 0 ? '#94a3b8' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: (isSaving || elementosDibujados.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                }}
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Publicar como Nueva Capa Oficial
              </button>
            </div>
          </div>

        </div>

        {/* Mapa Interactivo de Pantalla Completa */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <StandaloneStudioMap
            activeDrawMode={activeDrawMode}
            formColor={formColor}
            onElementCreated={handleElementCreated}
            onDrawModeEnded={() => setActiveDrawMode(null)}
            mostrarRedTransporte={mostrarRedTransporte}
            elementosDibujados={elementosDibujados}
            selectedElementoIdx={selectedElementoIdx}
            onSelectElemento={(idx) => {
              setSelectedElementoIdx(idx);
            }}
            onInspectElemento={(el) => {
              setInspeccionandoElemento(el);
            }}
          />
        </div>

      </main>

      {/* Modal de Detalle e Impacto en Líneas de Transporte al cliquear el punto */}
      <ModalDetallePuntoObra
        isOpen={!!inspeccionandoElemento}
        onClose={() => setInspeccionandoElemento(null)}
        elemento={inspeccionandoElemento}
        onTrazarDesvio={(coords, nombre) => {
          // Si el usuario decide planificar el desvío desde el botón, lo redirigimos a /desvios con las coordenadas
          router.push(`/desvios?lat=${coords[0]}&lng=${coords[1]}&nombre=${encodeURIComponent(nombre)}`);
        }}
      />

      <ImportadorPlanObrasModal
        isOpen={showImportadorObras}
        onClose={() => setShowImportadorObras(false)}
        onImportadoExitoso={(geojson, titulo) => {
          // Si el usuario quiere continuar trabajando sobre los elementos en la sesión del estudio
          if (geojson?.features) {
            const nuevos = geojson.features.map((f: any, i: number) => ({
              shape: f.geometry.type === 'LineString' ? 'Line' : 'Marker',
              geo: f,
              nombre: f.properties?.nombre || `Obra ${i + 1}`,
              descripcion: f.properties?.observaciones || f.properties?.descripcionOriginal || '',
              categoria: 'OBRAS',
              color: f.properties?.color || '#ea580c',
              icono: 'AlertTriangle',
            }));
            setElementosDibujados(prev => [...prev, ...nuevos]);
            setNombreNuevaCapa(titulo);
          }
        }}
      />
    </div>
  );
}
