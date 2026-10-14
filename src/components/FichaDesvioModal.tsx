import React from 'react';
import dynamic from 'next/dynamic';
import { X, Printer, Calendar, Clock, MapPin, Bus, AlertTriangle, ShieldCheck, QrCode } from 'lucide-react';

const StaticMapPreview = dynamic(() => import('@/components/StaticMapPreview'), {
  ssr: false,
  loading: () => <div style={{ height: '160px', width: '100%', background: '#f1f5f9', borderRadius: '8px' }} />
});

interface FichaDesvioModalProps {
  intervencion: any;
  onClose: () => void;
}

export default function FichaDesvioModal({ intervencion, onClose }: FichaDesvioModalProps) {
  if (!intervencion) return null;

  const handlePrint = () => {
    window.print();
  };

  const fechaInicioStr = new Date(intervencion.fechaInicio).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const fechaFinStr = intervencion.fechaFinEstimada 
    ? new Date(intervencion.fechaFinEstimada).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Hasta nuevo aviso / Fin de obra';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Barra de Acciones Superior (no se imprime) */}
        <div className="no-print" style={{
          padding: '12px 20px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
            Vista de Impresión Oficial · Planificación de Desvíos
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Printer size={15} />
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                padding: '6px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Hoja de Impresión A4 Formato Oficial */}
        <div style={{ padding: '36px 40px', overflowY: 'auto', flex: 1, color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
          
          {/* Encabezado Oficial Municipio */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '24px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', color: '#0f172a' }}>
                Municipio de Lanús
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Subsecretaría de Movilidad y Transporte · Dirección de Tránsito
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Área de Planificación de Redes y Desvíos Viales
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ 
                background: '#fef2f2', 
                color: '#dc2626', 
                border: '1px solid #fecaca', 
                padding: '4px 10px', 
                borderRadius: '6px', 
                fontSize: '12px', 
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}>
                {intervencion.codigo}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b' }}>
                Emisión: {new Date().toLocaleDateString('es-AR')}
              </p>
            </div>
          </div>

          {/* Título de la Intervención */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ 
              background: '#e0f2fe', 
              color: '#0369a1', 
              padding: '2px 8px', 
              borderRadius: '4px', 
              fontSize: '10px', 
              fontWeight: 800, 
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'inline-block',
              marginBottom: '6px'
            }}>
              {intervencion.tipo} · CORTE {intervencion.tipoCorte}
            </span>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
              {intervencion.titulo}
            </h1>
            {intervencion.motivo && (
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#475569' }}>
                {intervencion.motivo}
              </p>
            )}
          </div>

          {/* Fila de Datos Clave: Cuadrilla, Fechas, Ubicación */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '12px', 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            borderRadius: '10px', 
            padding: '14px',
            marginBottom: '24px'
          }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Calles Afectadas</span>
              <p style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                {intervencion.callesAfectadas || 'Ver demarcación en plano'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Vigencia</span>
              <p style={{ margin: '3px 0 0', fontSize: '11px', fontWeight: 600, color: '#1e293b' }}>
                Desde: {fechaInicioStr}<br />
                Hasta: {fechaFinStr}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Área Ejecutora</span>
              <p style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                {intervencion.areaResponsable || 'Secretaría de Obras / Tránsito'}
              </p>
            </div>
          </div>

          {/* Detalle de Líneas de Colectivo Afectadas y sus Desvíos */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 800, 
              color: '#0f172a', 
              textTransform: 'uppercase', 
              borderBottom: '1px solid #cbd5e1', 
              paddingBottom: '6px', 
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Bus size={16} color="#2563eb" />
              Líneas de Colectivo Afectadas & Esquema de Desvíos ({intervencion.desvios?.length || 0})
            </h3>

            {(!intervencion.desvios || intervencion.desvios.length === 0) ? (
              <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                No se registraron desvíos de transporte público para este corte.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {intervencion.desvios.map((d: any, idx: number) => (
                  <div key={d.id || idx} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    background: '#ffffff',
                    borderLeft: '4px solid #2563eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: '#1e293b',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          Línea {d.lineaNumero}
                        </span>
                        {d.ramal && (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            {d.ramal}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: d.sentido === 'VUELTA' ? '#e11d48' : '#0284c7',
                        background: d.sentido === 'VUELTA' ? '#ffe4e6' : '#e0f2fe',
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}>
                        Sentido: {d.sentido}
                      </span>
                    </div>

                    {/* Mini Mapa de la Traza del Desvío Provisorio */}
                    {d.datosGeoDesvio && (() => {
                      let parsedGeo = null;
                      try {
                        parsedGeo = typeof d.datosGeoDesvio === 'string' ? JSON.parse(d.datosGeoDesvio) : d.datosGeoDesvio;
                      } catch {}
                      if (!parsedGeo || (!parsedGeo.geometry && !parsedGeo.coordinates && !parsedGeo.features)) return null;

                      return (
                        <div style={{ marginTop: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            🗺️ Mapa de la Traza del Desvío:
                          </span>
                          <StaticMapPreview
                            geoData={parsedGeo}
                            height="160px"
                            strokeColor={d.sentido === 'VUELTA' ? '#e11d48' : '#059669'}
                            strokeWeight={5}
                            interactive={false}
                          />
                        </div>
                      );
                    })()}

                    {d.callesDesvio && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          Itinerario Provisorio de Desvío:
                        </span>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
                          {d.callesDesvio}
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px', fontSize: '11px' }}>
                      {d.paradasAnuladas && (
                        <div style={{ background: '#fef2f2', padding: '6px 10px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                          <span style={{ fontWeight: 700, color: '#991b1b' }}>🚫 Paradas Anuladas:</span>
                          <p style={{ margin: '2px 0 0', color: '#7f1d1d' }}>{d.paradasAnuladas}</p>
                        </div>
                      )}
                      {d.paradasProvisorias && (
                        <div style={{ background: '#f0fdf4', padding: '6px 10px', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                          <span style={{ fontWeight: 700, color: '#166534' }}>🚏 Paradas Provisorias:</span>
                          <p style={{ margin: '2px 0 0', color: '#14532d' }}>{d.paradasProvisorias}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pie de Página / Validez Legal */}
          <div style={{ 
            marginTop: '30px', 
            paddingTop: '16px', 
            borderTop: '1px dashed #cbd5e1', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-end',
            fontSize: '10px',
            color: '#64748b'
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#334155' }}>
                COMUNICACIÓN OFICIAL VÁLIDA PARA INSPECTORES, EMPRESAS DE TRANSPORTE Y CONTROL DE TRÁNSITO
              </p>
              <p style={{ margin: '2px 0 0' }}>
                Sistema de Información Geográfica (GIS) · Municipio de Lanús
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '130px', borderBottom: '1px solid #94a3b8', marginBottom: '4px' }} />
              <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Firma Autorizada / Sello</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
