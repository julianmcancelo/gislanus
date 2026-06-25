'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { renderToString } from 'react-dom/server';
import { MapPin, Plus, Minus, Home, Maximize, Printer, Save, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { escucharCambioMapa, escucharTracking } from '@/lib/rtdb';

const lucideIconsList: any = { MapPin, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building };
import Sidebar from './Sidebar';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const center: [number, number] = [-34.7042, -58.3961];

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

function MapToolbar({ activeTab, isAdmin }: { activeTab: string | null, isAdmin: boolean }) {
  const map = useMap();
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleHome = () => map.setView(center, 14);
  
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error al intentar entrar en pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handlePrintFull = () => window.print();
  
  const handlePrintZone = () => {
    toast('Seleccione un área en el mapa y presione Enter (Funcionalidad en desarrollo)', { icon: 'ℹ️' });
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
        await fetch(`/api/layers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ geoData })
        });
      }
      toast.success('Geometrías actualizadas exitosamente');
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
  const { user, dbUser } = useAuth();
  const [capasConfig, setCapasConfig] = useState<any[]>([]);
  const [cacheDatosGeo, setCacheDatosGeo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState<'layers' | 'info' | null>('layers');
  const [baseLayer, setBaseLayer] = useState<any>(null);
  const [trackingMarkers, setTrackingMarkers] = useState<any[]>([]);

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

        const [resCapas, resRutas, resLineas] = await Promise.all([
          fetch('/api/capas'),
          fetch('/api/rutas-transporte'),
          fetch('/api/lineas-transporte'),
        ]);

        const dataCapas = await resCapas.json();
        const dataRutas = await resRutas.json();
        const dataLineas = await resLineas.json();

        const validCapas = Array.isArray(dataCapas) ? dataCapas : [];
        const validRutas = Array.isArray(dataRutas) ? dataRutas.filter((r: any) => r.activo !== false) : [];
        const validLineas = Array.isArray(dataLineas) ? dataLineas.filter((l: any) => l.activo !== false) : [];

        const CAT_LABELS: Record<string, string> = {
          NACIONAL: '🇦🇷 Líneas Nacionales',
          PROVINCIAL: '🏛️ Líneas Provinciales',
          MUNICIPAL: '🏘️ Líneas Municipales',
        };
        const formatedLineas = validLineas.map((l: any) => {
          const geo = typeof l.datosGeo === 'string' ? JSON.parse(l.datosGeo) : l.datosGeo;
          const cat = l.categoria || 'NACIONAL';
          const grupoNombre = CAT_LABELS[cat] || 'Líneas de Transporte Público';
          const subGrupoNombre = l.subcategoria || null;
          return {
            id: `linea-${l.id}`,
            nombre: l.numero ? `Línea ${l.numero} – ${l.nombre}` : l.nombre,
            datosGeo: geo,
            color: l.color || '#E53E3E',
            visibilidad: 'PUBLIC',
            rolesPermitidos: [],
            grupo: { nombre: grupoNombre },
            subGrupo: subGrupoNombre ? { nombre: subGrupoNombre } : null,
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
          };
        });

        const allData = [...validCapas, ...formatedRutas, ...formatedLineas];

        // Filter based on visibility and login status
        const visibleData = allData.filter((l: any) => {
          if (l.visibilidad === 'PRIVATE') {
            if (!user || !dbUser) return false;
            if (dbUser.rol === 'SUPER_ADMIN') return true; // Super Admin siempre ve todo
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
          active: l.numeroSolicitud ? true : false,
          color: l.color,
          icono: l.icono || null,
          grupo: l.grupo,
          subGrupo: l.subGrupo,
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
          const res = await fetch(`/api/capas/${capa.id}`);
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
        <img 
          src="/logo-lanus.png" 
          alt="Logo Lanús" 
          style={{ 
            height: '100px', 
            objectFit: 'contain',
            animation: 'pulse-logo 2s infinite ease-in-out',
            marginBottom: '20px'
          }} 
        />
        <h2 style={{ letterSpacing: '1px', fontWeight: '500', color: '#ccc' }}>Cargando GIS Lanús...</h2>
      </div>
    );
  }

  const center: [number, number] = [-34.7042, -58.3961];

  const alternarCapa = (id: string) => {
    setCapasConfig(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  const capaActiva = (id: string) => capasConfig.find(l => l.id === id)?.active;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Header Institucional Lanús - Premium Glassmorphism */}
      <header style={{ 
        height: '65px', 
        background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)', // Slate dark gradient
        color: '#f8fafc', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px', 
        zIndex: 2000, 
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.05)', 
            padding: '6px', 
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <img src="/logo-lanus.png" alt="Logo Lanús" style={{ height: '38px', objectFit: 'contain' }} />
          </div>
          <div style={{ lineHeight: '1.1' }}>
            <strong style={{ fontSize: '19px', display: 'block', letterSpacing: '1.5px', fontWeight: 700, color: '#f8fafc' }}>LANÚS</strong>
            <span style={{ fontSize: '11px', letterSpacing: '3px', color: '#94a3b8', fontWeight: 600 }}>MUNICIPIO</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right', lineHeight: '1.1' }}>
            <strong style={{ fontSize: '20px', display: 'block', fontStyle: 'italic', fontWeight: 800, background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GIS LANÚS</strong>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.5px' }}>Sistema de Información Geográfica</span>
          </div>
          <div style={{ 
            width: '40px', height: '40px', 
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)', 
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 0 10px rgba(56,189,248,0.1)'
          }}>
            <MapPin size={22} color="#38bdf8" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <Sidebar capas={capasConfig} alternarCapa={alternarCapa} activeTab={activeTab} setActiveTab={setActiveTab} />
        
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
            style={{ width: '100%', height: '100%', zIndex: 1 }}
            zoomControl={false}
            preferCanvas={true}
            ref={setMapInstance}
          >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          detectRetina={true}
          maxZoom={19}
        />

        <GeomanController isAdmin={dbUser?.rol === 'SUPER_ADMIN'} />

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
              style={{ color: capa.color, weight: 5, opacity: 0.9 }}
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

                let popupContent = '';

                if (isTransporte) {
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
                    <div style="font-family:'Inter',system-ui,sans-serif;width:280px;">
                      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:12px 14px;border-radius:6px 6px 0 0;margin:-1px -1px 0;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                          <span style="font-size:13px;font-weight:800;color:#f1f5f9;">Solicitud #${escapeHtml(String(props._numeroSolicitud || ''))}</span>
                          <span style="background:${bgColor};color:${dotColor};border-radius:4px;padding:2px 8px;font-size:10px;font-weight:800;letter-spacing:.05em;">${estado}</span>
                        </div>
                        <div style="font-size:11px;color:#94a3b8;">${escapeHtml(props._empresaSolicitante || props._nombreSolicitante || '')}</div>
                        ${props._empresaSolicitante && props._nombreSolicitante !== props._empresaSolicitante
                          ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">${escapeHtml(props._nombreSolicitante)}</div>` : ''}
                      </div>
                      <div style="padding:10px 14px;">
                        ${props._tipoVehiculo || props._patente ? `
                        <div style="display:flex;gap:6px;margin-bottom:8px;">
                          ${props._tipoVehiculo ? `<span style="background:#f1f5f9;color:#475569;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;">${escapeHtml(props._tipoVehiculo)}</span>` : ''}
                          ${props._patente ? `<span style="background:#f1f5f9;color:#475569;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;font-family:monospace;">${escapeHtml(props._patente)}</span>` : ''}
                          ${props._pesoToneladas ? `<span style="background:#f1f5f9;color:#475569;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;">${escapeHtml(String(props._pesoToneladas))} t</span>` : ''}
                        </div>` : ''}
                        ${row('Tipo de carga', props._tipoCarga)}
                        ${origen ? row('Origen', origen) : ''}
                        ${destino ? row('Destino', destino) : ''}
                        ${props._origenNombre && props._destinoNombre ? `
                        <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
                          <span style="font-size:10px;color:#94a3b8;min-width:90px;">Recorrido</span>
                          <span style="font-size:11px;color:#0ea5e9;font-weight:600;">${escapeHtml(props._origenNombre)} → ${escapeHtml(props._destinoNombre)}</span>
                        </div>` : ''}
                        ${row('Frecuencia', props._frecuencia)}
                        ${row('Horario', props._horario)}
                        ${props._vigenciaDesde || props._vigenciaHasta ? row('Vigencia',
                          [props._vigenciaDesde, props._vigenciaHasta].filter(Boolean).join(' → ')) : ''}
                        ${props._fechaCreacion ? row('Fecha solicitud', props._fechaCreacion.slice(0,10)) : ''}
                        ${props._calles ? `
                        <div style="margin-top:8px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e8edf3;">
                          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Calles</div>
                          <div style="font-size:10px;color:#475569;line-height:1.6;">${escapeHtml(props._calles)}</div>
                        </div>` : ''}
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
        <TrackingLayer markers={trackingMarkers} />
        <MapToolbar activeTab={activeTab} isAdmin={dbUser?.rol === 'SUPER_ADMIN'} />
      </MapContainer>
        </div>
      </div>
    </div>
  );
}
