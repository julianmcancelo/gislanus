'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { renderToString } from 'react-dom/server';
import { MapPin, Plus, Minus, Home, Maximize, Printer, Save, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building } from 'lucide-react';

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
  const [baseLayer, setBaseLayer] = useState<any>(null);

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

        const [resCapas, resRutas] = await Promise.all([
          fetch('/api/capas'),
          fetch('/api/rutas-transporte')
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
          active: l.numeroSolicitud ? true : false,
          color: l.color,
          icono: l.icono || null,
          grupo: l.grupo,
          subGrupo: l.subGrupo,
          numeroSolicitud: l.numeroSolicitud
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
        setCacheDatosGeo(cache);
      } catch (error) {
        console.error('Error cargando capas:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCapas();
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
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          detectRetina={true}
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
                if (capa.icono && lucideIconsList[capa.icono]) {
                  const IconComp = lucideIconsList[capa.icono];
                  const svgString = renderToString(<IconComp size={18} color="white" />);
                  const innerHtml = `<div style="background-color: ${capa.color}; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; transform: translateY(-5px);">${svgString}</div>`;
                  
                  const customIcon = L.divIcon({
                    html: innerHtml,
                    className: 'custom-lucide-marker',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32]
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
                const rawName = props.nombre || props.name || props.Nombre || props.Name || props.title || props.Title || props.ESTABLECIM || props.Establecim || props.escuela || props.ESCUELA || capa.nombre;
                
                let extraPropsHtml = '';
                const keysToHide = ['dblayerid', 'nombre', 'name', 'title', 'establecim', 'escuela', 'color', 'stroke', 'fill', 'marker-color', 'marker-symbol', 'marker-size', 'group', 'id', 'fid', '_id', 'stroke-width', 'stroke-opacity', 'fill-opacity'];
                
                const translateMapKey = (k: string) => {
                  const lower = k.toLowerCase();
                  if (lower === 'description') return 'Descripción';
                  if (lower === 'address') return 'Dirección';
                  if (lower === 'type') return 'Tipo';
                  if (lower === 'category') return 'Categoría';
                  if (lower === 'phone') return 'Teléfono';
                  if (lower === 'email') return 'Correo';
                  // return capitalized version of the original key if no translation
                  return k.charAt(0).toUpperCase() + k.slice(1);
                };

                for (const [key, val] of Object.entries(props)) {
                   const lowerKey = key.toLowerCase();
                   // Skip internal or display fields we already use for styling or name
                   if (keysToHide.includes(lowerKey)) continue;
                   
                   if (val !== null && val !== undefined && String(val).trim() !== '') {
                      extraPropsHtml += `<li style="margin-bottom: 4px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;"><b>${escapeHtml(translateMapKey(key))}:</b> ${escapeHtml(String(val))}</li>`;
                   }
                }
                
                const safeName = escapeHtml(String(rawName));
                const popupContent = `
                  <div style="font-family: sans-serif; min-width: 220px; max-height: 250px; overflow-y: auto;">
                    <h3 style="margin: 0 0 10px 0; color: #29B6F6; font-size: 15px; border-bottom: 2px solid #29B6F6; padding-bottom: 5px;">${safeName}</h3>
                    ${extraPropsHtml ? `<ul style="list-style: none; padding: 0; margin: 0; font-size: 12px; color: #4A4A4A;">${extraPropsHtml}</ul>` : '<p style="margin:0; font-size:12px; color:#888;">Sin detalles adicionales</p>'}
                  </div>
                `;
                
                l.bindPopup(popupContent);
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
      </MapContainer>
      {mapInstance && <CustomMapControls map={mapInstance} activeTab={activeTab} />}
        </div>
      </div>
    </div>
  );
}
