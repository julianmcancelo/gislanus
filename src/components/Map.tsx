'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import HeatmapLayer from './HeatmapLayer';

import { renderToString } from 'react-dom/server';
import { MapPin, Plus, Minus, Home, Maximize, Printer, Save, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building, Share2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { escucharCambioMapa, escucharTracking } from '@/lib/rtdb';

const lucideIconsList: any = { MapPin, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building };
import Sidebar from './Sidebar';
import MapSearch from './MapSearch';
import MapPrintAtlasModal from './MapPrintAtlasModal';
import CompartirModal from './CompartirModal';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const center: [number, number] = [-34.7042, -58.3961];

const transitPalette = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];

function stableTransitColor(value: string, fallback: string) {
  if (!value) return fallback;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return transitPalette[hash % transitPalette.length];
}

const controlBtnStyle = {
  width: '28px',
  height: '28px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0
};

const printBtnStyle = {
  border: 'none',
  background: 'transparent',
  color: '#475569',
  padding: '0 12px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600' as const
};

const dividerStyle = {
  height: '1px',
  backgroundColor: 'rgba(255,255,255,0.2)',
  margin: '0 4px'
};

function MapToolbar({
  activeTab,
  isAdmin,
  abrirImpresionAtlas,
  abrirCompartir,
  capasConfig,
}: {
  activeTab: string | null;
  isAdmin: boolean;
  abrirImpresionAtlas?: (lineaNombre: string, capasLinea: any[]) => void;
  abrirCompartir?: () => void;
  capasConfig?: any[];
}) {
  const map = useMap();
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleHome = () => map.setView(center, 14);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error al intentar entrar en pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handlePrintFull = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPrintMenu(false);
    if (abrirImpresionAtlas && capasConfig) {
      const activeCapas = capasConfig.filter((c) => c.active);
      abrirImpresionAtlas('Mapa General de Lanús', activeCapas.length > 0 ? activeCapas : capasConfig);
    } else {
      window.print();
    }
  };

  const handlePrintZone = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPrintMenu(false);
    if (abrirImpresionAtlas && capasConfig) {
      const activeCapas = capasConfig.filter((c) => c.active);
      abrirImpresionAtlas('Selección por Zonas y Ramales', activeCapas.length > 0 ? activeCapas : capasConfig);
    } else {
      window.print();
    }
  };

  const handleSave = async () => {
    const layersToSave: Record<string, any[]> = {};
    map.eachLayer((layer: any) => {
      if ((layer instanceof L.Path || layer instanceof L.Marker) && typeof (layer as any).toGeoJSON === 'function') {
        const geojson = (layer as any).toGeoJSON();
        const dbLayerId = (layer as any).feature?.properties?.dbLayerId || geojson.properties?.dbLayerId;
        if (dbLayerId) {
          if (!layersToSave[dbLayerId]) layersToSave[dbLayerId] = [];
          geojson.properties = { ...(layer as any).feature?.properties, ...geojson.properties, dbLayerId };
          layersToSave[dbLayerId].push(geojson);
        }
      }
    });

    try {
      for (const [id, features] of Object.entries(layersToSave)) {
        const geoData = { type: 'FeatureCollection', features };
        if (id.startsWith('linea-')) {
          // Transit line: save geometry via lineas-transporte API
          const lineaId = id.replace(/^linea-/, '');
          await fetch(`/api/lineas-transporte/${lineaId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ datosGeo: JSON.stringify(geoData) }),
          });
        } else {
          await fetch(`/api/layers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geoData }),
          });
        }
      }
      toast.success('Geometrías guardadas');
    } catch (err) {
      toast.error('Error al guardar las geometrías');
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: '14px',
      left: activeTab ? '360px' : '60px',
      zIndex: 1000,
      transition: 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '6px',
    }} className="hide-on-print">
      {/* Grupo 1: Navegación */}
      <div className="map-toolbar">
        <button onClick={handleZoomIn} className="map-tool-btn" title="Acercar">
          <Plus size={16} />
        </button>
        <div className="map-divider" />
        <button onClick={handleHome} className="map-tool-btn primary" title="Vista general">
          <Home size={16} />
        </button>
        <div className="map-divider" />
        <button onClick={handleZoomOut} className="map-tool-btn" title="Alejar">
          <Minus size={16} />
        </button>
      </div>

      {/* Grupo 2: Utilidades */}
      <div className="map-toolbar">
        <button onClick={handleFullscreen} className="map-tool-btn" title="Pantalla completa">
          <Maximize size={16} />
        </button>
        <div className="map-divider" />
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowPrintMenu(true)}
          onMouseLeave={() => setShowPrintMenu(false)}
        >
          <button className="map-tool-btn" title="Imprimir">
            <Printer size={16} />
          </button>
          {showPrintMenu && (
            <div style={{
              position: 'absolute',
              left: '100%',
              top: 0,
              marginLeft: '8px',
              display: 'flex',
              background: 'rgba(15,23,42,0.92)',
              backdropFilter: 'blur(12px)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              height: '36px',
              whiteSpace: 'nowrap',
            }}>
              <button onClick={handlePrintFull} style={{ ...printBtnStyle, color: '#cbd5e1', fontSize: '0.78rem' }}>Completo</button>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />
              <button onClick={handlePrintZone} style={{ ...printBtnStyle, color: '#cbd5e1', fontSize: '0.78rem' }}>Selección</button>
            </div>
          )}
        </div>

        <div className="map-divider" />
        <button onClick={() => abrirCompartir?.()} className="map-tool-btn" title="Generar Enlace Compartido & QR">
          <Share2 size={16} />
        </button>

        {isAdmin && (
          <>
            <div className="map-divider" />
            <button onClick={handleSave} className="map-tool-btn success" title="Guardar ediciones">
              <Save size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tracking en tiempo real ──────────────────────────────────────────────────
function TrackingLayer({ markers }: { markers: any[] }) {
  const map = useMap();
  const layerRef = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    const activeIds = new Set(markers.map((m) => m.vehiculoId));

    // Remove stale markers
    Object.keys(layerRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(layerRef.current[id]);
        delete layerRef.current[id];
      }
    });

    // Add / update markers
    markers.forEach((m) => {
      const latlng: L.LatLngExpression = [m.lat, m.lng];
      const popup = `<strong>🚗 ${m.nombre}</strong><br/>ID: ${m.vehiculoId}${m.velocidad != null ? `<br/>🚀 ${m.velocidad} km/h` : ''}`;
      if (layerRef.current[m.vehiculoId]) {
        layerRef.current[m.vehiculoId].setLatLng(latlng).setPopupContent(popup);
      } else {
        const icon = L.divIcon({
          html: `<div style="background:#f97316;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🚗</div>`,
          className: '', iconSize: [32, 32], iconAnchor: [16, 16],
        });
        const marker = L.marker(latlng, { icon }).addTo(map).bindPopup(popup);
        layerRef.current[m.vehiculoId] = marker;
      }
    });
  }, [markers, map]);

  return null;
}

