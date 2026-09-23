'use client';
import React, { useState } from 'react';
import { Printer, X, Download, Loader2, Sparkles } from 'lucide-react';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const [ramalesSeleccionados, setRamalesSeleccionados] = useState<string[]>([]);
  const [modoVarita, setModoVarita] = useState<boolean>(false);
  const [paperFormat, setPaperFormat] = useState<'A4' | 'A3' | 'A2' | 'A1' | 'A0'>('A4');
  const [orientacion, setOrientacion] = useState<'landscape' | 'portrait'>('landscape');
  const [renderScale, setRenderScale] = useState<number>(3); // 2: Standard, 3: HD, 4: Ultra HD
  const [modoEncuadre, setModoEncuadre] = useState<'exacto' | 'autofit'>('exacto'); // 'exacto': tal cual se ve en pantalla, 'autofit': centrar en trazos
  const [incluirCuadricula, setIncluirCuadricula] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string>('');

  // Sincronizar ramales seleccionados cada vez que se abre el modal
  React.useEffect(() => {
    if (isOpen) {
      setModoVarita(false);
      if (capasLinea && capasLinea.length > 0) {
        setRamalesSeleccionados(capasLinea.map((c) => c.id));
      }
    }
  }, [isOpen, capasLinea]);

  const getLayerFeatureSegments = (capa: any) => {
    const geo = cacheDatosGeo[capa.id] || capa.datosGeo;
    if (!geo) return [];
    const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
    const segments: { nombre: string; coords: [number, number][] }[] = [];

    features.forEach((f: any, idx: number) => {
      if (!f || !f.geometry) return;
      const type = f.geometry.type;
      const geomCoords = f.geometry.coordinates;
      const featCoords: [number, number][] = [];

      if (type === 'LineString' && Array.isArray(geomCoords)) {
        geomCoords.forEach((pt: [number, number]) => {
          if (pt && pt.length >= 2) featCoords.push([pt[1], pt[0]]);
        });
      } else if (type === 'MultiLineString' && Array.isArray(geomCoords)) {
        geomCoords.forEach((line: [number, number][]) => {
          if (Array.isArray(line)) {
            line.forEach((pt: [number, number]) => {
              if (pt && pt.length >= 2) featCoords.push([pt[1], pt[0]]);
            });
          }
        });
      }

      if (featCoords.length > 0) {
        segments.push({
          nombre: `${capa.nombre}${features.length > 1 ? ` (Tramo ${idx + 1})` : ''}`,
          coords: featCoords,
        });
      }
    });

    return segments;
  };

  // Varita Mágica de selección por clic directo en mapa
  React.useEffect(() => {
    if (!isOpen || !mapInstance || !modoVarita) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const clickPt = e.latlng;
      let minDistance = Infinity;
      let closestCapaId: string | null = null;

      capasLinea.forEach((c) => {
        const segs = getLayerFeatureSegments(c);
        segs.forEach((s) => {
          s.coords.forEach((coord) => {
            const dist = mapInstance.distance(clickPt, L.latLng(coord[0], coord[1]));
            if (dist < minDistance) {
              minDistance = dist;
              closestCapaId = c.id;
            }
          });
        });
      });

      if (closestCapaId && minDistance < 300) {
        setRamalesSeleccionados((prev) =>
          prev.includes(closestCapaId!)
            ? prev.filter((id) => id !== closestCapaId)
            : [...prev, closestCapaId!]
        );
      }
    };

    mapInstance.on('click', handleMapClick);
    return () => {
      mapInstance.off('click', handleMapClick);
    };
  }, [isOpen, mapInstance, modoVarita, capasLinea, cacheDatosGeo]);

  if (!isOpen) return null;

  const capasFiltradas = capasLinea.filter((c) => ramalesSeleccionados.includes(c.id));

  const getAllCoordinates = (): [number, number][] => {
    const allCoords: [number, number][] = [];
    capasFiltradas.forEach((c) => {
      const segs = getLayerFeatureSegments(c);
      segs.forEach((s) => allCoords.push(...s.coords));
    });
    return allCoords;
  };

  // Generar Impresión Directa en 1 sola Hoja HD
  const handleGeneratePrint = async () => {
    if (!mapInstance) {
      alert('El mapa no está listo.');
      return;
    }

    const allCoords = getAllCoordinates();
    if (allCoords.length === 0) {
      alert('Seleccioná al menos 1 ramal o trazo para imprimir.');
      return;
    }

    setIsGenerating(true);
    setPrintStatus('Enfocando trazos seleccionados en el mapa...');

    try {
      const mapElement = mapInstance.getContainer();

      // Si se eligió 'autofit', centrar el mapa en los trazos; si es 'exacto', mantener la vista que eligió el usuario
      if (modoEncuadre === 'autofit') {
        const fullBounds = L.latLngBounds(allCoords);
        mapInstance.fitBounds(fullBounds, { padding: [50, 50], animate: false });
      }

      // Esperar descarga limpia de las imágenes/tiles de Mapbox/OpenStreetMap
      mapInstance.invalidateSize({ animate: false });
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const images = mapElement.querySelectorAll('img');
      const pendingImages = Array.from(images).filter((img) => !img.complete);
      if (pendingImages.length > 0) {
        await Promise.all(
          pendingImages.map(
            (img) =>
              new Promise((res) => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 2000);
              })
          )
        );
      }

      setPrintStatus('Capturando vista en alta definición HD...');

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: false,
        scale: renderScale,
        logging: false,
        ignoreElements: (el: Element) => {
          return (
            el.classList.contains('map-search-box') ||
            el.classList.contains('leaflet-control-container') ||
            el.classList.contains('hide-on-print') ||
            el.classList.contains('leaflet-popup') ||
            el.tagName === 'HEADER'
          );
        },
      });

      setPrintStatus('Compilando hoja PDF profesional...');

      const isLandscape = orientacion === 'landscape';
      const pdf = new jsPDF({
        orientation: orientacion,
        unit: 'mm',
        format: paperFormat.toLowerCase() as any,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      // 1. Imagen del mapa en alta resolución cubriendo toda la hoja manteniendo la proporción exacta
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      // 2. Cuadrícula cartográfica opcional estilo profesional
      if (incluirCuadricula) {
        pdf.setDrawColor(30, 41, 59);
        pdf.setLineWidth(0.2);
        const numCols = 4;
        const numRows = 3;
        const colWidth = pdfWidth / numCols;
        const rowHeight = pdfHeight / numRows;

        for (let c = 1; c < numCols; c++) {
          pdf.line(c * colWidth, 0, c * colWidth, pdfHeight);
        }
        for (let r = 1; r < numRows; r++) {
          pdf.line(0, r * rowHeight, pdfWidth, r * rowHeight);
        }
      }

      // 3. Encabezado institucional pro
      pdf.setFillColor(15, 23, 42); // #0f172a
      pdf.rect(8, 8, isLandscape ? 170 : 145, 18, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.text(`MUNICIPALIDAD DE LANÚS — PLANO Y TRAZADO CARTOGRÁFICO`, 12, 15);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`${lineaNombre.toUpperCase()} • ${capasFiltradas.length} TRAZO(S) INCLUIDO(S)`, 12, 21);

      // 4. Pie de página institucional
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(8, pdfHeight - 16, isLandscape ? 190 : 165, 10, 'FD');

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(`IMPRESIÓN OFICIAL HD — HOJA ${paperFormat} (${orientacion.toUpperCase()})`, 12, pdfHeight - 10);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Lanús Gobierno • Secretaría de Movilidad y Transporte`, 12, pdfHeight - 6);

      const pdfBlobUrl = pdf.output('bloburl');
      pdf.save(`Impresion_Seleccion_${lineaNombre.replace(/\s+/g, '_')}_${paperFormat}.pdf`);

      const printWindow = window.open(pdfBlobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => printWindow.print();
      }

      setPrintStatus('¡Plano impreso y descargado con éxito!');
    } catch (err) {
      console.error('Error al generar impresión:', err);
      alert('Error al generar la impresión.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="hide-on-print"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: modoVarita ? 'rgba(15, 23, 42, 0.35)' : 'rgba(15, 23, 42, 0.8)',
        backdropFilter: modoVarita ? 'none' : 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Inter', system-ui, sans-serif",
        pointerEvents: modoVarita ? 'none' : 'auto',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          pointerEvents: 'auto',
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Printer size={22} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                Impresión Inteligente por Selección
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                1 Hoja Directa • {capasFiltradas.length} de {capasLinea.length} trazos marcados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo Principal Unificado */}
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Varita mágica banner */}
          <div
            style={{
              background: modoVarita ? '#f0fdf4' : '#eff6ff',
              border: modoVarita ? '1.5px solid #86efac' : '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} color={modoVarita ? '#16a34a' : '#2563eb'} />
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: modoVarita ? '#166534' : '#1d4ed8', display: 'block' }}>
                  {modoVarita ? '¡Selección por Clic Activa!' : 'Varita Mágica de Mapa'}
                </span>
                <span style={{ fontSize: '0.75rem', color: modoVarita ? '#15803d' : '#3b82f6' }}>
                  {modoVarita ? 'Tocá cualquier trazo en el mapa para sumarlo/quitarlo' : 'Hacé clic en el mapa o elegí en la lista'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModoVarita(!modoVarita)}
              style={{
                background: modoVarita ? '#16a34a' : '#2563eb',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {modoVarita ? '✓ Seleccionando' : 'Activar Clic'}
            </button>
          </div>

          {/* Formato de Hojas A0-A4 */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
              📄 Formato de Papel:
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['A4', 'A3', 'A2', 'A1', 'A0'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setPaperFormat(fmt as any)}
                  style={{
                    flex: 1,
                    padding: '8px 2px',
                    borderRadius: '8px',
                    border: paperFormat === fmt ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: paperFormat === fmt ? '#eff6ff' : '#fff',
                    color: paperFormat === fmt ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Hoja {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Encuadre del Plano */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
              🎯 Encuadre del Plano:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: '🎯 Vista Pantalla Exacta (Tal cual se ve)', val: 'exacto' },
                { label: '📐 Auto-Centrar en Trazos Elegidos', val: 'autofit' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setModoEncuadre(item.val as any)}
                  style={{
                    flex: 1,
                    padding: '8px 6px',
                    borderRadius: '8px',
                    border: modoEncuadre === item.val ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: modoEncuadre === item.val ? '#eff6ff' : '#fff',
                    color: modoEncuadre === item.val ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calidad y Orientación */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                📐 Orientación:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { label: 'Horizontal', val: 'landscape' },
                  { label: 'Vertical', val: 'portrait' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setOrientacion(item.val as any)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: orientacion === item.val ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: orientacion === item.val ? '#eff6ff' : '#fff',
                      color: orientacion === item.val ? '#1d4ed8' : '#64748b',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                🔍 Resolución / Calidad:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { label: 'Alta (3x)', val: 3 },
                  { label: 'Ultra (4x)', val: 4 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setRenderScale(item.val)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: renderScale === item.val ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: renderScale === item.val ? '#eff6ff' : '#fff',
                      color: renderScale === item.val ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de Trazos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                🗺️ Trazos y Ramales Seleccionados:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRamalesSeleccionados(capasLinea.map((c) => c.id))}
                  style={{ background: '#eff6ff', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setRamalesSeleccionados([])}
                  style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}
                >
                  Ninguno
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
              {capasLinea.map((capa) => {
                const isChecked = ramalesSeleccionados.includes(capa.id);
                return (
                  <label
                    key={capa.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isChecked ? '#f0f6ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRamalesSeleccionados([...ramalesSeleccionados, capa.id]);
                          } else {
                            setRamalesSeleccionados(ramalesSeleccionados.filter((id) => id !== capa.id));
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                          {capa.subGrupo?.nombre ? `${capa.subGrupo.nombre} - ` : ''}{capa.nombre}
                        </span>
                        {capa.grupo?.nombre && (
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {capa.grupo.nombre}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: capa.color || '#2563eb' }} />
                  </label>
                );
              })}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={incluirCuadricula} onChange={(e) => setIncluirCuadricula(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#2563eb' }} />
            <span style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 600 }}>
              Incluir grilla de coordenadas cartográficas profesionales
            </span>
          </label>

          {isGenerating && (
            <div style={{ padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', color: '#1d4ed8', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 className="animate-spin" size={18} />
              <span>{printStatus}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            background: '#fafbfd',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGeneratePrint}
            disabled={isGenerating || capasFiltradas.length === 0}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              background: isGenerating || capasFiltradas.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isGenerating || capasFiltradas.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            {isGenerating ? 'Generando Plano...' : `Imprimir Selección en 1 Hoja (${paperFormat})`}
          </button>
        </div>
      </div>
    </div>
  );
}
