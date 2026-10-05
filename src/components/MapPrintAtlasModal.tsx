'use client';
import React, { useState, useMemo } from 'react';
import {
  Printer,
  X,
  Download,
  Loader2,
  Sparkles,
  Layers,
  Compass,
  MapPin,
  FileText,
  Copy,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  ZoomIn,
  Globe,
  CheckSquare,
  Square,
  Eye,
} from 'lucide-react';
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
  todasCapas?: any[];
  cacheDatosGeo: Record<string, any>;
  mapInstance: L.Map | null;
}

export type PageLayoutMode = 'individual' | 'all-in-one' | 'both';
export type FramingMode = 'tight' | 'optimal' | 'relaxed';

export default function MapPrintAtlasModal({
  isOpen,
  onClose,
  lineaNombre,
  capasLinea,
  todasCapas = [],
  cacheDatosGeo,
  mapInstance,
}: MapPrintAtlasModalProps) {
  const [ramalesSeleccionados, setRamalesSeleccionados] = useState<string[]>([]);
  const [modoVarita, setModoVarita] = useState<boolean>(false);
  const [pageLayout, setPageLayout] = useState<PageLayoutMode>('all-in-one');
  const [framingMode, setFramingMode] = useState<FramingMode>('optimal');
  const [paperFormat, setPaperFormat] = useState<'A4' | 'A3' | 'A2' | 'A1' | 'A0'>('A4');
  const [orientacion, setOrientacion] = useState<'landscape' | 'portrait'>('landscape');
  const [renderScale, setRenderScale] = useState<number>(3); // 2: Standard, 3: HD, 4: Ultra HD
  const [motorCartografico, setMotorCartografico] = useState<'mapbox' | 'pantalla'>('mapbox');
  const [estiloMapbox, setEstiloMapbox] = useState<MapboxStaticStyle>('streets-v12');
  const [incluirCuadricula, setIncluirCuadricula] = useState<boolean>(true);
  const [incluirEscalaNorte, setIncluirEscalaNorte] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string>('');

  // 🗺️ Estados para Superposición de Líneas por jurisdicción (Nacional / Provincial / Municipal)
  const [incluirNacionales, setIncluirNacionales] = useState<boolean>(false);
  const [jurisdiccionOverlay, setJurisdiccionOverlay] = useState<'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL'>('NACIONAL');
  const [nacionalesSeleccionadas, setNacionalesSeleccionadas] = useState<string[]>([]);
  const [modoEstiloNacionales, setModoEstiloNacionales] = useState<'sutil' | 'color'>('color');
  const [busquedaNacionales, setBusquedaNacionales] = useState<string>('');

  // Metadatos de etiqueta según la jurisdicción elegida para superponer
  const overlayMeta = {
    NACIONAL: {
      titulo: 'Nacionales (1-199)',
      plural: 'nacionales',
      corta: 'Nac.',
      buscar: '🔍 Filtrar línea nacional (ej: 9, 45, 158, 160)...',
      subtitulo: 'Compará referencias, corredores e idas/vueltas de la red nacional',
      emoji: '🇦🇷',
    },
    PROVINCIAL: {
      titulo: 'Provinciales (200-499)',
      plural: 'provinciales',
      corta: 'Prov.',
      buscar: '🔍 Filtrar línea provincial (ej: 203, 271, 354)...',
      subtitulo: 'Compará referencias, corredores e idas/vueltas de la red provincial',
      emoji: '🗺️',
    },
    MUNICIPAL: {
      titulo: 'Municipales (500+)',
      plural: 'municipales',
      corta: 'Mun.',
      buscar: '🔍 Filtrar línea municipal (ej: 501, 520, 543)...',
      subtitulo: 'Compará referencias, corredores e idas/vueltas de la red municipal',
      emoji: '🏘️',
    },
  } as const;
  const metaOverlay = overlayMeta[jurisdiccionOverlay];

  // Filtrar las líneas disponibles para superponer según la jurisdicción elegida
  // Convención argentina: Nacionales 1-199 · Provinciales 200-499 · Municipales 500+
  const capasNacionalesDisponibles = useMemo(() => {
    if (!todasCapas || todasCapas.length === 0) return [];

    // Solo si el modal fue abierto para una línea específica pequeña (<= 4 capas), excluimos las de esa misma línea
    // Si fue abierto para una selección amplia o mapa general, permitimos todas
    const excluirIds =
      capasLinea && capasLinea.length <= 4 ? new Set(capasLinea.map((c) => c.id)) : new Set();

    const filtered = todasCapas.filter((c) => {
      if (!c || excluirIds.has(c.id)) return false;
      const cat = (c.categoria || c.subGrupo?.categoria || '').toUpperCase();
      const grupo = (c.grupo?.nombre || '').toLowerCase();
      const subGrupo = (c.subGrupo?.nombre || '').toLowerCase();
      const rawNum =
        c.numero ||
        normalizeLineNumber(c.subGrupo?.nombre || '') ||
        normalizeLineNumber(c.nombre) ||
        '0';
      const num = parseInt(rawNum, 10);

      if (jurisdiccionOverlay === 'PROVINCIAL') {
        return (
          cat === 'PROVINCIAL' ||
          grupo.includes('provincial') ||
          subGrupo.includes('provincial') ||
          (num >= 200 && num < 500)
        );
      }
      if (jurisdiccionOverlay === 'MUNICIPAL') {
        return (
          cat === 'MUNICIPAL' ||
          grupo.includes('municipal') ||
          subGrupo.includes('municipal') ||
          num >= 500
        );
      }
      // NACIONAL (por defecto)
      return (
        cat === 'NACIONAL' ||
        grupo.includes('nacional') ||
        subGrupo.includes('nacional') ||
        (num > 0 && num < 200)
      );
    });

    // Ordenar numéricamente por número de línea
    return filtered.sort((a, b) => {
      const numA = parseInt(
        a.numero || normalizeLineNumber(a.subGrupo?.nombre || '') || normalizeLineNumber(a.nombre) || '999',
        10
      );
      const numB = parseInt(
        b.numero || normalizeLineNumber(b.subGrupo?.nombre || '') || normalizeLineNumber(b.nombre) || '999',
        10
      );
      if (numA !== numB) return numA - numB;
      return (a.subGrupo?.nombre || a.nombre || '').localeCompare(b.subGrupo?.nombre || b.nombre || '');
    });
  }, [todasCapas, capasLinea, jurisdiccionOverlay]);

  // Sincronizar ramales seleccionados cada vez que se abre el modal
  React.useEffect(() => {
    if (isOpen) {
      setModoVarita(false);
      if (capasLinea && capasLinea.length > 0) {
        setRamalesSeleccionados(capasLinea.map((c) => c.id));
      }
      // Inicializar nacionales seleccionadas con todas las disponibles
      if (capasNacionalesDisponibles.length > 0) {
        setNacionalesSeleccionadas(capasNacionalesDisponibles.map((c) => c.id));
      }
    }
  }, [isOpen, capasLinea, capasNacionalesDisponibles]);

  const detectSentido = (capa: any, feature?: any): 'IDA' | 'VUELTA' => {
    const props = feature?.properties || {};
    const sentidoRaw = (
      capa.sentido ||
      props._sentido ||
      props.sentido ||
      props.direction ||
      ''
    )
      .toString()
      .toUpperCase()
      .trim();

    if (sentidoRaw === 'VUELTA' || sentidoRaw === 'REGRESO' || sentidoRaw === 'RETORNO') return 'VUELTA';
    if (sentidoRaw === 'IDA') return 'IDA';

    const nombre = `${capa.nombre || ''} ${props.nombre || ''} ${props.name || ''} ${capa.subSubGrupo?.nombre || ''}`.toLowerCase();
    if (nombre.includes('vuelta') || nombre.includes('regreso') || nombre.includes('retorno')) {
      return 'VUELTA';
    }
    return 'IDA';
  };

  const getLayerFeatureSegments = (capa: any) => {
    let geo = cacheDatosGeo[capa.id] || capa.datosGeo;
    if (!geo) return [];
    if (typeof geo === 'string') {
      try {
        geo = JSON.parse(geo);
      } catch (e) {
        return [];
      }
    }

    const features = geo.type === 'FeatureCollection' ? geo.features : [geo];
    const segments: { nombre: string; coords: [number, number][]; isVuelta: boolean }[] = [];

    features.forEach((f: any, idx: number) => {
      if (!f || !f.geometry) return;
      const type = f.geometry.type;
      const geomCoords = f.geometry.coordinates;
      const featCoords: [number, number][] = [];
      const isVuelta = detectSentido(capa, f) === 'VUELTA';

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
          isVuelta,
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
  const capasNacionalesActivas = incluirNacionales
    ? capasNacionalesDisponibles.filter((c) => nacionalesSeleccionadas.includes(c.id))
    : [];

  const getCoordinatesForLayers = (layers: any[]): [number, number][] => {
    const allCoords: [number, number][] = [];
    layers.forEach((c) => {
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

  /**
   * Renderiza una lámina individual en un canvas maestro de alta resolución
   */
  const renderSingleSheetCanvas = async ({
    targetCapas,
    nationalCapas,
    pageTitle,
    pageSubtitle,
    pageNumber,
    totalPages,
    config,
    isLandscape,
    pdfWidthMm,
    pdfHeightMm,
    paddingFraction,
    dpmm,
    logoImg,
  }: {
    targetCapas: any[];
    nationalCapas: any[];
    pageTitle: string;
    pageSubtitle: string;
    pageNumber: number;
    totalPages: number;
    config: (typeof SHEET_CONFIGS)['A4'];
    isLandscape: boolean;
    pdfWidthMm: number;
    pdfHeightMm: number;
    paddingFraction: number;
    dpmm: number;
    logoImg: HTMLImageElement | null;
  }): Promise<HTMLCanvasElement> => {
    const toPx = (mm: number) => Math.max(1, Math.round(mm * dpmm));

    const sheetWidthPx = toPx(pdfWidthMm);
    const sheetHeightPx = toPx(pdfHeightMm);

    const marginPx = toPx(config.marginMm);
    const innerPaddingPx = toPx(config.innerPaddingMm);

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
    const mapViewportH = frameH - headerHeightPx - caratureHeightPx - 2 * gapPx;

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

    // Función auxiliar para truncado limpio de textos
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

    // Proyector Isométrico Web Mercator (EPSG:3857) enfocado a la línea principal de la lámina
    const targetCoords = getCoordinatesForLayers(targetCapas);
    const points: LatLng[] = targetCoords.map(([lat, lng]) => ({ lat, lng }));
    const proj = new MercatorViewportProjection(points, mapViewportW, mapViewportH, paddingFraction);

    // Cargar mapa base ráster
    let mapboxLoaded = false;
    if (motorCartografico === 'mapbox') {
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
    } else if (mapInstance) {
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

    if (!mapboxLoaded) {
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
    ctx.moveTo(mapViewportX + cornerMargin, mapViewportY + cornerMargin + cornerMarkLen);
    ctx.lineTo(mapViewportX + cornerMargin, mapViewportY + cornerMargin);
    ctx.lineTo(mapViewportX + cornerMargin + cornerMarkLen, mapViewportY + cornerMargin);

    ctx.moveTo(mapViewportX + mapViewportW - cornerMargin - cornerMarkLen, mapViewportY + cornerMargin);
    ctx.lineTo(mapViewportX + mapViewportW - cornerMargin, mapViewportY + cornerMargin);
    ctx.lineTo(mapViewportX + mapViewportW - cornerMargin, mapViewportY + cornerMargin + cornerMarkLen);

    ctx.moveTo(mapViewportX + cornerMargin, mapViewportY + mapViewportH - cornerMargin - cornerMarkLen);
    ctx.lineTo(mapViewportX + cornerMargin, mapViewportY + mapViewportH - cornerMargin);
    ctx.lineTo(mapViewportX + cornerMargin + cornerMarkLen, mapViewportY + mapViewportH - cornerMargin);

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

    // ─────────────────────────────────────────────────────────────
    // 🇦🇷 SUPERPOSICIÓN DE LÍNEAS NACIONALES (CAPA DE REFERENCIA Y COMPARACIÓN)
    // ─────────────────────────────────────────────────────────────
    const nationalSegments: { coords: Point2D[]; color: string; isVuelta: boolean; label: string }[] = [];
    if (nationalCapas.length > 0) {
      nationalCapas.forEach((capa) => {
        const segs = getLayerFeatureSegments(capa);
        const isVuelta = detectSentido(capa) === 'VUELTA';
        const num = normalizeLineNumber(capa.nombre) || normalizeLineNumber(capa.subGrupo?.nombre || '') || '';
        const rawColor = capa.color || getOfficialLineColor(capa.nombre);
        const color =
          modoEstiloNacionales === 'sutil'
            ? '#64748B' // Gris pizarra técnico
            : rawColor;

        segs.forEach((seg) => {
          if (seg.coords.length < 2) return;
          const projectedPts: Point2D[] = seg.coords.map(([lat, lng]) => {
            const pt = proj.project(lat, lng);
            return {
              x: mapViewportX + pt.x,
              y: mapViewportY + pt.y,
            };
          });

          nationalSegments.push({
            coords: projectedPts,
            color,
            isVuelta: seg.isVuelta || isVuelta,
            label: num ? `L.${num}` : capa.nombre,
          });
        });
      });

      // Halos para líneas nacionales
      const natHaloPx = Math.max(2, toPx(config.traceStrokeMm * 1.1));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = natHaloPx;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';

      nationalSegments.forEach((seg) => {
        if (seg.coords.length < 2) return;
        if (seg.isVuelta) {
          ctx.setLineDash([toPx(3.5), toPx(2.2)]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(seg.coords[0].x, seg.coords[0].y);
        for (let i = 1; i < seg.coords.length; i++) {
          ctx.lineTo(seg.coords[i].x, seg.coords[i].y);
        }
        ctx.stroke();
      });

      // Trazo para líneas nacionales
      const natStrokePx = Math.max(1.5, toPx(config.traceStrokeMm * 0.75));
      ctx.lineWidth = natStrokePx;
      nationalSegments.forEach((seg) => {
        if (seg.coords.length < 2) return;
        if (seg.isVuelta) {
          ctx.setLineDash([toPx(3.5), toPx(2.2)]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(seg.coords[0].x, seg.coords[0].y);
        for (let i = 1; i < seg.coords.length; i++) {
          ctx.lineTo(seg.coords[i].x, seg.coords[i].y);
        }
        ctx.strokeStyle = seg.color;
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // ─────────────────────────────────────────────────────────────
    // TRAZAS VECTORIALES PRINCIPALES (LÍNEA OBJETIVO)
    // ─────────────────────────────────────────────────────────────
    const officialLineColor = getOfficialLineColor(lineaNombre);
    let globalStartPoint: Point2D | null = null;
    let globalEndPoint: Point2D | null = null;
    let totalRouteDistanceKm = 0;
    let stopCount = 0;

    const allSegments: { coords: Point2D[]; color: string; isVuelta: boolean }[] = [];
    const allStops: Point2D[] = [];

    targetCapas.forEach((capa) => {
      const segs = getLayerFeatureSegments(capa);
      const color = capa.color || officialLineColor;
      const isVueltaCapa = detectSentido(capa) === 'VUELTA';

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

        allSegments.push({
          coords: projectedPts,
          color,
          isVuelta: seg.isVuelta || isVueltaCapa,
        });
      });

      // Paradas de la capa
      let geo = cacheDatosGeo[capa.id] || capa.datosGeo;
      if (typeof geo === 'string') {
        try {
          geo = JSON.parse(geo);
        } catch (e) {}
      }
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

    const traceStrokePx = Math.max(2, toPx(config.traceStrokeMm * 1.15));
    const haloStrokePx = Math.max(traceStrokePx + 2, toPx(config.haloStrokeMm));

    // ── CAPA 1: Halos de Contraste para la Línea Principal ──
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = haloStrokePx;
    ctx.strokeStyle =
      estiloMapbox.includes('dark') || estiloMapbox.includes('night')
        ? 'rgba(255, 255, 255, 0.95)'
        : 'rgba(255, 255, 255, 0.94)';

    allSegments.forEach((seg) => {
      if (seg.coords.length < 2) return;
      if (seg.isVuelta) {
        ctx.setLineDash([toPx(4.5), toPx(2.5)]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(seg.coords[0].x, seg.coords[0].y);
      for (let i = 1; i < seg.coords.length; i++) {
        ctx.lineTo(seg.coords[i].x, seg.coords[i].y);
      }
      ctx.stroke();
    });

    // ── CAPA 2: Trazado Principal (Continuo = Ida, Discontinuo = Vuelta) ──
    ctx.lineWidth = traceStrokePx;
    allSegments.forEach((seg) => {
      if (seg.coords.length < 2) return;
      if (seg.isVuelta) {
        ctx.setLineDash([toPx(4.5), toPx(2.5)]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(seg.coords[0].x, seg.coords[0].y);
      for (let i = 1; i < seg.coords.length; i++) {
        ctx.lineTo(seg.coords[i].x, seg.coords[i].y);
      }
      ctx.strokeStyle = seg.color;
      ctx.stroke();
    });
    ctx.setLineDash([]); // Reset dash

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

    // ── CAPA 4: Cabecera Inicial (Verde) y Terminal de Destino (Granate) con Carteles de Hito ──
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

      // Cartel flotante de hito: CABECERA (INICIO)
      const badgeText = 'INICIO CABECERA';
      const badgeFontPx = toPx(config.caratureValMm * 0.72);
      ctx.font = `bold ${badgeFontPx}px Inter, sans-serif`;
      const textW = ctx.measureText(badgeText).width;
      const bW = textW + toPx(5.0);
      const bH = badgeFontPx + toPx(2.4);
      const bX = p.x - bW / 2;
      const bY = p.y - termRadius - bH - toPx(1.8);

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = Math.max(1, toPx(0.35));
      ctx.beginPath();
      drawRoundRect(bX, bY, bW, bH, toPx(1.0));
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#15803D';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, p.x, bY + badgeFontPx + toPx(0.4));
      ctx.textAlign = 'start';
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

      // Cartel flotante de hito: TERMINAL (DESTINO)
      const badgeText = 'TERMINAL DESTINO';
      const badgeFontPx = toPx(config.caratureValMm * 0.72);
      ctx.font = `bold ${badgeFontPx}px Inter, sans-serif`;
      const textW = ctx.measureText(badgeText).width;
      const bW = textW + toPx(5.0);
      const bH = badgeFontPx + toPx(2.4);
      const bX = p.x - bW / 2;
      const bY = p.y - termRadius - bH - toPx(1.8);

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#7B1828';
      ctx.lineWidth = Math.max(1, toPx(0.35));
      ctx.beginPath();
      drawRoundRect(bX, bY, bW, bH, toPx(1.0));
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#7B1828';
      ctx.textAlign = 'center';
      ctx.fillText(badgeText, p.x, bY + badgeFontPx + toPx(0.4));
      ctx.textAlign = 'start';
    }

    // Badge Cartográfico de Contexto Urbano en el mapa (Top-Left)
    const contextBoxPad = toPx(config.marginMm * 0.5);
    const contextBoxX = mapViewportX + contextBoxPad;
    const contextBoxY = mapViewportY + contextBoxPad;
    const contextBoxW = Math.round(mapViewportW * 0.42);
    const contextBoxH = toPx(config.headerHeightMm * 0.56);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = '#00AEEF';
    ctx.lineWidth = Math.max(1, toPx(0.35));
    ctx.beginPath();
    drawRoundRect(contextBoxX, contextBoxY, contextBoxW, contextBoxH, toPx(1.5));
    ctx.fill();
    ctx.stroke();

    const ctxFontMain = toPx(config.caratureValMm * 0.88);
    const ctxFontSub = toPx(config.caratureValMm * 0.72);
    ctx.font = `800 ${ctxFontMain}px Inter, sans-serif`;
    ctx.fillStyle = '#0F172A';
    ctx.fillText(
      fitText(`RED DE COLECTIVOS · ${pageTitle}`, contextBoxW - toPx(4)),
      contextBoxX + toPx(2.5),
      contextBoxY + ctxFontMain + toPx(1.5)
    );

    const natContextStr =
      nationalCapas.length > 0 ? ` · ${nationalCapas.length} trazas ref. ${metaOverlay.corta}` : '';
    ctx.font = `600 ${ctxFontSub}px Inter, sans-serif`;
    ctx.fillStyle = '#0284C7';
    ctx.fillText(
      fitText(
        `LONGITUD: ${totalRouteDistanceKm.toFixed(2)} km · ${stopCount > 0 ? stopCount : targetCapas.length * 2} PARADAS${natContextStr}`,
        contextBoxW - toPx(4)
      ),
      contextBoxX + toPx(2.5),
      contextBoxY + ctxFontMain + ctxFontSub + toPx(3.2)
    );

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

    // ─────────────────────────────────────────────────────────────
    // CUADRO DE REFERENCIAS CARTOGRÁFICAS DETALLADO POR TRAZA (BOTTOM-RIGHT)
    // ─────────────────────────────────────────────────────────────
    const allUniqueLegendItems: {
      id: string;
      color: string;
      lineNum: string;
      ramal: string;
      sentido: 'IDA' | 'VUELTA';
      isNational: boolean;
    }[] = [];

    const seenKeys = new Set<string>();

    // 1. Trazas principales seleccionadas
    targetCapas.forEach((c) => {
      const sentido = detectSentido(c);
      const color = c.color || officialLineColor;
      const num = c.numero || normalizeLineNumber(c.subGrupo?.nombre || '') || normalizeLineNumber(c.nombre) || '';
      const lineNum = num ? `L.${num}` : (c.subGrupo?.nombre || c.nombre || 'Línea');
      const ramal = c.subSubGrupo?.nombre || c.subcategoria || (c.subGrupo?.nombre && c.nombre ? c.nombre : '');
      const key = `${lineNum}-${ramal}-${sentido}-${color}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allUniqueLegendItems.push({
          id: c.id,
          color,
          lineNum,
          ramal,
          sentido,
          isNational: false,
        });
      }
    });

    // 2. Trazas nacionales superpuestas
    nationalCapas.forEach((c) => {
      const sentido = detectSentido(c);
      const num = c.numero || normalizeLineNumber(c.subGrupo?.nombre || '') || normalizeLineNumber(c.nombre) || '';
      const lineNum = num ? `L.${num}` : (c.subGrupo?.nombre || c.nombre || 'L. Nac.');
      const rawColor = c.color || getOfficialLineColor(c.nombre);
      const color = modoEstiloNacionales === 'sutil' ? '#64748B' : rawColor;
      const ramal = c.subSubGrupo?.nombre || c.subcategoria || '';
      const key = `${lineNum}-${ramal}-${sentido}-${color}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allUniqueLegendItems.push({
          id: c.id,
          color,
          lineNum,
          ramal,
          sentido,
          isNational: true,
        });
      }
    });

    if (allUniqueLegendItems.length > 0) {
      // Leyenda compacta: máximo 5 filas visibles, el resto se resume en "+ N trazas"
      const maxDisplay = Math.min(5, allUniqueLegendItems.length);
      const itemsToDisplay = allUniqueLegendItems.slice(0, maxDisplay);
      const remainingCount = allUniqueLegendItems.length - maxDisplay;

      const legBoxPad = toPx(config.marginMm * 0.45);
      const legFontSize = toPx(config.caratureValMm * 0.62);
      const legTitleSize = toPx(config.caratureValMm * 0.72);
      const itemRowH = toPx(config.caratureValMm * 1.05);

      const legBoxW = Math.round(mapViewportW * (isLandscape ? 0.28 : 0.34));
      const legBoxH =
        legTitleSize +
        toPx(2.5) +
        itemsToDisplay.length * itemRowH +
        (remainingCount > 0 ? toPx(4) : toPx(2)) +
        toPx(2);

      const legBoxX = mapViewportX + mapViewportW - legBoxW - legBoxPad;
      const legBoxY = mapViewportY + mapViewportH - legBoxH - legBoxPad;

      // Fondo semitransparente con borde nítido
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.beginPath();
      drawRoundRect(legBoxX, legBoxY, legBoxW, legBoxH, toPx(1.5));
      ctx.fill();
      ctx.stroke();

      // Franja superior de título
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      drawRoundRect(legBoxX, legBoxY, legBoxW, legTitleSize + toPx(3), toPx(1.5));
      ctx.fill();

      ctx.font = `800 ${legTitleSize}px Inter, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        fitText('REFERENCIAS · TRAZAS & RAMALES', legBoxW - toPx(6)),
        legBoxX + toPx(3.5),
        legBoxY + legTitleSize + toPx(0.8)
      );

      // Renderizar cada traza con su muestra de línea (continua o discontinua) y nombre
      itemsToDisplay.forEach((item, i) => {
        const itemY = legBoxY + legTitleSize + toPx(4) + (i + 0.65) * itemRowH;
        const swatchStartX = legBoxX + toPx(3.5);
        const swatchW = toPx(7.0);

        // Muestra de traza
        ctx.beginPath();
        ctx.moveTo(swatchStartX, itemY);
        ctx.lineTo(swatchStartX + swatchW, itemY);
        ctx.lineWidth = Math.max(2.2, toPx(config.traceStrokeMm * 1.15));
        ctx.strokeStyle = item.color;
        ctx.lineCap = 'round';
        if (item.sentido === 'VUELTA') {
          ctx.setLineDash([toPx(2.5), toPx(1.8)]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Badge de Línea
        const lineBadgeW = toPx(10.0);
        ctx.fillStyle = item.color;
        ctx.beginPath();
        drawRoundRect(swatchStartX + swatchW + toPx(2.0), itemY - toPx(3.2), lineBadgeW, toPx(6.4), toPx(0.8));
        ctx.fill();

        ctx.font = `800 ${toPx(config.caratureValMm * 0.65)}px Inter, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(item.lineNum, swatchStartX + swatchW + toPx(2.0) + lineBadgeW / 2, itemY + toPx(1.0));
        ctx.textAlign = 'start';

        // Texto del Ramal + Sentido
        const textStartX = swatchStartX + swatchW + toPx(2.0) + lineBadgeW + toPx(2.5);
        const maxTextW = legBoxX + legBoxW - textStartX - toPx(3);
        const sentidoLabel = item.sentido === 'VUELTA' ? '(Vuelta ╌)' : '(Ida —)';
        const fullLabel = `${item.ramal ? `${item.ramal} ` : ''}${sentidoLabel}`;

        ctx.font = `600 ${legFontSize}px Inter, sans-serif`;
        ctx.fillStyle = '#1E293B';
        ctx.fillText(fitText(fullLabel, maxTextW), textStartX, itemY + toPx(1.2));
      });

      if (remainingCount > 0) {
        const extraY = legBoxY + legTitleSize + toPx(4) + itemsToDisplay.length * itemRowH + toPx(2);
        ctx.font = `italic 600 ${toPx(config.caratureValMm * 0.65)}px Inter, sans-serif`;
        ctx.fillStyle = '#64748B';
        ctx.fillText(`+ ${remainingCount} traza(s) adicional(es) en plano`, legBoxX + toPx(4), extraY);
      }
    }

    ctx.restore(); // Fin del clip del viewport del mapa

    // Borde técnico del viewport del mapa
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = Math.max(1, toPx(0.4));
    ctx.strokeRect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);

    // ─────────────────────────────────────────────────────────────
    // 1. ENCABEZADO INSTITUCIONAL OFICIAL (Fondo Oscuro con Estética Lanús)
    // ─────────────────────────────────────────────────────────────
    const cleanLineNumber =
      normalizeLineNumber(lineaNombre) || lineaNombre.replace(/^(l[ií]nea|line)\s*/i, '').trim();

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(headerX, headerY, headerW, headerH);

    // Franja superior celeste Lanús (#00AEEF)
    const topBarH = Math.max(2, toPx(0.8));
    ctx.fillStyle = '#00AEEF';
    ctx.fillRect(headerX, headerY, headerW, topBarH);

    const crestPad = toPx(config.marginMm * 0.4);
    let titleStartX = headerX + crestPad;

    // Dibujar Logotipo Oficial de Lanús Gobierno
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoH = Math.round(headerH * 0.65);
      const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
      const logoW = Math.round(logoH * logoAspect);
      const logoX = headerX + crestPad;
      const logoY = headerY + topBarH + (headerH - topBarH - logoH) / 2;
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      titleStartX = logoX + logoW + crestPad * 1.2;
    } else {
      const crestSize = Math.round(headerH * 0.7);
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
    const idBoxW = Math.round(headerW * (isLandscape ? 0.3 : 0.34));
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
    ctx.fillText(
      `CÓD: LAN-${cleanLineNumber}-${fechaCod} · HOJA ${pageNumber}/${totalPages}`,
      idBoxX + idBoxW - toPx(3.0),
      idBoxY + idBoxH * 0.68
    );

    ctx.font = `500 ${deptFontSize * 0.82}px Inter, sans-serif`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('EPSG:3857 ISOMÉTRICO 1:1', idBoxX + idBoxW - toPx(3.0), idBoxY + idBoxH * 0.92);
    ctx.textAlign = 'start';

    const maxTitleW = idBoxX - titleStartX - toPx(3.0);

    // Línea 1: SUBSECRETARÍA DE PLANIFICACIÓN URBANA
    ctx.font = `800 ${titleFontSize * 0.95}px Inter, sans-serif`;
    ctx.fillStyle = '#00AEEF';
    ctx.fillText(
      fitText('SUBSECRETARÍA DE PLANIFICACIÓN URBANA', maxTitleW),
      titleStartX,
      headerY + headerH * 0.46
    );

    // Línea 2: DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE
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
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(caratureX, caratureY, caratureW, caratureH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = Math.max(1, toPx(config.innerBorderMm));
    ctx.strokeRect(caratureX, caratureY, caratureW, caratureH);

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

    // ── COLUMNA 1: PROYECTO Y UBICACIÓN CON CONTEXTO REGIONAL ──
    const col1InnerW = col1W - 2 * caraturePad;
    ctx.font = `bold ${valFontSize * 0.95}px Inter, sans-serif`;
    ctx.fillStyle = '#7B1828'; // Granate Lanús
    ctx.fillText(
      fitText('PROYECTO: SISTEMA INTEGRADO DE TRANSPORTE URBANO', col1InnerW),
      col1X + caraturePad,
      caratureY + caratureH * 0.14
    );

    ctx.font = `600 ${valFontSize * 0.78}px Inter, sans-serif`;
    ctx.fillStyle = '#475569';
    ctx.fillText(
      fitText('COBERTURA: LANÚS O. · LANÚS E. · R. DE ESCALADA · V. ALSINA · GERLI · M. CHINGOLO', col1InnerW),
      col1X + caraturePad,
      caratureY + caratureH * 0.27
    );

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
    ctx.fillText(fitText(pageTitle, lineTextMaxW), lineTextX, badgeLineY + badgeLineSize * 0.45);

    ctx.font = `600 ${valFontSize * 0.88}px Inter, sans-serif`;
    ctx.fillStyle = '#64748B';
    ctx.fillText(fitText(pageSubtitle, lineTextMaxW), lineTextX, badgeLineY + badgeLineSize * 0.85);

    // ── COLUMNA 2: FICHA TÉCNICA Y CÓMPUTO ──
    const rowStep = caratureH / 5.2;
    const nationalLineNumbers = Array.from(
      new Set(
        nationalCapas
          .map((c) => normalizeLineNumber(c.nombre) || normalizeLineNumber(c.subGrupo?.nombre || ''))
          .filter(Boolean)
      )
    ).join(', ');

    const metrics = [
      { label: 'Longitud de Traza:', val: `${totalRouteDistanceKm.toFixed(2)} km` },
      { label: 'Paradas Registradas:', val: `${stopCount > 0 ? stopCount : targetCapas.length * 2}` },
      {
        label: `Red ${metaOverlay.corta} Referencia:`,
        val: nationalCapas.length > 0 ? `${nationalCapas.length} trazas (L.${nationalLineNumbers})` : 'Sin superposición',
      },
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
      ctx.fillText(fitText(m.val, col2W * 0.55), col2X + col2W - caraturePad, y);
      ctx.textAlign = 'start';
    });

    // ── COLUMNA 3: SIMBOLOGÍA Y REFERENCIAS TÉCNICAS ──
    const col3Pad = caraturePad;
    const col3InnerW = col3W - 2 * col3Pad;
    ctx.font = `bold ${valFontSize * 0.95}px Inter, sans-serif`;
    ctx.fillStyle = '#7B1828';
    ctx.fillText(fitText('SIMBOLOGÍA & REFERENCIAS TÉCNICAS', col3InnerW), col3X + col3Pad, caratureY + caratureH * 0.15);

    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = Math.max(1, toPx(0.35));
    ctx.beginPath();
    ctx.moveTo(col3X + col3Pad, caratureY + caratureH * 0.22);
    ctx.lineTo(col3X + col3W - col3Pad, caratureY + caratureH * 0.22);
    ctx.stroke();

    const legStep = (caratureH * 0.72) / 4;
    const legStartY = caratureY + caratureH * 0.34;

    // Item 1: Traza IDA (Continuo)
    const y1 = legStartY;
    const iconX = col3X + col3Pad + toPx(5);
    ctx.beginPath();
    ctx.moveTo(iconX - toPx(5), y1);
    ctx.lineTo(iconX + toPx(6), y1);
    ctx.lineWidth = Math.max(2.5, toPx(config.traceStrokeMm * 1.2));
    ctx.strokeStyle = officialLineColor;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.stroke();

    ctx.font = `600 ${valFontSize * 0.85}px Inter, sans-serif`;
    ctx.fillStyle = '#334155';
    ctx.fillText(fitText('Trazo Ida (Continuo —)', col3InnerW - toPx(15)), iconX + toPx(9), y1 + toPx(1.0));

    // Item 2: Traza VUELTA (Discontinuo)
    const y2 = legStartY + legStep;
    ctx.beginPath();
    ctx.moveTo(iconX - toPx(5), y2);
    ctx.lineTo(iconX + toPx(6), y2);
    ctx.lineWidth = Math.max(2.5, toPx(config.traceStrokeMm * 1.2));
    ctx.strokeStyle = officialLineColor;
    ctx.lineCap = 'round';
    ctx.setLineDash([toPx(2.5), toPx(1.8)]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#334155';
    ctx.fillText(fitText('Trazo Vuelta (Discontinuo ╌)', col3InnerW - toPx(15)), iconX + toPx(9), y2 + toPx(1.0));

    // Item 3: Cabecera Inicial / Terminal / Trazas superpuestas de referencia
    const y3 = legStartY + 2 * legStep;
    if (nationalCapas.length > 0) {
      // Mostrar muestra de traza nacional de referencia
      ctx.beginPath();
      ctx.moveTo(iconX - toPx(5), y3);
      ctx.lineTo(iconX + toPx(6), y3);
      ctx.lineWidth = Math.max(1.8, toPx(config.traceStrokeMm * 0.85));
      ctx.strokeStyle = modoEstiloNacionales === 'sutil' ? '#64748B' : '#0284C7';
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.fillText(
        fitText(`Líneas ${metaOverlay.corta} Ref (${nationalLineNumbers || '—'})`, col3InnerW - toPx(15)),
        iconX + toPx(9),
        y3 + toPx(1.0)
      );
    } else {
      ctx.beginPath();
      ctx.arc(iconX - toPx(2.2), y3 - toPx(1.0), toPx(2.0), 0, Math.PI * 2);
      ctx.fillStyle = '#16A34A';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(iconX + toPx(3.2), y3 - toPx(1.0), toPx(2.0), 0, Math.PI * 2);
      ctx.fillStyle = '#7B1828';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.fillText(fitText('Cabecera (●) / Terminal (●)', col3InnerW - toPx(15)), iconX + toPx(9), y3 + toPx(1.0));
    }

    // Item 4: Parada Registrada + Escala
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
    ctx.fillText(fitText(`Paradas Registradas${escalaStr}`, col3InnerW - toPx(15)), iconX + toPx(9), y4 + toPx(1.0));

    // ─────────────────────────────────────────────────────────────
    // 4. DOBLE RECUADRO PERIMETRAL TÉCNICO DE ARQUITECTURA
    // ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1.5, toPx(config.outerBorderMm));
    ctx.strokeRect(marginPx, marginPx, sheetWidthPx - 2 * marginPx, sheetHeightPx - 2 * marginPx);

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = Math.max(1, toPx(config.innerBorderMm));
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    return canvas;
  };

  // Generar Impresión Directa en Lámina Oficial de Arquitectura con Proyección Isométrica EPSG:3857
  const handleGeneratePrint = async () => {
    if (capasFiltradas.length === 0) {
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

      const dpmmMultiplier = renderScale === 4 ? 1.25 : renderScale === 3 ? 1.0 : 0.8;
      const dpmm = config.baseDpmm * dpmmMultiplier;

      const paddingFraction = framingMode === 'tight' ? 0.045 : framingMode === 'relaxed' ? 0.12 : 0.07;
      const cleanLineNumber =
        normalizeLineNumber(lineaNombre) || lineaNombre.replace(/^(l[ií]nea|line)\s*/i, '').trim();

      // Cargar logotipo oficial de Lanús concurrentemente
      const logoPromise = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = '/lanus_gobierno_white.png';
        setTimeout(() => resolve(null), 3000);
      });
      const logoImg = await logoPromise;

      // Planificar lista de páginas a generar según el modo seleccionado
      interface PagePlan {
        capas: any[];
        title: string;
        subtitle: string;
        isConsolidated: boolean;
      }

      const pagesToGenerate: PagePlan[] = [];

      if (pageLayout === 'individual' || pageLayout === 'both') {
        capasFiltradas.forEach((capa, idx) => {
          const sentido = detectSentido(capa);
          const ramalName = capa.nombre.trim() || `Ramal ${idx + 1}`;
          pagesToGenerate.push({
            capas: [capa],
            title: `LÍNEA ${cleanLineNumber} · ${ramalName.toUpperCase()}`,
            subtitle: `Variante ${idx + 1} de ${capasFiltradas.length} · Sentido ${sentido} · Sistema Lanús`,
            isConsolidated: false,
          });
        });
      }

      if (pageLayout === 'all-in-one' || pageLayout === 'both') {
        const ramalesUnicos = Array.from(new Set(capasFiltradas.map((c) => c.nombre.trim()).filter(Boolean)));
        const ramalesStr = ramalesUnicos.length > 0 ? ramalesUnicos.join(' · ') : 'Recorrido General';
        pagesToGenerate.push({
          capas: capasFiltradas,
          title: `LÍNEA ${cleanLineNumber} · ${ramalesStr.toUpperCase()}`,
          subtitle: `Plano General Consolidado · ${capasFiltradas.length} variante(s) activa(s) · Sistema Lanús`,
          isConsolidated: true,
        });
      }

      // Inicializar Documento jsPDF
      const pdf = new jsPDF({
        orientation: orientacion,
        unit: 'mm',
        format: paperFormat.toLowerCase() as any,
      });

      for (let i = 0; i < pagesToGenerate.length; i++) {
        const page = pagesToGenerate[i];
        setPrintStatus(
          `Generando lámina ${i + 1} de ${pagesToGenerate.length}: ${page.title}...`
        );

        const canvas = await renderSingleSheetCanvas({
          targetCapas: page.capas,
          nationalCapas: capasNacionalesActivas,
          pageTitle: page.title,
          pageSubtitle: page.subtitle,
          pageNumber: i + 1,
          totalPages: pagesToGenerate.length,
          config,
          isLandscape,
          pdfWidthMm,
          pdfHeightMm,
          paddingFraction,
          dpmm,
          logoImg,
        });

        if (i > 0) {
          pdf.addPage(paperFormat.toLowerCase() as any, orientacion);
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
      }

      setPrintStatus('Compilando y finalizando archivo PDF oficial...');
      const pdfBlobUrl = pdf.output('bloburl');
      const filename = `Plano_Lanus_${lineaNombre.replace(/\s+/g, '_')}_${paperFormat}_${pageLayout}.pdf`;
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
          maxWidth: '600px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          pointerEvents: 'auto',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
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
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#f8fafc' }}>
                Estudio Cartográfico de Impresión
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
                Motor Isométrico Web Mercator (EPSG:3857) · {capasFiltradas.length} trazos seleccionados
                {incluirNacionales && ` · +${capasNacionalesActivas.length} ${metaOverlay.plural}`}
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

        {/* Cuerpo Principal con Scroll */}
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
          }}
        >
          {/* Varita mágica banner */}
          <div
            style={{
              background: modoVarita ? '#f0fdf4' : '#eff6ff',
              border: modoVarita ? '1.5px solid #86efac' : '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '9px 12px',
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
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: modoVarita ? '#166534' : '#1d4ed8',
                    display: 'block',
                  }}
                >
                  {modoVarita ? '¡Selección por Clic Activa!' : 'Varita Mágica de Mapa'}
                </span>
                <span style={{ fontSize: '0.71rem', color: modoVarita ? '#15803d' : '#3b82f6' }}>
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
                padding: '5px 11px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              {modoVarita ? '✓ Seleccionando' : 'Activar Clic'}
            </button>
          </div>

          {/* 1. Organización de Páginas en el PDF */}
          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#1e293b',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              📚 Estructura de Páginas del PDF:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                {
                  id: 'all-in-one' as PageLayoutMode,
                  icon: <Layers size={15} />,
                  label: 'Todos Juntos',
                  sub: '1 sola lámina general',
                },
                {
                  id: 'individual' as PageLayoutMode,
                  icon: <FileText size={15} />,
                  label: '1 por Página',
                  sub: `${capasFiltradas.length} láminas individuales`,
                },
                {
                  id: 'both' as PageLayoutMode,
                  icon: <BookOpen size={15} />,
                  label: 'Álbum Completo',
                  sub: `${capasFiltradas.length + 1} pág. (Indiv. + Resumen)`,
                },
              ].map((opt) => {
                const isSelected = pageLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPageLayout(opt.id)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isSelected ? '#1d4ed8' : '#334155',
                      }}
                    >
                      {opt.icon}
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#64748b' }}>{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🗺️ SECCIÓN: Superposición de Líneas por jurisdicción */}
          <div
            style={{
              background: incluirNacionales ? '#f0f9ff' : '#f8fafc',
              border: `1.5px solid ${incluirNacionales ? '#38bdf8' : '#e2e8f0'}`,
              borderRadius: '12px',
              padding: '12px 14px',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={incluirNacionales}
                  onChange={(e) => setIncluirNacionales(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7' }}
                />
                <div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: incluirNacionales ? '#0369a1' : '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {metaOverlay.emoji} Superponer Líneas · {metaOverlay.titulo}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {metaOverlay.subtitulo}
                  </span>
                </div>
              </label>

              {incluirNacionales && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setModoEstiloNacionales('color')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '6px',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      border: modoEstiloNacionales === 'color' ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: modoEstiloNacionales === 'color' ? '#e0f2fe' : '#fff',
                      color: modoEstiloNacionales === 'color' ? '#0369a1' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Color Vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoEstiloNacionales('sutil')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '6px',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      border: modoEstiloNacionales === 'sutil' ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: modoEstiloNacionales === 'sutil' ? '#e0f2fe' : '#fff',
                      color: modoEstiloNacionales === 'sutil' ? '#0369a1' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Gris Sutil
                  </button>
                </div>
              )}
            </div>

            {incluirNacionales && (
              <div style={{ marginTop: '10px', borderTop: '1px solid #e0f2fe', paddingTop: '8px' }}>
                {/* Selector de jurisdicción: Nacional / Provincial / Municipal */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {(['NACIONAL', 'PROVINCIAL', 'MUNICIPAL'] as const).map((j) => {
                    const active = jurisdiccionOverlay === j;
                    const accent = j === 'NACIONAL' ? '#0284c7' : j === 'PROVINCIAL' ? '#16a34a' : '#d97706';
                    const bg = j === 'NACIONAL' ? '#e0f2fe' : j === 'PROVINCIAL' ? '#dcfce7' : '#fef3c7';
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => {
                          setJurisdiccionOverlay(j);
                          setBusquedaNacionales('');
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          border: active ? `2px solid ${accent}` : '1px solid #e2e8f0',
                          background: active ? bg : '#fff',
                          color: active ? accent : '#64748b',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {overlayMeta[j].emoji} {j.charAt(0) + j.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                  <span style={{ fontSize: '0.66rem', color: '#64748b', alignSelf: 'center', marginLeft: '2px' }}>
                    {capasNacionalesDisponibles.length} traza(s) disponible(s)
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0369a1' }}>
                    Trazas seleccionadas ({nacionalesSeleccionadas.length} de {capasNacionalesDisponibles.length}):
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setNacionalesSeleccionadas(capasNacionalesDisponibles.map((c) => c.id))}
                      style={{
                        background: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        color: '#0284c7',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        borderRadius: '5px',
                        padding: '3px 7px',
                        cursor: 'pointer',
                      }}
                    >
                      Todas ({capasNacionalesDisponibles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNacionalesSeleccionadas(
                          capasNacionalesDisponibles
                            .filter((c) => detectSentido(c) === 'IDA')
                            .map((c) => c.id)
                        )
                      }
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        color: '#16a34a',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        borderRadius: '5px',
                        padding: '3px 7px',
                        cursor: 'pointer',
                      }}
                    >
                      Solo Idas
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNacionalesSeleccionadas(
                          capasNacionalesDisponibles
                            .filter((c) => detectSentido(c) === 'VUELTA')
                            .map((c) => c.id)
                        )
                      }
                      style={{
                        background: '#faf5ff',
                        border: '1px solid #e9d5ff',
                        color: '#7e22ce',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        borderRadius: '5px',
                        padding: '3px 7px',
                        cursor: 'pointer',
                      }}
                    >
                      Solo Vueltas
                    </button>
                    <button
                      type="button"
                      onClick={() => setNacionalesSeleccionadas([])}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#64748b',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        borderRadius: '5px',
                        padding: '3px 7px',
                        cursor: 'pointer',
                      }}
                    >
                      Ninguna
                    </button>
                  </div>
                </div>

                {/* Buscador de líneas */}
                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={busquedaNacionales}
                    onChange={(e) => setBusquedaNacionales(e.target.value)}
                    placeholder={metaOverlay.buscar}
                    style={{
                      width: '100%',
                      padding: '5px 10px',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: '1px solid #bae6fd',
                      background: '#fff',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    paddingRight: '3px',
                  }}
                >
                  {capasNacionalesDisponibles
                    .filter((c) => {
                      if (!busquedaNacionales.trim()) return true;
                      const q = busquedaNacionales.toLowerCase();
                      const num = (
                        c.numero ||
                        normalizeLineNumber(c.subGrupo?.nombre || '') ||
                        normalizeLineNumber(c.nombre) ||
                        ''
                      ).toLowerCase();
                      const name = (c.subGrupo?.nombre || c.nombre || '').toLowerCase();
                      const ramal = (c.subSubGrupo?.nombre || c.subcategoria || '').toLowerCase();
                      return num.includes(q) || name.includes(q) || ramal.includes(q);
                    })
                    .map((capa) => {
                      const isChecked = nacionalesSeleccionadas.includes(capa.id);
                      const sentido = detectSentido(capa);
                      const isVuelta = sentido === 'VUELTA';
                      const num =
                        capa.numero ||
                        normalizeLineNumber(capa.subGrupo?.nombre || '') ||
                        normalizeLineNumber(capa.nombre) ||
                        '';
                      const lineName = num ? `Línea ${num}` : capa.subGrupo?.nombre || capa.nombre;
                      const ramalName =
                        capa.subSubGrupo?.nombre || capa.subcategoria || (isVuelta ? 'Vuelta' : 'Ida');

                      return (
                        <label
                          key={capa.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            background: isChecked ? '#e0f2fe' : '#ffffff',
                            border: `1.5px solid ${isChecked ? '#38bdf8' : '#e2e8f0'}`,
                            cursor: 'pointer',
                            fontSize: '0.68rem',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              overflow: 'hidden',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNacionalesSeleccionadas([...nacionalesSeleccionadas, capa.id]);
                                } else {
                                  setNacionalesSeleccionadas(
                                    nacionalesSeleccionadas.filter((id) => id !== capa.id)
                                  );
                                }
                              }}
                              style={{ width: '13px', height: '13px', accentColor: '#0284c7', flexShrink: 0 }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {lineName}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  color: '#64748b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {ramalName}
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: isVuelta ? '#f3e8ff' : '#dbeafe',
                              color: isVuelta ? '#7e22ce' : '#1d4ed8',
                              flexShrink: 0,
                              marginLeft: '4px',
                            }}
                          >
                            {isVuelta ? 'Vuelta ╌' : 'Ida —'}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 📖 Cuadro de Referencias Cartográficas y Simbología */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
              }}
            >
              📖 Referencias Cartográficas y Simbología:
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                fontSize: '0.7rem',
                color: '#334155',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 20,
                    height: 3,
                    background: '#2563eb',
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span><strong>Trazo de Ida</strong> (Continuo)</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 20,
                    height: 0,
                    borderTop: '2.5px dashed #2563eb',
                    flexShrink: 0,
                  }}
                />
                <span><strong>Trazo de Vuelta</strong> (Trazos ╌)</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#16a34a',
                    border: '1.5px solid #fff',
                    boxShadow: '0 0 0 1px #16a34a',
                    flexShrink: 0,
                  }}
                />
                <span><strong>Cabecera</strong> (Inicio)</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#7b1828',
                    border: '1.5px solid #fff',
                    boxShadow: '0 0 0 1px #7b1828',
                    flexShrink: 0,
                  }}
                />
                <span><strong>Terminal</strong> (Destino)</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#10b981',
                    border: '1.5px solid #0f172a',
                    flexShrink: 0,
                  }}
                />
                <span><strong>Paradas</strong> Intermedias</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 20,
                    height: 2,
                    background: '#64748b',
                    flexShrink: 0,
                  }}
                />
                <span><strong>Red Nacional</strong> (1-199)</span>
              </div>
            </div>
          </div>

          {/* 2. Encuadre y Escala */}
          <div>
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#1e293b',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              🎯 Encuadre y Escala Cartográfica:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                {
                  id: 'tight' as FramingMode,
                  label: '🔍 Ajustado / Nítido',
                  sub: 'Mayor zoom y calles grandes',
                },
                {
                  id: 'optimal' as FramingMode,
                  label: '📐 Óptimo (Recomendado)',
                  sub: 'Equilibrio perfecto de traza',
                },
                {
                  id: 'relaxed' as FramingMode,
                  label: '📏 Amplio',
                  sub: 'Mayor contexto urbano',
                },
              ].map((opt) => {
                const isSelected = framingMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFramingMode(opt.id)}
                    style={{
                      padding: '7px 6px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: isSelected ? '#1d4ed8' : '#334155',
                      }}
                    >
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.63rem', color: '#64748b', marginTop: '1px' }}>
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Motor Cartográfico y Mapa Base */}
          <div>
            <label
              style={{
                fontSize: '0.78rem',
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
                  id: 'satellite-streets-v12',
                  label: '🛰️ Satélite HD + Calles',
                  sub: 'Ortofoto aérea con nombres',
                  motor: 'mapbox',
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
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isSelected ? '#1d4ed8' : '#334155',
                      }}
                    >
                      {style.label}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px' }}>
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
                fontSize: '0.78rem',
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
                    padding: '6px 2px',
                    borderRadius: '8px',
                    border: paperFormat === fmt ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: paperFormat === fmt ? '#eff6ff' : '#fff',
                    color: paperFormat === fmt ? '#1d4ed8' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.78rem',
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
                  fontSize: '0.78rem',
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
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: orientacion === item.val ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: orientacion === item.val ? '#eff6ff' : '#fff',
                      color: orientacion === item.val ? '#1d4ed8' : '#64748b',
                      fontSize: '0.74rem',
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
                  fontSize: '0.78rem',
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
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: renderScale === item.val ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: renderScale === item.val ? '#eff6ff' : '#fff',
                      color: renderScale === item.val ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.74rem',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
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
                style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
                Retícula cartográfica sexagesimal con coordenadas DMS
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
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
                style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
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
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>
                🗺️ Trazos y Ramales Principales ({capasFiltradas.length} de {capasLinea.length}):
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setRamalesSeleccionados(capasLinea.map((c) => c.id))}
                  style={{
                    background: '#eff6ff',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    padding: '2px 7px',
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
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    padding: '2px 7px',
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
                gap: '5px',
                maxHeight: '130px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {capasLinea.map((capa) => {
                const isChecked = ramalesSeleccionados.includes(capa.id);
                const sentido = detectSentido(capa);
                const isVuelta = sentido === 'VUELTA';

                return (
                  <label
                    key={capa.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 9px',
                      borderRadius: '8px',
                      border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: isChecked ? '#f0f6ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                          width: '14px',
                          height: '14px',
                          accentColor: '#2563eb',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                            {capa.subGrupo?.nombre ? `${capa.subGrupo.nombre} - ` : ''}
                            {capa.nombre}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: isVuelta ? '#f3e8ff' : '#dbeafe',
                              color: isVuelta ? '#7e22ce' : '#1d4ed8',
                              border: `1px solid ${isVuelta ? '#d8b4fe' : '#93c5fd'}`,
                            }}
                          >
                            {isVuelta ? 'VUELTA ╌' : 'IDA —'}
                          </span>
                        </div>
                        {capa.grupo?.nombre && (
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
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
                padding: '10px 12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                color: '#1d4ed8',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Loader2 className="animate-spin" size={16} />
              <span>{printStatus}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
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
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.78rem',
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
              padding: '8px 18px',
              borderRadius: '8px',
              background:
                isGenerating || capasFiltradas.length === 0
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: isGenerating || capasFiltradas.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
            }}
          >
            {isGenerating ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            {isGenerating
              ? 'Generando Plano(s)...'
              : pageLayout === 'individual'
              ? `Imprimir ${capasFiltradas.length} Planos (${paperFormat})`
              : pageLayout === 'both'
              ? `Imprimir Álbum (${capasFiltradas.length + 1} Páginas ${paperFormat})`
              : `Imprimir Plano Isométrico (${paperFormat})`}
          </button>
        </div>
      </div>
    </div>
  );
}