function GeomanController({ isAdmin }: { isAdmin: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (isAdmin) {
      map.pm.addControls({
        position: 'topright',
        drawCircle: false,
        drawCircleMarker: false,
        drawText: false,
      });
      map.pm.setLang('es');
    } else {
      map.pm.removeControls();
    }
  }, [map, isAdmin]);

  return null;
}

const escapeHtml = (unsafe: string) => {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default function MapComponent() {
  const { user, dbUser, getIdToken } = useAuth();
  const [capasConfig, setCapasConfig] = useState<any[]>([]);
  const [cacheDatosGeo, setCacheDatosGeo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState<'layers' | 'info' | 'reclamos' | null>('layers');
  const [baseLayer, setBaseLayer] = useState<any>(null);
  const [trackingMarkers, setTrackingMarkers] = useState<any[]>([]);

  const [atlasModalOpen, setAtlasModalOpen] = useState(false);
  const [atlasLineaNombre, setAtlasLineaNombre] = useState('');
  const [atlasCapasLinea, setAtlasCapasLinea] = useState<any[]>([]);
  const [compartirModalOpen, setCompartirModalOpen] = useState(false);

  const handleOpenAtlasPrint = (lineaNombre: string, capasLinea: any[]) => {
    const capaIds = new Set(capasLinea.map((c) => c.id));
    setCapasConfig((prev) =>
      prev.map((l) => (capaIds.has(l.id) ? { ...l, active: true } : l))
    );
    setAtlasLineaNombre(lineaNombre);
    setAtlasCapasLinea(capasLinea);
    setAtlasModalOpen(true);
  };

  // Estados para el módulo de Reclamos SAT
  const [reclamos, setReclamos] = useState<any[]>([]);
  const [loadingReclamos, setLoadingReclamos] = useState(false);
  const [verReclamosCalor, setVerReclamosCalor] = useState(false);
  const [verReclamosMarcadores, setVerReclamosMarcadores] = useState(true);
  const [motivosSeleccionados, setMotivosSeleccionados] = useState<number[]>([33, 38, 81, 83, 84]);
  const [estadoFiltro, setEstadoFiltro] = useState<string>('TODOS');
  const [prioridadFiltro, setPrioridadFiltro] = useState<string>('TODAS');

  const getReclamos = async () => {
    if (!user) return;
    setLoadingReclamos(true);
    try {
      const token = await getIdToken();
      const motivosQuery = motivosSeleccionados.join(',');
      const res = await fetch(`/api/reclamos?motivoId=${motivosQuery}&estado=${estadoFiltro}&prioridad=${prioridadFiltro}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReclamos(data);
      }
    } catch (e) {
      console.error("Error fetching reclamos:", e);
    } finally {
      setLoadingReclamos(false);
    }
  };

  useEffect(() => {
    getReclamos();
  }, [user, motivosSeleccionados, estadoFiltro, prioridadFiltro]);


  useEffect(() => {
    const fetchCapas = async () => {
      try {
        // Fetch base layer
        try {
          const resBase = await fetch('/lanus-base.geojson');
          if (resBase.ok) {
            const baseGeo = await resBase.json();
            setBaseLayer(baseGeo);
          }
        } catch (e) {
          console.error("Error loading base layer:", e);
        }

        const [resCapas, resRutas, resLineas, resTransportBase] = await Promise.all([
          fetch('/api/capas'),
          fetch('/api/rutas-transporte'),
          fetch('/api/lineas-transporte'),
          fetch('/transporte-lanus.geojson'),
        ]);

        const dataCapas = await resCapas.json();
        const dataRutas = await resRutas.json();
        const dataLineas = await resLineas.json();
        const dataTransportBase = resTransportBase.ok ? await resTransportBase.json() : { features: [] };

        const validCapas = Array.isArray(dataCapas) ? dataCapas : [];
        const validRutas = Array.isArray(dataRutas) ? dataRutas.filter((r: any) => r.activo !== false) : [];
        const validLineas = Array.isArray(dataLineas) ? dataLineas.filter((l: any) => l.activo !== false) : [];

        const CAT_LABELS: Record<string, string> = {
          NACIONAL: 'Líneas Nacionales',
          PROVINCIAL: 'Líneas Provinciales',
          MUNICIPAL: 'Líneas Municipales',
        };
        const formatedLineas = validLineas.map((l: any) => {
          const geo = typeof l.datosGeo === 'string' ? JSON.parse(l.datosGeo) : l.datosGeo;
          const cat = l.categoria || 'NACIONAL';
          // Level 1 grupo  = categoría  ("Líneas Nacionales")
          const grupoNombre = CAT_LABELS[cat] || 'Líneas de Transporte';
          // Level 2 subGrupo = línea  ("Línea 45")
          const lineaLabel = l.numero ? `Línea ${l.numero}` : l.nombre;
          // Level 3 subSubGrupo = ramal — fallback to GeoJSON feature properties for old records
          let ramalLabel = l.subcategoria || null;
          let sentidoRaw = (l.sentido || '').toUpperCase();
          if (!ramalLabel || !sentidoRaw) {
            const firstFeature = geo?.type === 'Feature' ? geo : geo?.features?.[0];
            const fp = firstFeature?.properties || {};
            if (!ramalLabel) {
              if (fp.ramal) ramalLabel = `Ramal ${fp.ramal}`;
              else if (fp.subgrupo_detalle) ramalLabel = fp.subgrupo_detalle;
              else if (fp.subgrupo) ramalLabel = fp.subgrupo;
              else if (fp.ramal_nombre) ramalLabel = fp.ramal_nombre;
            }
            if (!sentidoRaw && fp.sentido) sentidoRaw = String(fp.sentido).toUpperCase();
          }
          const sentido = sentidoRaw;
          const lineColor = stableTransitColor(`${cat}-${lineaLabel}`, '#2563eb');
          const nombre = sentido
            ? sentido.charAt(0) + sentido.slice(1).toLowerCase().replace(/_/g, ' ')
            : lineaLabel;
          const lineaProps = {
            _tipo: 'linea',
            _linea: lineaLabel,
            _ramal: ramalLabel || null,
            _sentido: sentido || null,
            _operador: l.descripcion || null,
            _color: lineColor,
          };
          let geoConProps = geo;
          if (geo?.type === 'Feature') {
            geoConProps = { ...geo, properties: lineaProps };
          } else if (geo?.features) {
            geoConProps = { ...geo, features: geo.features.map((f: any) => ({ ...f, properties: lineaProps })) };
          }
          return {
            id: `linea-${l.id}`,
            nombre,
            datosGeo: geoConProps,
            color: lineColor,
            visibilidad: 'PUBLIC',
            rolesPermitidos: [],
            grupo: { nombre: grupoNombre },
            subGrupo: { nombre: lineaLabel },
            subSubGrupo: ramalLabel ? { nombre: ramalLabel } : null,
          };
        });

        const formatedTransportBase = (Array.isArray(dataTransportBase?.features) ? dataTransportBase.features : []).map((feature: any, index: number) => {
          const props = feature?.properties || {};
          const red = props.network === 'PROVINCIAL' ? 'Provincial' : 'Municipal';
          const lineaLabel = `Línea ${props.line || 's/n'}`;
          const ramalLabel = `Ramal ${props.branch || 'Principal'}`;
          const sentido = String(props.direction || '').toUpperCase();
          const idPart = `${props.network}-${props.line}-${props.branch}-${sentido}-${index}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
          const lineColor = stableTransitColor(`${props.network || 'TRANSPORTE'}-${lineaLabel}`, '#2563eb');
          const lineaProps = {
            ...props,
            _tipo: 'linea',
            _linea: lineaLabel,
            _ramal: ramalLabel,
            _sentido: sentido,
            _operador: props.operator || props.description || null,
            _color: lineColor,
          };

          return {
            id: `transporte-base-${idPart}`,
            nombre: sentido === 'VUELTA' ? 'Vuelta' : 'Ida',
            datosGeo: { ...feature, properties: lineaProps },
            color: lineColor,
            visibilidad: 'PUBLIC',
            rolesPermitidos: [],
            grupo: { nombre: `Red ${red} de Transporte` },
            subGrupo: { nombre: lineaLabel },
            subSubGrupo: { nombre: ramalLabel },
          };
        });

        const formatedRutas = validRutas.map((r: any, index: number) => {
          // Generar un color único usando el ángulo dorado para máxima distinción visual
          const hue = (index * 137.5) % 360;
          const colorUnico = `hsl(${hue}, 85%, 55%)`;

          const parsedGeo = typeof r.datosGeo === 'string' ? JSON.parse(r.datosGeo) : r.datosGeo;
          const transporteProps = {
            _tipo: 'transporte',
            _numeroSolicitud: r.numeroSolicitud,
            _estado: r.estado,
            _nombreSolicitante: r.nombreSolicitante,
            _empresaSolicitante: r.empresaSolicitante || null,
            _fechaCreacion: r.fechaCreacion || null,
            _tipoCarga: r.tipoCarga || null,
            _patente: r.patente || null,
            _tipoVehiculo: r.tipoVehiculo || null,
            _pesoToneladas: r.pesoToneladas || null,
            _origenNombre: r.origenNombre || r.origenLocalidad || null,
            _origenDireccion: r.origenDireccion || null,
            _destinoNombre: r.destinoNombre || r.destinoLocalidad || null,
            _destinoDireccion: r.destinoDireccion || null,
            _frecuencia: r.frecuencia || null,
            _horario: r.horario || null,
            _vigenciaDesde: r.vigenciaDesde || null,
            _vigenciaHasta: r.vigenciaHasta || null,
            _calles: r.calles || null,
          };
          if (parsedGeo.type === 'Feature') {
            parsedGeo.properties = { ...parsedGeo.properties, ...transporteProps };
          } else if (parsedGeo.features) {
            parsedGeo.features = parsedGeo.features.map((f: any) => ({
              ...f,
              properties: { ...f.properties, ...transporteProps },
            }));
          }

          return {
            id: r.id,
            nombre: `#${r.numeroSolicitud} (${r.nombreSolicitante}) - ${r.estado.toUpperCase()}`,
            datosGeo: parsedGeo,
            color: colorUnico,
            visibilidad: 'PRIVATE',
            rolesPermitidos: ['ADMINISTRADOR'],
            grupo: { nombre: 'Solicitudes Transporte Pesado' },
            numeroSolicitud: r.numeroSolicitud,
            estado: r.estado,
            nombreSolicitante: r.nombreSolicitante,
            empresaSolicitante: r.empresaSolicitante || null,
            fechaCreacion: r.fechaCreacion || null,
            tipoCarga: r.tipoCarga || null,
            origenNombre: r.origenNombre || r.origenLocalidad || null,
            destinoNombre: r.destinoNombre || r.destinoLocalidad || null,
            patente: r.patente || null,
            tipoServicio: r.tipoServicio || 'FIJO',
          };
        });

        const allData = [...validCapas, ...formatedRutas, ...formatedLineas, ...formatedTransportBase];

        // Filter based on visibility and login status
        const visibleData = allData.filter((l: any) => {
          if (l.visibilidad === 'PRIVATE') {
            if (!user || !dbUser) return false;
            if (dbUser.rol === 'SUPER_ADMIN') return true; // Super Admin siempre ve todo
            if (dbUser.permisos?.verCapas) return true; // TODO: Tal vez afinar según `rolesPermitidos` si quieren granuralidad, pero por ahora verCapas permite ver las privadas
            if (l.rolesPermitidos && l.rolesPermitidos.length > 0) {
              return l.rolesPermitidos.includes(dbUser.rol);
            }
            return false; // Privado sin roles permitidos explícitos = solo Super Admin
          }
          return true; // PUBLIC
        });

        const config = visibleData.map((l: any) => ({
          id: l.id,
          nombre: l.nombre,
          active: false,
          color: l.color,
          icono: l.icono || null,
          grupo: l.grupo,
          subGrupo: l.subGrupo,
          subSubGrupo: l.subSubGrupo || null,
          numeroSolicitud: l.numeroSolicitud,
          estado: l.estado || null,
          nombreSolicitante: l.nombreSolicitante || null,
          empresaSolicitante: l.empresaSolicitante || null,
          fechaCreacion: l.fechaCreacion || null,
          tipoCarga: l.tipoCarga || null,
          origenNombre: l.origenNombre || null,
          destinoNombre: l.destinoNombre || null,
        }));
        setCapasConfig(config);

        const cache: Record<string, any> = {};
        allData.forEach((l: any) => {
          if (!l.datosGeo) return; // Ignore missing geo data (lazy load)
          let parsed = typeof l.datosGeo === 'string' ? JSON.parse(l.datosGeo) : l.datosGeo;
          
          // Inject dbLayerId into all features so Geoman can trace them back
          if (parsed?.features) {
            parsed.features = parsed.features.map((f: any) => ({
              ...f,
              properties: { ...f.properties, dbLayerId: l.id }
            }));
          } else if (parsed?.type === 'Feature') {
            parsed.properties = { ...parsed.properties, dbLayerId: l.id };
          }
          
          cache[l.id] = parsed;
        });
        
        // Cargar en el estado los datos geográficos que vinieron incrustados (como las Rutas de Transporte)
        if (Object.keys(cache).length > 0) {
          setCacheDatosGeo(prev => ({ ...prev, ...cache }));
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchCapas();
  }, [user]);

  // Re-fetch cuando otro admin modifica capas o líneas
  useEffect(() => {
    const unsubCapas = escucharCambioMapa('capas', () => {
      toast('🗺️ Capas actualizadas', { duration: 3000 });
    });
    const unsubLineas = escucharCambioMapa('lineas', () => {
      toast('🚌 Líneas actualizadas', { duration: 3000 });
    });
    return () => { unsubCapas(); unsubLineas(); };
  }, []);

  // Escuchar posiciones GPS en tiempo real
  useEffect(() => {
    const unsub = escucharTracking((entries) => setTrackingMarkers(entries));
    return unsub;
  }, []);

  const fetchingRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    capasConfig.forEach(async (capa) => {
      if (capa.active && !cacheDatosGeo[capa.id] && !capa.numeroSolicitud && !fetchingRef.current[capa.id]) {
        fetchingRef.current[capa.id] = true;
        try {
          const token = user ? await getIdToken() : null;
          const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`/api/capas/${capa.id}`, { headers });
          const data = await res.json();
          if (data.datosGeo) {
            let parsed = typeof data.datosGeo === 'string' ? JSON.parse(data.datosGeo) : data.datosGeo;
            if (parsed?.features) {
              parsed.features = parsed.features.map((f: any) => ({
                ...f,
                properties: { ...f.properties, dbLayerId: capa.id }
              }));
            } else if (parsed?.type === 'Feature') {
              parsed.properties = { ...parsed.properties, dbLayerId: capa.id };
            }
            setCacheDatosGeo(prev => ({ ...prev, [capa.id]: parsed }));
          }
        } catch (e) {
          console.error("Error fetching lazy layer:", e);
        }
      }
    });
  }, [capasConfig, cacheDatosGeo]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        background: '#111', 
        color: '#fff',
        fontFamily: 'sans-serif',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}>
        <div style={{ width: 120, height: 120, background: '#3b82f6', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '64px', margin: '0 auto 20px', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.5)' }}>G</div>
        <h2 style={{ letterSpacing: '1px', fontWeight: '500', color: '#ccc' }}>Cargando GIS...</h2>
      </div>
    );
  }

  const center: [number, number] = [-34.7042, -58.3961];

  const alternarCapa = (id: string) => {
    setCapasConfig(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  const capaActiva = (id: string) => capasConfig.find(l => l.id === id)?.active;

  const descargarCapas = (capas: any[], nombreArchivo = 'lineas-transporte-lanus') => {
    const features = capas.flatMap(capa => {
      const geo = cacheDatosGeo[capa.id];
      if (!geo) return [];
      const collection = geo.type === 'FeatureCollection' ? geo.features : [geo];
      return collection.map((feature: any) => ({
        ...feature,
        properties: { ...(feature.properties || {}), nombreCapa: capa.nombre }
      }));
    });

    if (features.length === 0) {
      toast.error('No hay geometrías cargadas para descargar');
      return;
    }

    const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreArchivo}.geojson`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${features.length} geometría(s) descargada(s)`);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Header Institucional - Premium Glassmorphism */}
      <header style={{ 
        height: '65px', 
        background: 'linear-gradient(180deg, #090d16 0%, #0f172a 100%)', // Very sleek slate-dark gradient
        color: '#f8fafc', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px', 
        zIndex: 2000, 
        position: 'relative',
        boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif"
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(29, 78, 216, 0.05) 100%)', 
            padding: '5px', 
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ 
              width: 36, 
              height: 36, 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
              borderRadius: '9px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              fontWeight: 800, 
              fontSize: '20px',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>G</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ fontSize: '8px', letterSpacing: '3px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>MUNICIPALIDAD DE LANÚS</span>
            <strong style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.2px' }}>Sistema Geográfico</strong>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Botón de Reportar Error */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('gis-reportar-error', { detail: { section: 'Mapa Principal' } }))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <AlertTriangle size={13} color="#f87171" />
            Reportar Inconveniente
          </button>

          <div style={{ textAlign: 'right', lineHeight: '1.2' }}>
            <strong style={{ 
              fontSize: '18px', 
              fontWeight: 900, 
              letterSpacing: '1px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.25))'
            }}>GIS PORTAL</strong>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block', letterSpacing: '0.2px', marginTop: '1px' }}>Área de Sistemas e Innovación</span>
          </div>
          <div style={{ 
            width: '38px', height: '38px', 
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)', 
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(56,189,248,0.08)'
          }}>
            <MapPin size={20} color="#38bdf8" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <Sidebar 
          capas={capasConfig} 
          alternarCapa={alternarCapa} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          reclamos={reclamos}
          loadingReclamos={loadingReclamos}
          verReclamosCalor={verReclamosCalor}
          setVerReclamosCalor={setVerReclamosCalor}
          verReclamosMarcadores={verReclamosMarcadores}
          setVerReclamosMarcadores={setVerReclamosMarcadores}
          motivosSeleccionados={motivosSeleccionados}
          setMotivosSeleccionados={setMotivosSeleccionados}
          estadoFiltro={estadoFiltro}
          setEstadoFiltro={setEstadoFiltro}
          prioridadFiltro={prioridadFiltro}
          setPrioridadFiltro={setPrioridadFiltro}
          recargarReclamos={getReclamos}
          mapInstance={mapInstance}
          descargarCapas={descargarCapas}
          abrirImpresionAtlas={handleOpenAtlasPrint}
          abrirCompartir={() => setCompartirModalOpen(true)}
        />
        
        <div style={{ flex: 1, position: 'relative' }}>
          {capasConfig.some(c => c.active && !cacheDatosGeo[c.id] && fetchingRef.current[c.id]) && (
            <div style={{
              position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
              backgroundColor: '#ffffff', color: '#4A4A4A', padding: '10px 24px',
              borderRadius: '30px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)', border: '2px solid #29B6F6'
            }}>
              <div style={{ 
                width: '18px', height: '18px', borderRadius: '50%',
                border: '3px solid #e0e0e0', borderTopColor: '#29B6F6',
                animation: 'spin 1s linear infinite'
              }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              Descargando capa de datos...
            </div>
          )}

          <MapContainer 
            center={center} 
            zoom={14}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            ref={setMapInstance}
          >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          maxZoom={19}
          zIndex={0}
        />
        <MapSearch />

        <GeomanController isAdmin={dbUser?.rol === 'SUPER_ADMIN' || (dbUser?.permisos?.editarCapas ?? false)} />

        {baseLayer && (
          <GeoJSON 
            data={baseLayer}
            style={{
              color: '#3B82F6', // Blue to stand out on the map
              weight: 4,
              fillColor: '#3B82F6',
              fillOpacity: 0.08,
              dashArray: '10, 8'
            }}
            interactive={false}
          />
        )}

        {capasConfig.map(capa => {
          if (!capaActiva(capa.id) || !cacheDatosGeo[capa.id]) return null;
          
          return (
            <GeoJSON 
              key={capa.id}
              data={cacheDatosGeo[capa.id]} 
              style={(feature: any) => {
                const properties = feature?.properties || {};
                const isCollectiveLine = Boolean(
                  properties.network || properties._tipo === 'linea' || properties.sentido
                );
                const isReturn = String(
                  properties.direction || properties.sentido || properties._sentido || ''
                ).toUpperCase() === 'VUELTA';
                const routeColor = String(
                  properties.color_hex || properties.color || properties._color || capa.color
                );
                return {
                  color: routeColor,
                  weight: isCollectiveLine ? 2.5 : 5,
                  opacity: isCollectiveLine ? 0.9 : 0.9,
                  dashArray: isCollectiveLine && isReturn ? '7 8' : undefined,
                  lineCap: 'round',
                  lineJoin: 'round',
                };
              }}
              pointToLayer={(feature, latlng) => {
                if (capa.icono && lucideIconsList[capa.icono]) {
                  const IconComp = lucideIconsList[capa.icono];
                  const svgString = renderToString(<IconComp size={11} color="white" />);
                  const innerHtml = `<div style="background-color: ${capa.color}; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">${svgString}</div>`;

                  const customIcon = L.divIcon({
                    html: innerHtml,
                    className: 'custom-lucide-marker',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                    popupAnchor: [0, -12]
                  });
                  return L.marker(latlng, { icon: customIcon });
                }

                return L.circleMarker(latlng, {
                  radius: 5,
                  fillColor: capa.color,
                  color: '#fff',
                  weight: 1.5,
                  opacity: 1,
                  fillOpacity: 0.85
                });
              }}
              onEachFeature={(feature, l) => {
                const props = feature.properties || {};
                const isTransporte = props._tipo === 'transporte';
                const isLinea = props._tipo === 'linea';

                let popupContent = '';

                if (isLinea) {
                  // ── Popup limpio para Líneas de Transporte ──
                  const sentidoLabel = props._sentido
                    ? props._sentido.charAt(0) + props._sentido.slice(1).toLowerCase()
                    : null;
                    popupContent = `
                    <div style="font-family:'Inter',system-ui,sans-serif;min-width:200px;max-width:280px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;border-bottom:3px solid ${props._color || capa.color};">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <div style="width:10px;height:10px;border-radius:50%;background:${props._color || capa.color};flex-shrink:0;"></div>
                          <span style="font-size:13px;font-weight:800;color:#1e293b;">${escapeHtml(props._linea || capa.nombre)}</span>
                        </div>
                        <button onclick="window.print()" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;border-radius:6px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;" title="Imprimir o capturar esta línea">🖨️ Imprimir</button>
                      </div>
                      <div style="padding:8px 14px 10px;display:flex;flex-direction:column;gap:4px;">
                        ${props._ramal ? `<div style="display:flex;gap:8px;"><span style="font-size:11px;color:#94a3b8;min-width:60px;">Ramal</span><span style="font-size:11px;font-weight:600;color:#1e293b;">${escapeHtml(props._ramal)}</span></div>` : ''}
                        ${sentidoLabel ? `<div style="display:flex;gap:8px;"><span style="font-size:11px;color:#94a3b8;min-width:60px;">Sentido</span><span style="font-size:11px;font-weight:600;color:#1e293b;">${escapeHtml(sentidoLabel)}</span></div>` : ''}
                        ${props._operador ? `<div style="display:flex;gap:8px;"><span style="font-size:11px;color:#94a3b8;min-width:60px;">Operador</span><span style="font-size:11px;font-weight:600;color:#1e293b;">${escapeHtml(props._operador)}</span></div>` : ''}
                      </div>
                    </div>`;
                } else if (isTransporte) {
                  // ── Popup enriquecido para Transporte Pesado ──
                  const estadoColors: Record<string, string> = {
                    PENDIENTE: '#ca8a04', APROBADO: '#16a34a',
                    RECHAZADO: '#dc2626', VENCIDO: '#ea580c', BORRADOR: '#94a3b8',
                  };
                  const estadoBg: Record<string, string> = {
                    PENDIENTE: '#fef9c3', APROBADO: '#dcfce7',
                    RECHAZADO: '#fee2e2', VENCIDO: '#ffedd5', BORRADOR: '#f1f5f9',
                  };
                  const estado = (props._estado || '').toUpperCase();
                  const dotColor = estadoColors[estado] || '#94a3b8';
                  const bgColor = estadoBg[estado] || '#f1f5f9';

                  const row = (label: string, val: string | null) =>
                    val ? `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9;">
                      <span style="font-size:11px;color:#94a3b8;min-width:90px;flex-shrink:0;">${label}</span>
                      <span style="font-size:11px;color:#1e293b;font-weight:500;">${escapeHtml(val)}</span>
                    </div>` : '';

                  const origen = [props._origenDireccion, props._origenNombre].filter(Boolean).join(', ');
                  const destino = [props._destinoDireccion, props._destinoNombre].filter(Boolean).join(', ');

                  popupContent = `
                    <div style="font-family:'Inter',system-ui,sans-serif;min-width:260px;max-width:320px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;border-bottom:1px solid #f1f5f9;">
                        <span style="font-size:13px;font-weight:800;color:#1e293b;">Solicitud #${escapeHtml(props._numeroSolicitud || '')}</span>
                        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:${bgColor};color:${dotColor};">
                          ${escapeHtml(props._estado || '')}
                        </span>
                      </div>
                      <div style="padding:8px 14px 12px;display:flex;flex-direction:column;gap:1px;">
                        ${row('Solicitante', props._nombreSolicitante)}
                        ${row('Empresa', props._empresaSolicitante)}
                        ${row('Patente', props._patente)}
                        ${row('Tipo Vehículo', props._tipoVehiculo)}
                        ${row('Tipo Carga', props._tipoCarga)}
                        ${props._pesoToneladas ? row('Peso', `${props._pesoToneladas} Tn`) : ''}
                        ${row('Origen', origen)}
                        ${row('Destino', destino)}
                        ${row('Recorrido', props._calles)}
                      </div>
                    </div>`;
                } else {
                  // ── Popup genérico para capas GIS ──
                  const rawName = props.nombre || props.name || props.Nombre || props.Name ||
                    props.title || props.Title || props.ESTABLECIM || props.Establecim ||
                    props.escuela || props.ESCUELA || capa.nombre;

                  const keysToHide = new Set(['dblayerid','nombre','name','title','establecim','escuela',
                    'color','stroke','fill','marker-color','marker-symbol','marker-size',
                    'group','id','fid','_id','stroke-width','stroke-opacity','fill-opacity',
                    'calles']);

                  const labelMap: Record<string, string> = {
                    description:'Descripción', address:'Dirección', type:'Tipo',
                    category:'Categoría', phone:'Teléfono', email:'Correo',
                    direccion:'Dirección', telefono:'Teléfono', barrio:'Barrio',
                    localidad:'Localidad', partido:'Partido', provincia:'Provincia',
                  };

                  let rowsHtml = '';
                  for (const [key, val] of Object.entries(props)) {
                    if (keysToHide.has(key.toLowerCase())) continue;
                    if (val === null || val === undefined || String(val).trim() === '') continue;
                    const label = labelMap[key.toLowerCase()] || (key.charAt(0).toUpperCase() + key.slice(1));
                    rowsHtml += `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9;">
                      <span style="font-size:11px;color:#94a3b8;min-width:80px;flex-shrink:0;">${escapeHtml(label)}</span>
                      <span style="font-size:11px;color:#1e293b;font-weight:500;">${escapeHtml(String(val))}</span>
                    </div>`;
                  }

                  popupContent = `
                    <div style="font-family:'Inter',system-ui,sans-serif;min-width:200px;max-width:280px;">
                      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px 8px;border-bottom:2px solid ${capa.color};">
                        <div style="width:10px;height:10px;border-radius:50%;background:${capa.color};flex-shrink:0;"></div>
                        <span style="font-size:13px;font-weight:700;color:#1e293b;">${escapeHtml(String(rawName))}</span>
                      </div>
                      <div style="padding:6px 14px 10px;">
                        ${rowsHtml || '<p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Sin detalles adicionales.</p>'}
                      </div>
                    </div>`;
                }

                l.bindPopup(popupContent, { maxWidth: 320 });
              }}
            />
          );
        })}

        {/* Base Layer Limits (on top) */}
        {baseLayer && (
          <GeoJSON
            data={baseLayer}
            style={{
              color: '#000000',
              weight: 2.5,
              dashArray: '5, 5',
              fillOpacity: 0,
            }}
            interactive={false}
          />
        )}
        {/* Capa de calor para reclamos */}
        {verReclamosCalor && reclamos.length > 0 && (
          <HeatmapLayer 
            points={reclamos.map(r => ({ lat: r.lat, lng: r.lng, intensity: r.prioridad === 'URGENTE' ? 3 : r.prioridad === 'ALTA' ? 2 : 1 }))}
            radius={28}
            maxIntensity={3}
            opacity={0.8}
          />
        )}

        {/* Marcadores individuales para reclamos */}
        {verReclamosMarcadores && reclamos.map(r => {
          const latlng: [number, number] = [r.lat, r.lng];
          const color = r.motivoId === 81 ? '#EF4444' : '#3B82F6'; // Rojo para tránsito pesado, Azul para el resto
          const innerHtml = `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">⚠️</div>`;
          const customIcon = L.divIcon({
            html: innerHtml,
            className: 'custom-reclamo-marker',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -12]
          });

          return (
            <Marker key={r.id} position={latlng} icon={customIcon}>
              <Popup>
                <div style={{ fontFamily: 'Inter, system-ui, sans-serif', width: '250px' }}>
                  <div style={{ background: '#1e293b', color: 'white', padding: '10px 12px', borderRadius: '6px 6px 0 0', margin: '-1px -1px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Exp. #{r.numero}</span>
                      <span style={{
                        background: r.prioridad === 'URGENTE' ? '#fee2e2' : r.prioridad === 'ALTA' ? '#ffedd5' : '#f1f5f9',
                        color: r.prioridad === 'URGENTE' ? '#991b1b' : r.prioridad === 'ALTA' ? '#92400e' : '#475569',
                        padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold'
                      }}>{r.prioridad.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{r.motivoNombre}</div>
                  </div>
                  <div style={{ padding: '10px' }}>
                    <div style={{ fontSize: '11px', marginBottom: '6px' }}><strong>Dirección:</strong> {r.direccion || 'No especificada'}</div>
                    {r.descripcion && <div style={{ fontSize: '11px', background: '#f8fafc', padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0', maxHeight: '80px', overflowY: 'auto' }}>{r.descripcion}</div>}
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', textAlign: 'right' }}>{r.fecha || 'Sin fecha'}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <TrackingLayer markers={trackingMarkers} />
        <MapToolbar 
          activeTab={activeTab} 
          isAdmin={dbUser?.rol === 'SUPER_ADMIN' || (dbUser?.permisos?.editarCapas ?? false)} 
          abrirImpresionAtlas={handleOpenAtlasPrint}
          abrirCompartir={() => setCompartirModalOpen(true)}
          capasConfig={capasConfig}
        />
      </MapContainer>
        </div>
      </div>

      <MapPrintAtlasModal
        isOpen={atlasModalOpen}
        onClose={() => setAtlasModalOpen(false)}
        lineaNombre={atlasLineaNombre}
        capasLinea={atlasCapasLinea}
        cacheDatosGeo={cacheDatosGeo}
        mapInstance={mapInstance}
      />

      <CompartirModal
        isOpen={compartirModalOpen}
        onClose={() => setCompartirModalOpen(false)}
        capasConfig={capasConfig}
      />
    </div>
  );
}
