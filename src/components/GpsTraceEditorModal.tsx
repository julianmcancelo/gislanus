'use client';
import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  X, Save, RotateCcw, Sparkles, Sliders, MapPin, AlertTriangle,
  Bus, Info, ArrowLeftRight, Check, Scissors, RefreshCw, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as turf from '@turf/turf';

const StaticMapPreview = dynamic(() => import('@/components/StaticMapPreview'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
      <RefreshCw className="animate-spin" size={28} color="#0284c7" />
      <span style={{ marginLeft: 8, fontSize: '0.85rem' }}>Cargando mapa interactivo...</span>
    </div>
  ),
});

interface GpsTraceEditorModalProps {
  isOpen: boolean;
  trip: any;
  onClose: () => void;
  onSaved: (updatedTrip: any) => void;
}

const PRESET_COLORS = [
  { label: 'Azul Lanús', color: '#0284c7' },
  { label: 'Azul Real', color: '#2563eb' },
  { label: 'Violeta / Vuelta', color: '#8b5cf6' },
  { label: 'Verde Municipal', color: '#10b981' },
  { label: 'Ámbar Transporte', color: '#f59e0b' },
  { label: 'Rojo Alerta', color: '#ef4444' },
  { label: 'Rosa Magenta', color: '#ec4899' },
  { label: 'Gris Grafito', color: '#334155' },
];

