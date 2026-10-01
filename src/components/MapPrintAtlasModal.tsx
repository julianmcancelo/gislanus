'use client';
import React, { useState } from 'react';
import { Printer, X, Download, Loader2, Sparkles, Layers, Compass, MapPin } from 'lucide-react';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { MercatorViewportProjection, LatLng, MapboxStaticStyle } from '@/utils/cartographicProjection';

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
  const [motorCartografico, setMotorCartografico] = useState<'mapbox' | 'pantalla'>('mapbox');
  const [estiloMapbox, setEstiloMapbox] = useState<MapboxStaticStyle>('streets-v12');
  const [incluirCuadricula, setIncluirCuadricula] = useState<boolean>(true);
  const [incluirEscalaNorte, setIncluirEscalaNorte] = useState<boolean>(true);
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

  // Dimensiones estándar ISO en milímetros
  const PAGE_SIZES_MM: Record<string, { w: number; h: number }> = {
    A4: { w: 297, h: 210 },
    A3: { w: 420, h: 297 },
    A2: { w: 594, h: 420 },
    A1: { w: 841, h: 594 },
    A0: { w: 1189, h: 841 },
  };

  // Generar Impresión Directa en 1 sola Hoja HD con Proyección Cartográfica Isométrica
  const handleGeneratePrint = async () => {
    const allCoords = getAllCoordinates();
    if (allCoords.length === 0) {
      alert('Seleccioná al menos 1 ramal o trazo para imprimir.');
      return;
    }

    setIsGenerating(true);
    setPrintStatus('Iniciando Motor Cartográfico Isométrico Web Mercator (EPSG:3857)...');

    try {
      const isLandscape = orientacion === 'landscape';
      const baseDim = PAGE_SIZES_MM[paperFormat] || PAGE_SIZES_MM.A4;
      const pdfWidth = isLandscape ? baseDim.w : baseDim.h;
      const pdfHeight = isLandscape ? baseDim.h : baseDim.w;
      const targetRatio = pdfWidth / pdfHeight;

      const pdf = new jsPDF({
        orientation: orientacion,
        unit: 'mm',
        format: paperFormat.toLowerCase() as any,
      });

      if (motorCartografico === 'mapbox') {
        setPrintStatus('Normalizando coordenadas de mundo y preservando aspect ratio 1:1...');

        // Tamaño del lienzo en alta resolución proporcional a la hoja
        const baseWidthPx = 1800 * (renderScale / 2);
        const canvasWidth = Math.round(baseWidthPx);
        const canvasHeight = Math.round(canvasWidth / targetRatio);

        const points: LatLng[] = allCoords.map(([lat, lng]) => ({ lat, lng }));
        const proj = new MercatorViewportProjection(points, canvasWidth, canvasHeight, 0.09);

        setPrintStatus('Descargando mosaico cartográfico de alta definición Mapbox...');
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
        const { url } = proj.getMapboxStaticUrl(token, estiloMapbox, true);

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo inicializar el contexto 2D');

        // 1. Descargar y dibujar el fondo ráster estático
        let mapboxLoaded = false;
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Fallo al cargar imagen de Mapbox'));
            img.src = url;
            setTimeout(() => resolve(), 8000);
          });
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            mapboxLoaded = true;
          }
        } catch (e) {
          console.warn('Fallo Mapbox Static:', e);
        }

        if (!mapboxLoaded) {
          // Fondo cartográfico plano técnico
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        setPrintStatus('Proyectando capas vectoriales con coincidencia submilimétrica...');

        // 2. Dibujar capas vectoriales sincronizadas sobre el ráster
        capasFiltradas.forEach((capa) => {
          const segs = getLayerFeatureSegments(capa);
          const color = capa.color || '#2563eb';

          segs.forEach((seg) => {
            if (seg.coords.length < 2) return;

            // Halo/Casing exterior para contraste
            ctx.beginPath();
            let first = true;
            seg.coords.forEach(([lat, lng]) => {
              const p = proj.project(lat, lng);
              if (first) {
                ctx.moveTo(p.x, p.y);
                first = false;
              } else {
                ctx.lineTo(p.x, p.y);
              }
            });
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(5, Math.round(8.5 * (renderScale / 2)));
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
            ctx.stroke();

            // Línea principal en color del ramal
            ctx.beginPath();
            first = true;
            seg.coords.forEach(([lat, lng]) => {
              const p = proj.project(lat, lng);
              if (first) {
                ctx.moveTo(p.x, p.y);
                first = false;
              } else {
                ctx.lineTo(p.x, p.y);
              }
            });
            ctx.lineWidth = Math.max(3, Math.round(5.5 * (renderScale / 2)));
            ctx.strokeStyle = color;
            ctx.stroke();
          });

          // Dibujar paradas si existen en datosGeo
          const geo = cacheDatosGeo[capa.id] || capa.datosGeo;
          if (geo) {
            const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
            features.forEach((f: any) => {
              const geom = f?.geometry;
              if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
                const [lng, lat] = geom.coordinates;
                const p = proj.project(lat, lng);
                const r = Math.max(5, Math.round(7 * (renderScale / 2)));

                ctx.beginPath();
                ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fillStyle = '#10b981';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(p.x, p.y, r - 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
              }
            });
          }
        });

        // 3. Cuadrícula cartográfica con coordenadas sexagesimales reales
        if (incluirCuadricula) {
          setPrintStatus('Trazando retícula cartográfica sexagesimal...');
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.28)';
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 6]);

          const numCols = 4;
          const numRows = 3;
          ctx.font = `600 ${Math.round(11 * (renderScale / 2))}px Inter, sans-serif`;
          ctx.fillStyle = '#1e293b';

          for (let c = 1; c < numCols; c++) {
            const x = (c * canvasWidth) / numCols;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();

            const geoPt = proj.unproject(x, 25);
            const dms = MercatorViewportProjection.formatDMS(geoPt.lng, false);
            ctx.fillText(dms, x + 5, Math.round(35 * (renderScale / 2)));
          }

          for (let r = 1; r < numRows; r++) {
            const y = (r * canvasHeight) / numRows;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();

            const geoPt = proj.unproject(25, y);
            const dms = MercatorViewportProjection.formatDMS(geoPt.lat, true);
            ctx.fillText(dms, Math.round(15 * (renderScale / 2)), y - 6);
          }
          ctx.setLineDash([]);
        }

        // 4. Escalímetro gráfico oficial y Rosa de los Vientos
        if (incluirEscalaNorte) {
          const scaleBar = proj.getCartographicScaleBar(Math.round(170 * (renderScale / 2)));
          const sbMarginX = Math.round(28 * (renderScale / 2));
          const sbMarginY = canvasHeight - Math.round(34 * (renderScale / 2));

          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.fillRect(sbMarginX - 8, sbMarginY - 26, scaleBar.widthPx + 75, 38);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.strokeRect(sbMarginX - 8, sbMarginY - 26, scaleBar.widthPx + 75, 38);

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(sbMarginX, sbMarginY - 6, scaleBar.widthPx / 2, 7);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(sbMarginX + scaleBar.widthPx / 2, sbMarginY - 6, scaleBar.widthPx / 2, 7);
          ctx.strokeStyle = '#0f172a';
          ctx.strokeRect(sbMarginX, sbMarginY - 6, scaleBar.widthPx, 7);

          ctx.font = `bold ${Math.round(11 * (renderScale / 2))}px Inter, sans-serif`;
          ctx.fillStyle = '#0f172a';
          ctx.fillText(`0`, sbMarginX - 3, sbMarginY - 11);
          ctx.fillText(scaleBar.label, sbMarginX + scaleBar.widthPx - 18, sbMarginY - 11);

          // Flecha de Norte
          const northX = canvasWidth - Math.round(48 * (renderScale / 2));
          const northY = Math.round(52 * (renderScale / 2));
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.arc(northX, northY, Math.round(24 * (renderScale / 2)), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.stroke();

          ctx.font = `bold ${Math.round(13 * (renderScale / 2))}px Inter, sans-serif`;
          ctx.fillStyle = '#0f172a';
          ctx.fillText('N', northX - 4.5, northY - Math.round(7 * (renderScale / 2)));

          ctx.beginPath();
          ctx.moveTo(northX, northY - Math.round(5 * (renderScale / 2)));
          ctx.lineTo(northX - 5.5, northY + Math.round(12 * (renderScale / 2)));
          ctx.lineTo(northX, northY + Math.round(7 * (renderScale / 2)));
          ctx.lineTo(northX + 5.5, northY + Math.round(12 * (renderScale / 2)));
          ctx.closePath();
          ctx.fillStyle = '#0284c7';
          ctx.fill();
        }

        setPrintStatus('Compilando documento cartográfico oficial...');
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        // Modo captura de pantalla con ajuste isométrico estricto
        if (!mapInstance) throw new Error('El mapa interactivo no está disponible');
        const mapElement = mapInstance.getContainer();

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

        const screenRatio = canvas.width / canvas.height;
        let printW = pdfWidth;
        let printH = pdfHeight;
        let offsetX = 0;
        let offsetY = 0;

        // Ajuste isométrico sin estiramiento anamórfico
        if (screenRatio > targetRatio) {
          printW = pdfWidth;
          printH = pdfWidth / screenRatio;
          offsetY = (pdfHeight - printH) / 2;
        } else {
          printH = pdfHeight;
          printW = pdfHeight * screenRatio;
          offsetX = (pdfWidth - printW) / 2;
        }

        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', offsetX, offsetY, printW, printH);
      }

      // ── Encabezado Institucional Lanús Gobierno ────────────────────────
      pdf.setFillColor(15, 23, 42); // #0f172a
      pdf.rect(8, 8, isLandscape ? 175 : 145, 18, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(`MUNICIPALIDAD DE LANÚS — PLANO CARTOGRÁFICO OFICIAL`, 12, 14.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `${lineaNombre.toUpperCase()} • ${capasFiltradas.length} TRAZO(S) • EPSG:3857 ISOMÉTRICO 1:1`,
        12,
        20.5
      );

      // ── Pie de Página Institucional ────────────────────────────────────
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(8, pdfHeight - 16, isLandscape ? 195 : 165, 10, 'FD');

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.8);
      pdf.text(
        `IMPRESIÓN CARTOGRÁFICA HD — HOJA ${paperFormat} (${orientacion.toUpperCase()})`,
        12,
        pdfHeight - 10
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        `Lanús Gobierno • Secretaría de Movilidad y Transporte • Proyección Conforme Web Mercator`,
        12,
        pdfHeight - 6
      );

      const pdfBlobUrl = pdf.output('bloburl');
      const filename = `Plano_Cartografico_${lineaNombre.replace(/\s+/g, '_')}_${paperFormat}.pdf`;
      pdf.save(filename);

      const printWindow = window.open(pdfBlobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => printWindow.print();
      }

      setPrintStatus('¡Plano cartográfico isométrico generado con éxito!');
    } catch (err) {
      console.error('Error al generar impresión:', err);
      alert('Ocurrió un error al generar el plano cartográfico. Revisá la consola.');
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
          maxWidth: '560px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          pointerEvents: 'auto',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                Estudio Cartográfico de Impresión
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                Motor Isométrico Web Mercator (EPSG:3857) · {capasFiltradas.length} trazos seleccionados
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

        {/* Cuerpo Principal Unificado con Scroll */}
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
          }}
        >
          {/* Varita mágica banner */}
          <div
            style={{
              background: modoVarita ? '#f0fdf4' : '#eff6ff',
              border: modoVarita ? '1.5px solid #86efac' : '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color={modoVarita ? '#16a34a' : '#2563eb'} />
              <div>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: modoVarita ? '#166534' : '#1d4ed8',
                    display: 'block',
                  }}
                >
                  {modoVarita ? '¡Selección por Clic Activa!' : 'Varita Mágica de Mapa'}
                </span>
                <span style={{ fontSize: '0.73rem', color: modoVarita ? '#15803d' : '#3b82f6' }}>
                  {modoVarita
                    ? 'Tocá cualquier trazo en el mapa para sumarlo/quitarlo'
                    : 'Hacé clic en el mapa o elegí en la lista'}
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
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {modoVarita ? '✓ Seleccionando' : 'Activar Clic'}
            </button>
          </div>

          {/* Motor Cartográfico y Mapa Base */}
          <div>
            <label
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#1e293b',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              🗺️ Motor Cartográfico & Mapa Base:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {[
                {
                  id: 'streets-v12',
                  label: '🏙️ Callejero Urbano HD',
                  sub: 'Mapbox Streets (Recomendado)',
                  motor: 'mapbox',
                },
                {
                  id: 'light-v11',
                  label: '📐 Plano Técnico Claro',
                  sub: 'Arquitectónico / Contraste',
                  motor: 'mapbox',
                },
                {
                  id: 'satellite-streets-v12',
                  label: '🛰️ Satélite HD + Calles',
                  sub: 'Ortofoto aérea con nombres',
                  motor: 'mapbox',
                },
                {
                  id: 'pantalla',
                  label: '🖥️ Captura de Pantalla',
                  sub: 'Vista tal cual Leaflet actual',
                  motor: 'pantalla',
                },
              ].map((style) => {
                const isSelected =
                  style.motor === 'pantalla'
                    ? motorCartografico === 'pantalla'
                    : motorCartografico === 'mapbox' && estiloMapbox === style.id;

                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      if (style.motor === 'pantalla') {
                        setMotorCartografico('pantalla');
                      } else {
                        setMotorCartografico('mapbox');
                        setEstiloMapbox(style.id as MapboxStaticStyle);
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isSelected ? '#1d4ed8' : '#334155',
                      }}
                    >
                      {style.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '1px' }}>
                      {style.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formato de Hojas A0-A4 */}
          <div>
            <label
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#1e293b',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              📄 Formato de Lámina / Papel:
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['A4', 'A3', 'A2', 'A1', 'A0'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setPaperFormat(fmt as any)}
                  style={{
                    flex: 1,
                    padding: '7px 2px',
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

          {/* Calidad y Orientación */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#1e293b',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
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
                      padding: '7px 4px',
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
              <label
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#1e293b',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                🔍 Calidad / Resolución:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { label: 'Alta (3x)', val: 3 },
                  { label: 'Ultra HD (4x)', val: 4 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setRenderScale(item.val)}
                    style={{
                      flex: 1,
                      padding: '7px 4px',
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

          {/* Opciones Cartográficas Técnicas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={incluirCuadricula}
                onChange={(e) => setIncluirCuadricula(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.77rem', color: '#1e293b', fontWeight: 600 }}>
                Retícula cartográfica con coordenadas de latitud/longitud sexagesimales (DMS)
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={incluirEscalaNorte}
                onChange={(e) => setIncluirEscalaNorte(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.77rem', color: '#1e293b', fontWeight: 600 }}>
                Escalímetro gráfico métrico proporcional y Rosa de los Vientos (Norte)
              </span>
            </label>
          </div>

          {/* Lista de Trazos y Ramales */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
                🗺️ Trazos y Ramales a Incluir:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRamalesSeleccionados(capasLinea.map((c) => c.id))}
                  style={{
                    background: '#eff6ff',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setRamalesSeleccionados([])}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Ninguno
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '140px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {capasLinea.map((capa) => {
                const isChecked = ramalesSeleccionados.includes(capa.id);
                return (
                  <label
                    key={capa.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
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
                            setRamalesSeleccionados(
                              ramalesSeleccionados.filter((id) => id !== capa.id)
                            );
                          }
                        }}
                        style={{
                          width: '15px',
                          height: '15px',
                          accentColor: '#2563eb',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                          {capa.subGrupo?.nombre ? `${capa.subGrupo.nombre} - ` : ''}
                          {capa.nombre}
                        </span>
                        {capa.grupo?.nombre && (
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {capa.grupo.nombre}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: capa.color || '#2563eb',
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {isGenerating && (
            <div
              style={{
                padding: '12px 14px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                color: '#1d4ed8',
                fontSize: '0.8rem',
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

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            background: '#fafbfd',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '9px 16px',
              borderRadius: '9px',
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.82rem',
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
              padding: '9px 20px',
              borderRadius: '9px',
              background:
                isGenerating || capasFiltradas.length === 0
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: isGenerating || capasFiltradas.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            {isGenerating
              ? 'Generando Plano...'
              : `Imprimir Plano Isométrico (${paperFormat})`}
          </button>
        </div>
      </div>
    </div>
  );
}
