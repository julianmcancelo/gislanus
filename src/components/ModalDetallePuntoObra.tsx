'use client';
import React, { useState, useEffect } from 'react';
import { X, Bus, AlertTriangle, ArrowRight, Compass, ShieldAlert, CheckCircle2, Navigation, Layers } from 'lucide-react';
import { normalizeLineNumber } from '@/utils/transportUtils';

interface LineaImpacto {
  id: string;
  nombre: string;
  numero: string;
  color: string;
  categoria: string;
  ramal: string;
  sentido: string;
  distanciaMetros: number;
  esDirecta: boolean;
  datosGeo?: any;
}

interface ModalDetallePuntoObraProps {
  isOpen: boolean;
  onClose: () => void;
  elemento: any | null;
  onTrazarDesvio?: (coords: [number, number], nombre: string) => void;
}

export default function ModalDetallePuntoObra({
  isOpen,
  onClose,
  elemento,
  onTrazarDesvio,
}: ModalDetallePuntoObraProps) {
  const [loading, setLoading] = useState(false);
  const [lineasDirectas, setLineasDirectas] = useState<LineaImpacto[]>([]);
  const [lineasCercanas, setLineasCercanas] = useState<LineaImpacto[]>([]);
  const [coordsPunto, setCoordsPunto] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!isOpen || !elemento) {
      setLineasDirectas([]);
      setLineasCercanas([]);
      setCoordsPunto(null);
      return;
    }

    // Extraer coordenadas del elemento [lng, lat] o geometry
    const geo = elemento.geo;
    let lat: number | null = null;
    let lng: number | null = null;

    if (geo?.geometry?.type === 'Point' && Array.isArray(geo.geometry.coordinates)) {
      lng = geo.geometry.coordinates[0];
      lat = geo.geometry.coordinates[1];
    } else if (geo?.type === 'Point' && Array.isArray(geo.coordinates)) {
      lng = geo.coordinates[0];
      lat = geo.coordinates[1];
    } else if (elemento.layer && typeof elemento.layer.getLatLng === 'function') {
      const ll = elemento.layer.getLatLng();
      lat = ll.lat;
      lng = ll.lng;
    }

    if (lat !== null && lng !== null) {
      setCoordsPunto([lat, lng]);
      analizarImpacto(lat, lng);
    }
  }, [isOpen, elemento]);

  const analizarImpacto = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/obras/analizar-proximidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          radioDirectoMetros: 35,
          radioMaxMetros: 220,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLineasDirectas(data.directas || []);
        setLineasCercanas(data.cercanas || []);
      }
    } catch (e) {
      console.error('Error al analizar proximidad de líneas:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !elemento) return null;

  const props = elemento.geo?.properties || {};
  const nombreObra = elemento.nombre || props.nombre || props.name || 'Punto de Bacheo / Pavimentación';
  const empresa = props.empresa || 'No especificada';
  const zona = props.zona || '';
  const tipoMaterial = props.tipoMaterial || '';
  const observaciones = props.observaciones || props.descripcionOriginal || elemento.descripcion || '';
  const colorEmpresa = elemento.color || '#ea580c';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '18px 22px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: `4px solid ${colorEmpresa}`,
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: colorEmpresa,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                flexShrink: 0,
              }}
            >
              🚧
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#94a3b8' }}>
                  Punto de Intervención Vial · Lanús
                </span>
                {empresa && empresa !== 'No especificada' && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      background: 'rgba(255, 255, 255, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      color: '#f8fafc',
                    }}
                  >
                    {empresa}
                  </span>
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.25 }}>
                {nombreObra}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Ficha técnica del punto */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                Zona
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                {zona || 'Lanús'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                Tipo de Trabajo / Material
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                {tipoMaterial || 'Bacheo / Pavimento'}
              </span>
            </div>
            {coordsPunto && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                  Coordenadas GPS (WGS84)
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
                  {coordsPunto[0].toFixed(5)}, {coordsPunto[1].toFixed(5)}
                </span>
              </div>
            )}
            {observaciones && (
              <div style={{ gridColumn: 'span 2', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '8px 10px', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Detalle / Observaciones Técnicas
                </span>
                <p style={{ margin: 0, fontSize: '12px', color: '#334155', fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{observaciones}"
                </p>
              </div>
            )}
          </div>

          {/* ANÁLISIS DE TRANSPORTE Y LÍNEAS AFECTADAS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bus size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  Impacto en Líneas de Transporte Público
                </h3>
              </div>
              {loading && (
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Analizando trazas...
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  Calculando intersecciones con la red vial de Lanús...
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Cruzando trazas de líneas Municipales, Provinciales y Nacionales
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* 1. LÍNEAS QUE PASAN DIRECTO POR ESTE PUNTO */}
                <div style={{ border: '1px solid #fee2e2', background: '#fef2f2', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={16} color="#dc2626" />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>
                        Pasan sobre este punto / cruce directo ({lineasDirectas.length})
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>
                      Corte total de recorrido
                    </span>
                  </div>

                  {lineasDirectas.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '12px', color: '#991b1b', fontStyle: 'italic' }}>
                      Ninguna línea de colectivo tiene traza directa sobre esta coordenada exacta.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {lineasDirectas.map((linea) => {
                        const num = linea.numero || normalizeLineNumber(linea.nombre);
                        const isVuelta = linea.sentido === 'VUELTA' || linea.nombre.toLowerCase().includes('vuelta');
                        return (
                          <div
                            key={linea.id}
                            style={{
                              background: '#ffffff',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              border: '1px solid #fecaca',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  background: linea.color || '#dc2626',
                                  color: '#fff',
                                  fontWeight: 900,
                                  fontSize: '12px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  minWidth: '36px',
                                  textAlign: 'center',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                              >
                                {num ? `L.${num}` : 'LÍNEA'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                                  {linea.nombre}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {linea.ramal} · {isVuelta ? 'Vuelta ╌' : 'Ida —'} ({linea.categoria})
                                </span>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626' }}>
                                {linea.distanciaMetros <= 5 ? 'En el punto' : `a ${linea.distanciaMetros}m`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. LÍNEAS QUE PASAN CERCA O CHOCAN EN BOCACALLE (< 200m) */}
                <div style={{ border: '1px solid #fef3c7', background: '#fffbeb', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={16} color="#d97706" />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                        Pasan cerca / Bocacalle contigua ({lineasCercanas.length})
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                      Radio &lt; 200m
                    </span>
                  </div>

                  {lineasCercanas.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '12px', color: '#92400e', fontStyle: 'italic' }}>
                      No se registraron líneas pasando por las cuadras inmediatas a esta obra.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {lineasCercanas.map((linea) => {
                        const num = linea.numero || normalizeLineNumber(linea.nombre);
                        const isVuelta = linea.sentido === 'VUELTA' || linea.nombre.toLowerCase().includes('vuelta');
                        return (
                          <div
                            key={linea.id}
                            style={{
                              background: '#ffffff',
                              borderRadius: '8px',
                              padding: '7px 10px',
                              border: '1px solid #fde68a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  background: linea.color || '#d97706',
                                  color: '#fff',
                                  fontWeight: 800,
                                  fontSize: '11px',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  minWidth: '32px',
                                  textAlign: 'center',
                                }}
                              >
                                {num ? `L.${num}` : 'L.'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b' }}>
                                  {linea.nombre}
                                </span>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>
                                  {linea.ramal} · {isVuelta ? 'Vuelta' : 'Ida'}
                                </span>
                              </div>
                            </div>

                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>
                              a {linea.distanciaMetros}m
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Footer con acciones */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Lanús Gobierno · Dirección General de Tránsito y Transporte
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {coordsPunto && onTrazarDesvio && (
              <button
                type="button"
                onClick={() => {
                  onTrazarDesvio(coordsPunto, nombreObra);
                  onClose();
                }}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Navigation size={14} />
                Planificar Desvío Vial
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
