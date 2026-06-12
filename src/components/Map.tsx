'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { MapPin, Plus, Minus, Home, Maximize, Printer, Save } from 'lucide-react';
import Sidebar from './Sidebar';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const center: [number, number] = [-34.7042, -58.3961];

const controlBtnStyle = {
  width: '32px',
  height: '32px',
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
  color: 'white',
  padding: '0 12px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500' as const
};

const dividerStyle = {
  height: '1px',
  backgroundColor: 'rgba(255,255,255,0.2)',
  margin: '0 4px'
};

function CustomMapControls({ map, activeTab }: { map: L.Map, activeTab: 'layers' | 'info' | null }) {
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleHome = () => map.setView(center, 14);
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handlePrintFull = () => {
    window.print();
  };

  const handlePrintZone = () => {
    map.pm.enableDraw('Rectangle', {
      snappable: false,
      cursorMarker: false,
    });

    const onCreate = (e: any) => {
      const layer = e.layer;
      const bounds = layer.getBounds();
      map.pm.disableDraw();
      layer.remove(); // Remove the drawn rectangle visually

      const currentBounds = map.getBounds();
      
      map.fitBounds(bounds);
      
      // Wait for tiles to load
      setTimeout(() => {
        window.print();
        setTimeout(() => map.fitBounds(currentBounds), 500);
      }, 800);
      
      map.off('pm:create', onCreate);
    };

    map.on('pm:create', onCreate);
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
      alert('Geometrías actualizadas exitosamente');
    } catch (err) {
      alert('Error al guardar');
    }
  };

  return (
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      left: activeTab ? '420px' : '70px', 
      zIndex: 1000,
      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start'
    }} className="hide-on-print">
      {/* Zoom Group */}
      <div style={{ backgroundColor: 'rgba(74, 74, 74, 0.9)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
        <button onClick={handleZoomIn} style={controlBtnStyle} title="Acercar">
          <Plus size={18} color="white" />
        </button>
        <div style={dividerStyle} />
        <button onClick={handleHome} style={controlBtnStyle} title="Vista General">
          <Home size={18} color="#29B6F6" />
        </button>
        <div style={dividerStyle} />
        <button onClick={handleZoomOut} style={controlBtnStyle} title="Alejar">
          <Minus size={18} color="white" />
        </button>
      </div>

      {/* Fullscreen Group */}
      <div style={{ backgroundColor: 'rgba(74, 74, 74, 0.9)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: '10px' }}>
        <button onClick={handleFullscreen} style={controlBtnStyle} title="Pantalla Completa">
          <Maximize size={18} color="white" />
        </button>
      </div>

      {/* Print Group */}
      <div 
        style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}
        onMouseEnter={() => setShowPrintMenu(true)}
        onMouseLeave={() => setShowPrintMenu(false)}
      >
        <div style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', borderRadius: '2px 0 0 2px', overflow: 'hidden' }}>
          <button style={{...controlBtnStyle, width: '38px', height: '38px'}} title="Imprimir">
            <Printer size={20} color="white" />
          </button>
        </div>
        
        {showPrintMenu && (
          <div style={{ display: 'flex', backgroundColor: 'rgba(74, 74, 74, 0.95)', borderRadius: '0 2px 2px 0', border: '1px solid rgba(255,255,255,0.3)', borderLeft: 'none', overflow: 'hidden', height: '38px' }}>
            <button onClick={handlePrintFull} style={printBtnStyle}>Completo</button>
            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.4)', margin: '6px 0' }} />
            <button onClick={handlePrintZone} style={printBtnStyle}>Seleccion de zona</button>
          </div>
        )}
      </div>

      {/* Save Edits Group */}
      <div style={{ backgroundColor: '#29B6F6', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: '10px' }}>
        <button onClick={handleSave} style={{...controlBtnStyle, width: '38px', height: '38px'}} title="Guardar Ediciones del Mapa">
          <Save size={20} color="white" />
        </button>
      </div>
    </div>
  );
}

