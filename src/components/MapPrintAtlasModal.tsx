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
  HelpCircle,
  Target,
  Building2,
  Search,
  Palette,
  Ruler,
  Files,
  Pencil,
  Repeat,
  Info,
  ChevronDown,
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
  /** Modo "Completo": plano del Partido de Lanús centrado en sus límites, con selección por jurisdicción */
  modoGeneral?: boolean;
  /** IDs de capas que arrancan seleccionadas al abrir el modal (si no se informa, se seleccionan todas) */
  idsPreseleccionados?: string[];
}

export type PageLayoutMode = 'individual' | 'all-in-one' | 'both';
export type FramingMode = 'tight' | 'optimal' | 'relaxed';

type Jurisdiccion = 'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL' | 'OTRA';

const JURISDICCION_UI: Record<Jurisdiccion, { label: string; emoji: string; accent: string; bg: string }> = {
  NACIONAL: { label: 'Nacionales', emoji: '🇦🇷', accent: '#0284c7', bg: '#e0f2fe' },
  PROVINCIAL: { label: 'Provinciales', emoji: '🗺️', accent: '#16a34a', bg: '#dcfce7' },
  MUNICIPAL: { label: 'Municipales', emoji: '🏘️', accent: '#d97706', bg: '#fef3c7' },
  OTRA: { label: 'Otras', emoji: '📍', accent: '#64748b', bg: '#f1f5f9' },
};

/**
 * Clasifica una capa de transporte en su jurisdicción.
 * Prioridad: categoría / grupo explícito; si no, convención por número (1-199 Nac · 200-499 Prov · 500+ Mun).
 */
const clasificarJurisdiccion = (c: any): Jurisdiccion => {
  const cat = (c?.categoria || c?.subGrupo?.categoria || '').toString().toUpperCase();
  const texto = `${c?.grupo?.nombre || ''} ${c?.subGrupo?.nombre || ''}`.toLowerCase();
  if (cat === 'PROVINCIAL' || texto.includes('provincial')) return 'PROVINCIAL';
  if (cat === 'MUNICIPAL' || texto.includes('municipal')) return 'MUNICIPAL';
  if (cat === 'NACIONAL' || texto.includes('nacional')) return 'NACIONAL';
  const num = parseInt(
    c?.numero || normalizeLineNumber(c?.subGrupo?.nombre || '') || normalizeLineNumber(c?.nombre || '') || '0',
    10
  );
  if (num >= 500) return 'MUNICIPAL';
  if (num >= 200) return 'PROVINCIAL';
  if (num > 0) return 'NACIONAL';
  return 'OTRA';
};

/** Ítem de referencia (leyenda) deduplicado por línea + ramal + sentido + color */
interface LegendItem {
  key: string;
  id: string;
  color: string;
  lineNum: string;
  ramal: string;
  sentido: 'IDA' | 'VUELTA';
  isNational: boolean;
  jurisdiccion: Jurisdiccion;
}

