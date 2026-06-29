import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import MapSearch from './MapSearch';
import { MapPin, Flag, Octagon, X, Ruler, Clock, Trash2, Plus, Route } from 'lucide-react';

const center: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function WizardMapController({ onComplete, initialGeo, initialWaypoints }: any) {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState<any>(null);
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [waypoints, setWaypoints] = useState<any[]>([]);
  const [savedFeatures, setSavedFeatures] = useState<any[]>([]);
  const [isTracing, setIsTracing] = useState(false);
  const [routeName, setRouteName] = useState('Recorrido 1');
  const [aiText, setAiText] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Inicializar con initialGeo si existe
  useEffect(() => {
    if (initialGeo?.features && savedFeatures.length === 0) {
      setSavedFeatures(initialGeo.features);
      setRouteName(`Recorrido ${initialGeo.features.length + 1}`);
    } else if (initialGeo?.type === 'Feature' && savedFeatures.length === 0) {
      setSavedFeatures([initialGeo]);
      setRouteName(`Recorrido 2`);
    }
  }, [initialGeo]);

  useEffect(() => {
    if (panelRef.current) {
      L.DomEvent.disableClickPropagation(panelRef.current);
      L.DomEvent.disableScrollPropagation(panelRef.current);
    }
    if (buttonsRef.current) {
      L.DomEvent.disableClickPropagation(buttonsRef.current);
    }
    if (overlayRef.current) {
      L.DomEvent.disableClickPropagation(overlayRef.current);
      L.DomEvent.disableScrollPropagation(overlayRef.current);
    }
  }, [waypoints.length, currentRoute, savedFeatures.length, isTracing, aiText, isGeneratingAI]);

  // Auto zoom to initialGeo bounds if provided
  useEffect(() => {
    if (initialGeo) {
      try {
        const geoJsonLayer = L.geoJSON(initialGeo);
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.error("Error setting map bounds for initialGeo:", e);
      }
    }
  }, [initialGeo, map]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Ocultar botones de geoman si quedan
    if (map.pm) {
      map.pm.addControls({ position: 'topleft', drawCircle: false, drawPolygon: false, drawRectangle: false, drawMarker: false, drawPolyline: false, editMode: false, dragMode: false, cutPolygon: false, removalMode: false });
    }

    // @ts-ignore
    if (!L.Routing) return;

    if (!isTracing) {
      if (routingControl) {
        map.removeControl(routingControl);
        setRoutingControl(null);
        setCurrentRoute(null);
        setWaypoints([]);
      }
      return;
    }

    // Silenciar el console.warn temporalmente para evitar que el usuario vea el mensaje de OSRM demo server
    const originalWarn = console.warn;
    console.warn = function (msg) {
      if (typeof msg === 'string' && msg.includes("You are using OSRM's demo server")) return;
      originalWarn.apply(console, arguments as any);
    };

    // @ts-ignore
    const control = L.Routing.control({
      waypoints: [],
      routeWhileDragging: true,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: {
        styles: [{ color: '#29B6F6', opacity: 0.8, weight: 6 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0
      },
      // @ts-ignore
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving'
      }),
      show: false, // Ocultar el panel de instrucciones para mantener limpio el UI
      addWaypoints: true,
      createMarker: function(i: number, wp: any, nWps: number) {
        return L.marker(wp.latLng, { draggable: true });
      }
    } as any).addTo(map);

    if (initialWaypoints && initialWaypoints.length > 0) {
      control.setWaypoints(initialWaypoints);
    }

    // Restaurar console.warn después de inicializar
    setTimeout(() => {
      console.warn = originalWarn;
    }, 1000);

    control.on('routesfound', function(e: any) {
      const routes = e.routes;
      if (routes && routes.length > 0) {
        setCurrentRoute(routes[0]);
      }
    });

    control.on('waypointschanged', async function(e: any) {
      const validWps = e.waypoints ? e.waypoints.filter((w:any) => w.latLng) : control.getWaypoints().filter((w:any) => w.latLng);
      
      // Update state immediately with default names
      setWaypoints([...validWps]);

      // Reverse geocode to get street names for waypoints that don't have one
      const enhancedWps = await Promise.all(validWps.map(async (wp: any) => {
        if (!wp.name && wp.latLng) {
          try {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${wp.latLng.lng},${wp.latLng.lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=address,poi`);
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              return { ...wp, name: data.features[0].text };
            }
          } catch(err) {}
        }
        return wp;
      }));
      setWaypoints(enhancedWps);
    });

    setRoutingControl(control);

    let lastClickTime = 0;
    const onMapClick = (e: any) => {
      // Prevent double clicks or rapid clicks from adding multiple waypoints
      const now = Date.now();
      if (now - lastClickTime < 400) return;
      lastClickTime = now;

      const wps = control.getWaypoints().filter((w: any) => w.latLng);
      if (wps.length === 0) {
        control.spliceWaypoints(0, 1, e.latlng);
      } else if (wps.length === 1) {
        control.spliceWaypoints(1, 1, e.latlng);
      } else {
        control.spliceWaypoints(wps.length, 0, e.latlng);
      }
    };

    map.on('click', onMapClick);

    return () => {
      map.off('click', onMapClick);
      try { map.removeControl(control); } catch(err) {}
    };
  }, [map, isTracing]);

  const handleAITrace = async () => {
    if (!aiText.trim()) return;
    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/parse-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, index: savedFeatures.length, description: routeName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error trazando con IA');
      
      setSavedFeatures(prev => [...prev, data.feature]);
      setRouteName(`Recorrido ${savedFeatures.length + 2}`);
      setAiText('');
      
      const layer = L.geoJSON(data.feature);
      map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    } catch (err: any) {
      alert(err.message || 'Error al procesar el recorrido con IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const confirmCurrentTrace = async () => {
    if (!currentRoute) {
      alert("Hacé clic en el mapa para marcar el recorrido antes de guardar el trazo.");
      return;
    }
    
    const coordinates = currentRoute.coordinates.map((c: any) => [c.lng, c.lat]);
    const streets = (currentRoute.instructions || [])
      .map((inst: any) => inst.road)
      .filter((road: string) => road && road.trim().length > 0);
    const uniqueStreets = Array.from(new Set(streets)) as string[];
    
    const colors = ['#29B6F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
    const color = colors[savedFeatures.length % colors.length];

    const newFeature = {
      type: 'Feature',
      properties: {
        name: routeName,
        streets: uniqueStreets.join(' - '),
        color: color,
        waypoints: waypoints
      },
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    };

    setSavedFeatures([...savedFeatures, newFeature]);
    setIsTracing(false);
    setRouteName(`Recorrido ${savedFeatures.length + 2}`);
  };

  const cancelTrace = () => {
    setIsTracing(false);
  };

  const deleteFeature = (idx: number) => {
    const updated = [...savedFeatures];
    updated.splice(idx, 1);
    setSavedFeatures(updated);
  };

  const finishAll = () => {
    if (savedFeatures.length === 0) {
      alert("Debes tener al menos un recorrido guardado para continuar.");
      return;
    }

    const allStreets = savedFeatures.map(f => f.properties.streets || '');
    const geojson = {
      type: 'FeatureCollection',
      features: savedFeatures
    };
    
    onComplete(geojson, allStreets, []);
  };

  const undoLastWaypoint = () => {
    if (routingControl) {
      const wps = routingControl.getWaypoints().filter((w: any) => w.latLng);
      if (wps.length > 0) {
        routingControl.spliceWaypoints(wps.length - 1, 1);
      }
    }
  };

  return (
    <>
      {waypoints.length > 0 && (
        <div ref={panelRef} style={{ position: 'absolute', top: '80px', left: '10px', zIndex: 1000, background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(10px)', padding: '16px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)', border: '1px solid rgba(255, 255, 255, 0.4)', width: '250px', maxHeight: '400px', overflowY: 'auto', transition: 'all 0.3s ease' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '14px', fontWeight: '800' }}>Puntos del Recorrido</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {waypoints.map((wp, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px', display: 'flex', alignItems: 'center', gap: '4px' }} title={wp.name || ''}>
                  {i === 0 ? <MapPin size={14} color="#10b981" /> : i === waypoints.length - 1 ? <Flag size={14} color="#3b82f6" /> : <Octagon size={14} color="#f59e0b" />}
                  {wp.name ? wp.name : (i === 0 ? 'Inicio' : i === waypoints.length - 1 ? 'Destino' : `Parada ${i}`)}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); routingControl.spliceWaypoints(i, 1); }}
                  style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Eliminar punto"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
          {currentRoute && currentRoute.summary && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Ruler size={14} /> {(currentRoute.summary.totalDistance / 1000).toFixed(1)} km</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {Math.round(currentRoute.summary.totalTime / 60)} min</span>
            </div>
          )}
        </div>
      )}

      {/* Panel Superior Derecho: Mesa de Trabajo Multiruta */}
      <div ref={overlayRef} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000, background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', padding: '18px', borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.05)', border: '1px solid rgba(255,255,255,0.6)', width: '290px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', color: '#0f172a', borderBottom: '2px solid rgba(226, 232, 240, 0.6)', paddingBottom: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Route size={18} color="#3b82f6" /> Mesa de Trabajo
        </h3>

        {/* Lista de Trazos Guardados */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {savedFeatures.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', margin: 0 }}>No hay recorridos guardados.</p>
          ) : (
            savedFeatures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', border: `1px solid ${f.properties.color || '#e2e8f0'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: f.properties.color || '#333', boxShadow: `0 0 0 3px ${f.properties.color}33` }}></span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>{f.properties.name || `Recorrido ${i+1}`}</span>
                </div>
                <button onClick={() => deleteFeature(i)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '6px', transition: 'all 0.2s' }} title="Eliminar recorrido" onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>

        {/* Formulario de Nuevo Trazo */}
        {isTracing ? (
          <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#0369a1', fontWeight: 'bold' }}>Trazando: {routeName}</p>
            <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#0c4a6e' }}>Hacé clics en el mapa para dibujar la ruta.</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={cancelTrace} style={{ flex: 1, padding: '6px', fontSize: '11px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
              <button onClick={confirmCurrentTrace} style={{ flex: 2, padding: '6px', fontSize: '11px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar Trazo</button>
            </div>
            {currentRoute && currentRoute.summary && (
              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#0369a1', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Ruler size={12} /> {(currentRoute.summary.totalDistance / 1000).toFixed(1)} km</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={12} /> {Math.round(currentRoute.summary.totalTime / 60)} min</span>
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input 
              type="text" 
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Ej: Ida, Vuelta, Recorrido A"
              style={{ padding: '10px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)', transition: 'border-color 0.2s', backgroundColor: 'rgba(255,255,255,0.9)' }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
            <button 
              onClick={() => setIsTracing(true)}
              style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'; }}
            >
              <Plus size={16} strokeWidth={3} /> Dibujar Manualmente
            </button>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.7)', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '14px' }}>✨</span> Trazado Inteligente (IA)
              </p>
              <textarea 
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="Pegá las calles o escribilas acá. Ej: Yrigoyen, 25 de mayo, y salir por Lanus Este..."
                style={{ width: '100%', height: '60px', padding: '8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'none', outline: 'none', backgroundColor: 'rgba(255,255,255,0.9)' }}
              />
              <button 
                onClick={handleAITrace}
                disabled={isGeneratingAI || !aiText.trim()}
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: isGeneratingAI || !aiText.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', opacity: isGeneratingAI || !aiText.trim() ? 0.6 : 1 }}
              >
                {isGeneratingAI ? 'Procesando...' : 'Dibujar con IA'}
              </button>
            </div>
          </div>
        )}

        <button 
          onClick={finishAll}
          style={{ marginTop: '15px', background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)'; }}
        >
          Terminar y Enviar Todo
        </button>
      </div>

      {/* Renderizar trazos guardados */}
      {savedFeatures.map((f, i) => (
        <GeoJSON 
          key={`saved-${i}`}
          data={f} 
          style={() => ({
            color: f.properties.color || '#333',
            weight: 6,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round'
          })}
          onEachFeature={(feature, layer) => {
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(`
                <div style="font-family: sans-serif; padding: 5px; min-width: 150px;">
                  <strong style="color: ${feature.properties.color || '#8B5CF6'}; font-size: 14px; display: block; margin-bottom: 4px;">
                    ${feature.properties.name}
                  </strong>
                  <span style="font-size: 12px; color: #475569; line-height: 1.4; display: block;">
                    ${feature.properties.streets || ''}
                  </span>
                </div>
              `);
            }
          }}
        />
      ))}
    </>
  );
}

interface WizardMapProps {
  onComplete: (geoJson: any, streets: string[], waypoints: any[]) => void;
  initialGeo?: any;
  initialWaypoints?: any[];
}

export default function WizardMap({ onComplete, initialGeo, initialWaypoints }: WizardMapProps) {
  // Use a stable JSON key to force re-render when geocoded data changes
  const geoJsonKey = initialGeo ? JSON.stringify(initialGeo).substring(0, 100) : 'empty';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer 
        key={geoJsonKey}
        center={center} 
        zoom={14} 
        minZoom={12}
        maxBounds={[
          [-34.7505, -58.4519], // Sur-Oeste
          [-34.6537, -58.3284]  // Nor-Este
        ]}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          maxZoom={19}
        />

        <MapSearch />
        <WizardMapController onComplete={onComplete} initialGeo={initialGeo} initialWaypoints={initialWaypoints} />
      </MapContainer>
    </div>
  );
}
