'use client';
import React, { useState } from 'react';
import { 
  Sparkles, MapPin, Route, CheckCircle2, AlertTriangle, X, 
  Loader2, Download, Save, Layers, ArrowRight, RefreshCw, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { emitirCambioMapa } from '@/lib/rtdb';

interface ImportadorPlanObrasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportadoExitoso?: (geojson: any, tituloPlan: string) => void;
}

const DEFAULT_SAMPLE_TEXT = `PLAN DE PAVIMENTACIÓN
Semana del 19/10 al 23/10 - EMPRESAS

LÁZARO

Zona Este - Hormigón:

1. Tucumán y Posadas - Bacheo de hormigón (Resta aserrar y tirar hormigon en el centro de bocacalle.)
2. Félix de Alzaga y Chascomús - Bacheo de hormigón + Reconstrucción de cámara de inspección

Zona Oeste - Hormigón:

1. Sayos y Balbín - Cruce de hormigón (queda pendiente hormigón en la mitad donde se acumula agua)
2. Balbín entre Erezcano y Veracruz - Media cuadra - Resta media calzada.
3. Murguiondo entre Maza y Warnes. - Media cuadra. 
4. Maza y Warnes - Cruce de Hormigon. 
5. Enrique Fernandez entre Sayos y Tacuari - Bache 
6. Ocampo y Noya - Bache,

Zona Este Carpeta asfáltica:

1. Guidi entre Pringles y Guido - Carpeta asfaltica. 

Zona Oeste Carpeta asfaltica: 

1. Liniers entre Darragueira y Osorio - (5 cuadras) - Fresado + Carpeta asfaltica. 

KAVOS

Villa Esperanza - Cordón cuneta:

1. Colón entre Velloso y Ruiz de Ocaña - Cordón cuneta + excavación + nivelación
2. Colón entre Ruiz de Ocaña y Namuncurá - Cordón cuneta + excavación + nivelación
3. Colón entre Namuncurá y General Paz - Cordón cuneta + excavación + nivelación

Hormigón:

1. Carlos Gardel entre Yerbal y Biglieri - Media cuadra
2. Iberlucea y Zuloaga - Medio cruce + bache
3. Iberlucea y De La Cruz - Cruce de hormigon. 

USIMIX

Gerli Este - Hormigón:

1. V. de Lujan y Bolaños - Cruce. 
2. V. de Lujan y Blanco Encalada - Cruce
3. Pergamino y Bolaños - Cruce. 
4. Guidi y Bolaños - Medio cruce.`;