// ══════════════════════════════════════════════════════════════════
// 🧩 Sección colapsable — definida FUERA del componente principal
// con React.memo para evitar re-renders innecesarios al escribir
// ══════════════════════════════════════════════════════════════════
const Seccion = React.memo(function Seccion({
  id,
  num,
  icon,
  titulo,
  sub,
  children,
  accent = '#2563eb',
  badge,
  abierta,
  onToggle,
}: {
  id: string;
  num: number;
  icon: React.ReactNode;
  titulo: string;
  sub?: string;
  children: React.ReactNode;
  accent?: string;
  badge?: React.ReactNode;
  abierta: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: `1.5px solid ${abierta ? accent + '30' : '#e8edf3'}`,
        borderRadius: '14px',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: abierta
          ? `0 2px 8px ${accent}10, 0 0 0 1px ${accent}08`
          : '0 1px 2px rgba(0,0,0,0.04)',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '11px 13px',
          background: abierta ? `linear-gradient(135deg, ${accent}07, transparent 70%)` : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s ease',
          borderTopLeftRadius: '13px',
          borderTopRightRadius: '13px',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: abierta ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : '#eef2f7',
            color: abierta ? '#fff' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.68rem',
            fontWeight: 900,
            flexShrink: 0,
            transition: 'all 0.2s ease',
            boxShadow: abierta ? `0 2px 6px ${accent}35` : 'none',
          }}
        >
          {num}
        </div>
        <span style={{ color: abierta ? accent : '#94a3b8', display: 'flex', flexShrink: 0, transition: 'color 0.2s' }}>
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.77rem',
              fontWeight: 800,
              color: abierta ? '#0f172a' : '#64748b',
              display: 'block',
              lineHeight: 1.3,
            }}
          >
            {titulo}
          </span>
          {sub && (
            <span style={{ fontSize: '0.63rem', color: '#94a3b8', fontWeight: 600, display: 'block', lineHeight: 1.3, marginTop: '1px' }}>{sub}</span>
          )}
        </div>
        {badge && (
          <span
            style={{
              background: accent + '12',
              color: accent,
              fontSize: '0.6rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '99px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {badge}
          </span>
        )}
        <span
          style={{
            color: '#c1c9d4',
            display: 'flex',
            flexShrink: 0,
            transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease, color 0.15s',
          }}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      </button>

      {abierta && (
        <div
          style={{
            padding: '0 13px 13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${accent}20, transparent)`, marginBottom: '2px' }} />
          {children}
        </div>
      )}
    </div>
  );
});

export default function MapPrintAtlasModal({
  isOpen,
  onClose,
  lineaNombre,
  capasLinea,
  todasCapas = [],
  cacheDatosGeo,
  mapInstance,
  modoGeneral = false,
  idsPreseleccionados,
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
  const [numerarTrazas, setNumerarTrazas] = useState<boolean>(true);
  const [leyendaCompleta, setLeyendaCompleta] = useState<boolean>(false);
  const [grosorTraza, setGrosorTraza] = useState<'fina' | 'normal' | 'gruesa'>('normal');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string>('');

  // 🏛️ Encuadre en el Partido de Lanús, trazado de límites y referencias en hoja aparte
  const [encuadreLanus, setEncuadreLanus] = useState<boolean>(false);
  const [dibujarLimites, setDibujarLimites] = useState<boolean>(false);
  const [referenciasHojaAparte, setReferenciasHojaAparte] = useState<boolean>(true);
  const [limitesLanus, setLimitesLanus] = useState<[number, number][][] | null>(null); // anillos [lat, lng]
  const [busquedaRamales, setBusquedaRamales] = useState<string>('');

  // ✏️ Datos editables de la carátula (el usuario puede personalizarlos antes de exportar)
  const [datosPlano, setDatosPlano] = useState({
    proyecto: 'SISTEMA INTEGRADO DE TRANSPORTE URBANO',
    cobertura: 'LANÚS O. · LANÚS E. · R. DE ESCALADA · V. ALSINA · GERLI · M. CHINGOLO',
    operador: '',
    escalaNominal: '',
    observaciones: '',
    tituloPlano: '',    // vacío = auto ("LÍNEA {nombre}")
    subtitulo: '',      // vacío = auto ("Plano General Consolidado · X variantes...")
    mostrarRedRef: true, // mostrar/ocultar métrica "Red X Referencia"
  });
  const setDatoPlano = (campo: keyof typeof datosPlano, valor: string | boolean) =>
    setDatosPlano((d) => ({ ...d, [campo]: valor }));

  // 👁️ Vista previa de la lámina antes de exportar
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);

  // 📂 Secciones colapsables del modal (todas abiertas por defecto)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({
    contenido: true,
    lineas: true,
    refs: true,
    formato: true,
    datos: true,
  });
  const toggleSeccion = (id: string) =>
    setSeccionesAbiertas((s) => ({ ...s, [id]: !s[id] }));

  // 🚌 Modo Ida y Vuelta: juntos en la misma lámina o separados en láminas distintas
  const [modoIdaVuelta, setModoIdaVuelta] = useState<'juntos' | 'separados'>('juntos');

  // ❓ Modal de ayuda
  const [ayudaAbierta, setAyudaAbierta] = useState<boolean>(false);

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
        if (idsPreseleccionados && idsPreseleccionados.length > 0) {
          const validos = new Set(capasLinea.map((c) => c.id));
          setRamalesSeleccionados(idsPreseleccionados.filter((id) => validos.has(id)));
        } else {
          setRamalesSeleccionados(capasLinea.map((c) => c.id));
        }
      }
    }
  }, [isOpen, capasLinea, idsPreseleccionados]);

  // No auto-seleccionar nacionales: el usuario elige manualmente o usa "Todos"
  React.useEffect(() => {
    if (isOpen) {
      setNacionalesSeleccionadas([]);
      setIncluirNacionales(false);
    }
  }, [isOpen]);

  // Al abrir: configurar los valores por defecto según el modo (general "Completo" o línea puntual)
  React.useEffect(() => {
    if (!isOpen) return;
    setEncuadreLanus(modoGeneral);
    setDibujarLimites(modoGeneral);
    setReferenciasHojaAparte(modoGeneral);
    setBusquedaRamales('');
    if (modoGeneral) {
      setIncluirNacionales(false);
      setPageLayout('all-in-one');
    }
  }, [isOpen, modoGeneral]);

  // Cargar los límites del Partido de Lanús (una sola vez) para encuadrar y dibujar el contorno
  React.useEffect(() => {
    if (!isOpen || limitesLanus) return;
    let cancelled = false;
    fetch('/lanus-base.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (cancelled || !geo) return;
        const rings: [number, number][][] = [];
        const feats = geo.type === 'FeatureCollection' ? geo.features : [geo];
        feats.forEach((f: any) => {
          const g = f?.geometry;
          if (!g) return;
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
          polys.forEach((poly: any) =>
            poly.forEach((ring: any) => {
              rings.push(ring.map((p: number[]) => [p[1], p[0]] as [number, number]));
            })
          );
        });
        if (rings.length > 0) setLimitesLanus(rings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, limitesLanus]);

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
   * 📄 Renderiza la hoja aparte de referencias SIEMPRE en A4 apaisado (ISO 216),
   * independientemente del formato de papel elegido para las láminas del plano.
   * Diseño prolijo: header institucional, 3 columnas de contenido y footer con paginación.
   */
  const renderReferencePageCanvas = async ({
    allCapas,
    pageNumber,
    totalPages,
    logoImg,
    lineaNombre,
    cleanLineNumber,
    datosRef,
  }: {
    allCapas: any[];
    pageNumber: number;
    totalPages: number;
    logoImg: HTMLImageElement | null;
    lineaNombre: string;
    cleanLineNumber: string;
    datosRef: { proyecto: string; cobertura: string; operador: string; escalaNominal: string; observaciones: string };
  }): Promise<HTMLCanvasElement> => {
    // 📐 Fijo A4 apaisado: 297 × 210 mm
    const A4_W_MM = 297;
    const A4_H_MM = 210;
    const A4_Dpmm = 11.0; // ~3234 × 2310 px ≈ 300 DPI reales
    const toPx = (mm: number) => Math.max(1, Math.round(mm * A4_Dpmm));

    const canvas = document.createElement('canvas');
    canvas.width = toPx(A4_W_MM);
    canvas.height = toPx(A4_H_MM);
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    const Mm = toPx; // alias corto

    // Helpers locales
    const fit = (text: string, maxWidth: number) => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let t = text;
      while (t.length > 2 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
      return t + '…';
    };
    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
    };

    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    const marginPx = Mm(8);
    const innerX = marginPx;
    const innerY = marginPx;
    const innerW = W - marginPx * 2;
    const innerH = H - marginPx * 2;

    // ── HEADER INSTITUCIONAL ──
    const headerH = Mm(22);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(innerX, innerY, innerW, headerH);
    // Franja celeste Lanús superior
    ctx.fillStyle = '#00AEEF';
    ctx.fillRect(innerX, innerY, innerW, Mm(1.4));

    let titleStartX = innerX + Mm(6);
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoH = Math.round(headerH * 0.62);
      const logoW = Math.round(logoH * (logoImg.naturalWidth / logoImg.naturalHeight));
      ctx.drawImage(logoImg, innerX + Mm(5), innerY + (headerH - logoH) / 2, logoW, logoH);
      titleStartX = innerX + Mm(5) + logoW + Mm(5);
    }

    // Título alineado a la izquierda junto al logo (más prolijo que centrado)
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Mm(6.2)}px Inter, sans-serif`;
    ctx.fillText('REFERENCIAS Y LEYENDA COMPLETA', titleStartX, innerY + headerH * 0.38);

    ctx.font = `600 ${Mm(3.2)}px Inter, sans-serif`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(
      `Línea ${cleanLineNumber} · ${lineaNombre} · ${datosRef.proyecto || 'Sistema GIS Lanús'}`,
      titleStartX,
      innerY + headerH * 0.72
    );

    // Badge "A4" a la derecha del header
    const a4BadgeW = Mm(20);
    const a4BadgeH = Mm(8);
    const a4BadgeX = innerX + innerW - a4BadgeW - Mm(5);
    const a4BadgeY = innerY + (headerH - a4BadgeH) / 2;
    roundRect(a4BadgeX, a4BadgeY, a4BadgeW, a4BadgeH, Mm(1.6));
    ctx.fillStyle = '#1E293B';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1, Mm(0.3));
    ctx.stroke();
    ctx.fillStyle = '#38BDF8';
    ctx.font = `800 ${Mm(3.4)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('A4 · ISO 216', a4BadgeX + a4BadgeW / 2, a4BadgeY + a4BadgeH / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // ── ÁREA DE CONTENIDO: 3 COLUMNAS ──
    const bodyY = innerY + headerH + Mm(5);
    const bodyH = innerY + innerH - bodyY - Mm(11);
    const colGap = Mm(5);
    const colW = (innerW - colGap * 2) / 3;
    const col1X = innerX;
    const col2X = innerX + colW + colGap;
    const col3X = innerX + (colW + colGap) * 2;

    const drawColTitle = (x: number, text: string) => {
      ctx.fillStyle = '#7B1828';
      ctx.fillRect(x, bodyY, Mm(1.2), Mm(5));
      ctx.fillStyle = '#0F172A';
      ctx.font = `800 ${Mm(3.8)}px Inter, sans-serif`;
      ctx.fillText(text, x + Mm(2.6), bodyY + Mm(3.8));
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1, Mm(0.25));
      ctx.beginPath();
      ctx.moveTo(x, bodyY + Mm(6.5));
      ctx.lineTo(x + colW, bodyY + Mm(6.5));
      ctx.stroke();
    };

    // ══ COLUMNA 1: Simbología ══
    drawColTitle(col1X, 'SIMBOLOGÍA TÉCNICA');
    const symStartY = bodyY + Mm(12);
    const symRowH = Mm(7.5);
    const symItems: { draw: () => void; label: string }[] = [
      { draw: () => { ctx.strokeStyle = '#2563EB'; ctx.lineWidth = Mm(1.2); ctx.beginPath(); ctx.moveTo(col1X + Mm(1), symStartY); ctx.lineTo(col1X + Mm(14), symStartY); ctx.stroke(); }, label: 'Trazo de Ida (continuo)' },
      { draw: () => { ctx.strokeStyle = '#DC2626'; ctx.lineWidth = Mm(1.2); ctx.setLineDash([Mm(3), Mm(2)]); ctx.beginPath(); ctx.moveTo(col1X + Mm(1), symStartY + symRowH); ctx.lineTo(col1X + Mm(14), symStartY + symRowH); ctx.stroke(); ctx.setLineDash([]); }, label: 'Trazo de Vuelta (discontinuo)' },
      { draw: () => { ctx.beginPath(); ctx.arc(col1X + Mm(7.5), symStartY + symRowH * 2, Mm(2.2), 0, Math.PI * 2); ctx.fillStyle = '#16A34A'; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Mm(0.6); ctx.stroke(); }, label: 'Cabecera (inicio de recorrido)' },
      { draw: () => { ctx.beginPath(); ctx.arc(col1X + Mm(7.5), symStartY + symRowH * 3, Mm(2.2), 0, Math.PI * 2); ctx.fillStyle = '#DC2626'; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Mm(0.6); ctx.stroke(); }, label: 'Terminal (destino de recorrido)' },
      { draw: () => { ctx.beginPath(); ctx.arc(col1X + Mm(7.5), symStartY + symRowH * 4, Mm(1.4), 0, Math.PI * 2); ctx.fillStyle = '#2563EB'; ctx.fill(); }, label: 'Paradas intermedias' },
      { draw: () => { ctx.strokeStyle = '#DB2777'; ctx.lineWidth = Mm(1.0); ctx.setLineDash([Mm(3), Mm(1.8)]); ctx.beginPath(); ctx.moveTo(col1X + Mm(1), symStartY + symRowH * 5); ctx.lineTo(col1X + Mm(14), symStartY + symRowH * 5); ctx.stroke(); ctx.setLineDash([]); }, label: 'Límite del Partido de Lanús' },
    ];

    ctx.font = `600 ${Mm(2.7)}px Inter, sans-serif`;
    symItems.forEach((it) => it.draw());
    symItems.forEach((it, i) => {
      ctx.fillStyle = '#1E293B';
      ctx.fillText(fit(it.label, colW - Mm(18)), col1X + Mm(18), symStartY + symRowH * i + Mm(1));
    });

    // ══ COLUMNA 2: Jurisdicciones + ficha de la línea ══
    drawColTitle(col2X, 'JURISDICCIONES');
    const jurStartY = bodyY + Mm(12);
    const jurItems = [
      { label: 'Nacional', range: 'Líneas 1 a 199', color: '#DC2626' },
      { label: 'Provincial', range: 'Líneas 200 a 499', color: '#2563EB' },
      { label: 'Municipal', range: 'Líneas 500 en adelante', color: '#16A34A' },
    ];
    ctx.font = `600 ${Mm(2.7)}px Inter, sans-serif`;
    jurItems.forEach((j, i) => {
      const y = jurStartY + i * Mm(8);
      roundRect(col2X, y - Mm(2.4), Mm(13), Mm(4.4), Mm(2.2));
      ctx.fillStyle = j.color;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Mm(2.3)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(j.label.toUpperCase(), col2X + Mm(6.5), y - Mm(0.2));
      ctx.textAlign = 'start';
      ctx.fillStyle = '#475569';
      ctx.font = `600 ${Mm(2.5)}px Inter, sans-serif`;
      ctx.fillText(j.range, col2X + Mm(16), y - Mm(0.2));
    });

    // Sub-bloque: datos del plano (editables)
    const detY = jurStartY + jurItems.length * Mm(8) + Mm(3);
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 ${Mm(3.2)}px Inter, sans-serif`;
    ctx.fillText('DATOS DEL PLANO', col2X, detY);

    const detailRows: [string, string][] = [
      ['Cobertura', datosRef.cobertura || 'Partido de Lanús'],
    ];
    if (datosRef.operador.trim()) detailRows.push(['Operador', datosRef.operador.trim()]);
    if (datosRef.escalaNominal.trim()) detailRows.push(['Escala', datosRef.escalaNominal.trim()]);
    detailRows.push(['Proyección', 'EPSG:3857 Isométrico']);
    detailRows.push(['Emitido', new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })]);

    ctx.font = `500 ${Mm(2.4)}px Inter, sans-serif`;
    detailRows.forEach(([k, v], i) => {
      const y = detY + Mm(4.5) + i * Mm(4.6);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(k + ':', col2X, y);
      ctx.fillStyle = '#1E293B';
      ctx.font = `700 ${Mm(2.4)}px Inter, sans-serif`;
      ctx.fillText(fit(v, colW - Mm(22)), col2X + Mm(20), y);
      ctx.font = `500 ${Mm(2.4)}px Inter, sans-serif`;
    });

    if (datosRef.observaciones.trim()) {
      const obsY = detY + Mm(4.5) + detailRows.length * Mm(4.6) + Mm(1.5);
      ctx.fillStyle = '#94A3B8';
      ctx.font = `500 ${Mm(2.3)}px Inter, sans-serif`;
      ctx.fillText('Observaciones:', col2X, obsY);
      ctx.fillStyle = '#334155';
      ctx.font = `600 ${Mm(2.3)}px Inter, sans-serif`;
      ctx.fillText(fit(datosRef.observaciones.trim(), colW - Mm(2)), col2X, obsY + Mm(4));
    }

    // ══ COLUMNA 3: Catálogo numerado de trazas ══
    drawColTitle(col3X, 'CATÁLOGO DE TRAZAS');
    interface RefItem { num: number; color: string; label: string; jurisdiccion: string; }
    const refItems: RefItem[] = [];
    const seenLabels = new Set<string>();

    allCapas.forEach((capa, idx) => {
      const num = capa.numero || normalizeLineNumber(capa.subGrupo?.nombre || '') || normalizeLineNumber(capa.nombre) || '';
      const lineNum = num ? `L.${num}` : (capa.subGrupo?.nombre || capa.nombre || `T.${idx + 1}`);
      const ramal = capa.subSubGrupo?.nombre || capa.subcategoria || '';
      const sentido = detectSentido(capa);
      const label = `${lineNum}${ramal ? ` · ${ramal}` : ''}${sentido ? ` · ${sentido}` : ''}`;
      const color = capa.color || getOfficialLineColor(capa.nombre);

      if (seenLabels.has(label)) return;
      seenLabels.add(label);

      const numVal = parseInt(String(num).replace(/\D/g, ''), 10);
      let jurisdiccion = 'Municipal';
      if (!isNaN(numVal)) {
        if (numVal >= 1 && numVal <= 199) jurisdiccion = 'Nac.';
        else if (numVal >= 200 && numVal <= 499) jurisdiccion = 'Prov.';
      }

      refItems.push({ num: refItems.length + 1, color, label, jurisdiccion });
    });

    // Filas tabulares con zebra striping y columna de jurisdicción
    const catStartY = bodyY + Mm(12);
    const catRowH = Mm(4.3);
    const maxCatRows = Math.max(1, Math.floor((bodyH - Mm(10)) / catRowH));
    const shown = refItems.slice(0, maxCatRows);

    // Encabezado de columnas
    ctx.font = `800 ${Mm(2.1)}px Inter, sans-serif`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Nº', col3X + Mm(1), catStartY - Mm(1.6));
    ctx.fillText('TRAZA', col3X + Mm(8), catStartY - Mm(1.6));
    ctx.fillText('JUR.', col3X + colW - Mm(11), catStartY - Mm(1.6));

    shown.forEach((item, i) => {
      const y = catStartY + i * catRowH;
      // Zebra striping de fondo
      if (i % 2 === 0) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(col3X, y - Mm(1.4), colW, catRowH);
      }

      // Badge numerado
      const bx = col3X + Mm(2.6);
      const by = y + Mm(0.6);
      ctx.beginPath();
      ctx.arc(bx, by, Mm(1.5), 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Mm(1.9)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(item.num), bx, by);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      // Muestra de color de la traza
      ctx.fillStyle = item.color;
      roundRect(col3X + Mm(5.2), y - Mm(0.5), Mm(2.2), Mm(2.2), Mm(0.5));
      ctx.fill();

      // Label de la traza
      ctx.fillStyle = '#1E293B';
      ctx.font = `600 ${Mm(2.3)}px Inter, sans-serif`;
      ctx.fillText(fit(item.label, colW - Mm(22)), col3X + Mm(8.4), y + Mm(1.1));

      // Jurisdicción (abreviada)
      ctx.fillStyle = '#64748B';
      ctx.font = `700 ${Mm(2.0)}px Inter, sans-serif`;
      ctx.fillText(item.jurisdiccion, col3X + colW - Mm(10.5), y + Mm(1.1));
    });

    if (refItems.length > shown.length) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = `600 ${Mm(2.3)}px Inter, sans-serif`;
      ctx.fillText(`+ ${refItems.length - shown.length} traza(s) más en el plano`, col3X + Mm(1), catStartY + shown.length * catRowH + Mm(2.5));
    }

    // ── FOOTER INSTITUCIONAL ──
    const footerH = Mm(8);
    const footerY = innerY + innerH - footerH;
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(innerX, footerY, innerW, footerH);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = Math.max(1, Mm(0.25));
    ctx.beginPath();
    ctx.moveTo(innerX, footerY);
    ctx.lineTo(innerX + innerW, footerY);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = `600 ${Mm(2.2)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      'Gobierno del Partido de Lanús · Subsecretaría de Transporte · Sistema GIS Lanús',
      innerX + innerW / 2,
      footerY + footerH * 0.38
    );
    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 ${Mm(2.0)}px Inter, sans-serif`;
    ctx.fillText(
      `Hoja de Referencias · Página ${pageNumber} de ${totalPages} · Formato A4 (297 × 210 mm)`,
      innerX + innerW / 2,
      footerY + footerH * 0.75
    );
    ctx.textAlign = 'start';

    return canvas;
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

    // Factor de grosor de traza elegido por el usuario (Fina 0.7× / Normal 1× / Gruesa 1.35×)
    const factorGrosor = grosorTraza === 'fina' ? 0.7 : grosorTraza === 'gruesa' ? 1.35 : 1;
    const trazoMm = config.traceStrokeMm * factorGrosor;
    const haloMm = config.haloStrokeMm * factorGrosor;

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
    let points: LatLng[] = targetCoords.map(([lat, lng]) => ({ lat, lng }));

    // 🎯 Encuadre fijo en el Partido de Lanús: inyectamos los vértices de sus límites
    // para que el encuadre nunca se salga del partido, sin importar la traza activa.
    if (encuadreLanus && limitesLanus && limitesLanus.length > 0) {
      const lanusPoints: LatLng[] = [];
      limitesLanus.forEach((ring) => {
        // Submuestreo defensivo para no inflar el array en anillos muy densos
        const step = Math.max(1, Math.floor(ring.length / 400));
        for (let i = 0; i < ring.length; i += step) {
          lanusPoints.push({ lat: ring[i][0], lng: ring[i][1] });
        }
      });
      points = points.concat(lanusPoints);
    }

    const proj = new MercatorViewportProjection(points, mapViewportW, mapViewportH, paddingFraction);

    // Cargar mapa base ráster
    let mapboxLoaded = false;
    if (motorCartografico === 'mapbox') {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
      const { url } = proj.getMapboxStaticUrl(token, estiloMapbox, true);

      // Reintentar hasta 3 veces con delay creciente para evitar rate limit de Mapbox
      for (let attempt = 0; attempt < 3 && !mapboxLoaded; attempt++) {
        if (attempt > 0) {
          // Delay progresivo: 400ms, luego 1200ms
          await new Promise((r) => setTimeout(r, 400 * attempt * 3));
        }
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const loaded = await new Promise<boolean>((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
            setTimeout(() => resolve(false), 10000);
          });
          if (loaded && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, mapViewportX, mapViewportY, mapViewportW, mapViewportH);
            mapboxLoaded = true;
          }
        } catch (e) {
          console.warn(`Fallo Mapbox Static (intento ${attempt + 1}):`, e);
        }
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
      // Fallback mejorado: fondo con grilla sutil para que no quede en blanco
      ctx.fillStyle = '#f0f4f8';
      ctx.fillRect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);
      // Grilla técnica sutil
      ctx.strokeStyle = '#d8e2ec';
      ctx.lineWidth = 0.5;
      const gridStep = Math.max(30, Math.min(mapViewportW, mapViewportH) / 12);
      for (let gx = mapViewportX; gx <= mapViewportX + mapViewportW; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, mapViewportY);
        ctx.lineTo(gx, mapViewportY + mapViewportH);
        ctx.stroke();
      }
      for (let gy = mapViewportY; gy <= mapViewportY + mapViewportH; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(mapViewportX, gy);
        ctx.lineTo(mapViewportX + mapViewportW, gy);
        ctx.stroke();
      }
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
    const nationalSegments: { coords: Point2D[]; color: string; isVuelta: boolean; label: string; capaId: string }[] = [];
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
            capaId: capa.id,
          });
        });
      });

      // Halos para líneas nacionales
      const natHaloPx = Math.max(2, toPx(trazoMm * 1.1));
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
      const natStrokePx = Math.max(1.5, toPx(trazoMm * 0.75));
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

    const allSegments: { coords: Point2D[]; color: string; isVuelta: boolean; capaId: string }[] = [];
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
          capaId: capa.id,
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

    const traceStrokePx = Math.max(2, toPx(trazoMm * 1.15));
    const haloStrokePx = Math.max(traceStrokePx + 2, toPx(haloMm));

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
      // Leyenda: compacta (5 filas + resumen numerado) o completa (hasta 12 filas)
      const maxDisplay = Math.min(leyendaCompleta ? 12 : 5, allUniqueLegendItems.length);
      const itemsToDisplay = allUniqueLegendItems.slice(0, maxDisplay);
      const remainingCount = allUniqueLegendItems.length - maxDisplay;

      // ── CAPA 5: Badges numerados de referencia cruzada plano ↔ leyenda ──
      // Cada traza lleva su número (①②③…) en el punto medio, igual que en la leyenda.
      // Tamaño proporcional al grosor de traza para no tapar el recorrido.
      if (numerarTrazas) {
        const numR = toPx(trazoMm * 1.3);
        const numFont = toPx(trazoMm * 1.15);
        allUniqueLegendItems.forEach((item, i) => {
          const seg =
            allSegments.find((s) => s.capaId === item.id) ||
            nationalSegments.find((s) => s.capaId === item.id);
          if (!seg || seg.coords.length < 2) return;
          const mid = seg.coords[Math.floor(seg.coords.length / 2)];
          // Halo blanco para legibilidad sobre el mapa base
          ctx.beginPath();
          ctx.arc(mid.x, mid.y, numR + toPx(0.5), 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          // Círculo oscuro con el número
          ctx.beginPath();
          ctx.arc(mid.x, mid.y, numR, 0, Math.PI * 2);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          ctx.font = `800 ${numFont}px Inter, sans-serif`;
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), mid.x, mid.y + toPx(0.2));
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        });
      }

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
        let swatchStartX = legBoxX + toPx(3.5);
        const swatchW = toPx(7.0);

        // Badge con el número de referencia cruzada (igual que en el plano).
        // Radio menor que la altura de fila para que no se solapen entre filas.
        if (numerarTrazas) {
          const numRLeg = toPx(config.caratureValMm * 0.36);
          const numCX = swatchStartX + numRLeg;
          ctx.beginPath();
          ctx.arc(numCX, itemY, numRLeg, 0, Math.PI * 2);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          ctx.font = `800 ${toPx(config.caratureValMm * 0.38)}px Inter, sans-serif`;
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), numCX, itemY + toPx(0.2));
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
          swatchStartX = numCX + numRLeg + toPx(1.5);
        }

        // Muestra de traza
        ctx.beginPath();
        ctx.moveTo(swatchStartX, itemY);
        ctx.lineTo(swatchStartX + swatchW, itemY);
        ctx.lineWidth = Math.max(2.2, toPx(trazoMm * 1.15));
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
        const hiddenNums = allUniqueLegendItems
          .slice(maxDisplay)
          .map((_, k) => maxDisplay + k + 1)
          .join(', ');
        const resumen = numerarTrazas
          ? `+ ${remainingCount} más en plano: Nº ${hiddenNums}`
          : `+ ${remainingCount} traza(s) adicional(es) en plano`;
        ctx.fillText(fitText(resumen, legBoxW - toPx(8)), legBoxX + toPx(4), extraY);
      }
    }

    // 🏛️ Dibujar el contorno del Partido de Lanús sobre el mapa (recortado al viewport)
    if (dibujarLimites && limitesLanus && limitesLanus.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(mapViewportX, mapViewportY, mapViewportW, mapViewportH);
      ctx.clip();

      const trazoLimite = Math.max(2, toPx(0.9));
      // Halo blanco para que el límite sea visible sobre cualquier mapa base
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Pasada 1: halo blanco ancho
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = trazoLimite + toPx(1.6);
      limitesLanus.forEach((ring) => {
        if (ring.length < 2) return;
        ctx.beginPath();
        ring.forEach(([lat, lng], idx) => {
          const pt = proj.project(lat, lng);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.stroke();
      });

      // Pasada 2: trazo magenta oficial (#DB2777) discontinuo estilo límite administrativo
      ctx.setLineDash([toPx(4), toPx(2.5)]);
      ctx.strokeStyle = '#DB2777';
      ctx.lineWidth = trazoLimite;
      limitesLanus.forEach((ring) => {
        if (ring.length < 2) return;
        ctx.beginPath();
        ring.forEach(([lat, lng], idx) => {
          const pt = proj.project(lat, lng);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Etiqueta "PARTIDO DE LANÚS" sobre el centroide del primer anillo
      try {
        const mainRing = limitesLanus.reduce((a, b) => (b.length > a.length ? b : a));
        let sx = 0;
        let sy = 0;
        let n = 0;
        const labelStep = Math.max(1, Math.floor(mainRing.length / 60));
        for (let i = 0; i < mainRing.length; i += labelStep) {
          const pt = proj.project(mainRing[i][0], mainRing[i][1]);
          sx += pt.x;
          sy += pt.y;
          n++;
        }
        if (n > 0) {
          const lx = sx / n;
          const ly = sy / n;
          const labelFont = toPx(2.6);
          ctx.font = `800 ${labelFont}px Inter, sans-serif`;
          const labelText = 'PARTIDO DE LANÚS';
          const tw = ctx.measureText(labelText).width;
          const padX = toPx(1.4);
          const padY = toPx(0.9);
          ctx.fillStyle = 'rgba(219, 39, 119, 0.92)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(lx - tw / 2 - padX, ly - labelFont - padY, tw + padX * 2, labelFont + padY * 2, toPx(1));
          else ctx.rect(lx - tw / 2 - padX, ly - labelFont - padY, tw + padX * 2, labelFont + padY * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, lx, ly - labelFont * 0.4);
          ctx.textAlign = 'start';
          ctx.textBaseline = 'alphabetic';
        }
      } catch {
        // El etiquetado es best-effort; nunca debe romper la generación
      }

      ctx.restore();
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
      fitText(`PROYECTO: ${datosPlano.proyecto || 'SISTEMA INTEGRADO DE TRANSPORTE URBANO'}`, col1InnerW),
      col1X + caraturePad,
      caratureY + caratureH * 0.14
    );

    ctx.font = `600 ${valFontSize * 0.78}px Inter, sans-serif`;
    ctx.fillStyle = '#475569';
    ctx.fillText(
      fitText(`COBERTURA: ${datosPlano.cobertura || 'PARTIDO DE LANÚS'}`, col1InnerW),
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

    // 📝 Título personalizable: si el usuario escribió uno, lo usa; si no, el auto
    const tituloFinal = datosPlano.tituloPlano.trim() || pageTitle;
    const subtituloFinal = datosPlano.subtitulo.trim() || pageSubtitle;

    ctx.font = `bold ${titleFontCarature}px Inter, sans-serif`;
    ctx.fillStyle = '#0F172A';
    ctx.fillText(fitText(tituloFinal, lineTextMaxW), lineTextX, badgeLineY + badgeLineSize * 0.45);

    ctx.font = `600 ${valFontSize * 0.88}px Inter, sans-serif`;
    ctx.fillStyle = '#64748B';
    ctx.fillText(fitText(subtituloFinal, lineTextMaxW), lineTextX, badgeLineY + badgeLineSize * 0.85);

    // ── COLUMNA 2: FICHA TÉCNICA Y CÓMPUTO ──
    const nationalLineNumbers = Array.from(
      new Set(
        nationalCapas
          .map((c) => normalizeLineNumber(c.nombre) || normalizeLineNumber(c.subGrupo?.nombre || ''))
          .filter(Boolean)
      )
    ).join(', ');

    const metrics: { label: string; val: string }[] = [
      { label: 'Longitud de Traza:', val: `${totalRouteDistanceKm.toFixed(2)} km` },
      { label: 'Paradas Registradas:', val: `${stopCount > 0 ? stopCount : targetCapas.length * 2}` },
    ];

    // 🔘 "Red Referencia" solo si el usuario la quiere ver (a veces ensucia con 240+ trazas)
    if (datosPlano.mostrarRedRef) {
      const refTruncada = nationalLineNumbers.length > 30
        ? nationalLineNumbers.substring(0, 27) + '…'
        : nationalLineNumbers;
      metrics.push({
        label: `Red ${metaOverlay.corta} Referencia:`,
        val: nationalCapas.length > 0
          ? `${nationalCapas.length} trazas${refTruncada ? ` (L.${refTruncada})` : ''}`
          : 'Sin superposición',
      });
    }

    metrics.push({
      label: 'Fecha de Emisión:',
      val: new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
    metrics.push({ label: 'Datum / Proyección:', val: 'EPSG:3857 Isométrico 1:1' });

    // Filas opcionales solo si el usuario las completó (máx. 7 filas para no desbordar)
    if (datosPlano.operador.trim()) {
      metrics.push({ label: 'Operador:', val: datosPlano.operador.trim() });
    }
    if (datosPlano.escalaNominal.trim()) {
      metrics.push({ label: 'Escala Nominal:', val: datosPlano.escalaNominal.trim() });
    }
    if (datosPlano.observaciones.trim()) {
      metrics.push({ label: 'Observaciones:', val: datosPlano.observaciones.trim() });
    }

    // Paso adaptativo: acomoda de 4 a 8 filas dentro de la altura de la carátula
    const rowStep = caratureH / (metrics.length + 0.3);

    metrics.forEach((m, idx) => {
      const y = caratureY + (idx + 0.85) * rowStep;

      // Zebra striping sutil para legibilidad
      if (idx % 2 === 0) {
        ctx.fillStyle = '#FAFBFC';
        ctx.fillRect(col2X + caraturePad * 0.5, y - rowStep * 0.42, col2W - caraturePad, rowStep * 0.84);
      }

      ctx.font = `500 ${valFontSize * 0.85}px Inter, sans-serif`;
      ctx.fillStyle = '#64748B';
      ctx.fillText(m.label, col2X + caraturePad, y);

      ctx.font = `bold ${valFontSize * 0.92}px Inter, sans-serif`;
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'right';
      ctx.fillText(fitText(m.val, col2W * 0.55), col2X + col2W - caraturePad, y);
      ctx.textAlign = 'start';
    });

    // ── COLUMNA 3: SIMBOLOGÍA Y REFERENCIAS TÉCNICAS ──
    const col3Pad = caraturePad;
    const col3InnerW = col3W - 2 * col3Pad;

    // Título con barra de color
    ctx.fillStyle = '#7B1828';
    ctx.fillRect(col3X + col3Pad, caratureY + caratureH * 0.1, toPx(1.2), toPx(4));
    ctx.font = `bold ${valFontSize * 0.92}px Inter, sans-serif`;
    ctx.fillStyle = '#7B1828';
    ctx.fillText(fitText('SIMBOLOGÍA & REFERENCIAS', col3InnerW - toPx(3)), col3X + col3Pad + toPx(2.5), caratureY + caratureH * 0.15);

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
    ctx.lineWidth = Math.max(2.5, toPx(trazoMm * 1.2));
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
    ctx.lineWidth = Math.max(2.5, toPx(trazoMm * 1.2));
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
      ctx.lineWidth = Math.max(1.8, toPx(trazoMm * 0.85));
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
  // 👁️ Vista previa rápida de la lámina (baja resolución, sin generar PDF)
  const handlePreview = async () => {
    if (capasFiltradas.length === 0) {
      alert('Seleccioná al menos 1 ramal o trazo para previsualizar.');
      return;
    }
    setIsPreviewing(true);
    setPrintStatus('Renderizando vista previa...');
    try {
      const isLandscapeLocal = orientacion === 'landscape';
      const cfg = SHEET_CONFIGS[paperFormat] || SHEET_CONFIGS.A4;
      const pw = isLandscapeLocal ? cfg.w : cfg.h;
      const ph = isLandscapeLocal ? cfg.h : cfg.w;
      // Escala reducida (~1/4 del dpmm final) para que la vista previa sea instantánea
      const previewDpmm = Math.max(1.4, cfg.baseDpmm * 0.28);

      const canvas = await renderSingleSheetCanvas({
        targetCapas: capasFiltradas,
        nationalCapas: capasNacionalesActivas,
        pageTitle: `LÍNEA ${normalizeLineNumber(lineaNombre) || lineaNombre}`,
        pageSubtitle: `Vista previa · ${capasFiltradas.length} variante(s) activa(s) · Sistema Lanús`,
        pageNumber: 1,
        totalPages: 1,
        config: cfg,
        isLandscape: isLandscapeLocal,
        pdfWidthMm: pw,
        pdfHeightMm: ph,
        paddingFraction: framingMode === 'tight' ? 0.045 : framingMode === 'relaxed' ? 0.12 : 0.07,
        dpmm: previewDpmm,
        logoImg: null,
      });

      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.86));
      setPrintStatus('');
    } catch (e) {
      console.error('Error en vista previa:', e);
      setPrintStatus('');
      alert('No se pudo generar la vista previa. Revisá la consola.');
    } finally {
      setIsPreviewing(false);
    }
  };

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
        isReferencePage?: boolean;
      }

      const pagesToGenerate: PagePlan[] = [];

      const capasIda = capasFiltradas.filter((c) => detectSentido(c) === 'IDA');
      const capasVuelta = capasFiltradas.filter((c) => detectSentido(c) === 'VUELTA');
      const hayAmbosSentidos = capasIda.length > 0 && capasVuelta.length > 0;
      // Modo JUNTOS: una sola lámina con todo, sin importar layout
      if (modoIdaVuelta === 'juntos') {
        // Una lámina por cada ramal, con ida + vuelta juntos
        const grupos = new Map<string, any[]>();
        capasFiltradas.forEach((capa) => {
          const key = (capa.nombre || '').trim() || `Ramal`;
          if (!grupos.has(key)) grupos.set(key, []);
          grupos.get(key)!.push(capa);
        });
        grupos.forEach((capasGrupo, nombreRamal) => {
          const sentido = capasGrupo.map((c) => detectSentido(c)).join('/');
          pagesToGenerate.push({
            capas: capasGrupo,
            title: `LÍNEA ${cleanLineNumber} · ${nombreRamal.toUpperCase()}`,
            subtitle: `Variante · Sentido ${sentido} · Sistema Lanús`,
            isConsolidated: capasGrupo.length > 1,
          });
        });
        // Si no hay grupos (fallback), una sola lámina
        if (grupos.size === 0) {
          const ramalesUnicos = Array.from(new Set(capasFiltradas.map((c) => c.nombre.trim()).filter(Boolean)));
          const ramalesStr = ramalesUnicos.length > 0 ? ramalesUnicos.join(' · ') : 'Recorrido General';
          pagesToGenerate.push({
            capas: capasFiltradas,
            title: `LÍNEA ${cleanLineNumber} · ${ramalesStr.toUpperCase()}`,
            subtitle: `Plano Consolidado · ${capasFiltradas.length} variante(s) · Sistema Lanús`,
            isConsolidated: true,
          });
        }
      } else if (pageLayout === 'individual') {
        // Modo separados + individual: una página por capa
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
      } else if (pageLayout === 'all-in-one') {
        // Modo separados + all-in-one: una lámina por sentido
        if (hayAmbosSentidos) {
          if (capasIda.length > 0) {
            const ramalesIda = Array.from(new Set(capasIda.map((c) => c.nombre.trim()).filter(Boolean)));
            pagesToGenerate.push({
              capas: capasIda,
              title: `LÍNEA ${cleanLineNumber} · ${ramalesIda.join(' · ').toUpperCase() || 'IDA'}`,
              subtitle: `Plano Consolidado · Sentido IDA · ${capasIda.length} variante(s) · Sistema Lanús`,
              isConsolidated: true,
            });
          }
          if (capasVuelta.length > 0) {
            const ramalesVuelta = Array.from(new Set(capasVuelta.map((c) => c.nombre.trim()).filter(Boolean)));
            pagesToGenerate.push({
              capas: capasVuelta,
              title: `LÍNEA ${cleanLineNumber} · ${ramalesVuelta.join(' · ').toUpperCase() || 'VUELTA'}`,
              subtitle: `Plano Consolidado · Sentido VUELTA · ${capasVuelta.length} variante(s) · Sistema Lanús`,
              isConsolidated: true,
            });
          }
        } else {
          const ramalesUnicos = Array.from(new Set(capasFiltradas.map((c) => c.nombre.trim()).filter(Boolean)));
          const ramalesStr = ramalesUnicos.length > 0 ? ramalesUnicos.join(' · ') : 'Recorrido General';
          pagesToGenerate.push({
            capas: capasFiltradas,
            title: `LÍNEA ${cleanLineNumber} · ${ramalesStr.toUpperCase()}`,
            subtitle: `Plano General Consolidado · ${capasFiltradas.length} variante(s) activa(s) · Sistema Lanús`,
            isConsolidated: true,
          });
        }
      } else {
        // Modo separados + both: consolidado por sentido + individuales
        if (hayAmbosSentidos) {
          if (capasIda.length > 0) {
            const ramalesIda = Array.from(new Set(capasIda.map((c) => c.nombre.trim()).filter(Boolean)));
            pagesToGenerate.push({
              capas: capasIda,
              title: `LÍNEA ${cleanLineNumber} · ${ramalesIda.join(' · ').toUpperCase() || 'IDA'}`,
              subtitle: `Plano Consolidado · Sentido IDA · ${capasIda.length} variante(s) · Sistema Lanús`,
              isConsolidated: true,
            });
          }
          if (capasVuelta.length > 0) {
            const ramalesVuelta = Array.from(new Set(capasVuelta.map((c) => c.nombre.trim()).filter(Boolean)));
            pagesToGenerate.push({
              capas: capasVuelta,
              title: `LÍNEA ${cleanLineNumber} · ${ramalesVuelta.join(' · ').toUpperCase() || 'VUELTA'}`,
              subtitle: `Plano Consolidado · Sentido VUELTA · ${capasVuelta.length} variante(s) · Sistema Lanús`,
              isConsolidated: true,
            });
          }
        } else {
          const ramalesUnicos = Array.from(new Set(capasFiltradas.map((c) => c.nombre.trim()).filter(Boolean)));
          const ramalesStr = ramalesUnicos.length > 0 ? ramalesUnicos.join(' · ') : 'Recorrido General';
          pagesToGenerate.push({
            capas: capasFiltradas,
            title: `LÍNEA ${cleanLineNumber} · ${ramalesStr.toUpperCase()}`,
            subtitle: `Plano General Consolidado · ${capasFiltradas.length} variante(s) activa(s) · Sistema Lanús`,
            isConsolidated: true,
          });
        }
        // Individuales
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

      // Si por filtros no quedó ninguna página planificada, generamos al menos la lámina general del municipio
      if (pagesToGenerate.length === 0) {
        pagesToGenerate.push({
          capas: capasLinea && capasLinea.length > 0 ? capasLinea : [],
          title: lineaNombre.toUpperCase() || 'MAPA DE LANÚS',
          subtitle: 'Cartografía Municipal Oficial · Subsecretaría de Transporte',
          isConsolidated: true,
        });
      }

      // 📄 Hoja aparte de referencias: catálogo completo al final del PDF
      if (referenciasHojaAparte) {
        pagesToGenerate.push({
          capas: capasFiltradas,
          title: 'REFERENCIAS Y LEYENDA COMPLETA',
          subtitle: `Catálogo de trazas · Línea ${cleanLineNumber} · Sistema Lanús`,
          isConsolidated: true,
          isReferencePage: true,
        });
      }

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

        // 📄 Página de referencias: SIEMPRE A4 apaisado (297 × 210 mm), independiente del papel del plano
        if (page.isReferencePage) {
          const refCanvas = await renderReferencePageCanvas({
            allCapas: [...capasFiltradas, ...capasNacionalesActivas],
            pageNumber: i + 1,
            totalPages: pagesToGenerate.length,
            logoImg,
            lineaNombre,
            cleanLineNumber,
            datosRef: datosPlano,
          });
          if (i > 0) {
            pdf.addPage('a4', 'landscape');
          }
          const refImgData = refCanvas.toDataURL('image/jpeg', 0.98);
          // Se dibuja en 297 × 210 mm (A4 apaisado) sin importar el formato del resto del PDF
          pdf.addImage(refImgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
          continue;
        }

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
          // Delay entre páginas para evitar rate limit de Mapbox Static API
          await new Promise((r) => setTimeout(r, 350));
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');
      }

      // También agregar delay antes de la hoja de referencias si hay más páginas
      if (pagesToGenerate.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
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

  // ══════════════════════════════════════════════════════════════════
  // ❓ Tooltip de ayuda contextual
  // ══════════════════════════════════════════════════════════════════
  const InfoTooltip = ({ texto, children }: { texto: string; children?: React.ReactNode }) => (
    <span
      title={texto}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'help',
        position: 'relative',
      }}
    >
      {children}
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: '#e2e8f0',
          color: '#64748b',
          fontSize: '0.58rem',
          fontWeight: 900,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
          lineHeight: 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
      >
        ?
      </span>
    </span>
  );

  // ══════════════════════════════════════════════════════════════════
  // 📖 Modal de ayuda completo con todas las funciones explicadas
  // ══════════════════════════════════════════════════════════════════
  const ModalAyuda = () => {
    if (!ayudaAbierta) return null;
    const bloques: { titulo: string; color: string; items: { icon: string; label: string; desc: string }[] }[] = [
      {
        titulo: '1 · Contenido del PDF',
        color: '#2563eb',
        items: [
          { icon: '📄', label: 'Todos Juntos', desc: 'Genera una sola lámina con todos los trazos superpuestos. Ideal para una vista general.' },
          { icon: '📑', label: '1 por Página', desc: 'Cada trazo/variante en su propia página. Ideal para imprimir por ramal.' },
          { icon: '📚', label: 'Álbum Completo', desc: 'Combina ambos: una página por trazo + una lámina resumen al final.' },
          { icon: '🔄', label: 'Ida y Vuelta', desc: '"Juntos" pone ida y vuelta en la misma lámina. "Separados" genera dos láminas: una para ida, otra para vuelta.' },
        ],
      },
      {
        titulo: '2 · Líneas y Jurisdicción',
        color: '#0891b2',
        items: [
          { icon: '🌐', label: 'Superponer Líneas', desc: 'Agrega al plano las líneas nacionales (1-199), provinciales (200-499) o municipales (500+) como referencia de contexto.' },
          { icon: '🎨', label: 'Color Vivo / Sutil', desc: '"Color Vivo" las muestra en su color oficial. "Sutil" las muestra en gris para que no compitan con tu línea.' },
          { icon: '🔍', label: 'Buscador', desc: 'Filtra la lista de trazos por número de línea, nombre de ramal o jurisdicción.' },
        ],
      },
      {
        titulo: '3 · Simbología',
        color: '#7c3aed',
        items: [
          { icon: '—', label: 'Trazo Ida', desc: 'Línea continua que representa el recorrido de ida.' },
          { icon: '╌', label: 'Trazo Vuelta', desc: 'Línea discontinua que representa el recorrido de vuelta/regreso.' },
          { icon: '●', label: 'Cabecera / Terminal', desc: 'Puntos verdes (cabecera/inicio) y granates (terminal/destino).' },
        ],
      },
      {
        titulo: '4 · Formato y Motor',
        color: '#059669',
        items: [
          { icon: '🔍', label: 'Encuadre', desc: 'Ajustado = más zoom. Óptimo = equilibrio. Amplio = más contexto urbano.' },
          { icon: '🗺️', label: 'Motor Cartográfico', desc: 'Define el mapa base: Mapbox (satélital/streets) o modo pantalla (sin dependencias).' },
          { icon: '📏', label: 'Grosor de Traza', desc: 'Delgada para muchos trazos. Gruesa para pocos trazos o impresión tamaño grande.' },
          { icon: '📐', label: 'Formato', desc: 'A4 (297×210) para oficina. A3/A2/A1/A0 para planos grandes. La hoja de referencias siempre es A4.' },
        ],
      },
      {
        titulo: '5 · Datos y Opciones',
        color: '#d97706',
        items: [
          { icon: '✏️', label: 'Título y Subtítulo', desc: 'Personalizá el texto grande de la carátula. Si lo dejás vacío, se genera automáticamente.' },
          { icon: '📋', label: 'Proyecto / Cobertura', desc: 'Datos institucionales que aparecen en la carátula del plano.' },
          { icon: '👁️', label: 'Vista Previa', desc: 'Renderiza la lámina en baja resolución sin generar el PDF. Ideal para verificar antes de imprimir.' },
          { icon: '📄', label: 'Referencias A4', desc: 'Agrega una hoja final A4 con simbología completa, jurisdicciones y catálogo numerado de trazas.' },
        ],
      },
      {
        titulo: 'Varita Mágica',
        color: '#16a34a',
        items: [
          { icon: '✨', label: 'Selección por Clic', desc: 'Activála y hacé clic directamente sobre los trazos del mapa para agregarlos o quitarlos de la selección.' },
        ],
      },
    ];

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={() => setAyudaAbierta(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>📖</span>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Guía de Impresión Cartográfica</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Cómo usar cada opción del generador de planos</div>
              </div>
            </div>
            <button onClick={() => setAyudaAbierta(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>✕</button>
          </div>
          <div style={{ padding: '14px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {bloques.map((bloque) => (
              <div key={bloque.titulo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ width: 3, height: 16, borderRadius: 2, background: bloque.color }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: bloque.color }}>{bloque.titulo}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {bloque.items.map((item) => (
                    <div key={item.label} style={{ display: 'flex', gap: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '0.9rem', flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b' }}>{item.label}</span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', lineHeight: 1.4 }}>{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setAyudaAbierta(false)} style={{ padding: '8px 18px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
              Entendido ✓
            </button>
          </div>
        </div>
      </div>
    );
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
      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .seccion-btn:hover { background: rgba(0,0,0,0.025) !important; }
        .modal-scroll::-webkit-scrollbar { width: 5px; }
        .modal-scroll::-webkit-scrollbar-track { background: transparent; }
        .modal-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
        .modal-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .hidden-mobile { display: inline; }
        @media (max-width: 640px) {
          .modal-header-steps { display: none !important; }
          .hidden-mobile { display: none !important; }
          .modal-footer-btns { flex-direction: column !important; width: 100% !important; }
          .modal-footer-btns button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          pointerEvents: 'auto',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.25s ease',
          minHeight: 0,
        }}
      >
        {/* Encabezado rediseñado con indicador de flujo */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c4a6e 100%)',
            color: '#f8fafc',
            padding: '14px 18px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(37,99,235,0.15))',
                  border: '1px solid rgba(56,189,248,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Printer size={19} color="#38bdf8" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Estudio Cartográfico
                </h3>
                <p style={{ margin: '1px 0 0', fontSize: '0.66rem', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  EPSG:3857 ·{' '}
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{capasFiltradas.length} trazos</span>
                  {incluirNacionales && (
                    <> + <span style={{ color: '#86efac', fontWeight: 700 }}>+{capasNacionalesActivas.length}</span></>
                  )}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <button
                onClick={() => setAyudaAbierta(true)}
                title="Guía de uso"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#94a3b8',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                ❓ <span className="hidden-mobile">Ayuda</span>
              </button>
              <button
                onClick={onClose}
                disabled={isGenerating}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  padding: '7px',
                  borderRadius: '10px',
                  display: 'flex',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!isGenerating) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#f8fafc'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Indicador de flujo: 5 pasos */}
          <div className="modal-header-steps" style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
            {[
              { id: 'contenido', label: 'Contenido' },
              { id: 'lineas', label: 'Líneas' },
              { id: 'refs', label: 'Simbología' },
              { id: 'formato', label: 'Formato' },
              { id: 'datos', label: 'Datos' },
            ].map((p, i, arr) => {
              const activa = seccionesAbiertas[p.id] !== false;
              return (
                <React.Fragment key={p.id}>
                  <button
                    type="button"
                    onClick={() => { if (seccionesAbiertas[p.id] === false) toggleSeccion(p.id); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '1px 0',
                    }}
                  >
                    <div
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 5,
                        background: activa ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${activa ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.55rem',
                        fontWeight: 800,
                        color: activa ? '#38bdf8' : '#475569',
                        transition: 'all 0.2s',
                      }}
                    >
                      {i + 1}
                    </div>
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        color: activa ? '#cbd5e1' : '#475569',
                        transition: 'color 0.2s',
                      }}
                    >
                      {p.label}
                    </span>
                  </button>
                  {i < arr.length - 1 && (
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 4px', minWidth: '6px' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Cuerpo Principal con Scroll */}
        <div
          className="modal-scroll"
          style={{
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Varita mágica — banner compacto */}
          <div
            style={{
              background: modoVarita ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              border: `1.5px solid ${modoVarita ? '#86efac' : '#bfdbfe'}`,
              borderRadius: '12px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: modoVarita ? '0 0 16px rgba(34,197,94,0.12)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: modoVarita ? 'rgba(22,163,74,0.12)' : 'rgba(37,99,235,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={15} color={modoVarita ? '#16a34a' : '#2563eb'} />
              </div>
              <div>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: modoVarita ? '#166534' : '#1d4ed8', display: 'block', lineHeight: 1.2 }}>
                  {modoVarita ? '✓ Selección por Clic Activa' : 'Varita Mágica de Mapa'}
                </span>
                <span style={{ fontSize: '0.66rem', color: modoVarita ? '#15803d' : '#3b82f6' }}>
                  {modoVarita ? 'Tocá cualquier trazo para sumarlo/quitarlo' : 'Hacé clic en el mapa o elegí en la lista'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModoVarita(!modoVarita)}
              style={{
                background: modoVarita ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: 'none',
                color: '#fff',
                borderRadius: '9px',
                padding: '6px 12px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {modoVarita ? '✓ Activa' : 'Activar Clic'}
            </button>
          </div>

          {/* ═══ SECCIÓN 1: Contenido del PDF ═══ */}
          <Seccion
            abierta={seccionesAbiertas.contenido !== false}
            onToggle={toggleSeccion}
            id="contenido"
            num={1}
            icon={<Layers size={16} />}
            titulo="Contenido del PDF"
            sub="Elegí cómo organizar las páginas y qué trazos incluir"
            accent="#2563eb"
            badge={`${capasFiltradas.length} trazos`}
          >
            <label
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#1e293b',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              <Layers size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Estructura de Páginas del PDF:
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

            {/* 🔄 Toggle: Ida y Vuelta Juntos o Separados */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Ida y Vuelta:</span>
                <InfoTooltip texto='"Juntos" pone ida y vuelta en la misma lámina (trazo continuo + discontinuo). "Separados" genera dos láminas independientes: una solo ida, otra solo vuelta.'>
                  <></>
                </InfoTooltip>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  {
                    id: 'juntos' as const,
                    icon: <Repeat size={16} />,
                    label: 'Juntos',
                    sub: 'Ida + Vuelta en la misma lámina',
                  },
                  {
                    id: 'separados' as const,
                    icon: <Files size={16} />,
                    label: 'Separados',
                    sub: '2 láminas: una ida, otra vuelta',
                  },
                ].map((opt) => {
                  const isSelected = modoIdaVuelta === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setModoIdaVuelta(opt.id)}
                      style={{
                        padding: '7px 8px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        textAlign: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: isSelected ? '#1d4ed8' : '#334155',
                        }}
                      >
                        {opt.icon} {opt.label}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b' }}>{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Seccion>

          {/* ═══ SECCIÓN 2: Líneas y Jurisdicción ═══ */}
          <Seccion
            abierta={seccionesAbiertas.lineas !== false}
            onToggle={toggleSeccion}
            id="lineas"
            num={2}
            icon={<Globe size={16} />}
            titulo="Líneas y Jurisdicción"
            sub="Superponé la red nacional/provincial y seleccioná trazos"
            accent="#0891b2"
            badge={incluirNacionales ? `+${capasNacionalesActivas.length}` : undefined}
          >
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
          </Seccion>

          {/* ═══ SECCIÓN 3: Simbología ═══ */}
          <Seccion
            abierta={seccionesAbiertas.refs !== false}
            onToggle={toggleSeccion}
            id="refs"
            num={3}
            icon={<BookOpen size={16} />}
            titulo="Simbología y Referencias"
            sub="Cómo se representan las trazas en el plano"
            accent="#7c3aed"
          >
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
          </Seccion>

          {/* ═══ SECCIÓN 4: Formato y Motor ═══ */}
          <Seccion
            abierta={seccionesAbiertas.formato !== false}
            onToggle={toggleSeccion}
            id="formato"
            num={4}
            icon={<Compass size={16} />}
            titulo="Formato y Motor Cartográfico"
            sub="Encuadre, escala, mapa base y calidad de impresión"
            accent="#059669"
          >
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
              <Target size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Encuadre y Escala Cartográfica:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                {
                  id: 'tight' as FramingMode,
                  label: 'Ajustado / Nítido',
                  sub: 'Mayor zoom y calles grandes',
                },
                {
                  id: 'optimal' as FramingMode,
                  label: 'Óptimo (Recomendado)',
                  sub: 'Equilibrio perfecto de traza',
                },
                {
                  id: 'relaxed' as FramingMode,
                  label: 'Amplio',
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
              <Globe size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Motor Cartográfico & Mapa Base:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {[
                {
                  id: 'streets-v12',
                  label: 'Callejero Urbano HD',
                  sub: 'Mapbox Streets (Recomendado)',
                  motor: 'mapbox',
                },
                {
                  id: 'light-v11',
                  label: 'Plano Técnico Claro',
                  sub: 'Minimalista / Alto Contraste',
                  motor: 'mapbox',
                },
                {
                  id: 'navigation-day-v1',
                  label: 'Red Vial Vectorial',
                  sub: 'Líneas viales y nombres nítidos',
                  motor: 'mapbox',
                },
                {
                  id: 'satellite-streets-v12',
                  label: 'Satélite HD + Calles',
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

          {/* Grosor de Traza */}
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
              <Pencil size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Grosor de Traza:
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'fina', label: 'Fina', sub: '0.7×' },
                { id: 'normal', label: 'Normal', sub: '1×' },
                { id: 'gruesa', label: 'Gruesa', sub: '1.35×' },
              ].map((g) => {
                const active = grosorTraza === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGrosorTraza(g.id as 'fina' | 'normal' | 'gruesa')}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: '8px',
                      border: active ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: active ? '#eff6ff' : '#fff',
                      color: active ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                  >
                    {g.label}
                    <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>{g.sub}</div>
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
          </Seccion>

          {/* ═══ SECCIÓN 5: Datos y Opciones ═══ */}
          <Seccion
            abierta={seccionesAbiertas.datos !== false}
            onToggle={toggleSeccion}
            id="datos"
            num={5}
            icon={<FileText size={16} />}
            titulo="Datos del Plano y Opciones"
            sub="Personalizá la carátula y las opciones técnicas"
            accent="#d97706"
          >
          {/* ✏️ Datos editables del plano (personalización de la carátula) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>
                <Pencil size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Datos del Plano:
              </label>
              <button
                type="button"
                onClick={() =>
                  setDatosPlano({
                    proyecto: 'SISTEMA INTEGRADO DE TRANSPORTE URBANO',
                    cobertura: 'LANÚS O. · LANÚS E. · R. DE ESCALADA · V. ALSINA · GERLI · M. CHINGOLO',
                    operador: '',
                    escalaNominal: '',
                    observaciones: '',
                    tituloPlano: '',
                    subtitulo: '',
                    mostrarRedRef: true,
                  })
                }
                style={{
                  padding: '3px 8px',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#64748b',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                ↺ Restaurar
              </button>
            </div>

            {/* Campos principales */}
            {(
              [
                { key: 'tituloPlano', label: 'Título del Plano', placeholder: `LÍNEA ${normalizeLineNumber(lineaNombre) || lineaNombre}` },
                { key: 'subtitulo', label: 'Subtítulo', placeholder: 'Plano General Consolidado · Sistema Lanús' },
                { key: 'proyecto', label: 'Proyecto', placeholder: 'SISTEMA INTEGRADO DE TRANSPORTE URBANO' },
                { key: 'cobertura', label: 'Cobertura', placeholder: 'Partidos / localidades que abarca' },
                { key: 'operador', label: 'Operador (opcional)', placeholder: 'Empresa operadora' },
                { key: 'escalaNominal', label: 'Escala nominal (opcional)', placeholder: 'Ej: 1:25.000' },
                { key: 'observaciones', label: 'Observaciones (opcional)', placeholder: 'Notas al pie de la carátula' },
              ] as { key: keyof typeof datosPlano; label: string; placeholder: string }[]
            ).map((campo) => (
              <div key={campo.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>{campo.label}</span>
                <input
                  type="text"
                  value={datosPlano[campo.key] as string}
                  onChange={(e) => setDatoPlano(campo.key, e.target.value)}
                  placeholder={campo.placeholder}
                  style={{
                    padding: '6px 9px',
                    fontSize: '0.74rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '7px',
                    background: '#fff',
                    color: '#1e293b',
                    fontWeight: 600,
                    width: '100%',
                  }}
                />
              </div>
            ))}

            {/* Toggle: mostrar/ocultar "Red Referencia" en la carátula */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '2px',
              }}
            >
              <input
                type="checkbox"
                checked={datosPlano.mostrarRedRef}
                onChange={(e) => setDatoPlano('mostrarRedRef', e.target.checked)}
                style={{ width: '14px', height: '14px', accentColor: '#d97706' }}
              />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e' }}>
                Mostrar "Red Referencia" en ficha técnica
              </span>
              <span style={{ fontSize: '0.62rem', color: '#b45309', fontWeight: 500 }}>
                (si hay muchas trazas, puede ensuciar)
              </span>
            </label>
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

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={numerarTrazas}
                onChange={(e) => setNumerarTrazas(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#16a34a' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
                Numerar trazas en el plano (①②③) con referencia cruzada en la leyenda
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
                checked={leyendaCompleta}
                onChange={(e) => setLeyendaCompleta(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
                Leyenda completa: mostrar todas las trazas (sin resumir en "+ N más")
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={referenciasHojaAparte}
                onChange={(e) => setReferenciasHojaAparte(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#d97706' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
                📄 Referencias en hoja aparte (catálogo completo al final del PDF)
              </span>
              <InfoTooltip texto="Agrega una página A4 al final del PDF con: simbología completa, jurisdicciones, datos del plano y catálogo numerado de todas las trazas. Siempre en formato A4 aunque el plano sea A3 o mayor.">
                <></>
              </InfoTooltip>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={encuadreLanus}
                onChange={(e) => setEncuadreLanus(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#0284c7' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
                🎯 Encuadre fijo en Partido de Lanús
              </span>
              <InfoTooltip texto="Fuerza el encuadre del plano dentro de los límites del Partido de Lanús, inyectando sus vértices geográficos en la proyección. Útil para que el plano nunca se salga del municipio.">
                <></>
              </InfoTooltip>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: '#fce7f3',
                border: '1px solid #f9a8d4',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={dibujarLimites}
                onChange={(e) => setDibujarLimites(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#db2777' }}
              />
              <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 600 }}>
                🏛️ Dibujar límites del Partido de Lanús
              </span>
              <InfoTooltip texto="Dibuja el polígono del Partido de Lanús sobre el plano con trazo magenta discontinuo y etiqueta. Recortado al viewport de la lámina.">
                <></>
              </InfoTooltip>
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
          </Seccion>

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
            padding: '10px 16px',
            background: 'linear-gradient(180deg, #fafbfd, #f1f5f9)',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (!isGenerating) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          >
            Cancelar
          </button>

          {/* 👁️ Vista previa + Imprimir */}
          <div className="modal-footer-btns" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePreview}
              disabled={isGenerating || isPreviewing || capasFiltradas.length === 0}
              title="Renderiza la lámina en baja resolución sin generar el PDF"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: isGenerating || isPreviewing || capasFiltradas.length === 0 ? '#f1f5f9' : '#fff7ed',
                border: `1px solid ${isGenerating || isPreviewing || capasFiltradas.length === 0 ? '#e2e8f0' : '#fed7aa'}`,
                color: isGenerating || isPreviewing || capasFiltradas.length === 0 ? '#94a3b8' : '#c2410c',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: isGenerating || isPreviewing || capasFiltradas.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { if (!isGenerating && !isPreviewing && capasFiltradas.length > 0) { e.currentTarget.style.background = '#ffedd5'; e.currentTarget.style.borderColor = '#fdba74'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.borderColor = '#fed7aa'; }}
            >
              {isPreviewing ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />}
              {isPreviewing ? '...' : 'Vista Previa'}
            </button>

            <button
              type="button"
              onClick={handleGeneratePrint}
              disabled={isGenerating || capasFiltradas.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                background:
                  isGenerating || capasFiltradas.length === 0
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: isGenerating || capasFiltradas.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isGenerating ? 'none' : '0 3px 12px rgba(37,99,235,0.3)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
              {isGenerating
                ? 'Generando...'
                : pageLayout === 'individual'
                ? `Imprimir ${capasFiltradas.length} Planos (${paperFormat})`
                : pageLayout === 'both'
                ? `Álbum (${capasFiltradas.length + 1} Pág. ${paperFormat})`
                : `Imprimir (${paperFormat})`}
            </button>
          </div>
        </div>

        {/* 👁️ Overlay de vista previa de la lámina */}
        {previewUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(6px)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setPreviewUrl(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: '14px',
                padding: '16px',
                maxWidth: '96%',
                maxHeight: '94%',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                    <Eye size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Vista previa — {paperFormat} {orientacion === 'landscape' ? 'Apaisado' : 'Vertical'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                    Editá los datos del plano o las opciones y volvé a renderizar para ver los cambios
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <X size={14} /> Cerrar
                </button>
              </div>

              <img
                src={previewUrl}
                alt="Vista previa del plano"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#fff',
                }}
              />
            </div>
          </div>
        )}

        {/* 📖 Modal de ayuda */}
        <ModalAyuda />
      </div>
    </div>
  );
}
