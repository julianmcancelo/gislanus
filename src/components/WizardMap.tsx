import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import MapSearch from './MapSearch';

const center: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function WizardMapController({ onComplete, initialGeo }: any) {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState<any>(null);
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [waypoints, setWaypoints] = useState<any[]>([]);

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

    control.on('waypointschanged', function(e: any) {
      const validWps = e.waypoints ? e.waypoints.filter((w:any) => w.latLng) : control.getWaypoints().filter((w:any) => w.latLng);
      setWaypoints([...validWps]);
    });

    setRoutingControl(control);

    const onMapClick = (e: any) => {
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
  }, [map]);

  const confirmRoute = async () => {
    if (!currentRoute) {
      alert("Hacé clic en el mapa para marcar el recorrido antes de confirmar.");
      return;
    }
    
    const coordinates = currentRoute.coordinates.map((c: any) => [c.lng, c.lat]);
    
    const streets = (currentRoute.instructions || [])
      .map((inst: any) => inst.road)
      .filter((road: string) => road && road.trim().length > 0);
    
    const uniqueStreets = Array.from(new Set(streets)) as string[];
    
    const geojson = {
      type: 'Feature',
      properties: {
        streets: uniqueStreets.join(' - ')
      },
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    };

    onComplete(geojson, uniqueStreets);
  };

  const confirmInitialRoute = () => {
    if (initialGeo) {
      onComplete(initialGeo, []);
    }
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
        <div style={{ position: 'absolute', top: '80px', left: '10px', zIndex: 1000, background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '250px', maxHeight: '400px', overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>Puntos del Recorrido</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {waypoints.map((wp, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                  {i === 0 ? '📍 Inicio' : i === waypoints.length - 1 ? '🏁 Destino' : `🛑 Parada ${i}`}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); routingControl.spliceWaypoints(i, 1); }}
                  style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}
                  title="Eliminar punto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {currentRoute && currentRoute.summary && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>📏 {(currentRoute.summary.totalDistance / 1000).toFixed(1)} km</span>
              <span>⏱️ {Math.round(currentRoute.summary.totalTime / 60)} min</span>
            </div>
          )}
        </div>
      )}

      {currentRoute ? (
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '10px' }}>
          <button 
            onClick={undoLastWaypoint}
            style={{ 
              background: '#F59E0B', color: 'white', border: 'none', padding: '12px 20px', 
              borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
            }}
          >
            ↩️ Deshacer Último Punto
          </button>
          <button 
            onClick={confirmRoute}
            style={{ 
              background: '#10B981', color: 'white', border: 'none', padding: '12px 24px', 
              borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
            }}
          >
            Confirmar Nuevo Recorrido
          </button>
        </div>
      ) : (
        initialGeo && (
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '10px' }}>
            <button 
              onClick={undoLastWaypoint}
              style={{ 
                background: '#F59E0B', color: 'white', border: 'none', padding: '12px 20px', 
                borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
              }}
            >
              ↩️ Deshacer Último Punto
            </button>
            <button 
              onClick={confirmInitialRoute}
              style={{ 
                background: '#8B5CF6', color: 'white', border: 'none', padding: '12px 24px', 
                borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)'
              }}
            >
              Confirmar Trazado
            </button>
          </div>
        )
      )}
    </>
  );
}

export default function WizardMap({ onComplete, initialGeo }: { onComplete: (data: any, streets: string[]) => void, initialGeo?: any }) {
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
        {initialGeo && (
          <GeoJSON 
            data={initialGeo} 
            style={(feature) => ({
              color: feature?.properties?.color || '#8B5CF6',
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
        )}
        <MapSearch />
        <WizardMapController onComplete={onComplete} initialGeo={initialGeo} />
      </MapContainer>
    </div>
  );
}
