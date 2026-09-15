'use client';
import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import L from 'leaflet';

interface MapPrintAtlasModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineaNombre: string;
  capasLinea: any[];
  cacheDatosGeo: Record<string, any>;
  mapInstance: L.Map | null;
}

export default function MapPrintAtlasModal({
  isOpen,
  onClose,
  lineaNombre,
  capasLinea,
  cacheDatosGeo,
  mapInstance,
}: MapPrintAtlasModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [numSegmentos, setNumSegmentos] = useState<number>(4);
  const [incluirVistaGeneral, setIncluirVistaGeneral] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string>('');

  if (!isOpen) return null;

  const getLineCoordinates = (): [number, number][] => {
    const coords: [number, number][] = [];
    capasLinea.forEach((c) => {
      const geo = cacheDatosGeo[c.id] || c.datosGeo;
      if (!geo) return;
      const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
      features.forEach((f: any) => {
        if (!f || !f.geometry) return;
        const type = f.geometry.type;
        const geomCoords = f.geometry.coordinates;

        if (type === 'LineString' && Array.isArray(geomCoords)) {
          geomCoords.forEach((pt: [number, number]) => {
            if (pt && pt.length >= 2) coords.push([pt[1], pt[0]]);
          });
        } else if (type === 'MultiLineString' && Array.isArray(geomCoords)) {
          geomCoords.forEach((line: [number, number][]) => {
            if (Array.isArray(line)) {
              line.forEach((pt: [number, number]) => {
                if (pt && pt.length >= 2) coords.push([pt[1], pt[0]]);
              });
            }
          });
        }
      });
    });
    return coords;
  };

  const handleStartAtlasPrint = async () => {
    if (!mapInstance) {
      alert('El mapa no está listo todavía.');
      return;
    }

    const allCoords = getLineCoordinates();
    if (allCoords.length === 0) {
      alert('No se encontraron coordenadas trazadas para esta línea.');
      return;
    }

    setIsGenerating(true);

    try {
      setPrintStatus('Enfocando trazado de la línea...');
      const fullBounds = L.latLngBounds(allCoords);
      mapInstance.fitBounds(fullBounds, { padding: [50, 50] });
      await new Promise((resolve) => setTimeout(resolve, 600));

      setPrintStatus('Abriendo diálogo de impresión...');
      setIsGenerating(false);

      setTimeout(() => {
        window.print();
        onClose();
      }, 200);
    } catch (err: any) {
      console.error('Error al preparar la impresión:', err);
      setIsGenerating(false);
      alert('Error durante la preparación de la impresión.');
    }
  };

  const totalRamales = capasLinea.length;

  return (
    <div
      className="hide-on-print"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Printer size={18} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                Imprimir Atlas de Recorrido Tramo por Tramo
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                {lineaNombre} ({totalRamales} ramal/es)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
              Dividir recorrido en tramos con zoom detallado:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[2, 3, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumSegmentos(num)}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: numSegmentos === num ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: numSegmentos === num ? '#eff6ff' : '#f8fafc',
                    color: numSegmentos === num ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {num} Tramos
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
              Nivel de zoom por tramo:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: 'Cercano (Calles)', val: 17 },
                { label: 'Medio (Barrios)', val: 16 },
                { label: 'Amplio (Zonal)', val: 15 },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setZoomLevel(item.val)}
                  style={{
                    flex: 1,
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: zoomLevel === item.val ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: zoomLevel === item.val ? '#eff6ff' : '#fff',
                    color: zoomLevel === item.val ? '#1d4ed8' : '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={incluirVistaGeneral}
              onChange={(e) => setIncluirVistaGeneral(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
              Incluir lámina con vista general de Lanús
            </span>
          </label>

          {isGenerating && (
            <div
              style={{
                padding: '12px',
                background: '#eff6ff',
                borderRadius: '8px',
                color: '#1d4ed8',
                fontSize: '0.8rem',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {printStatus}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '16px 24px',
            background: '#fafbfd',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStartAtlasPrint}
            disabled={isGenerating}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            <Printer size={16} />
            {isGenerating ? 'Preparando...' : 'Generar Impresión Tramo a Tramo'}
          </button>
        </div>
      </div>
    </div>
  );
}
