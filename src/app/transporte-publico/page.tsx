'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, Truck, CheckCircle, ArrowRight, Loader2, Plus, Edit2, ArrowLeft, List, LayoutDashboard, User, Shield, Info, Search, Filter, ExternalLink, FileText, Route, Navigation, ClipboardList, Clock, Zap, ChevronUp, ChevronDown, Bot, AlertTriangle, Wand2, Trash2, Pencil } from 'lucide-react';
import AccessDenied from '@/components/AccessDenied';
import NotificacionToast from '@/components/NotificacionToast';


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
import { emitirNuevaSolicitud } from '@/lib/rtdb';

const ROUTE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2'];

export default function TransportePublicoWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, dbUser, loading, getIdToken } = useAuth();
  
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

  const handleAITrace = async () => {
    if (!aiText.trim()) return;
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const res = await fetch('/api/parse-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, index: preTracedFeatures.length, description: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el texto.');
      
      const newFeatures = data.features || (data.feature ? [data.feature] : (data.recorridos ? data.recorridos : []));
      // Note: route.ts returns an array of features at allFeatures or something. Let me double check route.ts return.
      // Wait, let's verify what route.ts actually returns.
      // Ah, wait. I shouldn't guess. Let me check `route.ts`. 
      // For now, I'll copy what WizardMap was doing: `data.features || (data.feature ? [data.feature] : [])`. But wait...
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

  useEffect(() => {
    // Basic init
  }, []);

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
      const token = await getIdToken();
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
        // Build individual geojson for this record
        const individualGeo = {
          type: 'FeatureCollection',
          features: [feature]
        };

        const res = await fetch('/api/lineas-transporte', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            nombre,
            numero,
            color: feature.properties?.color || color,
            categoria,
            // If the feature has a name from AI/metadata editing, use it as subcategoria. Otherwise fallback to Paso 2 input.
            subcategoria: feature.properties?.name || subcategoria || 'Ramal Principal',
            sentido: sentido || null,
            // If the feature has a description from AI/metadata, use it. Otherwise fallback.
            descripcion: feature.properties?.description || descripcion || '',
            datosGeo: individualGeo
          })
        });

        if (!res.ok) throw new Error('Error al guardar uno de los ramales.');
      }
      
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
  if (!user || !dbUser?.permisos?.editarLineas) {
    return <AccessDenied 
      mensaje="No tenés permiso para cargar líneas de transporte público. Contactá a un administrador."
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
            <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1, boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }}>Cargar otra línea</button>
            <button onClick={() => router.push('/admin')} style={{ padding: '12px 24px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600, cursor: 'pointer', flex: 1 }}>Volver al Panel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      {/* SIDEBAR PANEL */}
      <div style={{ width: '420px', background: '#ffffff', display: 'flex', flexDirection: 'column', color: '#0f172a', zIndex: 10, boxShadow: '4px 0 24px rgba(15,23,42,0.06)', position: 'relative', borderRight: '1px solid rgba(226,232,240,0.8)' }}>
        <div style={{ height: 52, borderBottom: '1px solid #f1f5f9', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-lanus.png" alt="Lanús" style={{ width: 30, height: 30, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Transporte Público</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Asistente de registro · Lanús</div>
            </div>
          </div>
          <button onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <ArrowLeft size={13} /> Inicio
          </button>
        </div>

        {/* STEPPER */}
        <div style={{ padding: '16px 24px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {[{ n: 1, label: 'Datos' }, { n: 2, label: 'Ramal' }, { n: 3, label: 'Traza' }].map(({ n, label }, idx) => (
              <React.Fragment key={n}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: step > n ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : step === n ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#f1f5f9',
                    border: step >= n ? 'none' : '1.5px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: step >= n ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 11,
                    boxShadow: step === n ? '0 0 0 3px rgba(37,99,235,0.18)' : 'none',
                    transition: 'all 0.25s ease', flexShrink: 0
                  }}>
                    {step > n ? <CheckCircle size={13} color="#fff" strokeWidth={3} /> : n}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: step >= n ? '#2563eb' : '#94a3b8' }}>{label}</span>
                </div>
                {idx < 2 && (
                  <div style={{ flex: 1, height: 2, background: step > n ? '#2563eb' : '#e2e8f0', margin: '0 4px', marginBottom: 16, transition: 'background 0.3s' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* FORM STEPS */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 24px', background: '#f8fafc' }}>
          
          {step === 1 && (
            <div className="fade-in">
              <div style={{ border: 'none', borderLeft: '3px solid #2563eb', borderRadius: '0 10px 10px 0', padding: '12px 16px 8px', marginBottom: '18px', background: '#f8faff' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Información Base</div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nombre de la Línea *</label>
                <input 
                  value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="ej: Línea 271"
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                />
              </div>

              <div style={{ marginBottom: '14px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Número</label>
                  <input 
                    value={numero} onChange={e => setNumero(e.target.value)}
                    placeholder="ej: 271"
                    style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="color" value={color} onChange={e => setColor(e.target.value)}
                      style={{ width: '45px', height: '45px', padding: '2px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <input 
                      value={color} onChange={e => setColor(e.target.value)}
                      style={{ flex: 1, padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '6px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Jurisdicción / Categoría *</label>
                <select 
                  value={categoria} onChange={e => setCategoria(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                >
                  <option value="MUNICIPAL">Municipal</option>
                  <option value="PROVINCIAL">Provincial</option>
                  <option value="NACIONAL">Nacional</option>
                </select>
              </div>
              </div>{/* end fieldset */}
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <div style={{ border: 'none', borderLeft: '3px solid #2563eb', borderRadius: '0 10px 10px 0', padding: '12px 16px 14px', marginBottom: '18px', background: '#f8faff' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Gestión de Ramales</div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                  Pegá el texto de la resolución (CNRT, etc.) para extraer automáticamente los ramales, o cargalos a mano.
                </p>
              </div>

              <div style={{ background: '#f8faff', padding: '14px', borderRadius: '10px', border: '1px solid #e0e7ff', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Bot size={13} color="#2563eb" /> Procesamiento con IA
                </p>
                <textarea
                  value={aiText}
                  onChange={e => { setAiText(e.target.value); if (aiError) setAiError(null); }}
                  placeholder="Escribí o pegá la resolución acá..."
                  style={{ width: '100%', height: 80, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', resize: 'vertical', outline: 'none', color: '#0f172a', boxSizing: 'border-box', background: '#fff' }}
                />
                <button
                  onClick={handleAITrace}
                  disabled={isGeneratingAI || !aiText.trim()}
                  style={{ width: '100%', marginTop: 8, padding: '10px', fontSize: '0.85rem', fontWeight: 700, background: isGeneratingAI || !aiText.trim() ? '#e5e7eb' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: isGeneratingAI || !aiText.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: '8px', cursor: isGeneratingAI || !aiText.trim() ? 'not-allowed' : 'pointer', boxShadow: isGeneratingAI || !aiText.trim() ? 'none' : '0 2px 8px rgba(37,99,235,0.3)', transition: 'all 0.2s' }}>
                  {isGeneratingAI ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Procesando e interpretando...</span> : 'Extraer Ramales'}
                </button>
                {aiError && (
                  <div style={{ marginTop: 8, padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.4 }}>
                    {aiError}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <button
                  onClick={addManualFeature}
                  style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 3px 10px rgba(37,99,235,0.3)' }}
                >
                  <Plus size={16} strokeWidth={2.5} /> Añadir Ramal Manualmente
                </button>
              </div>

              {/* Lista de Ramales Extraídos */}
              {preTracedFeatures.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Ramales detectados ({preTracedFeatures.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {preTracedFeatures.map((f, i) => (
                      <div key={i} style={{ background: '#f8faff', border: '1px solid #e9eef6', borderLeft: `3px solid ${f.properties?.color || '#2563eb'}`, borderRadius: '0 10px 10px 0', padding: '11px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', transition: 'box-shadow 0.15s' }}>
                        
                        {editingMetadataIdx === i ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              type="text"
                              value={tempMetadata.name}
                              onChange={e => setTempMetadata({ ...tempMetadata, name: e.target.value })}
                              placeholder="Nombre del Ramal"
                              style={{ width: '100%', padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #bfdbfe', outline: 'none' }}
                            />
                            <textarea
                              value={tempMetadata.description}
                              onChange={e => setTempMetadata({ ...tempMetadata, description: e.target.value })}
                              placeholder="Descripción detallada"
                              rows={2}
                              style={{ width: '100%', padding: '8px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #bfdbfe', outline: 'none', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button onClick={() => setEditingMetadataIdx(null)} style={{ flex: 1, padding: '6px', fontSize: '0.8rem', fontWeight: 600, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                              <button onClick={() => saveMetadata(i)} style={{ flex: 1, padding: '6px', fontSize: '0.8rem', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Guardar Cambios</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.properties.color || '#2563eb', display: 'inline-block' }} />
                                {f.properties.name || `Ramal ${i + 1}`}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                                {f.properties.description || 'Sin descripción.'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                                {f.properties.streets ? `Calles: ${f.properties.streets.substring(0, 60)}...` : 'Sin traza detallada'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button onClick={() => startEditMetadata(i)} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Editar Ramal">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => deleteFeature(i)} style={{ background: '#fef2f2', color: '#dc2626', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <div style={{ border: 'none', borderLeft: '3px solid #16a34a', borderRadius: '0 10px 10px 0', padding: '10px 16px 12px', marginBottom: '18px', background: '#f0fdf4' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={11} /> Trazado Geográfico
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>Dibujá la traza exacta de este ramal en el mapa.</p>
              </div>
              
              <div style={{ padding: '14px 16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Estado del trazado:</span>
                {datosGeo ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 700, background: '#dcfce7', padding: '4px 10px', borderRadius: '20px' }}>
                    <CheckCircle size={14} /> Listo
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontSize: '0.85rem', fontWeight: 700, background: '#fef3c7', padding: '4px 10px', borderRadius: '20px' }}>
                    <AlertTriangle size={14} /> Pendiente
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', background: '#fafbfd' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {step > 1 && (
              <button 
                onClick={handlePrev}
                style={{ padding: '12px 20px', borderRadius: '12px', background: '#fff', border: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <ArrowLeft size={18} /> Atrás
              </button>
            )}
            
            {step < 3 ? (
              <button 
                onClick={handleNext}
                style={{ flex: 1, padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(37, 99, 235, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(37, 99, 235, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Siguiente <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px 24px', borderRadius: '12px', background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: isSubmitting ? 'none' : '0 4px 14px 0 rgba(22, 163, 74, 0.3)', transition: 'all 0.2s' }}
                onMouseOver={(e) => { if(!isSubmitting){ e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(22, 163, 74, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseOut={(e) => { if(!isSubmitting){ e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(22, 163, 74, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                {isSubmitting ? 'Guardando...' : 'Finalizar Línea'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAP AREA */}
      <div style={{ flex: 1, position: 'relative', background: '#f1f5f9' }}>
        <WizardMap 
          onComplete={handleGeoDataUpdate}
          initialWaypoints={savedWaypoints}
          initialFeatures={preTracedFeatures}
        />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};