export default function ImportadorPlanObrasModal({
  isOpen,
  onClose,
  onImportadoExitoso,
}: ImportadorPlanObrasModalProps) {
  const { getIdToken } = useAuth();
  const [texto, setTexto] = useState(DEFAULT_SAMPLE_TEXT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [nombreCapa, setNombreCapa] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleProcesar = async () => {
    if (!texto.trim()) {
      toast.error('Por favor pegue el texto del plan de obras');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading('Analizando y geocodificando direcciones en Lanús...');

    try {
      const res = await fetch('/api/obras/parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error procesando el plan');
      }

      const data = await res.json();
      setResultado(data);
      setNombreCapa(data.tituloPlan || 'Plan de Pavimentación Lanús');
      toast.success(
        `¡Geocodificación completada! ${data.itemsGeocodificados} de ${data.itemsTotal} ubicados con éxito.`,
        { id: toastId }
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al procesar el reporte', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGuardarComoCapaOficial = async () => {
    if (!resultado?.geojson || resultado.geojson.features.length === 0) {
      toast.error('No hay geometrías para guardar');
      return;
    }

    if (!nombreCapa.trim()) {
      toast.error('Indique un nombre para la capa');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Publicando capa en la base de datos municipal...');

    try {
      const token = await getIdToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Buscar o crear grupo "Obras Públicas y Pavimentación"
      let grupoId: string | null = null;
      try {
        const resGrupos = await fetch('/api/grupos');
        if (resGrupos.ok) {
          const grupos = await resGrupos.json();
          const g = grupos.find((item: any) => 
            item.nombre.toLowerCase().includes('obras') || item.nombre.toLowerCase().includes('paviment')
          );
          if (g) grupoId = g.id;
        }
      } catch {}

      const res = await fetch('/api/capas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: nombreCapa.trim(),
          type: 'geojson',
          color: '#ea580c',
          icono: 'AlertTriangle',
          grupoId,
          geoData: resultado.geojson,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error guardando capa');
      }

      emitirCambioMapa('capas');
      toast.success(`🎉 ¡Capa "${nombreCapa}" publicada exitosamente en el GIS!`, { id: toastId });

      if (onImportadoExitoso) {
        onImportadoExitoso(resultado.geojson, nombreCapa);
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al publicar la capa', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDescargarGeoJSON = () => {
    if (!resultado?.geojson) return;
    const blob = new Blob([JSON.stringify(resultado.geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nombreCapa.toLowerCase().replace(/\s+/g, '_')}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('GeoJSON descargado con éxito');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '900px',
        maxWidth: '100%',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Encabezado */}
        <div style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#38bdf8', padding: '6px', borderRadius: '8px', color: '#0f172a' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Importador Inteligente de Planes de Obras y Pavimentación
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Pega el reporte semanal en texto y geocodifica automáticamente todos los puntos y cuadras de Lanús
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {!resultado ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Texto del Reporte o Parte Semanal:
                </label>
                <button
                  type="button"
                  onClick={() => setTexto(DEFAULT_SAMPLE_TEXT)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cargar texto de ejemplo
                </button>
              </div>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Pegue aquí el texto recibido por WhatsApp, Word o Correo con las empresas y calles..."
                rows={12}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  background: '#f8fafc',
                  resize: 'vertical',
                }}
              />

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleProcesar}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Analizar & Georreferenciar Automáticamente
                </button>
              </div>
            </div>
          ) : (
            /* Vista de Resultados y Confirmación */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Tarjeta de métricas */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '14px 18px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#22c55e', color: '#fff', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#166534' }}>
                      {resultado.itemsGeocodificados} de {resultado.itemsTotal} obras georreferenciadas con éxito en Lanús
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: '#15803d' }}>
                      Se calcularon bocacalles exactas y tramos lineales entre esquinas.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setResultado(null)}
                  style={{
                    background: '#fff',
                    border: '1px solid #86efac',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#15803d',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RefreshCw size={12} /> Modificar texto
                </button>
              </div>

              {/* Lista previa de elementos */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Detalle de Puntos y Cuadras Detectadas:
                </span>
                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                  {resultado.geojson.features.map((f: any, idx: number) => {
                    const p = f.properties;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                              {p.nombre}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#475569', fontWeight: 600 }}>
                                {p.empresa}
                              </span>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>
                                {p.zona} · {p.tipoMaterial}
                              </span>
                              {p.observaciones && (
                                <span style={{ fontSize: '10px', color: '#0284c7', fontStyle: 'italic' }}>
                                  ({p.observaciones})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: p.tipoForma === 'tramo' ? '#eff6ff' : '#fef2f2',
                          color: p.tipoForma === 'tramo' ? '#1d4ed8' : '#b91c1c',
                        }}>
                          {p.tipoForma === 'tramo' ? 'Cuadra / Tramo' : 'Cruce / Esquina'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulario de Guardado como Capa */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Nombre de la Capa Oficial para el GIS:
                </label>
                <input
                  type="text"
                  value={nombreCapa}
                  onChange={(e) => setNombreCapa(e.target.value)}
                  placeholder="Ej: Plan Pavimentación 19/10 al 23/10"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                    marginBottom: '12px',
                  }}
                />

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleDescargarGeoJSON}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#334155',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Download size={14} /> Descargar GeoJSON
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleGuardarComoCapaOficial}
                    style={{
                      flex: 2,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#16a34a',
                      color: '#fff',
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
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Publicar como Capa Oficial en el GIS
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
