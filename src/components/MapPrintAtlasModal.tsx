'use client';
import React, { useState } from 'react';
import { Printer, X, Download, Loader2, Sparkles, Layers, Compass, MapPin } from 'lucide-react';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { MercatorViewportProjection, LatLng, Point2D, MapboxStaticStyle } from '@/utils/cartographicProjection';
import { getOfficialLineColor, calculateHaversineKm, normalizeLineNumber } from '@/utils/transportUtils';

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

  // Configuración técnica y proporciones arquitectónicas calibradas en milímetros (ISO 216 / IRAM)
  const SHEET_CONFIGS: Record<
    string,
    {
      w: number;
      h: number;
      marginMm: number;
      innerPaddingMm: number;
      headerHeightMm: number;
      caratureHeightMm: number;
      gapMm: number;
      titleFontMm: number;
      subFontMm: number;
      deptFontMm: number;
      caratureTitleMm: number;
      caratureValMm: number;
      badgeLineMm: number;
      crosshairArmMm: number;
      cornerMarkMm: number;
      haloStrokeMm: number;
      traceStrokeMm: number;
      stopRadiusMm: number;
      terminalRadiusMm: number;
      northArrowScale: number;
      outerBorderMm: number;
      innerBorderMm: number;
      baseDpmm: number;
    }
  > = {
    A4: {
      w: 297,
      h: 210,
      marginMm: 6.0,
      innerPaddingMm: 1.8,
      headerHeightMm: 20,
      caratureHeightMm: 32,
      gapMm: 2.0,
      titleFontMm: 5.0,
      subFontMm: 3.5,
      deptFontMm: 2.8,
      caratureTitleMm: 4.5,
      caratureValMm: 3.0,
      badgeLineMm: 13,
      crosshairArmMm: 2.5,
      cornerMarkMm: 5.0,
      haloStrokeMm: 1.8,
      traceStrokeMm: 1.1,
      stopRadiusMm: 1.2,
      terminalRadiusMm: 2.2,
      northArrowScale: 1.0,
      outerBorderMm: 0.7,
      innerBorderMm: 0.35,
      baseDpmm: 11.0,
    },
    A3: {
      w: 420,
      h: 297,
      marginMm: 8.0,
      innerPaddingMm: 2.4,
      headerHeightMm: 26,
      caratureHeightMm: 44,
      gapMm: 2.5,
      titleFontMm: 6.8,
      subFontMm: 4.8,
      deptFontMm: 3.8,
      caratureTitleMm: 6.0,
      caratureValMm: 4.0,
      badgeLineMm: 18,
      crosshairArmMm: 3.2,
      cornerMarkMm: 7.0,
      haloStrokeMm: 2.1,
      traceStrokeMm: 1.3,
      stopRadiusMm: 1.4,
      terminalRadiusMm: 2.6,
      northArrowScale: 1.3,
      outerBorderMm: 0.9,
      innerBorderMm: 0.45,
      baseDpmm: 9.2,
    },
    A2: {
      w: 594,
      h: 420,
      marginMm: 11.0,
      innerPaddingMm: 3.0,
      headerHeightMm: 36,
      caratureHeightMm: 60,
      gapMm: 3.2,
      titleFontMm: 9.5,
      subFontMm: 6.8,
      deptFontMm: 5.4,
      caratureTitleMm: 8.5,
      caratureValMm: 5.6,
      badgeLineMm: 25,
      crosshairArmMm: 4.2,
      cornerMarkMm: 9.5,
      haloStrokeMm: 2.5,
      traceStrokeMm: 1.6,
      stopRadiusMm: 1.7,
      terminalRadiusMm: 3.2,
      northArrowScale: 1.7,
      outerBorderMm: 1.2,
      innerBorderMm: 0.6,
      baseDpmm: 7.6,
    },
    A1: {
      w: 841,
      h: 594,
      marginMm: 15.0,
      innerPaddingMm: 4.0,
      headerHeightMm: 50,
      caratureHeightMm: 84,
      gapMm: 4.2,
      titleFontMm: 13.5,
      subFontMm: 9.5,
      deptFontMm: 7.5,
      caratureTitleMm: 11.5,
      caratureValMm: 7.6,
      badgeLineMm: 34,
      crosshairArmMm: 5.5,
      cornerMarkMm: 13.0,
      haloStrokeMm: 3.0,
      traceStrokeMm: 1.9,
      stopRadiusMm: 2.0,
      terminalRadiusMm: 3.8,
      northArrowScale: 2.2,
      outerBorderMm: 1.5,
      innerBorderMm: 0.75,
      baseDpmm: 6.4,
    },
    A0: {
      w: 1189,
      h: 841,
      marginMm: 20.0,
      innerPaddingMm: 5.0,
      headerHeightMm: 68,
      caratureHeightMm: 115,
      gapMm: 5.5,
      titleFontMm: 18.5,
      subFontMm: 13.0,
      deptFontMm: 10.5,
      caratureTitleMm: 16.0,
      caratureValMm: 10.5,
      badgeLineMm: 46,
      crosshairArmMm: 7.2,
      cornerMarkMm: 17.0,
      haloStrokeMm: 3.6,
      traceStrokeMm: 2.3,
      stopRadiusMm: 2.4,
      terminalRadiusMm: 4.4,
      northArrowScale: 2.8,
      outerBorderMm: 1.8,
      innerBorderMm: 0.9,
      baseDpmm: 5.3,
    },
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
      const config = SHEET_CONFIGS[paperFormat] || SHEET_CONFIGS.A4;
      const pdfWidthMm = isLandscape ? config.w : config.h;
      const pdfHeightMm = isLandscape ? config.h : config.w;

      // Densidad de píxeles por milímetro calibrada para cada formato (Ultra HD sin sobrecargar memoria)
      const dpmmMultiplier = renderScale === 4 ? 1.25 : renderScale === 3 ? 1.0 : 0.8;
      const dpmm = config.baseDpmm * dpmmMultiplier;

      // Conversor milímetros -> píxeles de canvas
      const toPx = (mm: number) => Math.max(1, Math.round(mm * dpmm));

      const sheetWidthPx = toPx(pdfWidthMm);
      const sheetHeightPx = toPx(pdfHeightMm);

      const marginPx = toPx(config.marginMm);
      const innerPaddingPx = toPx(config.innerPaddingMm);

      // En modo vertical (portrait) ampliamos la altura de carátula para holgura de textos
      const caratureHeightMm = isLandscape ? config.caratureHeightMm : config.caratureHeightMm * 1.15;
      const headerHeightMm = config.headerHeightMm;

      const headerHeightPx = toPx(headerHeightMm);
      const caratureHeightPx = toPx(caratureHeightMm);
      const gapPx = toPx(config.gapMm);

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

      // Función auxiliar para truncado limpio y prolijo de textos
      const fitText = (text: string, maxWidth: number) => {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let truncated = text;
        while (truncated.length > 2 && ctx.measureText(truncated + '...').width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
      };

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

      // Cargar mapa base ráster y logotipo oficial de Lanús concurrentemente
      let mapboxLoaded = false;
      let logoImg: HTMLImageElement | null = null;

      const logoPromise = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = '/lanus_gobierno_white.png';
        setTimeout(() => resolve(null), 3000);
      });

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

      logoImg = await logoPromise;

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
      const crossArm = toPx(config.crosshairArmMm);

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = Math.max(1, toPx(0.35));
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
      const cornerMarkLen = toPx(config.cornerMarkMm);
      const cornerMargin = toPx(config.marginMm * 0.35);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(1, toPx(0.55));
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(mapViewportX + cornerMargin, mapViewportY + cornerMargin + cornerMarkLen);
      ctx.lineTo(mapViewportX + cornerMargin, mapViewportY + cornerMargin);
      ctx.lineTo(mapViewportX + cornerMargin + cornerMarkLen, mapViewportY + cornerMargin);
      // Top-Right
      ctx.moveTo(mapViewportX + mapViewportW - cornerMargin - cornerMarkLen, mapViewportY + cornerMargin);
      ctx.lineTo(mapViewportX + mapViewportW - cornerMargin, mapViewportY + cornerMargin);
      ctx.lineTo(mapViewportX + mapViewportW - cornerMargin, mapViewportY + cornerMargin + cornerMarkLen);
      // Bottom-Left
      ctx.moveTo(mapViewportX + cornerMargin, mapViewportY + mapViewportH - cornerMargin - cornerMarkLen);
      ctx.lineTo(mapViewportX + cornerMargin, mapViewportY + mapViewportH - cornerMargin);
      ctx.lineTo(mapViewportX + cornerMargin + cornerMarkLen, mapViewportY + mapViewportH - cornerMargin);
      // Bottom-Right
      ctx.moveTo(mapViewportX + mapViewportW - cornerMargin - cornerMarkLen, mapViewportY + mapViewportH - cornerMargin);
      ctx.lineTo(mapViewportX + mapViewportW - cornerMargin, mapViewportY + mapViewportH - cornerMargin);
      ctx.lineTo(mapViewportX + mapViewportW - cornerMargin, mapViewportY + mapViewportH - cornerMargin - cornerMarkLen);
      ctx.stroke();

      // Retícula Sexagesimal DMS si está activa
      if (incluirCuadricula) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.22)';
        ctx.lineWidth = Math.max(1, toPx(0.3));
        ctx.setLineDash([toPx(2.5), toPx(2.0)]);

        const fontSizeDms = toPx(config.caratureValMm * 0.88);
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
          ctx.fillText(dms, x + toPx(1.5), mapViewportY + fontSizeDms + toPx(2.0));
        }

        for (let r = 1; r < crossRows; r++) {
          const y = mapViewportY + (r * mapViewportH) / crossRows;
          ctx.beginPath();
          ctx.moveTo(mapViewportX, y);
          ctx.lineTo(mapViewportX + mapViewportW, y);
          ctx.stroke();

          const geoPt = proj.unproject(20, (r * mapViewportH) / crossRows);
          const dms = MercatorViewportProjection.formatDMS(geoPt.lat, true);
          ctx.fillText(dms, mapViewportX + toPx(2.5), y - toPx(1.5));
        }
        ctx.setLineDash([]);
      }

      setPrintStatus('Proyectando trazas vectoriales con coincidencia submilimétrica...');

      // Trazas Vectoriales con Halo de Contraste Proporcional
      const officialLineColor = getOfficialLineColor(lineaNombre);
      let globalStartPoint: Point2D | null = null;
      let globalEndPoint: Point2D | null = null;
      let totalRouteDistanceKm = 0;
      let stopCount = 0;

      const allSegments: { coords: Point2D[]; color: string }[] = [];
      const allStops: Point2D[] = [];

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

          allSegments.push({ coords: projectedPts, color });
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
              allStops.push({
                x: mapViewportX + pt.x,
                y: mapViewportY + pt.y,
              });
            }
          });
        }
      });

      // Factor de ajuste dinámico de trazo con relación al mapa
      const traceStrokePx = Math.max(2, toPx(config.traceStrokeMm));
      const haloStrokePx = Math.max(traceStrokePx + 2, toPx(config.haloStrokeMm));

      // ── CAPA 1: Todos los Halos de Contraste juntos (evita solapamiento destructivo entre ramales) ──
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = haloStrokePx;
      ctx.strokeStyle = estiloMapbox.includes('dark') || estiloMapbox.includes('night')
        ? 'rgba(255, 255, 255, 0.95)'
        : 'rgba(255, 255, 255, 0.90)';

      allSegments.forEach((seg) => {
        if (seg.coords.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(seg.coords[0].x, seg.coords[0].y);
        for (let i = 1; i < seg.coords.length; i++) {
          ctx.lineTo(seg.coords[i].x, seg.coords[i].y);
        }
        ctx.stroke();
      });

      // ── CAPA 2: Todas las Líneas de Trazado Oficial ──
      ctx.lineWidth = traceStrokePx;
      allSegments.forEach((seg) => {
        if (seg.coords.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(seg.coords[0].x, seg.coords[0].y);
        for (let i = 1; i < seg.coords.length; i++) {
          ctx.lineTo(seg.coords[i].x, seg.coords[i].y);
        }
        ctx.strokeStyle = seg.color;
        ctx.stroke();
      });

      // ── CAPA 3: Paradas Intermedias Registradas ──
      const r = toPx(config.stopRadiusMm);
      allStops.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + toPx(0.5), 0, Math.PI * 2);
        ctx.fillStyle = '#0F172A';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#10B981';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, r - toPx(0.5)), 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      });

      // ── CAPA 4: Cabecera Inicial (Verde) y Terminal de Destino (Granate) ──
      const termRadius = toPx(config.terminalRadiusMm);
      if (globalStartPoint) {
        const p: Point2D = globalStartPoint;
        ctx.beginPath();
        ctx.arc(p.x, p.y, termRadius + toPx(0.8), 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, termRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#16A34A'; // Verde Cabecera
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1, toPx(0.6));
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, termRadius * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      if (globalEndPoint) {
        const p: Point2D = globalEndPoint;
        ctx.beginPath();
        ctx.arc(p.x, p.y, termRadius + toPx(0.8), 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, termRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#7B1828'; // Granate Lanús
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1, toPx(0.6));
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, termRadius * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      // Rosa de los Vientos (North Arrow) Arquitectónica (Top-Right)
      if (incluirEscalaNorte) {
        const compassW = toPx(config.northArrowScale * 14);
        const compassH = toPx(config.northArrowScale * 22);
        const compassPad = toPx(config.marginMm * 0.7);
        const compassX = mapViewportX + mapViewportW - compassW - compassPad;
        const compassY = mapViewportY + compassPad;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = Math.max(1, toPx(0.35));
        ctx.fillRect(compassX, compassY, compassW, compassH);
        ctx.strokeRect(compassX, compassY, compassW, compassH);

        const cx = compassX + compassW / 2;
        const cy = compassY + compassH * 0.62;
        const needleH = compassH * 0.42;
        const needleW = compassW * 0.28;

        // Letra N
        ctx.font = `bold ${toPx(config.caratureValMm * 1.05)}px Inter, sans-serif`;
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText('N', cx, compassY + toPx(config.caratureValMm * 1.1));

        // Círculo graduado
        ctx.beginPath();
        ctx.arc(cx, cy, needleW * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = Math.max(1, toPx(0.25));
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
        const scaleBarDesiredPx = toPx(config.northArrowScale * 45);
        const scaleBar = proj.getCartographicScaleBar(scaleBarDesiredPx);
        const sbMarginX = mapViewportX + compassPad;
        const sbH = toPx(config.northArrowScale * 13);
        const sbW = scaleBar.widthPx + toPx(18);
        const sbMarginY = mapViewportY + mapViewportH - compassPad - sbH;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = Math.max(1, toPx(0.35));
        ctx.fillRect(sbMarginX, sbMarginY, sbW, sbH);
        ctx.strokeRect(sbMarginX, sbMarginY, sbW, sbH);

        const sbFontSize = toPx(config.caratureValMm * 0.85);
        ctx.font = `bold ${sbFontSize}px Inter, sans-serif`;
        ctx.fillStyle = '#0F172A';
        ctx.fillText(`ESCALA: ${scaleBar.label}`, sbMarginX + toPx(2.5), sbMarginY + sbFontSize + toPx(1.5));

        // Barra segmentada en bloques
        const barStartX = sbMarginX + toPx(2.5);
        const barStartY = sbMarginY + sbFontSize + toPx(3.0);
        const barW = scaleBar.widthPx;
        const barH = toPx(config.northArrowScale * 3.2);
        const numBlocks = 4;
        const blockW = barW / numBlocks;

        for (let b = 0; b < numBlocks; b++) {
          ctx.fillStyle = b % 2 === 0 ? '#0F172A' : '#FFFFFF';
          ctx.fillRect(barStartX + b * blockW, barStartY, blockW, barH);
        }
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = Math.max(1, toPx(0.35));
        ctx.strokeRect(barStartX, barStartY, barW, barH);
      }

      ctx.restore(); // Fin del clip del viewport del mapa

      // Borde técnico del viewport del mapa
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.strokeRect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);

      // ─────────────────────────────────────────────────────────────
      // 1. ENCABEZADO INSTITUCIONAL OFICIAL (Fondo Oscuro con Estética Lanús)
      // ─────────────────────────────────────────────────────────────
      setPrintStatus('Renderizando carátula y encabezado oficial de Lanús Gobierno...');
      const cleanLineNumber = normalizeLineNumber(lineaNombre) || lineaNombre.replace(/^(l[ií]nea|line)\s*/i, '').trim();

      // Fondo oscuro institucional elegante (#1E293B)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(headerX, headerY, headerW, headerH);

      // Franja superior celeste Lanús (#00AEEF)
      const topBarH = Math.max(2, toPx(0.8));
      ctx.fillStyle = '#00AEEF';
      ctx.fillRect(headerX, headerY, headerW, topBarH);

      const crestPad = toPx(config.marginMm * 0.4);
      let titleStartX = headerX + crestPad;

      // Dibujar Logotipo Oficial de Lanús Gobierno (Blanco / Transparente)
      if (logoImg && logoImg.naturalWidth > 0) {
        const logoH = Math.round(headerH * 0.65);
        const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
        const logoW = Math.round(logoH * logoAspect);
        const logoX = headerX + crestPad;
        const logoY = headerY + topBarH + (headerH - topBarH - logoH) / 2;
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
        titleStartX = logoX + logoW + crestPad * 1.2;
      } else {
        // Fallback gráfico: Escudo Lanús con Anillo Celeste
        const crestSize = Math.round(headerH * 0.70);
        const crestX = headerX + crestPad;
        const crestY = headerY + topBarH + (headerH - topBarH - crestSize) / 2;

        ctx.beginPath();
        ctx.arc(crestX + crestSize / 2, crestY + crestSize / 2, crestSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.strokeStyle = '#00AEEF';
        ctx.lineWidth = Math.max(1.5, toPx(0.55));
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(crestX + crestSize / 2, crestY + crestSize / 2, crestSize * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#7B1828';
        ctx.fill();

        ctx.font = `900 ${Math.round(crestSize * 0.52)}px Inter, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('L', crestX + crestSize / 2, crestY + crestSize / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        titleStartX = crestX + crestSize + crestPad;
      }

      const titleFontSize = toPx(config.titleFontMm);
      const subFontSize = toPx(config.subFontMm);
      const deptFontSize = toPx(config.deptFontMm);

      // Identificador Técnico de Plano (a la derecha)
      const idBoxW = Math.round(headerW * (isLandscape ? 0.28 : 0.32));
      const idBoxH = Math.round(headerH * 0.74);
      const idBoxX = headerX + headerW - idBoxW - crestPad;
      const idBoxY = headerY + topBarH + (headerH - topBarH - idBoxH) / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#00AEEF';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.beginPath();
      drawRoundRect(idBoxX, idBoxY, idBoxW, idBoxH, toPx(1.5));
      ctx.fill();
      ctx.stroke();

      const fechaCod = new Date().toISOString().slice(0, 7).replace('-', '');
      ctx.textAlign = 'right';
      ctx.font = `bold ${subFontSize * 0.95}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PLANO DE ORDENAMIENTO VIAL', idBoxX + idBoxW - toPx(3.0), idBoxY + idBoxH * 0.36);

      ctx.font = `bold ${subFontSize * 0.88}px Inter, sans-serif`;
      ctx.fillStyle = '#00AEEF';
      ctx.fillText(`CÓD: LAN-${cleanLineNumber}-${fechaCod}`, idBoxX + idBoxW - toPx(3.0), idBoxY + idBoxH * 0.68);

      ctx.font = `500 ${deptFontSize * 0.82}px Inter, sans-serif`;
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('EPSG:3857 ISOMÉTRICO 1:1', idBoxX + idBoxW - toPx(3.0), idBoxY + idBoxH * 0.92);
      ctx.textAlign = 'start';

      const maxTitleW = idBoxX - titleStartX - toPx(3.0);

      // Línea 1: SUBSECRETARÍA DE PLANIFICACIÓN URBANA en celeste institucional (#00AEEF)
      ctx.font = `800 ${titleFontSize * 0.95}px Inter, sans-serif`;
      ctx.fillStyle = '#00AEEF';
      ctx.fillText(
        fitText('SUBSECRETARÍA DE PLANIFICACIÓN URBANA', maxTitleW),
        titleStartX,
        headerY + headerH * 0.46
      );

      // Línea 2: DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE · LANÚS DIGITAL
      ctx.font = `600 ${deptFontSize * 1.05}px Inter, sans-serif`;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(
        fitText('DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE · LANÚS DIGITAL', maxTitleW),
        titleStartX,
        headerY + headerH * 0.78
      );

      // ─────────────────────────────────────────────────────────────
      // 3. CARÁTULA ARQUITECTÓNICA DE URBANISMO (TITLE BLOCK)
      // ─────────────────────────────────────────────────────────────
      // Fondo blanco puro con bordes y líneas tenues claras
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(caratureX, caratureY, caratureW, caratureH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.max(1, toPx(config.innerBorderMm));
      ctx.strokeRect(caratureX, caratureY, caratureW, caratureH);

      // 3 Columnas claras sin firmas:
      // Col 1: Proyecto y Línea (44%)
      // Col 2: Ficha Técnica (28%)
      // Col 3: Simbología y Referencias Cartográficas Oficiales (28%)
      const col1Ratio = 0.44;
      const col2Ratio = 0.28;
      const col1W = Math.round(caratureW * col1Ratio);
      const col2W = Math.round(caratureW * col2Ratio);
      const col3W = caratureW - col1W - col2W;

      const col1X = caratureX;
      const col2X = caratureX + col1W;
      const col3X = col2X + col2W;

      // Divisores verticales tenues
      ctx.beginPath();
      ctx.moveTo(col2X, caratureY);
      ctx.lineTo(col2X, caratureY + caratureH);
      ctx.moveTo(col3X, caratureY);
      ctx.lineTo(col3X, caratureY + caratureH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.stroke();

      const caraturePad = toPx(config.marginMm * 0.4);
      const valFontSize = toPx(config.caratureValMm);
      const titleFontCarature = toPx(config.caratureTitleMm);

      // ── COLUMNA 1: PROYECTO Y UBICACIÓN ──
      const col1InnerW = col1W - 2 * caraturePad;
      ctx.font = `bold ${valFontSize * 0.95}px Inter, sans-serif`;
      ctx.fillStyle = '#7B1828'; // Granate Lanús
      ctx.fillText(
        fitText('PROYECTO: RED DE TRANSPORTE PÚBLICO COLECTIVO', col1InnerW),
        col1X + caraturePad,
        caratureY + caratureH * 0.15
      );

      ctx.font = `600 ${valFontSize * 0.85}px Inter, sans-serif`;
      ctx.fillStyle = '#475569';
      ctx.fillText(
        fitText('UBICACIÓN: PARTIDO DE LANÚS · PROVINCIA DE BUENOS AIRES', col1InnerW),
        col1X + caraturePad,
        caratureY + caratureH * 0.28
      );

      // Divisor sutil
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = Math.max(1, toPx(0.35));
      ctx.beginPath();
      ctx.moveTo(col1X + caraturePad, caratureY + caratureH * 0.36);
      ctx.lineTo(col1X + col1W - caraturePad, caratureY + caratureH * 0.36);
      ctx.stroke();

      // Badge con color oficial de línea
      const badgeLineSize = Math.round(caratureH * 0.48);
      const badgeLineX = col1X + caraturePad;
      const badgeLineY = caratureY + caratureH * 0.43;

      ctx.beginPath();
      ctx.arc(badgeLineX + badgeLineSize / 2, badgeLineY + badgeLineSize / 2, badgeLineSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = officialLineColor;
      ctx.fill();

      // Texto dentro del badge: SÓLO EL NÚMERO (e.g. "520", nunca "Línea 520")
      const badgeText = cleanLineNumber;
      const badgeFontScale = badgeText.length <= 2 ? 0.52 : badgeText.length === 3 ? 0.42 : 0.33;
      ctx.font = `900 ${Math.round(badgeLineSize * badgeFontScale)}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeLineX + badgeLineSize / 2, badgeLineY + badgeLineSize / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      const lineTextX = badgeLineX + badgeLineSize + toPx(config.marginMm * 0.35);
      const lineTextMaxW = col1X + col1W - lineTextX - caraturePad;

      ctx.font = `bold ${titleFontCarature}px Inter, sans-serif`;
      ctx.fillStyle = '#0F172A';
      // Desduplicar nombres de ramales para evitar "Vuelta, Ida, Vuelta, Ida..."
      const ramalesUnicos = Array.from(new Set(capasFiltradas.map((c) => c.nombre.trim()).filter(Boolean)));
      const ramalesStr = ramalesUnicos.length > 0 ? ramalesUnicos.join(' · ') : 'Recorrido General';

      ctx.fillText(
        fitText(`LÍNEA ${cleanLineNumber} · ${ramalesStr}`, lineTextMaxW),
        lineTextX,
        badgeLineY + badgeLineSize * 0.45
      );

      ctx.font = `600 ${valFontSize * 0.88}px Inter, sans-serif`;
      ctx.fillStyle = '#64748B';
      ctx.fillText(
        fitText(`RELEVAMIENTO: ${capasFiltradas.length} variante(s) activa(s) · Sistema Integrado Lanús`, lineTextMaxW),
        lineTextX,
        badgeLineY + badgeLineSize * 0.85
      );

      // ── COLUMNA 2: FICHA TÉCNICA Y CÓMPUTO ──
      const rowStep = caratureH / 5.2;
      const metrics = [
        { label: 'Longitud de Traza:', val: `${totalRouteDistanceKm.toFixed(2)} km` },
        { label: 'Paradas Registradas:', val: `${stopCount > 0 ? stopCount : capasFiltradas.length * 2}` },
        { label: 'Coordenadas GPS:', val: `${allCoords.length} pts (WGS-84)` },
        {
          label: 'Fecha de Emisión:',
          val: new Date().toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        { label: 'Datum / Proyección:', val: 'EPSG:3857 Isométrico 1:1' },
      ];

      metrics.forEach((m, idx) => {
        const y = caratureY + (idx + 0.85) * rowStep;
        ctx.font = `500 ${valFontSize * 0.88}px Inter, sans-serif`;
        ctx.fillStyle = '#64748B';
        ctx.fillText(m.label, col2X + caraturePad, y);

        ctx.font = `bold ${valFontSize * 0.95}px Inter, sans-serif`;
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'right';
        ctx.fillText(m.val, col2X + col2W - caraturePad, y);
        ctx.textAlign = 'start';
      });

      // ── COLUMNA 3: SIMBOLOGÍA Y REFERENCIAS TÉCNICAS (Reemplaza firmas) ──
      const col3Pad = caraturePad;
      const col3InnerW = col3W - 2 * col3Pad;
      ctx.font = `bold ${valFontSize * 0.95}px Inter, sans-serif`;
      ctx.fillStyle = '#7B1828';
      ctx.fillText(
        fitText('SIMBOLOGÍA & REFERENCIAS TÉCNICAS', col3InnerW),
        col3X + col3Pad,
        caratureY + caratureH * 0.15
      );

      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = Math.max(1, toPx(0.35));
      ctx.beginPath();
      ctx.moveTo(col3X + col3Pad, caratureY + caratureH * 0.22);
      ctx.lineTo(col3X + col3W - col3Pad, caratureY + caratureH * 0.22);
      ctx.stroke();

      // 4 Elementos de Referencia Técnica
      const legStep = (caratureH * 0.72) / 4;
      const legStartY = caratureY + caratureH * 0.34;

      // Item 1: Traza de Colectivo
      const y1 = legStartY;
      const iconX = col3X + col3Pad + toPx(4);
      ctx.beginPath();
      ctx.moveTo(iconX - toPx(4), y1);
      ctx.lineTo(iconX + toPx(5), y1);
      ctx.lineWidth = Math.max(3, toPx(config.traceStrokeMm * 1.2));
      ctx.strokeStyle = officialLineColor;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.font = `600 ${valFontSize * 0.85}px Inter, sans-serif`;
      ctx.fillStyle = '#334155';
      ctx.fillText(
        fitText(`Traza Oficial (Línea ${cleanLineNumber})`, col3InnerW - toPx(14)),
        iconX + toPx(8),
        y1 + toPx(1.0)
      );

      // Item 2: Cabecera Inicial
      const y2 = legStartY + legStep;
      ctx.beginPath();
      ctx.arc(iconX, y2 - toPx(1.0), toPx(2.2), 0, Math.PI * 2);
      ctx.fillStyle = '#16A34A';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, toPx(0.5));
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.fillText(
        fitText('Cabecera Inicial / Salida', col3InnerW - toPx(14)),
        iconX + toPx(8),
        y2 + toPx(1.0)
      );

      // Item 3: Terminal de Destino
      const y3 = legStartY + 2 * legStep;
      ctx.beginPath();
      ctx.arc(iconX, y3 - toPx(1.0), toPx(2.2), 0, Math.PI * 2);
      ctx.fillStyle = '#7B1828';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, toPx(0.5));
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.fillText(
        fitText('Terminal de Recorrido / Llegada', col3InnerW - toPx(14)),
        iconX + toPx(8),
        y3 + toPx(1.0)
      );

      // Item 4: Parada Registrada + Escala Numérica
      const y4 = legStartY + 3 * legStep;
      ctx.beginPath();
      ctx.arc(iconX, y4 - toPx(1.0), toPx(1.8), 0, Math.PI * 2);
      ctx.fillStyle = '#10B981';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(1, toPx(0.5));
      ctx.stroke();

      const metersPerPixel = proj.getMetersPerPixel();
      const scaleDenominator = Math.round(dpmm * 1000 * metersPerPixel);
      const escalaStr = scaleDenominator > 0 ? ` · 1:${scaleDenominator.toLocaleString('es-AR')}` : '';

      ctx.fillStyle = '#334155';
      ctx.fillText(
        fitText(`Paradas Oficiales${escalaStr}`, col3InnerW - toPx(14)),
        iconX + toPx(8),
        y4 + toPx(1.0)
      );

      // ─────────────────────────────────────────────────────────────
      // 4. DOBLE RECUADRO PERIMETRAL TÉCNICO DE ARQUITECTURA
      // ─────────────────────────────────────────────────────────────
      // Borde exterior en pizarra arquitectónica suave
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = Math.max(1.5, toPx(config.outerBorderMm));
      ctx.strokeRect(marginPx, marginPx, sheetWidthPx - 2 * marginPx, sheetHeightPx - 2 * marginPx);

      // Borde interior en gris técnico claro
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = Math.max(1, toPx(config.innerBorderMm));
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
                  sub: 'Minimalista / Alto Contraste',
                  motor: 'mapbox',
                },
                {
                  id: 'navigation-day-v1',
                  label: '🚗 Red Vial Vectorial',
                  sub: 'Líneas viales y nombres nítidos',
                  motor: 'mapbox',
                },
                {
                  id: 'outdoors-v12',
                  label: '🌳 Topográfico & Verde',
                  sub: 'Relieve, espacios verdes y vías',
                  motor: 'mapbox',
                },
                {
                  id: 'satellite-streets-v12',
                  label: '🛰️ Satélite HD + Calles',
                  sub: 'Ortofoto aérea con nombres',
                  motor: 'mapbox',
                },
                {
                  id: 'dark-v11',
                  label: '🌙 Plano Técnico Oscuro',
                  sub: 'Fondo oscuro / Contraste alto',
                  motor: 'mapbox',
                },
                {
                  id: 'navigation-night-v1',
                  label: '🌌 Vial Nocturno',
                  sub: 'Tránsito y vías fluo',
                  motor: 'mapbox',
                },
                {
                  id: 'pantalla',
                  label: '🖥️ Captura de Pantalla',
                  sub: 'Vista exacta interactiva Leaflet',
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
