'use client';
import React, { useState } from 'react';
import { Printer, X, Download, FileText, CheckCircle2, Loader2, MapPin } from 'lucide-react';
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
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [numSegmentos, setNumSegmentos] = useState<number>(6);
  const [incluirVistaGeneral, setIncluirVistaGeneral] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string>('');
  const [captures, setCaptures] = useState<{ title: string; dataUrl: string }[]>([]);

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

  // Capturar pantalla por tramos secuencialmente
  const handleGenerateAtlasPDF = async () => {
    if (!mapInstance) {
      alert('El mapa no está listo.');
      return;
    }

    const allCoords = getLineCoordinates();
    if (allCoords.length === 0) {
      alert('No se encontraron coordenadas trazadas para esta línea.');
      return;
    }

    setIsGenerating(true);
    setCaptures([]);

    const mapElement = mapInstance.getContainer();
    const totalPts = allCoords.length;
    const stepSize = Math.max(1, Math.floor(totalPts / numSegmentos));

    const generatedCaptures: { title: string; dataUrl: string }[] = [];

    try {
      // Helper para esperar a que los tiles de Leaflet se hayan cargado
      const waitForMapTiles = async () => {
        mapInstance.invalidateSize({ animate: false });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // Esperar a que no queden imágenes cargando en el contenedor del mapa
        const images = mapElement.querySelectorAll('img');
        const pendingImages = Array.from(images).filter((img) => !img.complete);
        if (pendingImages.length > 0) {
          await Promise.all(
            pendingImages.map(
              (img) =>
                new Promise((res) => {
                  img.onload = res;
                  img.onerror = res;
                  setTimeout(res, 2000); // timeout máximo de seguridad de 2s por tile
                })
            )
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      };

      const captureOptions = {
        useCORS: true,
        allowTaint: false,
        scale: 2, // Mayor resolución para evitar borrosidad
        logging: false,
        ignoreElements: (el: Element) => {
          if (
            el.classList.contains('map-search-box') ||
            el.classList.contains('leaflet-control-container') ||
            el.classList.contains('hide-on-print') ||
            el.classList.contains('leaflet-popup') ||
            el.tagName === 'HEADER'
          ) {
            return true;
          }
          return false;
        },
      };

      // 1. Vista General opcional
      if (incluirVistaGeneral) {
        setPrintStatus('Procesando Lámina 1: Vista General de Lanús...');
        const fullBounds = L.latLngBounds(allCoords);
        mapInstance.fitBounds(fullBounds, { padding: [40, 40], animate: false });
        await waitForMapTiles();

        const canvas = await html2canvas(mapElement, captureOptions);
        generatedCaptures.push({
          title: `${lineaNombre} - Vista General Lanús`,
          dataUrl: canvas.toDataURL('image/png'),
        });
      }

      // 2. Tramo por tramo con encuadre exacto del segmento
      for (let i = 0; i < numSegmentos; i++) {
        setPrintStatus(`Procesando Tramo ${i + 1} de ${numSegmentos}...`);
        const startIndex = i * stepSize;
        const endIndex = i === numSegmentos - 1 ? totalPts - 1 : Math.min(totalPts - 1, (i + 1) * stepSize);
        const segmentPts = allCoords.slice(startIndex, endIndex + 1);

        if (segmentPts.length > 0) {
          const bounds = L.latLngBounds(segmentPts);
          // Usar fitBounds en lugar de setView para que el tramo quede perfectamente centrado y visible
          mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: zoomLevel, animate: false });
          await waitForMapTiles();

          const canvas = await html2canvas(mapElement, captureOptions);
          generatedCaptures.push({
            title: `${lineaNombre} - Tramo ${i + 1}/${numSegmentos}`,
            dataUrl: canvas.toDataURL('image/png'),
          });
        }
      }

      setCaptures(generatedCaptures);
      setPrintStatus('Generando documento PDF multipágina...');

      // 3. Ensamblar documento PDF en formato A4 Horizontal
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      generatedCaptures.forEach((item, index) => {
        if (index > 0) pdf.addPage();
        pdf.addImage(item.dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

        // Membrete impreso institucional en el PDF
        pdf.setFillColor(15, 23, 42); // #0f172a
        pdf.rect(10, 10, 140, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.text(`MUNICIPALIDAD DE LANÚS - GIS PORTAL`, 14, 16);
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${item.title} | Hoja ${index + 1} de ${generatedCaptures.length}`, 14, 23);
      });

      const pdfBlobUrl = pdf.output('bloburl');
      pdf.save(`Atlas_Recorrido_${lineaNombre.replace(/\s+/g, '_')}.pdf`);

      // Abrir automáticamente la ventana de impresión nativa con el PDF cargado
      const printWindow = window.open(pdfBlobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      setPrintStatus('¡Atlas PDF generado, descargado y enviado a imprimir con éxito!');
    } catch (err: any) {
      console.error('Error al generar atlas de capturas:', err);
      alert('Hubo un error al generar las capturas.');
    } finally {
      setIsGenerating(false);
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
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
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
          borderRadius: '18px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Modal Header */}
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
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Printer size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                Generador de Atlas Tramo por Tramo
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                {lineaNombre} • {totalRamales} ramal(es) georreferenciado(s)
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

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Opción 1: Número de tramos */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
              Cantidad de hojas / capturas en el único PDF:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
              {[4, 8, 12, 16, 20, 30].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumSegmentos(num)}
                  disabled={isGenerating}
                  style={{
                    padding: '8px 2px',
                    borderRadius: '10px',
                    border: numSegmentos === num ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: numSegmentos === num ? '#eff6ff' : '#f8fafc',
                    color: numSegmentos === num ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {num} Págs
                </button>
              ))}
            </div>
          </div>

          {/* Opción 2: Nivel de zoom */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
              Nivel de zoom por tramo:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: 'Detallado (Calles)', val: 17 },
                { label: 'Medio (Barrios)', val: 16 },
                { label: 'Amplio (Zonal)', val: 15 },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setZoomLevel(item.val)}
                  disabled={isGenerating}
                  style={{
                    flex: 1,
                    padding: '9px 8px',
                    borderRadius: '8px',
                    border: zoomLevel === item.val ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: zoomLevel === item.val ? '#eff6ff' : '#fff',
                    color: zoomLevel === item.val ? '#1d4ed8' : '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Checkbox Vista General */}
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
              disabled={isGenerating}
              style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
              Incluir lámina 1 con la vista panorámica completa
            </span>
          </label>

          {/* Estado del procesamiento */}
          {isGenerating && (
            <div
              style={{
                padding: '14px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                color: '#1d4ed8',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Loader2 className="animate-spin" size={18} />
              <span>{printStatus}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
            onClick={handleGenerateAtlasPDF}
            disabled={isGenerating}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              background: isGenerating ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            {isGenerating ? 'Capturando pantallas...' : `Exportar Atlas PDF (${numSegmentos} Hojas)`}
          </button>
        </div>
      </div>
    </div>
  );
}
