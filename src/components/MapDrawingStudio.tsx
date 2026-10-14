'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { 
  Palette, MapPin, Route, Square, Check, X, 
  Trash2, Download, Save, Layers, Loader2, Sparkles, Plus, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { emitirCambioMapa } from '@/lib/rtdb';

interface MapDrawingStudioProps {
  capasDisponibles: any[];
  onCapaActualizada?: () => void;
  onClose?: () => void;
}

const COMMON_CATEGORIES = [
  { id: 'EDUCACION', label: 'Escuelas / Colegios', icon: 'School', color: '#2563eb' },
  { id: 'SALUD', label: 'Hospitales / Salitas', icon: 'Hospital', color: '#dc2626' },
  { id: 'SEGURIDAD', label: 'Comisarías / Control', icon: 'Shield', color: '#475569' },
  { id: 'OBRAS', label: 'Obras & Mantenimiento', icon: 'AlertTriangle', color: '#f59e0b' },
  { id: 'TRANSPORTE', label: 'Trazas & Puntos de Colectivo', icon: 'Bus', color: '#059669' },
  { id: 'GENERAL', label: 'Punto de Interés General', icon: 'MapPin', color: '#7c3aed' },
];

export default function MapDrawingStudio({ capasDisponibles, onCapaActualizada, onClose }: MapDrawingStudioProps) {
  const map = useMap();
  const { getIdToken } = useAuth();

  // Estados de dibujo
  const [activeDrawMode, setActiveDrawMode] = useState<'marker' | 'line' | 'polygon' | null>(null);
  const [elementosDibujados, setElementosDibujados] = useState<any[]>([]);
  const [selectedElementoIdx, setSelectedElementoIdx] = useState<number | null>(null);

  // Formulario de atributos para el elemento recién dibujado o seleccionado
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoria, setFormCategoria] = useState('GENERAL');
  const [formColor, setFormColor] = useState('#2563eb');
  const [formIcono, setFormIcono] = useState('MapPin');

  // Destino de guardado
  const [saveMode, setSaveMode] = useState<'existente' | 'nueva'>('existente');
  const [targetCapaId, setTargetCapaId] = useState<string>(capasDisponibles[0]?.id || '');
  const [nuevaCapaNombre, setNuevaCapaNombre] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const drawnLayersGroupRef = useRef<L.FeatureGroup | null>(null);

  // Inicializar grupo contenedor de capas dibujadas
  useEffect(() => {
    if (!drawnLayersGroupRef.current) {
      drawnLayersGroupRef.current = new L.FeatureGroup();
      drawnLayersGroupRef.current.addTo(map);
    }

    return () => {
      if (drawnLayersGroupRef.current) {
        drawnLayersGroupRef.current.clearLayers();
        map.removeLayer(drawnLayersGroupRef.current);
        drawnLayersGroupRef.current = null;
      }
    };
  }, [map]);

  // Manejador del evento cuando Geoman termina de crear una figura
  useEffect(() => {
    if (!map || !(map as any).pm) return;

    const handleCreate = (e: any) => {
      const layer = e.layer;
      const shape = e.shape;

      // Color actual de la figura
      if (layer.setStyle) {
        layer.setStyle({ color: formColor, fillColor: formColor, fillOpacity: 0.35, weight: 4 });
      }

      if (drawnLayersGroupRef.current) {
        drawnLayersGroupRef.current.addLayer(layer);
      }

      const geo = layer.toGeoJSON();
      const nuevoElemento = {
        layer,
        shape,
        geo,
        nombre: formNombre || (shape === 'Marker' ? 'Nuevo Punto' : shape === 'Line' ? 'Nueva Traza' : 'Nueva Zona'),
        descripcion: formDescripcion,
        categoria: formCategoria,
        color: formColor,
        icono: formIcono,
      };

      setElementosDibujados(prev => {
        const next = [...prev, nuevoElemento];
        setSelectedElementoIdx(next.length - 1);
        return next;
      });

      // Salir del modo de dibujo activo tras completar un trazo
      (map as any).pm.disableDraw();
      setActiveDrawMode(null);
      toast.success('Elemento dibujado. Complete sus detalles para incorporarlo.', { icon: '✏️' });
    };

    map.on('pm:create', handleCreate);
    return () => {
      map.off('pm:create', handleCreate);
    };
  }, [map, formColor, formNombre, formDescripcion, formCategoria, formIcono]);

  // Iniciar modo de dibujo
  const handleStartDraw = (mode: 'marker' | 'line' | 'polygon') => {
    if (!map || !(map as any).pm) return;

    if (activeDrawMode === mode) {
      (map as any).pm.disableDraw();
      setActiveDrawMode(null);
      return;
    }

    setActiveDrawMode(mode);
    (map as any).pm.setGlobalOptions({
      templineStyle: { color: formColor, dashArray: '5, 5' },
      hintlineStyle: { color: formColor, dashArray: '5, 5' },
      pathOptions: { color: formColor, fillColor: formColor, fillOpacity: 0.35, weight: 4 },
    });

    if (mode === 'marker') {
      (map as any).pm.enableDraw('Marker', { snappable: true });
    } else if (mode === 'line') {
      (map as any).pm.enableDraw('Line', { snappable: true, allowSelfIntersection: true });
    } else if (mode === 'polygon') {
      (map as any).pm.enableDraw('Polygon', { snappable: true, allowSelfIntersection: false });
    }
  };

  // Cancelar dibujo en curso
  const handleCancelDraw = () => {
    if (map && (map as any).pm) {
      (map as any).pm.disableDraw();
    }
    setActiveDrawMode(null);
  };

  // Eliminar elemento seleccionado
  const handleRemoveElemento = (idx: number) => {
    const el = elementosDibujados[idx];
    if (el?.layer && drawnLayersGroupRef.current) {
      drawnLayersGroupRef.current.removeLayer(el.layer);
    }
    setElementosDibujados(prev => prev.filter((_, i) => i !== idx));
    if (selectedElementoIdx === idx) {
      setSelectedElementoIdx(null);
    }
  };

  // Exportar dibujo a archivo GeoJSON
  const handleExportGeoJSON = () => {
    if (elementosDibujados.length === 0) {
      toast.error('No hay elementos dibujados para exportar');
      return;
    }

    const featureCollection = {
      type: 'FeatureCollection',
      features: elementosDibujados.map((el, i) => ({
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
    a.download = `diseno_cartografico_lanus_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Archivo GeoJSON descargado exitosamente');
  };

  // Guardar en Base de Datos (en capa existente o nueva)
  const handleGuardarEnSistema = async () => {
    if (elementosDibujados.length === 0) {
      toast.error('Dibuje al menos un punto, traza o zona en el mapa');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Guardando geometrías en la base de datos municipal...');

    try {
      const token = await getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const newFeatures = elementosDibujados.map((el, i) => ({
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

      if (saveMode === 'existente') {
        if (!targetCapaId) {
          throw new Error('Debe seleccionar una capa existente');
        }

        const res = await fetch(`/api/capas/${targetCapaId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            appendFeatures: newFeatures,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al incorporar a la capa');
        }

        toast.success(`¡${elementosDibujados.length} elemento(s) incorporado(s) a la capa correctamente!`, { id: toastId });
      } else {
        // Crear nueva capa
        if (!nuevaCapaNombre.trim()) {
          throw new Error('Indique el nombre de la nueva capa');
        }

        const res = await fetch('/api/capas', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: nuevaCapaNombre.trim(),
            type: 'geojson',
            color: formColor,
            icono: formIcono,
            geoData: {
              type: 'FeatureCollection',
              features: newFeatures,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al crear la nueva capa');
        }

        toast.success(`¡Capa "${nuevaCapaNombre}" creada con éxito!`, { id: toastId });
      }

      // Notificar a clientes en tiempo real
      emitirCambioMapa('capas');

      // Limpiar capas dibujadas temporales del mapa
      if (drawnLayersGroupRef.current) {
        drawnLayersGroupRef.current.clearLayers();
      }
      setElementosDibujados([]);
      setSelectedElementoIdx(null);
      if (onCapaActualizada) onCapaActualizada();
      if (onClose) onClose();

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al guardar', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      width: '380px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(16px)',
      borderRadius: '16px',
      boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
      border: '1px solid #e2e8f0',
      zIndex: 1100,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: '#0f172a',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Encabezado */}
      <div style={{
        padding: '14px 18px',
        background: '#0f172a',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={18} color="#38bdf8" />
          <div>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Estudio Cartográfico
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>
              Diseño & Trazado de Capas en Vivo
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={() => {
              handleCancelDraw();
              onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Barra de Herramientas de Dibujo */}
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            1. Seleccionar Herramienta de Dibujo
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleStartDraw('marker')}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeDrawMode === 'marker' ? '#2563eb' : '#cbd5e1',
                background: activeDrawMode === 'marker' ? '#eff6ff' : '#fff',
                color: activeDrawMode === 'marker' ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '11px',
                transition: 'all 0.15s ease'
              }}
            >
              <MapPin size={18} color={activeDrawMode === 'marker' ? '#2563eb' : '#64748b'} />
              Punto / Hito
            </button>

            <button
              type="button"
              onClick={() => handleStartDraw('line')}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeDrawMode === 'line' ? '#2563eb' : '#cbd5e1',
                background: activeDrawMode === 'line' ? '#eff6ff' : '#fff',
                color: activeDrawMode === 'line' ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '11px',
                transition: 'all 0.15s ease'
              }}
            >
              <Route size={18} color={activeDrawMode === 'line' ? '#2563eb' : '#64748b'} />
              Traza / Línea
            </button>

            <button
              type="button"
              onClick={() => handleStartDraw('polygon')}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeDrawMode === 'polygon' ? '#2563eb' : '#cbd5e1',
                background: activeDrawMode === 'polygon' ? '#eff6ff' : '#fff',
                color: activeDrawMode === 'polygon' ? '#1d4ed8' : '#334155',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '11px',
                transition: 'all 0.15s ease'
              }}
            >
              <Square size={18} color={activeDrawMode === 'polygon' ? '#2563eb' : '#64748b'} />
              Área / Zona
            </button>
          </div>

          {activeDrawMode && (
            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>
                Hacé clic en el mapa para posicionar {activeDrawMode === 'marker' ? 'el punto' : 'los vértices'}
              </span>
              <button
                type="button"
                onClick={handleCancelDraw}
                style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Estilo y Atributos del Elemento */}
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            2. Atributos & Categoría
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                Nombre del Elemento
              </label>
              <input
                type="text"
                placeholder="Ej: Escuela N° 12, Traza Especial Turno Noche..."
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Categoría
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setFormCategoria(cat);
                    const found = COMMON_CATEGORIES.find(c => c.id === cat);
                    if (found) {
                      setFormColor(found.color);
                      setFormIcono(found.icon);
                    }
                  }}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  {COMMON_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Color
                </label>
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  style={{ width: '100%', height: '31px', padding: '0 2px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                Observaciones / Motivo Laboral
              </label>
              <textarea
                rows={2}
                placeholder="Detalle o información de referencia técnica..."
                value={formDescripcion}
                onChange={(e) => setFormDescripcion(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        </div>

        {/* Lista de Elementos Dibujados en la Sesión */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              3. Elementos Diseñados ({elementosDibujados.length})
            </span>
            {elementosDibujados.length > 0 && (
              <button
                type="button"
                onClick={handleExportGeoJSON}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Download size={12} /> GeoJSON
              </button>
            )}
          </div>

          {elementosDibujados.length === 0 ? (
            <div style={{ padding: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Aún no has dibujado ningún elemento. Seleccioná una herramienta arriba para comenzar.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {elementosDibujados.map((el, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: el.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>
                      {el.nombre}
                    </span>
                    <span style={{ fontSize: '9px', background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: '4px' }}>
                      {el.shape}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveElemento(idx)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
                    title="Eliminar elemento"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Destino de Incorporación en Base de Datos */}
        <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            4. Destino de Guardado
          </span>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={() => setSaveMode('existente')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: saveMode === 'existente' ? '#2563eb' : '#cbd5e1',
                background: saveMode === 'existente' ? '#dbeafe' : '#fff',
                color: saveMode === 'existente' ? '#1d4ed8' : '#475569',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Capa Existente
            </button>
            <button
              type="button"
              onClick={() => setSaveMode('nueva')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: saveMode === 'nueva' ? '#2563eb' : '#cbd5e1',
                background: saveMode === 'nueva' ? '#dbeafe' : '#fff',
                color: saveMode === 'nueva' ? '#1d4ed8' : '#475569',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              + Nueva Capa
            </button>
          </div>

          {saveMode === 'existente' ? (
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                Seleccionar Capa de Destino
              </label>
              <select
                value={targetCapaId}
                onChange={(e) => setTargetCapaId(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                {capasDisponibles.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.grupo?.nombre ? `(${c.grupo.nombre})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                Nombre de la Nueva Capa
              </label>
              <input
                type="text"
                placeholder="Ej: Relevamiento Puntos Laborales 2026"
                value={nuevaCapaNombre}
                onChange={(e) => setNuevaCapaNombre(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          )}
        </div>

        {/* Botón de Guardado Final */}
        <button
          type="button"
          disabled={isSaving || elementosDibujados.length === 0}
          onClick={handleGuardarEnSistema}
          style={{
            background: elementosDibujados.length === 0 ? '#94a3b8' : '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            fontWeight: 800,
            cursor: (isSaving || elementosDibujados.length === 0) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
            marginTop: '4px'
          }}
        >
          {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Incorporar Diseños al Mapa Oficial
        </button>

      </div>
    </div>
  );
}
