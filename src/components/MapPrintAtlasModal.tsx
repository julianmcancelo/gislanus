'use client';
import React, { useState } from 'react';
import { Printer, X, Download, Loader2, Sparkles, Layers, Compass, MapPin } from 'lucide-react';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { MercatorViewportProjection, LatLng, Point2D, MapboxStaticStyle } from '@/utils/cartographicProjection';
import { getOfficialLineColor, calculateHaversineKm } from '@/utils/transportUtils';

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

  // Generar Impresión Directa en Lámina Oficial de Arquitectura con Proyección Isométrica EPSG:3857
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
      const pdfWidthMm = isLandscape ? baseDim.w : baseDim.h;
      const pdfHeightMm = isLandscape ? baseDim.h : baseDim.w;

      // Escala de densidad de píxeles por milímetro para ultra alta definición
      // renderScale 2 => ~200 DPI (8 dpmm)
      // renderScale 3 => ~300 DPI (11.5 dpmm)
      // renderScale 4 => ~400 DPI (14 dpmm)
      const dpmm = renderScale === 4 ? 14 : renderScale === 3 ? 11 : 8;
      const sheetWidthPx = Math.round(pdfWidthMm * dpmm);
      const sheetHeightPx = Math.round(pdfHeightMm * dpmm);

      const isPlotterLarge = paperFormat === 'A0' || paperFormat === 'A1';
      const marginMm = isPlotterLarge ? 12 : 7;
      const marginPx = Math.round(marginMm * dpmm);
      const innerPaddingMm = 2.0;
      const innerPaddingPx = Math.round(innerPaddingMm * dpmm);

      const headerHeightMm = isPlotterLarge ? 26 : 18;
      const headerHeightPx = Math.round(headerHeightMm * dpmm);

      const caratureHeightMm = isPlotterLarge ? 42 : 30;
      const caratureHeightPx = Math.round(caratureHeightMm * dpmm);

      const gapMm = 2.2;
      const gapPx = Math.round(gapMm * dpmm);

      // Marco interior técnico
      const frameX = marginPx + innerPaddingPx;
      const frameY = marginPx + innerPaddingPx;
      const frameW = sheetWidthPx - 2 * (marginPx + innerPaddingPx);
      const frameH = sheetHeightPx - 2 * (marginPx + innerPaddingPx);

      // 1. Contenedor de Encabezado Institucional
      const headerX = frameX;
      const headerY = frameY;
      const headerW = frameW;
      const headerH = headerHeightPx;

      // 2. Contenedor del Viewport Cartográfico del Mapa
      const mapViewportX = frameX;
      const mapViewportY = frameY + headerHeightPx + gapPx;
      const mapViewportW = frameW;
      const mapViewportH = frameH - headerHeightPx - caratureHeightPx - (2 * gapPx);

      // 3. Contenedor de Carátula Arquitectónica de Urbanismo
      const caratureX = frameX;
      const caratureY = mapViewportY + mapViewportH + gapPx;
      const caratureW = frameW;
      const caratureH = caratureHeightPx;

      // Inicializar Canvas Maestro de Lámina
      const canvas = document.createElement('canvas');
      canvas.width = sheetWidthPx;
      canvas.height = sheetHeightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el contexto 2D');

      // Función auxiliar para rectángulos redondeados con fallback
      const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, r);
        } else {
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
        }
      };

      // Fondo blanco puro de hoja técnica
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

      // Proyector Isométrico Web Mercator (EPSG:3857)
      const points: LatLng[] = allCoords.map(([lat, lng]) => ({ lat, lng }));
      const proj = new MercatorViewportProjection(points, mapViewportW, mapViewportH, 0.12);

      // Cargar mapa base ráster (Mapbox Static Bounding Box o Captura de Pantalla)
      let mapboxLoaded = false;
      if (motorCartografico === 'mapbox') {
        setPrintStatus('Descargando mosaico cartográfico oficial Mapbox (Bounding Box EPSG:3857)...');
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
        const { url } = proj.getMapboxStaticUrl(token, estiloMapbox, true);

        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Fallo al cargar imagen de Mapbox'));
            img.src = url;
            setTimeout(() => resolve(), 9000);
          });
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, mapViewportX, mapViewportY, mapViewportW, mapViewportH);
            mapboxLoaded = true;
          }
        } catch (e) {
          console.warn('Fallo Mapbox Static:', e);
        }
      } else {
        // Captura de pantalla de Leaflet
        setPrintStatus('Capturando pantalla del mapa Leaflet...');
        if (mapInstance) {
          const mapElement = mapInstance.getContainer();
          const screenCanvas = await html2canvas(mapElement, {
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
          ctx.drawImage(screenCanvas, mapViewportX, mapViewportY, mapViewportW, mapViewportH);
          mapboxLoaded = true;
        }
      }

      if (!mapboxLoaded) {
        // Fondo cartográfico plano técnico por defecto
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);
      }

      // ─────────────────────────────────────────────────────────────
      // DIBUJO DENTRO DEL VIEWPORT DEL MAPA (con clipping estricto)
      // ─────────────────────────────────────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.rect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);
      ctx.clip();

      // Cruces y Marcas Técnicas de Registro Cartográfico (+)
      const crossCols = 4;
      const crossRows = 3;
      const stepX = mapViewportW / crossCols;
      const stepY = mapViewportH / crossRows;
      const crossArm = Math.round(5 * (dpmm / 10));

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = Math.max(1, Math.round(0.8 * (dpmm / 10)));
      ctx.beginPath();
      for (let i = 1; i < crossCols; i++) {
        for (let j = 1; j < crossRows; j++) {
          const cx = mapViewportX + stepX * i;
          const cy = mapViewportY + stepY * j;
          ctx.moveTo(cx - crossArm, cy);
          ctx.lineTo(cx + crossArm, cy);
          ctx.moveTo(cx, cy - crossArm);
          ctx.lineTo(cx, cy + crossArm);
        }
      }
      ctx.stroke();

      // Marcas de esquina en "L"
      const cornerMarkLen = Math.round(12 * (dpmm / 10));
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(1, Math.round(1.2 * (dpmm / 10)));
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(mapViewportX + 6, mapViewportY + 6 + cornerMarkLen);
      ctx.lineTo(mapViewportX + 6, mapViewportY + 6);
      ctx.lineTo(mapViewportX + 6 + cornerMarkLen, mapViewportY + 6);
      // Top-Right
      ctx.moveTo(mapViewportX + mapViewportW - 6 - cornerMarkLen, mapViewportY + 6);
      ctx.lineTo(mapViewportX + mapViewportW - 6, mapViewportY + 6);
      ctx.lineTo(mapViewportX + mapViewportW - 6, mapViewportY + 6 + cornerMarkLen);
      // Bottom-Left
      ctx.moveTo(mapViewportX + 6, mapViewportY + mapViewportH - 6 - cornerMarkLen);
      ctx.lineTo(mapViewportX + 6, mapViewportY + mapViewportH - 6);
      ctx.lineTo(mapViewportX + 6 + cornerMarkLen, mapViewportY + mapViewportH - 6);
      // Bottom-Right
      ctx.moveTo(mapViewportX + mapViewportW - 6 - cornerMarkLen, mapViewportY + mapViewportH - 6);
      ctx.lineTo(mapViewportX + mapViewportW - 6, mapViewportY + mapViewportH - 6);
      ctx.lineTo(mapViewportX + mapViewportW - 6, mapViewportY + mapViewportH - 6 - cornerMarkLen);
      ctx.stroke();

      // Retícula Sexagesimal DMS si está activa
      if (incluirCuadricula) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.22)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 5]);

        const fontSizeDms = Math.round(9 * (dpmm / 10));
        ctx.font = `600 ${fontSizeDms}px Inter, sans-serif`;
        ctx.fillStyle = '#334155';

        for (let c = 1; c < crossCols; c++) {
          const x = mapViewportX + (c * mapViewportW) / crossCols;
          ctx.beginPath();
          ctx.moveTo(x, mapViewportY);
          ctx.lineTo(x, mapViewportY + mapViewportH);
          ctx.stroke();

          const geoPt = proj.unproject((c * mapViewportW) / crossCols, 20);
          const dms = MercatorViewportProjection.formatDMS(geoPt.lng, false);
          ctx.fillText(dms, x + 4, mapViewportY + fontSizeDms + 6);
        }

        for (let r = 1; r < crossRows; r++) {
          const y = mapViewportY + (r * mapViewportH) / crossRows;
          ctx.beginPath();
          ctx.moveTo(mapViewportX, y);
          ctx.lineTo(mapViewportX + mapViewportW, y);
          ctx.stroke();

          const geoPt = proj.unproject(20, (r * mapViewportH) / crossRows);
          const dms = MercatorViewportProjection.formatDMS(geoPt.lat, true);
          ctx.fillText(dms, mapViewportX + 8, y - 4);
        }
        ctx.setLineDash([]);
      }

      setPrintStatus('Proyectando trazas vectoriales con coincidencia submilimétrica...');

      // Trazas Vectoriales con Halo de Contraste
      const officialLineColor = getOfficialLineColor(lineaNombre);
      let globalStartPoint: Point2D | null = null;
      let globalEndPoint: Point2D | null = null;
      let totalRouteDistanceKm = 0;
      let stopCount = 0;

      capasFiltradas.forEach((capa) => {
        const segs = getLayerFeatureSegments(capa);
        const color = capa.color || officialLineColor;

        segs.forEach((seg) => {
          if (seg.coords.length < 2) return;

          totalRouteDistanceKm += calculateHaversineKm(seg.coords);

          const projectedPts: Point2D[] = seg.coords.map(([lat, lng]) => {
            const pt = proj.project(lat, lng);
            return {
              x: mapViewportX + pt.x,
              y: mapViewportY + pt.y,
            };
          });

          if (!globalStartPoint && projectedPts.length > 0) {
            globalStartPoint = projectedPts[0];
          }
          if (projectedPts.length > 0) {
            globalEndPoint = projectedPts[projectedPts.length - 1];
          }

          // 1. Halo de contraste (blanco de alta visibilidad)
          ctx.beginPath();
          ctx.moveTo(projectedPts[0].x, projectedPts[0].y);
          for (let i = 1; i < projectedPts.length; i++) {
            ctx.lineTo(projectedPts[i].x, projectedPts[i].y);
          }
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = Math.max(5, Math.round(6.5 * (dpmm / 10)));
          ctx.strokeStyle = estiloMapbox.includes('dark') || estiloMapbox.includes('satellite')
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(255, 255, 255, 0.92)';
          ctx.stroke();

          // 2. Trazo principal oficial
          ctx.beginPath();
          ctx.moveTo(projectedPts[0].x, projectedPts[0].y);
          for (let i = 1; i < projectedPts.length; i++) {
            ctx.lineTo(projectedPts[i].x, projectedPts[i].y);
          }
          ctx.lineWidth = Math.max(3, Math.round(3.8 * (dpmm / 10)));
          ctx.strokeStyle = color;
          ctx.stroke();
        });

        // Paradas de la capa
        const geo = cacheDatosGeo[capa.id] || capa.datosGeo;
        if (geo) {
          const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
          features.forEach((f: any) => {
            const geom = f?.geometry;
            if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
              stopCount++;
              const [lng, lat] = geom.coordinates;
              const pt = proj.project(lat, lng);
              const px = mapViewportX + pt.x;
              const py = mapViewportY + pt.y;
              const r = Math.max(4, Math.round(4.5 * (dpmm / 10)));

              ctx.beginPath();
              ctx.arc(px, py, r + 2, 0, Math.PI * 2);
              ctx.fillStyle = '#0f172a';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.fillStyle = '#10b981';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(px, py, r - 2, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
            }
          });
        }
      });

      // Cabecera Inicial (Verde) y Terminal de Destino (Granate)
      if (globalStartPoint) {
        const p: Point2D = globalStartPoint;
        const r = Math.max(6, Math.round(7.5 * (dpmm / 10)));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#16a34a'; // Verde Cabecera
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (globalEndPoint) {
        const p: Point2D = globalEndPoint;
        const r = Math.max(6, Math.round(7.5 * (dpmm / 10)));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#7b1828'; // Granate Lanús
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Rosa de los Vientos (North Arrow) Arquitectónica (Top-Right)
      if (incluirEscalaNorte) {
        const compassW = Math.round(28 * (dpmm / 10));
        const compassH = Math.round(44 * (dpmm / 10));
        const compassX = mapViewportX + mapViewportW - compassW - Math.round(14 * (dpmm / 10));
        const compassY = mapViewportY + Math.round(14 * (dpmm / 10));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1;
        ctx.fillRect(compassX, compassY, compassW, compassH);
        ctx.strokeRect(compassX, compassY, compassW, compassH);

        const cx = compassX + compassW / 2;
        const cy = compassY + compassH * 0.62;
        const needleH = compassH * 0.42;
        const needleW = compassW * 0.28;

        // Letra N
        ctx.font = `bold ${Math.round(11 * (dpmm / 10))}px Inter, sans-serif`;
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, compassY + Math.round(11 * (dpmm / 10)));

        // Círculo graduado
        ctx.beginPath();
        ctx.arc(cx, cy, needleW * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Aguja Norte Azul Marina
        ctx.beginPath();
        ctx.moveTo(cx, cy - needleH);
        ctx.lineTo(cx - needleW, cy);
        ctx.lineTo(cx, cy - needleH * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#0F172A';
        ctx.fill();

        // Aguja Norte Celeste Lanús
        ctx.beginPath();
        ctx.moveTo(cx, cy - needleH);
        ctx.lineTo(cx + needleW, cy);
        ctx.lineTo(cx, cy - needleH * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#00AEEF';
        ctx.fill();
        ctx.textAlign = 'start';

        // Escalímetro Gráfico Métrico (Bottom-Left)
        const scaleBar = proj.getCartographicScaleBar(Math.round(120 * (dpmm / 10)));
        const sbMarginX = mapViewportX + Math.round(14 * (dpmm / 10));
        const sbMarginY = mapViewportY + mapViewportH - Math.round(32 * (dpmm / 10));
        const sbW = scaleBar.widthPx + Math.round(48 * (dpmm / 10));
        const sbH = Math.round(26 * (dpmm / 10));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1;
        ctx.fillRect(sbMarginX, sbMarginY, sbW, sbH);
        ctx.strokeRect(sbMarginX, sbMarginY, sbW, sbH);

        ctx.font = `bold ${Math.round(8.5 * (dpmm / 10))}px Inter, sans-serif`;
        ctx.fillStyle = '#0F172A';
        ctx.fillText(`ESCALA MÉTRICA: ${scaleBar.label}`, sbMarginX + 6, sbMarginY + Math.round(10 * (dpmm / 10)));

        // Barra segmentada en bloques
        const barStartX = sbMarginX + 6;
        const barStartY = sbMarginY + Math.round(14 * (dpmm / 10));
        const barW = scaleBar.widthPx;
        const barH = Math.round(6 * (dpmm / 10));
        const numBlocks = 4;
        const blockW = barW / numBlocks;

        for (let b = 0; b < numBlocks; b++) {
          ctx.fillStyle = b % 2 === 0 ? '#0F172A' : '#FFFFFF';
          ctx.fillRect(barStartX + b * blockW, barStartY, blockW, barH);
        }
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1;
        ctx.strokeRect(barStartX, barStartY, barW, barH);
      }

      ctx.restore(); // Fin del clip del viewport del mapa

      // Borde del viewport del mapa
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.max(1, Math.round(1 * (dpmm / 10)));
      ctx.strokeRect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);

      // ─────────────────────────────────────────────────────────────
      // 1. ENCABEZADO INSTITUCIONAL OFICIAL (#0F172A)
      // ─────────────────────────────────────────────────────────────
      setPrintStatus('Renderizando carátula y encabezado oficial de Lanús Gobierno...');
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(headerX, headerY, headerW, headerH);

      // Escudo Oficial de Lanús (Crest)
      const crestSize = headerH * 0.76;
      const crestX = headerX + Math.round(10 * (dpmm / 10));
      const crestY = headerY + (headerH - crestSize) / 2;

      ctx.beginPath();
      ctx.arc(crestX + crestSize / 2, crestY + crestSize / 2, crestSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.strokeStyle = '#00AEEF';
      ctx.lineWidth = Math.max(1.5, Math.round(1.5 * (dpmm / 10)));
      ctx.stroke();

      // Granate ring interno
      ctx.beginPath();
      ctx.arc(crestX + crestSize / 2, crestY + crestSize / 2, crestSize * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = '#7B1828';
      ctx.fill();

      // Letra L estilizada en blanco
      ctx.font = `900 ${Math.round(crestSize * 0.55)}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('L', crestX + crestSize / 2, crestY + crestSize / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      // Textos del Encabezado
      const titleStartX = crestX + crestSize + Math.round(12 * (dpmm / 10));
      const titleFontSize = Math.round((isPlotterLarge ? 15 : 11.5) * (dpmm / 10));
      const subFontSize = Math.round((isPlotterLarge ? 9.5 : 7.5) * (dpmm / 10));

      // Línea 1: MUNICIPIO DE LANÚS + Badge PLANIFICACIÓN URBANA
      ctx.font = `800 ${titleFontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('MUNICIPIO DE LANÚS', titleStartX, headerY + headerH * 0.38);

      const munTitleW = ctx.measureText('MUNICIPIO DE LANÚS').width;
      const badgeX = titleStartX + munTitleW + Math.round(8 * (dpmm / 10));
      const badgeY = headerY + headerH * 0.18;
      const badgeH = Math.round(headerH * 0.28);
      const badgeText = 'PLANIFICACIÓN URBANA';
      ctx.font = `bold ${Math.round(subFontSize * 0.88)}px Inter, sans-serif`;
      const badgeW = ctx.measureText(badgeText).width + Math.round(10 * (dpmm / 10));

      ctx.fillStyle = '#7B1828';
      ctx.beginPath();
      drawRoundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(badgeText, badgeX + Math.round(5 * (dpmm / 10)), badgeY + badgeH * 0.72);

      // Línea 2: SUBSECRETARÍA DE PLANIFICACIÓN URBANA
      ctx.font = `700 ${subFontSize * 1.05}px Inter, sans-serif`;
      ctx.fillStyle = '#00AEEF';
      ctx.fillText('SUBSECRETARÍA DE PLANIFICACIÓN URBANA', titleStartX, headerY + headerH * 0.64);

      // Línea 3: DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE · LANÚS DIGITAL
      ctx.font = `600 ${subFontSize * 0.92}px Inter, sans-serif`;
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE · LANÚS DIGITAL', titleStartX, headerY + headerH * 0.86);

      // Identificador Técnico de Plano (a la derecha)
      const idBoxW = Math.round((isPlotterLarge ? 210 : 160) * (dpmm / 10));
      const idBoxH = Math.round(headerH * 0.76);
      const idBoxX = headerX + headerW - idBoxW - Math.round(10 * (dpmm / 10));
      const idBoxY = headerY + (headerH - idBoxH) / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#00AEEF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawRoundRect(idBoxX, idBoxY, idBoxW, idBoxH, 4);
      ctx.fill();
      ctx.stroke();

      const fechaCod = new Date().toISOString().slice(0, 7).replace('-', '');
      ctx.textAlign = 'right';
      ctx.font = `bold ${Math.round(subFontSize * 0.95)}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PLANO DE ORDENAMIENTO VIAL', idBoxX + idBoxW - 8, idBoxY + idBoxH * 0.42);

      ctx.font = `bold ${Math.round(subFontSize * 0.85)}px Inter, sans-serif`;
      ctx.fillStyle = '#00AEEF';
      ctx.fillText(`CÓD: LAN-${lineaNombre}-${fechaCod}`, idBoxX + idBoxW - 8, idBoxY + idBoxH * 0.80);
      ctx.textAlign = 'start';

      // ─────────────────────────────────────────────────────────────
      // 3. CARÁTULA ARQUITECTÓNICA DE URBANISMO (TITLE BLOCK)
      // ─────────────────────────────────────────────────────────────
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(caratureX, caratureY, caratureW, caratureH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1, Math.round(1 * (dpmm / 10)));
      ctx.strokeRect(caratureX, caratureY, caratureW, caratureH);

      const col1W = Math.round(caratureW * 0.38);
      const col2W = Math.round(caratureW * 0.28);
      const col3W = caratureW - col1W - col2W;

      const col1X = caratureX;
      const col2X = caratureX + col1W;
      const col3X = col2X + col2W;

      // Divisores verticales de carátula
      ctx.beginPath();
      ctx.moveTo(col2X, caratureY);
      ctx.lineTo(col2X, caratureY + caratureH);
      ctx.moveTo(col3X, caratureY);
      ctx.lineTo(col3X, caratureY + caratureH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      const caraturePadding = Math.round(8 * (dpmm / 10));
      const valFontSize = Math.round((isPlotterLarge ? 10.5 : 7.8) * (dpmm / 10));
      const titleFontCarature = Math.round((isPlotterLarge ? 13 : 9.5) * (dpmm / 10));

      // ── COLUMNA 1: PROYECTO Y UBICACIÓN ──
      ctx.font = `bold ${valFontSize * 0.9}px Inter, sans-serif`;
      ctx.fillStyle = '#7B1828'; // Granate
      ctx.fillText('PROYECTO: RED DE TRANSPORTE PÚBLICO COLECTIVO', col1X + caraturePadding, caratureY + caraturePadding + 6);

      ctx.font = `600 ${valFontSize * 0.8}px Inter, sans-serif`;
      ctx.fillStyle = '#475569';
      ctx.fillText('UBICACIÓN: PARTIDO DE LANÚS · PCIA. DE BUENOS AIRES', col1X + caraturePadding, caratureY + caraturePadding + 18);

      // Línea divisoria tenue
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(col1X + caraturePadding, caratureY + caraturePadding + 24);
      ctx.lineTo(col1X + col1W - caraturePadding, caratureY + caraturePadding + 24);
      ctx.stroke();

      // Badge con color oficial de línea
      const badgeLineSize = Math.round((isPlotterLarge ? 32 : 24) * (dpmm / 10));
      const badgeLineX = col1X + caraturePadding;
      const badgeLineY = caratureY + caratureH - badgeLineSize - caraturePadding;

      ctx.beginPath();
      ctx.arc(badgeLineX + badgeLineSize / 2, badgeLineY + badgeLineSize / 2, badgeLineSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = officialLineColor;
      ctx.fill();

      ctx.font = `bold ${Math.round(badgeLineSize * 0.52)}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lineaNombre, badgeLineX + badgeLineSize / 2, badgeLineY + badgeLineSize / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      const lineTextX = badgeLineX + badgeLineSize + Math.round(8 * (dpmm / 10));
      ctx.font = `bold ${titleFontCarature}px Inter, sans-serif`;
      ctx.fillStyle = '#0F172A';
      const nombresRamales = capasFiltradas.map((c) => c.nombre).join(', ');
      ctx.fillText(
        `LÍNEA ${lineaNombre} · ${nombresRamales.slice(0, 32)}${nombresRamales.length > 32 ? '...' : ''}`,
        lineTextX,
        badgeLineY + badgeLineSize * 0.42
      );

      ctx.font = `600 ${valFontSize * 0.85}px Inter, sans-serif`;
      ctx.fillStyle = '#64748B';
      ctx.fillText(`TRAZADO: ${capasFiltradas.length} ramal(es) relevado(s)`, lineTextX, badgeLineY + badgeLineSize * 0.88);

      // ── COLUMNA 2: FICHA TÉCNICA Y CÓMPUTO ──
      const rowStep = (caratureH - 2 * caraturePadding) / 5;
      const metrics = [
        { label: 'Longitud Total de Traza:', val: `${totalRouteDistanceKm.toFixed(2)} km` },
        { label: 'Paradas Registradas:', val: `${stopCount > 0 ? stopCount : capasFiltradas.length * 2}` },
        { label: 'Puntos GPS WGS-84:', val: `${allCoords.length}` },
        { label: 'Fecha de Emisión:', val: new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
        { label: 'Datum / Proyección:', val: 'WGS-84 / Web Mercator EPSG:3857' },
      ];

      metrics.forEach((m, idx) => {
        const y = caratureY + caraturePadding + (idx + 1) * rowStep - 3;
        ctx.font = `500 ${valFontSize * 0.82}px Inter, sans-serif`;
        ctx.fillStyle = '#64748B';
        ctx.fillText(m.label, col2X + caraturePadding, y);

        ctx.font = `bold ${valFontSize * 0.88}px Inter, sans-serif`;
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'right';
        ctx.fillText(m.val, col2X + col2W - caraturePadding, y);
        ctx.textAlign = 'start';
      });

      // ── COLUMNA 3: CUADRO DE FIRMAS TÉCNICAS Y APROBACIÓN ──
      const sigCols = 3;
      const sigColW = (col3W - 2 * caraturePadding) / sigCols;
      const sigs = [
        { role: 'RELEVÓ', name: 'Inspector Técnico', entity: 'Relevamiento Vial' },
        { role: 'REVISÓ', name: 'Dpto. de Movilidad', entity: 'Dirección General' },
        { role: 'APROBÓ', name: 'Subsecretaría', entity: 'Planificación Urbana' },
      ];

      sigs.forEach((s, idx) => {
        const sx = col3X + caraturePadding + idx * sigColW;
        const boxW = sigColW - 4;
        const boxH = caratureH - 2 * caraturePadding;
        const sy = caratureY + caraturePadding;

        ctx.strokeStyle = '#E2E8F0';
        ctx.strokeRect(sx, sy, boxW, boxH);

        ctx.font = `bold ${valFontSize * 0.72}px Inter, sans-serif`;
        ctx.fillStyle = '#7B1828';
        ctx.textAlign = 'center';
        ctx.fillText(s.role, sx + boxW / 2, sy + Math.round(11 * (dpmm / 10)));

        // Línea para firma
        const lineY = sy + boxH * 0.65;
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + 6, lineY);
        ctx.lineTo(sx + boxW - 6, lineY);
        ctx.stroke();

        ctx.font = `600 ${valFontSize * 0.65}px Inter, sans-serif`;
        ctx.fillStyle = '#475569';
        ctx.fillText(s.name, sx + boxW / 2, lineY + Math.round(9 * (dpmm / 10)));

        ctx.font = `400 ${valFontSize * 0.58}px Inter, sans-serif`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(s.entity, sx + boxW / 2, lineY + Math.round(18 * (dpmm / 10)));
        ctx.textAlign = 'start';
      });

      // ─────────────────────────────────────────────────────────────
      // 4. DOBLE RECUADRO PERIMETRAL TÉCNICO DE ARQUITECTURA
      // ─────────────────────────────────────────────────────────────
      // Borde exterior
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(2, Math.round(2.2 * (dpmm / 10)));
      ctx.strokeRect(marginPx, marginPx, sheetWidthPx - 2 * marginPx, sheetHeightPx - 2 * marginPx);

      // Borde interior
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1, Math.round(0.9 * (dpmm / 10)));
      ctx.strokeRect(frameX, frameY, frameW, frameH);

      // ─────────────────────────────────────────────────────────────
      // 5. COMPILAR DOCUMENTO OFICIAL JSPDF
      // ─────────────────────────────────────────────────────────────
      setPrintStatus('Compilando lámina de arquitectura en PDF alta fidelidad...');
      const pdf = new jsPDF({
        orientation: orientacion,
        unit: 'mm',
        format: paperFormat.toLowerCase() as any,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');

      const pdfBlobUrl = pdf.output('bloburl');
      const filename = `Plano_Lanus_${lineaNombre.replace(/\s+/g, '_')}_${paperFormat}.pdf`;
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