function GeomanController() {
  const map = useMap();
  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
    });
    map.pm.setLang('es');
  }, [map]);

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
  const [capasConfig, setCapasConfig] = useState<any[]>([]);
  const [cacheDatosGeo, setCacheDatosGeo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState<'layers' | 'info' | null>('layers');

  useEffect(() => {
    const fetchCapas = async () => {
      try {
        const [resCapas, resRutas, _] = await Promise.all([
          fetch('/api/capas'),
          fetch('/api/rutas-transporte'),
          new Promise(resolve => setTimeout(resolve, 2500)) // Espera artificial de 2.5s
        ]);
        
        const dataCapas = await resCapas.json();
        const dataRutas = await resRutas.json();
        
        const validCapas = Array.isArray(dataCapas) ? dataCapas : [];
        const validRutas = Array.isArray(dataRutas) ? dataRutas : [];

        const formatedRutas = validRutas.map((r: any, index: number) => {
          // Generar un color único usando el ángulo dorado para máxima distinción visual
          const hue = (index * 137.5) % 360;
          const colorUnico = `hsl(${hue}, 85%, 55%)`;

          return {
            id: r.id,
            nombre: `Solicitudes - #${r.numeroSolicitud} (${r.nombreSolicitante}) - ${r.estado.toUpperCase()}`,
            datosGeo: typeof r.datosGeo === 'string' ? JSON.parse(r.datosGeo) : r.datosGeo,
            color: colorUnico
          };
        });

        const allData = [...validCapas, ...formatedRutas];

        const config = allData.map((l: any) => ({
          id: l.id,
          nombre: l.nombre,
          active: true,
          color: l.color,
        }));
        setCapasConfig(config);

        const cache: Record<string, any> = {};
        allData.forEach((l: any) => {
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
        setCacheDatosGeo(cache);
      } catch (error) {
        console.error('Error cargando capas:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCapas();
  }, []);

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
    setCapasConfig(capasConfig.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  const capaActiva = (id: string) => capasConfig.find(l => l.id === id)?.active;


  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Header Institucional Lanús */}
      <header style={{ 
        height: '60px', 
        backgroundColor: '#4A4A4A', // Lanús footer dark gray
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 20px', 
        zIndex: 2000, 
        position: 'relative',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo-lanus.png" alt="Logo Lanús" style={{ height: '45px', objectFit: 'contain' }} />
          <div style={{ lineHeight: '1.2' }}>
            <strong style={{ fontSize: '18px', display: 'block', letterSpacing: '1px' }}>LANÚS</strong>
            <span style={{ fontSize: '11px', letterSpacing: '2px', opacity: 0.9 }}>MUNICIPIO</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: '1.2' }}>
            <strong style={{ fontSize: '18px', display: 'block', fontStyle: 'italic', color: '#29B6F6' }}>GIS LANÚS</strong>
            <span style={{ fontSize: '11px', opacity: 0.9 }}>Sistema de Información Geográfica</span>
          </div>
          <div style={{ 
            width: '32px', height: '40px', 
            border: '2px solid #29B6F6', borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <MapPin size={20} color="#29B6F6" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <Sidebar capas={capasConfig} alternarCapa={alternarCapa} activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer 
            center={center} 
            zoom={14} 
            style={{ width: '100%', height: '100%', zIndex: 1 }}
            zoomControl={false}
            ref={setMapInstance}
          >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <GeomanController />

        {capasConfig.map(capa => {
          if (!capaActiva(capa.id) || !cacheDatosGeo[capa.id]) return null;
          
          return (
            <GeoJSON 
              key={capa.id}
              data={cacheDatosGeo[capa.id]} 
              style={{ color: capa.color, weight: 5, opacity: 0.9 }}
              pointToLayer={(feature, latlng) => {
                return L.circleMarker(latlng, {
                  radius: 8,
                  fillColor: capa.color,
                  color: '#fff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.9
                });
              }}
              onEachFeature={(feature, l) => {
                const rawName = feature.properties?.nombre || feature.properties?.name || capa.nombre;
                const rawDesc = feature.properties?.descripcion || feature.properties?.description || feature.properties?.estado || feature.properties?.status || '';
                
                const safeName = escapeHtml(String(rawName));
                const safeDesc = escapeHtml(String(rawDesc));
                
                l.bindPopup(`<b>${safeName}</b><br/>${safeDesc}`);
              }}
            />
          );
        })}
      </MapContainer>
      {mapInstance && <CustomMapControls map={mapInstance} activeTab={activeTab} />}
        </div>
      </div>
    </div>
  );
}