export default function GpsTraceEditorModal({
  isOpen,
  trip,
  onClose,
  onSaved,
}: GpsTraceEditorModalProps) {
  if (!isOpen || !trip) return null;

  // Tab selection
  const [activeTab, setActiveTab] = useState<'trazos' | 'info' | 'paradas' | 'incidencias'>('trazos');
  const [isSaving, setIsSaving] = useState(false);

  // Metadata form state
  const [lineaNumero, setLineaNumero] = useState(trip.lineaNumero || '');
  const [ramal, setRamal] = useState(trip.ramal || '');
  const [sentido, setSentido] = useState(trip.sentido || 'IDA');
  const [interno, setInterno] = useState(trip.interno || '');
  const [patente, setPatente] = useState(trip.patente || '');
  const [chofer, setChofer] = useState(trip.chofer || '');
  const [notas, setNotas] = useState(trip.notas || '');
  const [estado, setEstado] = useState(trip.estado || 'FINALIZADO');

  // Styling state
  const [strokeColor, setStrokeColor] = useState('#0284c7');
  const [strokeWeight, setStrokeWeight] = useState(5);
  const [strokeOpacity, setStrokeOpacity] = useState(0.9);

  // Simplification tolerance state (degrees, approx 0.0001 = ~10m)
  const [simplifyTolerance, setSimplifyTolerance] = useState(0.0001);

  // Parsed GeoJSON state
  const originalGeo = useMemo(() => {
    try {
      return typeof trip.datosGeo === 'string' ? JSON.parse(trip.datosGeo) : trip.datosGeo;
    } catch {
      return { type: 'FeatureCollection', features: [] };
    }
  }, [trip.datosGeo]);

  const [currentGeo, setCurrentGeo] = useState<any>(originalGeo);
  const [history, setHistory] = useState<any[]>([originalGeo]);

  // Sync state when trip prop changes
  useEffect(() => {
    setLineaNumero(trip.lineaNumero || '');
    setRamal(trip.ramal || '');
    setSentido(trip.sentido || 'IDA');
    setInterno(trip.interno || '');
    setPatente(trip.patente || '');
    setChofer(trip.chofer || '');
    setNotas(trip.notas || '');
    setEstado(trip.estado || 'FINALIZADO');
    setCurrentGeo(originalGeo);
    setHistory([originalGeo]);
  }, [trip, originalGeo]);

  // Extract Line feature
  const lineFeature = useMemo(() => {
    if (!currentGeo?.features) return null;
    return currentGeo.features.find((f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString') || null;
  }, [currentGeo]);

  // Extract stops and incidents
  const stopsList = useMemo(() => {
    if (!currentGeo?.features) return [];
    return currentGeo.features.filter((f: any) => f.properties?.type === 'stop');
  }, [currentGeo]);

  const incidentsList = useMemo(() => {
    if (!currentGeo?.features) return [];
    return currentGeo.features.filter((f: any) => f.properties?.type === 'incident');
  }, [currentGeo]);

  // Calculate dynamic metrics
  const currentMetrics = useMemo(() => {
    let distanceKm = 0;
    let pointsCount = 0;
    if (lineFeature && lineFeature.geometry?.type === 'LineString') {
      try {
        distanceKm = turf.length(lineFeature, { units: 'kilometers' });
        pointsCount = lineFeature.geometry.coordinates?.length || 0;
      } catch {}
    }
    return {
      distanceKm: distanceKm > 0 ? distanceKm.toFixed(2) : (trip.distanciaMeters / 1000).toFixed(2),
      distanceMeters: distanceKm > 0 ? Math.round(distanceKm * 1000) : trip.distanciaMeters,
      pointsCount,
      stopsCount: stopsList.length,
      incidentsCount: incidentsList.length,
    };
  }, [lineFeature, stopsList, incidentsList, trip.distanciaMeters]);

  // Push new state into undo history
  const pushState = (newGeo: any) => {
    setHistory(prev => [...prev.slice(-10), newGeo]);
    setCurrentGeo(newGeo);
  };

  // Undo last modification
  const handleUndo = () => {
    if (history.length <= 1) return;
    const prev = history[history.length - 2];
    setHistory(h => h.slice(0, -1));
    setCurrentGeo(prev);
    toast.success('Cambio deshecho');
  };

  // Reset to original
  const handleReset = () => {
    setCurrentGeo(originalGeo);
    setHistory([originalGeo]);
    toast('Trazado restablecido al original grabado por el GPS', { icon: '🔄' });
  };

  /**
   * ACCIÓN 1: Simplificación Ramer-Douglas-Peucker (Suavizar temblequeo)
   */
  const handleSimplify = () => {
    if (!lineFeature || lineFeature.geometry?.type !== 'LineString') {
      toast.error('No se encontró una polilínea LineString para simplificar');
      return;
    }

    try {
      const origCount = lineFeature.geometry.coordinates.length;
      const simplified = turf.simplify(lineFeature, {
        tolerance: simplifyTolerance,
        highQuality: true,
        mutate: false,
      });

      const newCount = simplified.geometry.coordinates.length;
      if (newCount < 2) {
        toast.error('La tolerancia elegida es demasiado alta para este trazo');
        return;
      }

      const newFeatures = currentGeo.features.map((f: any) => {
        if (f.geometry?.type === 'LineString') {
          return {
            ...simplified,
            properties: {
              ...f.properties,
              simplified: true,
              tolerance: simplifyTolerance,
            },
          };
        }
        return f;
      });

      pushState({
        type: 'FeatureCollection',
        features: newFeatures,
      });

      const reduction = Math.round(((origCount - newCount) / origCount) * 100);
      toast.success(`Trazo optimizado: ${origCount} ➔ ${newCount} puntos (-${reduction}% de ruido)`);
    } catch (err: any) {
      toast.error('Error al simplificar trazo: ' + err.message);
    }
  };

  /**
   * ACCIÓN 2: Suavizado Curvo Bézier Spline
   */
  const handleBezierSmooth = () => {
    if (!lineFeature || lineFeature.geometry?.type !== 'LineString') {
      toast.error('No se encontró una línea para suavizar');
      return;
    }

    try {
      // First clean coords
      const cleaned = turf.cleanCoords(lineFeature);
      const spline = turf.bezierSpline(cleaned, { resolution: 10000, sharpness: 0.85 });

      const newFeatures = currentGeo.features.map((f: any) => {
        if (f.geometry?.type === 'LineString') {
          return {
            ...f,
            geometry: spline.geometry,
            properties: {
              ...f.properties,
              smoothed: 'bezier',
            },
          };
        }
        return f;
      });

      pushState({
        type: 'FeatureCollection',
        features: newFeatures,
      });

      toast.success('Curvas y giros de avenidas suavizados profesionalmente');
    } catch (err: any) {
      toast.error('Error al aplicar suavizado Bézier: ' + err.message);
    }
  };

  /**
   * ACCIÓN 3: Invertir Sentido de Coordenadas
   */
  const handleReverseDirection = () => {
    if (!lineFeature || lineFeature.geometry?.type !== 'LineString') return;

    try {
      const reversedCoords = [...lineFeature.geometry.coordinates].reverse();
      const newFeatures = currentGeo.features.map((f: any) => {
        if (f.geometry?.type === 'LineString') {
          return {
            ...f,
            geometry: {
              ...f.geometry,
              coordinates: reversedCoords,
            },
          };
        }
        return f;
      });

      const newSentido = sentido === 'IDA' ? 'VUELTA' : 'IDA';
      setSentido(newSentido);

      pushState({
        type: 'FeatureCollection',
        features: newFeatures,
      });

      toast.success(`Sentido invertido a: ${newSentido}`);
    } catch (err: any) {
      toast.error('Error al invertir sentido: ' + err.message);
    }
  };

  /**
   * ACCIÓN 4: Limpiar Puntos Duplicados o Micro-Jitter
   */
  const handleCleanJitter = () => {
    if (!lineFeature || lineFeature.geometry?.type !== 'LineString') return;

    try {
      const origCount = lineFeature.geometry.coordinates.length;
      const cleaned = turf.cleanCoords(lineFeature);
      const newCount = cleaned.geometry.coordinates.length;

      const newFeatures = currentGeo.features.map((f: any) => {
        if (f.geometry?.type === 'LineString') return cleaned;
        return f;
      });

      pushState({
        type: 'FeatureCollection',
        features: newFeatures,
      });

      toast.success(`Limpieza completada: ${origCount - newCount} micro-vértices repetidos eliminados`);
    } catch (err: any) {
      toast.error('Error al limpiar coordenadas: ' + err.message);
    }
  };

  /**
   * GESTIÓN DE PARADAS: Renombrar o Eliminar
   */
  const handleUpdateStopName = (index: number, newName: string) => {
    let stopIdx = 0;
    const newFeatures = currentGeo.features.map((f: any) => {
      if (f.properties?.type === 'stop') {
        if (stopIdx === index) {
          stopIdx++;
          return {
            ...f,
            properties: { ...f.properties, name: newName },
          };
        }
        stopIdx++;
      }
      return f;
    });

    pushState({
      type: 'FeatureCollection',
      features: newFeatures,
    });
  };

  const handleDeleteStop = (index: number) => {
    let stopIdx = 0;
    const newFeatures = currentGeo.features.filter((f: any) => {
      if (f.properties?.type === 'stop') {
        const keep = stopIdx !== index;
        stopIdx++;
        return keep;
      }
      return true;
    });

    pushState({
      type: 'FeatureCollection',
      features: newFeatures,
    });
    toast.success('Parada removida del recorrido');
  };

  /**
   * GESTIÓN DE INCIDENCIAS: Eliminar
   */
  const handleDeleteIncident = (index: number) => {
    let incIdx = 0;
    const newFeatures = currentGeo.features.filter((f: any) => {
      if (f.properties?.type === 'incident') {
        const keep = incIdx !== index;
        incIdx++;
        return keep;
      }
      return true;
    });

    pushState({
      type: 'FeatureCollection',
      features: newFeatures,
    });
    toast.success('Incidencia descartada');
  };

  /**
   * GUARDAR CAMBIOS: Enviar PATCH a /api/bitacora-gps/[id]
   */
  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Guardando modificaciones del relevamiento...');

    try {
      const payload = {
        lineaNumero: lineaNumero.trim() || null,
        ramal: ramal.trim() || null,
        sentido: sentido || 'IDA',
        interno: interno.trim() || null,
        patente: patente.trim() || null,
        chofer: chofer.trim() || null,
        notas: notas.trim() || null,
        estado,
        distanciaMeters: currentMetrics.distanceMeters,
        puntosCount: currentMetrics.pointsCount,
        paradasCount: currentMetrics.stopsCount,
        incidenciasCount: currentMetrics.incidentsCount,
        datosGeo: currentGeo,
      };

      const res = await fetch(`/api/bitacora-gps/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar');
      }

      const updated = await res.json();
      toast.success('Relevamiento y trazo cartográfico guardados con éxito', { id: toastId });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error('No se pudo guardar: ' + e.message, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 1200,
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}>
        {/* MODAL HEADER */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(135deg, #091325 0%, #1e293b 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sliders size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                  Editor de Trazado & Metadatos
                </h2>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(56,189,248,0.2)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}>
                  {lineaNumero ? `Línea ${lineaNumero}` : 'Relevamiento'} — {ramal || 'Principal'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8' }}>
                Perfeccioná estéticamente los recorridos GPS, suavizá curvas y actualizá información municipal
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {history.length > 1 && (
              <button
                onClick={handleUndo}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#e2e8f0',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Deshacer última acción"
              >
                <RotateCcw size={14} /> Deshacer
              </button>
            )}

            <button
              onClick={handleReset}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#e2e8f0',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Restablecer trazo original del GPS"
            >
              <RefreshCw size={14} /> Original
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseOver={e => e.currentTarget.style.color = '#fff'}
              onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SPLIT 2 COLUMNS) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* LEFT COLUMN: EDITING TOOLS & FORMS */}
          <div style={{
            width: 480,
            background: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* TABS SELECTOR */}
            <div style={{
              display: 'flex',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '0 8px',
            }}>
              <button
                onClick={() => setActiveTab('trazos')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: activeTab === 'trazos' ? '2px solid #0284c7' : '2px solid transparent',
                  color: activeTab === 'trazos' ? '#0284c7' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={14} /> Estética Trazo
              </button>
              <button
                onClick={() => setActiveTab('info')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: activeTab === 'info' ? '2px solid #0284c7' : '2px solid transparent',
                  color: activeTab === 'info' ? '#0284c7' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Info size={14} /> Información
              </button>
              <button
                onClick={() => setActiveTab('paradas')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: activeTab === 'paradas' ? '2px solid #0284c7' : '2px solid transparent',
                  color: activeTab === 'paradas' ? '#0284c7' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MapPin size={14} /> Paradas ({stopsList.length})
              </button>
              <button
                onClick={() => setActiveTab('incidencias')}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: activeTab === 'incidencias' ? '2px solid #0284c7' : '2px solid transparent',
                  color: activeTab === 'incidencias' ? '#0284c7' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <AlertTriangle size={14} /> Incidencias ({incidentsList.length})
              </button>
            </div>

            {/* TAB CONTENT SCROLLABLE */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              
              {/* TAB 1: ESTÉTICA Y TRAZOS */}
              {activeTab === 'trazos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Tool 1: Suavizado Bézier */}
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 6, borderRadius: 6 }}>
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Suavizado Curvo Bézier</strong>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                            Redondea esquinas y giros para eliminar la apariencia dentada del GPS
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleBezierSmooth}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 2px 6px rgba(2,132,199,0.25)',
                      }}
                    >
                      <Sparkles size={14} /> Aplicar Curvatura Suave
                    </button>
                  </div>

                  {/* Tool 2: Simplificación RDP */}
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ background: '#fef3c7', color: '#d97706', padding: 6, borderRadius: 6 }}>
                        <Scissors size={16} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Simplificación Inteligente</strong>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                          Reduce vértices redundantes manteniendo la fidelidad del recorrido
                        </p>
                      </div>
                    </div>

                    <div style={{ margin: '12px 0 8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b', marginBottom: 4 }}>
                        <span>Tolerancia de filtro:</span>
                        <strong>{simplifyTolerance === 0.00003 ? 'Baja (Micro)' : simplifyTolerance === 0.0001 ? 'Media (Recomendada)' : 'Alta (Línea Rápida)'}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[
                          { label: 'Suave', val: 0.00003 },
                          { label: 'Media', val: 0.0001 },
                          { label: 'Alta', val: 0.0003 },
                        ].map(opt => (
                          <button
                            key={opt.val}
                            onClick={() => setSimplifyTolerance(opt.val)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: 6,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: simplifyTolerance === opt.val ? '2px solid #0284c7' : '1px solid #cbd5e1',
                              background: simplifyTolerance === opt.val ? '#e0f2fe' : '#ffffff',
                              color: simplifyTolerance === opt.val ? '#0369a1' : '#475569',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleSimplify}
                      style={{
                        width: '100%',
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 8,
                      }}
                    >
                      <Scissors size={14} color="#d97706" /> Simplificar Vértices Redundantes
                    </button>
                  </div>

                  {/* Tool 3: Inversión de Sentido y Micro-limpieza */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      onClick={handleReverseDirection}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        textAlign: 'center',
                      }}
                    >
                      <ArrowLeftRight size={18} color="#8b5cf6" />
                      <strong style={{ fontSize: '0.76rem', color: '#1e293b' }}>Invertir Sentido</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Cambia orden Ida ⇄ Vuelta</span>
                    </button>

                    <button
                      onClick={handleCleanJitter}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        textAlign: 'center',
                      }}
                    >
                      <Scissors size={18} color="#10b981" />
                      <strong style={{ fontSize: '0.76rem', color: '#1e293b' }}>Limpiar Jitter</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Borra puntos duplicados</span>
                    </button>
                  </div>

                  {/* Styling: Paleta de Colores y Grosor */}
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: 8 }}>
                      Estilo Cartográfico en Mapa
                    </strong>

                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: 6 }}>Color del trazo:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c.color}
                            onClick={() => setStrokeColor(c.color)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: c.color,
                              border: strokeColor === c.color ? '3px solid #0f172a' : '2px solid #fff',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={c.label}
                          >
                            {strokeColor === c.color && <Check size={14} color="#fff" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b', marginBottom: 4 }}>
                        <span>Grosor de línea:</span>
                        <strong>{strokeWeight}px</strong>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        value={strokeWeight}
                        onChange={e => setStrokeWeight(Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: INFORMACIÓN & METADATOS */}
              {activeTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Línea de Colectivo
                      </label>
                      <input
                        type="text"
                        value={lineaNumero}
                        onChange={e => setLineaNumero(e.target.value)}
                        placeholder="Ej: 523"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Sentido
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setSentido('IDA')}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: 8,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: sentido === 'IDA' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                            background: sentido === 'IDA' ? '#e0f2fe' : '#ffffff',
                            color: sentido === 'IDA' ? '#0369a1' : '#64748b',
                          }}
                        >
                          IDA
                        </button>
                        <button
                          type="button"
                          onClick={() => setSentido('VUELTA')}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: 8,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: sentido === 'VUELTA' ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                            background: sentido === 'VUELTA' ? '#f3e8ff' : '#ffffff',
                            color: sentido === 'VUELTA' ? '#7e22ce' : '#64748b',
                          }}
                        >
                          VUELTA
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Ramal / Variante
                    </label>
                    <input
                      type="text"
                      value={ramal}
                      onChange={e => setRamal(e.target.value)}
                      placeholder="Ej: Ramal A - Estación Lanús a Villa Jardín"
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Nº de Interno
                      </label>
                      <input
                        type="text"
                        value={interno}
                        onChange={e => setInterno(e.target.value)}
                        placeholder="Ej: 42"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Patente / Dominio
                      </label>
                      <input
                        type="text"
                        value={patente}
                        onChange={e => setPatente(e.target.value)}
                        placeholder="Ej: AF 123 CD"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Chofer / Inspector
                      </label>
                      <input
                        type="text"
                        value={chofer}
                        onChange={e => setChofer(e.target.value)}
                        placeholder="Nombre del personal"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                        Estado del Relevamiento
                      </label>
                      <select
                        value={estado}
                        onChange={e => setEstado(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem', background: '#fff' }}
                      >
                        <option value="FINALIZADO">FINALIZADO</option>
                        <option value="REVISADO">REVISADO (Visto Bueno)</option>
                        <option value="EN_CORRECCION">EN CORRECCIÓN</option>
                        <option value="APROBADO">APROBADO PARA LÍNEA OFICIAL</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Notas & Observaciones de Campo
                    </label>
                    <textarea
                      rows={3}
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      placeholder="Observaciones de tránsito, cortes de calle, desvíos temporales, etc."
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: PARADAS */}
              {activeTab === 'paradas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
                    Podés renombrar cada parada para ajustar su nomenclatura oficial o descartar paradas que no correspondan.
                  </p>

                  {stopsList.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10 }}>
                      No se registraron paradas en este viaje.
                    </div>
                  ) : (
                    stopsList.map((stop: any, idx: number) => {
                      const name = stop.properties?.name || `Parada ${idx + 1}`;
                      const seq = stop.properties?.sequence || (idx + 1);
                      return (
                        <div
                          key={idx}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <span style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#10b981',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}>
                              {seq}
                            </span>
                            <input
                              type="text"
                              value={name}
                              onChange={e => handleUpdateStopName(idx, e.target.value)}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                fontSize: '0.8rem',
                              }}
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteStop(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: 4,
                            }}
                            title="Quitar parada"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: INCIDENCIAS */}
              {activeTab === 'incidencias' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
                    Incidentes y obstáculos de calzada reportados por el chofer durante el viaje.
                  </p>

                  {incidentsList.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10 }}>
                      No se registraron incidencias en este viaje.
                    </div>
                  ) : (
                    incidentsList.map((inc: any, idx: number) => {
                      const type = inc.properties?.incidentType || 'Alerta';
                      const desc = inc.properties?.description || 'Sin detalle';
                      return (
                        <div
                          key={idx}
                          style={{
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            borderRadius: 8,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#e11d48' }}>
                              ⚠️ {type}
                            </span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#4c0519' }}>
                              {desc}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteIncident(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#e11d48',
                              cursor: 'pointer',
                              padding: 4,
                            }}
                            title="Quitar reporte"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: MAP & LIVE PREVIEW */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            
            {/* Floating Live Telemetry Badge */}
            <div style={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: '0.75rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>DISTANCIA</span>
                <strong style={{ display: 'block', fontSize: '0.85rem', color: '#38bdf8' }}>{currentMetrics.distanceKm} km</strong>
              </div>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>VÉRTICES GPS</span>
                <strong style={{ display: 'block', fontSize: '0.85rem', color: '#4ade80' }}>{currentMetrics.pointsCount} pts</strong>
              </div>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>PARADAS</span>
                <strong style={{ display: 'block', fontSize: '0.85rem', color: '#facc15' }}>{currentMetrics.stopsCount}</strong>
              </div>
            </div>

            {/* Map Canvas */}
            <div style={{ flex: 1 }}>
              <StaticMapPreview
                geoData={currentGeo}
                interactive={true}
                height="100%"
                strokeColor={strokeColor}
                strokeWeight={strokeWeight}
                strokeOpacity={strokeOpacity}
              />
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Los cambios de trazo y datos se guardarán directamente en el relevamiento de la base municipal.
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
              }}
            >
              {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
              <span>Guardar Modificaciones</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
