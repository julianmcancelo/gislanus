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
  const [step, setStep] = useState<number>(1);
  const [ramalesSeleccionados, setRamalesSeleccionados] = useState<string[]>(capasLinea.map(c => c.id));
  const [modoVarita, setModoVarita] = useState<boolean>(false);
  const [paperFormat, setPaperFormat] = useState<'A4' | 'A3' | 'A2'>('A4');
  const [zoomLevel, setZoomLevel] = useState<number>(16);
  const [numSegmentos, setNumSegmentos] = useState<number>(6);
  const [incluirVistaGeneral, setIncluirVistaGeneral] = useState<boolean>(true);
  const [incluirCuadricula, setIncluirCuadricula] = useState<boolean>(true);
  const [orientacion, setOrientacion] = useState<'landscape' | 'portrait'>('landscape');
  const [modoManual, setModoManual] = useState<boolean>(false);
  const [capturasManuales, setCapturasManuales] = useState<{ title: string; dataUrl: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string>('');
  const [captures, setCaptures] = useState<{ title: string; dataUrl: string }[]>([]);

  // Efecto para activar la Varita Mágica en el mapa
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

      // Si se hizo clic cerca de un trazo (menos de 250 metros)
      if (closestCapaId && minDistance < 250) {
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

  const getLayerFeatureSegments = (capa: any) => {
    const geo = cacheDatosGeo[capa.id] || capa.datosGeo;
    if (!geo) return [];
    const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
    const segments: { nombre: string; coords: [number, number][] }[] = [];

    features.forEach((f: any, idx: number) => {
      if (!f || !f.geometry) return;
      const type = f.geometry.type;
      const geomCoords = f.geometry.coordinates;
      const featName = f.properties?.nombre || f.properties?.name || f.properties?.RAMAL || capa.nombre;
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

  const capasFiltradas = capasLinea.filter((c) => ramalesSeleccionados.includes(c.id));

  const getAllCoordinates = (): [number, number][] => {
    const allCoords: [number, number][] = [];
    capasFiltradas.forEach((c) => {
      const segs = getLayerFeatureSegments(c);
      segs.forEach((s) => allCoords.push(...s.coords));
    });
    return allCoords;
  };

  // Capturar pantalla por tramos secuencialmente
  const handleGenerateAtlasPDF = async () => {
    if (!mapInstance) {
      alert('El mapa no está listo.');
      return;
    }

    const allCoords = getAllCoordinates();
    if (allCoords.length === 0) {
      alert('No se encontraron coordenadas trazadas para la selección.');
      return;
    }

    setIsGenerating(true);
    setCaptures([]);

    const mapElement = mapInstance.getContainer();
    const generatedCaptures: { title: string; dataUrl: string }[] = [];

    try {
      // Helper para esperar a que los tiles de Leaflet se hayan cargado
      const waitForMapTiles = async () => {
        mapInstance.invalidateSize({ animate: false });
        await new Promise((resolve) => setTimeout(resolve, 1500));
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
        await new Promise((resolve) => setTimeout(resolve, 500));
      };

      const captureOptions = {
        useCORS: true,
        allowTaint: false,
        scale: 2,
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

      // 2. Recorrer cada capa/ramal de la selección de forma independiente
      for (let cIdx = 0; cIdx < capasFiltradas.length; cIdx++) {
        const capaObj = capasFiltradas[cIdx];
        const segs = getLayerFeatureSegments(capaObj);

        for (let sIdx = 0; sIdx < segs.length; sIdx++) {
          const seg = segs[sIdx];
          const coords = seg.coords;
          const totalPts = coords.length;
          const stepSize = Math.max(1, Math.floor(totalPts / numSegmentos));

          for (let i = 0; i < numSegmentos; i++) {
            const currentStepNum = generatedCaptures.length + 1;
            setPrintStatus(`Procesando ${seg.nombre} - Sub-tramo ${i + 1} de ${numSegmentos}...`);

            const startIndex = i * stepSize;
            const endIndex = i === numSegmentos - 1 ? totalPts - 1 : Math.min(totalPts - 1, (i + 1) * stepSize);
            const segmentPts = coords.slice(startIndex, endIndex + 1);

            if (segmentPts.length > 0) {
              const bounds = L.latLngBounds(segmentPts);
              mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: zoomLevel, animate: false });
              await waitForMapTiles();

              const canvas = await html2canvas(mapElement, captureOptions);
              generatedCaptures.push({
                title: `${seg.nombre} - Tramo ${i + 1}/${numSegmentos}`,
                dataUrl: canvas.toDataURL('image/png'),
              });
            }
          }
        }
      }

      setCaptures(generatedCaptures);
      setPrintStatus('Generando documento PDF multipágina...');

      // 3. Ensamblar documento PDF en formato profesional tipo Nakarte / Field Papers
      const isLandscape = orientacion === 'landscape';
      const pdf = new jsPDF({ orientation: orientacion, unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      generatedCaptures.forEach((item, index) => {
        if (index > 0) pdf.addPage();

        // Calcular el aspecto original de la captura para no deformar/estirar el mapa
        const imgProps = pdf.getImageProperties(item.dataUrl);
        const imgAspect = imgProps.width / imgProps.height;
        const pageAspect = pdfWidth / pdfHeight;

        let renderW = pdfWidth;
        let renderH = pdfHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > pageAspect) {
          renderH = pdfWidth / imgAspect;
          offsetY = (pdfHeight - renderH) / 2;
        } else {
          renderW = pdfHeight * imgAspect;
          offsetX = (pdfWidth - renderW) / 2;
        }

        // Fondo y mapa principal sin deformaciones
        pdf.addImage(item.dataUrl, 'PNG', offsetX, offsetY, renderW, renderH);

        // Cuadrícula de coordenadas estilo Nakarte / Field Papers
        if (incluirCuadricula) {
          pdf.setDrawColor(30, 41, 59);
          pdf.setLineWidth(0.15);
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

        // Encabezado profesional institucional
        pdf.setFillColor(15, 23, 42); // #0f172a
        pdf.rect(8, 8, isLandscape ? 160 : 140, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(`MUNICIPALIDAD DE LANÚS — SISTEMA GIS / ATLAS DE RECORRIDOS`, 12, 15);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${item.title} | Hoja ${index + 1} de ${generatedCaptures.length}`, 12, 21);

        // Leyenda de escala e instrucciones en pie de página estilo Nakarte / Field Papers
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(8, pdfHeight - 16, isLandscape ? 180 : 160, 10, 'FD');

        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(`ESCALA ZOOM ${zoomLevel} — IMPRESIÓN OFICIAL CAMPO / RECORRIDO`, 12, pdfHeight - 10);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Lanús Gobierno • Trazado cartográfico de precisión`, 12, pdfHeight - 6);
      });

      const pdfBlobUrl = pdf.output('bloburl');
      pdf.save(`Atlas_Recorrido_${lineaNombre.replace(/\s+/g, '_')}.pdf`);

      const printWindow = window.open(pdfBlobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => printWindow.print();
      }

      setPrintStatus('¡Atlas PDF generado, descargado y enviado a imprimir con éxito!');
    } catch (err: any) {
      console.error('Error al generar atlas de capturas:', err);
      alert('Hubo un error al generar las capturas.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Capturar una foto manual de la vista actual del usuario en el mapa
  const handleTomarCapturaManual = async () => {
    if (!mapInstance) return;
    setIsGenerating(true);
    setPrintStatus('Capturando vista actual del mapa...');

    try {
      const mapElement = mapInstance.getContainer();
      mapInstance.invalidateSize({ animate: false });
      await new Promise((res) => setTimeout(res, 300));

      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
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

      const num = capturasManuales.length + 1;
      const dataUrl = canvas.toDataURL('image/png');
      setCapturasManuales((prev) => [
        ...prev,
        { title: `${lineaNombre} - Foto ${num}`, dataUrl },
      ]);
      setPrintStatus(`¡Foto ${num} agregada! Podés mover el mapa y sacar otra.`);
    } catch (err) {
      console.error('Error al tomar captura manual:', err);
      alert('Error al tomar foto.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBorrarCapturaManual = (index: number) => {
    setCapturasManuales((prev) => prev.filter((_, i) => i !== index));
  };

  // Ensamblar PDF de capturas manuales
  const handleExportarPDFManual = () => {
    if (capturasManuales.length === 0) {
      alert('Primero saca al menos 1 foto del mapa.');
      return;
    }

    setIsGenerating(true);
    setPrintStatus('Compilando PDF multipágina...');

    try {
      const isLandscape = orientacion === 'landscape';
      const pdf = new jsPDF({ orientation: orientacion, unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      capturasManuales.forEach((item, index) => {
        if (index > 0) pdf.addPage();
        pdf.addImage(item.dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

        if (incluirCuadricula) {
          pdf.setDrawColor(30, 41, 59);
          pdf.setLineWidth(0.15);
          const numCols = 4;
          const numRows = 3;
          const colWidth = pdfWidth / numCols;
          const rowHeight = pdfHeight / numRows;
          for (let c = 1; c < numCols; c++) pdf.line(c * colWidth, 0, c * colWidth, pdfHeight);
          for (let r = 1; r < numRows; r++) pdf.line(0, r * rowHeight, pdfWidth, r * rowHeight);
        }

        // Encabezado
        pdf.setFillColor(15, 23, 42);
        pdf.rect(8, 8, isLandscape ? 160 : 140, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(`MUNICIPALIDAD DE LANÚS — ATLAS DE RECORRIDOS`, 12, 15);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`${item.title} | Hoja ${index + 1} de ${capturasManuales.length}`, 12, 21);

        // Pie de página
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(8, pdfHeight - 16, isLandscape ? 180 : 160, 10, 'FD');
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(`IMPRESIÓN MANUAL DE CAPTURAS - CAPA: ${lineaNombre.toUpperCase()}`, 12, pdfHeight - 10);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Lanús Gobierno • Trazado cartográfico de precisión`, 12, pdfHeight - 6);
      });

      const pdfBlobUrl = pdf.output('bloburl');
      pdf.save(`Atlas_Manual_${lineaNombre.replace(/\s+/g, '_')}.pdf`);

      const printWindow = window.open(pdfBlobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => printWindow.print();
      }
      setPrintStatus('¡PDF generado y enviado a imprimir!');
    } catch (err) {
      console.error(err);
      alert('Error al generar PDF.');
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
                Asistente de Impresión Cartográfica (Atlas MapOSMatic)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                {lineaNombre} • {totalRamales} ramal(es) cargado(s)
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

        {/* Indicador de Pasos del Asistente estilo MapOSMatic / get-map.org */}
        <div style={{ background: '#0f172a', padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[
            { num: 1, label: '1. Trazos' },
            { num: 2, label: '2. Formato' },
            { num: 3, label: '3. Generar' },
          ].map((st) => (
            <button
              key={st.num}
              type="button"
              onClick={() => !isGenerating && setStep(st.num)}
              style={{
                background: 'transparent',
                border: 'none',
                color: step === st.num ? '#38bdf8' : '#64748b',
                fontWeight: step === st.num ? 800 : 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: step === st.num ? '#38bdf8' : '#1e293b',
                color: step === st.num ? '#0f172a' : '#94a3b8',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800
              }}>
                {st.num}
              </span>
              {st.label}
            </button>
          ))}
        </div>

        {/* Modal Body: Paso a Paso estilo MapOSMatic (print.get-map.org) */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '320px' }}>
          {/* PASO 1: Selección de Trazos / Ramales a imprimir */}
          {step === 1 && (
            <div>
              <div style={{ background: modoVarita ? '#f0fdf4' : '#eff6ff', border: modoVarita ? '1px solid #86efac' : '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🪄</span>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: modoVarita ? '#166534' : '#1d4ed8', display: 'block' }}>
                      {modoVarita ? '¡Varita Mágica Activada!' : 'Varita Mágica de Selección'}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: modoVarita ? '#15803d' : '#3b82f6' }}>
                      {modoVarita ? 'Tocá cualquier trazo directamente en el mapa para marcarlo/desmarcarlo' : 'Elegí hacer clic en la pantalla o mediante la lista'}
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
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {modoVarita ? '✓ Seleccionando en Mapa' : 'Activar Clic en Mapa'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                  Elegí los trazos / ramales que deseas incluir:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRamalesSeleccionados(capasLinea.map(c => c.id))}
                    style={{ background: '#eff6ff', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}
                  >
                    Seleccionar todos
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                {capasLinea.map((capa) => {
                  const isChecked = ramalesSeleccionados.includes(capa.id);
                  return (
                    <label
                      key={capa.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isChecked ? '#f0f6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
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
                              setRamalesSeleccionados(ramalesSeleccionados.filter(id => id !== capa.id));
                            }
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                          {capa.nombre}
                        </span>
                      </div>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: capa.color || '#2563eb' }} />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASO 2: Diseño, Formato y Escala estilo MapOSMatic */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  1. Formato de Papel:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['A4', 'A3', 'A2'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setPaperFormat(fmt as any)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: paperFormat === fmt ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: paperFormat === fmt ? '#eff6ff' : '#fff',
                        color: paperFormat === fmt ? '#1d4ed8' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Hoja {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  2. Orientación de Página:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { label: 'Horizontal (Landscape)', val: 'landscape' },
                    { label: 'Vertical (Portrait)', val: 'portrait' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setOrientacion(item.val as any)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: orientacion === item.val ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: orientacion === item.val ? '#eff6ff' : '#fff',
                        color: orientacion === item.val ? '#1d4ed8' : '#64748b',
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

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  3. Nivel de Detalle / Zoom:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { label: 'Máximo (Calles)', val: 17 },
                    { label: 'Medio (Barrios)', val: 16 },
                    { label: 'Amplio (Zonal)', val: 15 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setZoomLevel(item.val)}
                      style={{
                        flex: 1,
                        padding: '8px',
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
            </div>
          )}

          {/* PASO 3: Opciones de Renderizado y Disparo estilo MapOSMatic */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Cantidad de Láminas / Hojas continuas en el Atlas:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {[4, 8, 12, 16, 20, 30].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumSegmentos(num)}
                      style={{
                        padding: '8px 2px',
                        borderRadius: '8px',
                        border: numSegmentos === num ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: numSegmentos === num ? '#eff6ff' : '#f8fafc',
                        color: numSegmentos === num ? '#1d4ed8' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      {num} Págs
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={incluirCuadricula} onChange={(e) => setIncluirCuadricula(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#2563eb' }} />
                  <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
                    Incluir cuadrícula cartográfica (estilo Field Papers / MapOSMatic)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={incluirVistaGeneral} onChange={(e) => setIncluirVistaGeneral(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#2563eb' }} />
                  <span style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
                    Incluir lámina 1 con la vista panorámica completa
                  </span>
                </label>
              </div>

              {isGenerating && (
                <div style={{ padding: '14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', color: '#1d4ed8', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 className="animate-spin" size={18} />
                  <span>{printStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer: Navegación de Pasos estilo MapOSMatic / print.get-map.org */}
        <div
          style={{
            padding: '16px 24px',
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

          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={isGenerating}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
              >
                ← Anterior
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (ramalesSeleccionados.length === 0) {
                    alert('Selecciona al menos 1 ramal para continuar.');
                    return;
                  }
                  setStep(step + 1);
                }}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Siguiente →
              </button>
            ) : (
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
                {isGenerating ? 'Generando MapOSMatic...' : `Generar Atlas (${numSegmentos} Hojas)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
