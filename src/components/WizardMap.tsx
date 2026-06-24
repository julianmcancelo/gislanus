import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';

const center: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function WizardMapController({ onComplete }: any) {
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
    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    };

    onComplete(geojson, []);
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

export default function WizardMap({ onComplete }: { onComplete: (data: any, streets: string[]) => void }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
        <WizardMapController onComplete={onComplete} />
      </MapContainer>
    </div>
  );
}
