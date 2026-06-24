import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { Loader2 } from 'lucide-react';

const center: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function WizardMapController({ onComplete, setProcessing, onLiveUpdate, suggestedRoute }: any) {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState<any>(null);
  const [currentRoute, setCurrentRoute] = useState<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Ocultar botones de geoman si quedan
    if (map.pm) {
      map.pm.addControls({ position: 'topleft', drawCircle: false, drawPolygon: false, drawRectangle: false, drawMarker: false, drawPolyline: false, editMode: false, dragMode: false, cutPolygon: false, removalMode: false });
    }

    // @ts-ignore
    if (!L.Routing) return;

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

    control.on('routesfound', function(e: any) {
      const routes = e.routes;
      if (routes && routes.length > 0) {
        setCurrentRoute(routes[0]);
        
        if (onLiveUpdate) {
          const orderedStreets: string[] = [];
          routes[0].instructions.forEach((inst: any) => {
            const name = inst.road?.trim();
            if (name && name !== '') {
              if (orderedStreets.length === 0 || orderedStreets[orderedStreets.length - 1] !== name) {
                orderedStreets.push(name);
              }
            }
          });
          
          const seen = new Set<string>();
          const formattedStreets = orderedStreets.map((street: string) => {
            if (seen.has(street)) return `${street} (Repetida / Vuelve a pasar)`;
            seen.add(street);
            return street;
          });
          
          onLiveUpdate(formattedStreets);
        }
      }
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
    if (!currentRoute) return;
    setProcessing(true);
    
    const coordinates = currentRoute.coordinates.map((c: any) => [c.lng, c.lat]);
    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    };

    const orderedStreets: string[] = [];
    currentRoute.instructions.forEach((inst: any) => {
      const name = inst.road?.trim();
      if (name && name !== '') {
        if (orderedStreets.length === 0 || orderedStreets[orderedStreets.length - 1] !== name) {
          orderedStreets.push(name);
        }
      }
    });

    const seen = new Set<string>();
    const formattedStreets = orderedStreets.map((street: string) => {
      if (seen.has(street)) return `${street} (Repetida / Vuelve a pasar)`;
      seen.add(street);
      return street;
    });

    onComplete(geojson, formattedStreets);
  };

  return (
    <>
      {currentRoute && (
        <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000 }}>
          <button 
            onClick={confirmRoute}
            style={{ 
              background: '#10B981', color: 'white', border: 'none', padding: '12px 24px', 
              borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
            }}
          >
            Confirmar Recorrido
          </button>
        </div>
      )}
    </>
  );
}

export default function WizardMap({ onComplete, onLiveUpdate, suggestedRoute }: { onComplete: (data: any, streets: string[]) => void, onLiveUpdate?: (streets: string[]) => void, suggestedRoute?: any }) {
  const [processing, setProcessing] = useState(false);
  const [baseLayer, setBaseLayer] = useState<any>(null);

  useEffect(() => {
    fetch('/lanus-base.geojson')
      .then(res => res.json())
      .then(data => setBaseLayer(data))
      .catch(e => console.error("Error loading base layer in wizard:", e));
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {processing && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={48} color="#29B6F6" style={{ marginBottom: '15px' }} />
          <h3 style={{ margin: 0, color: '#333' }}>Extrayendo calles...</h3>
          <p style={{ color: '#666', fontSize: '13px' }}>Conectando con OpenStreetMap</p>
        </div>
      )}
      <MapContainer 
        center={center} 
        zoom={14} 
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <WizardMapController onComplete={onComplete} setProcessing={setProcessing} onLiveUpdate={onLiveUpdate} />
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
        {suggestedRoute && (
          <GeoJSON
            data={suggestedRoute}
            style={{
              color: '#8B5CF6',
              weight: 6,
              dashArray: '10, 10',
              opacity: 0.6,
            }}
            interactive={false}
          />
        )}
      </MapContainer>
    </div>
  );
}
