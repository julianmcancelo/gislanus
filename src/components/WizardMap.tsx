import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
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

  useEffect(() => {
    // Hide standard Geoman buttons
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      drawPolygon: false,
      drawRectangle: false,
      drawMarker: false,
      drawPolyline: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
    });

    map.pm.setLang('es');

    // Start drawing a line immediately
    map.pm.enableDraw('Line', {
      snappable: true,
      templineStyle: { color: '#29B6F6', weight: 5 },
      hintlineStyle: { color: '#29B6F6', dashArray: '5,5' },
    });

    const getStreetName = async (lat: number, lng: number) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
        const data = await res.json();
        return data.address?.road || data.address?.pedestrian || null;
      } catch (e) {
        return null;
      }
    };

    let liveDetected: string[] = [];

    const handleVertexAdded = async (e: any) => {
      if (!onLiveUpdate) return;
      const latlng = e.latlng;
      const name = await getStreetName(latlng.lat, latlng.lng);
      if (name) {
        if (liveDetected.length === 0 || liveDetected[liveDetected.length - 1] !== name) {
          liveDetected = [...liveDetected, name];
          onLiveUpdate(liveDetected);
        }
      }
    };

    map.on('pm:drawstart', (e: any) => {
      liveDetected = [];
      if (onLiveUpdate) onLiveUpdate([]);
      e.workingLayer.on('pm:vertexadded', handleVertexAdded);
    });

    const getOsrmRoute = async (latlngs: any[]) => {
      try {
        // Limit to 99 points to avoid OSRM limits
        const safeLatLngs = latlngs.slice(0, 99);
        const coords = safeLatLngs.map(pt => `${pt.lng},${pt.lat}`).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
        const data = await res.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          return null;
        }

        const route = data.routes[0];
        const geojson = { type: 'Feature', properties: {}, geometry: route.geometry };
        
        const orderedStreets: string[] = [];
        if (route.legs) {
          route.legs.forEach((leg: any) => {
            if (leg.steps) {
              leg.steps.forEach((step: any) => {
                const name = step.name?.trim();
                if (name) {
                  // Solo agregar si es distinta a la cuadra inmediatamente anterior
                  if (orderedStreets.length === 0 || orderedStreets[orderedStreets.length - 1] !== name) {
                    orderedStreets.push(name);
                  }
                }
              });
            }
          });
        }

        // Formatear para mostrar repeticiones
        const seen = new Set<string>();
        const formattedStreets = orderedStreets.map(street => {
          if (seen.has(street)) {
            return `${street} (Repetida / Vuelve a pasar)`;
          }
          seen.add(street);
          return street;
        });

        return { geojson, streets: formattedStreets };
      } catch (e) {
        return null;
      }
    };

    const onCreate = async (e: any) => {
      setProcessing(true);
      const layer = e.layer;
      let geojson = layer.toGeoJSON();
      map.pm.disableDraw();

      const latlngs = layer.getLatLngs();
      let finalStreets: string[] = [];

      // Try Map Matching / Routing with OSRM
      const osrmData = await getOsrmRoute(latlngs);

      if (osrmData) {
        geojson = osrmData.geojson;
        finalStreets = osrmData.streets;
        
        // Remove rough line and add the snapped one
        map.removeLayer(layer);
        L.geoJSON(geojson, {
          style: { color: '#29B6F6', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }
        }).addTo(map);
      } else {
        // Fallback to basic Nominatim if OSRM fails
        const uniqueStreets = new Set<string>();
        const pointsToQuery = latlngs.length > 5 
          ? [latlngs[0], latlngs[Math.floor(latlngs.length/2)], latlngs[latlngs.length-1]]
          : latlngs;
        for (const pt of pointsToQuery) {
          const name = await getStreetName(pt.lat, pt.lng);
          if (name) uniqueStreets.add(name);
        }
        finalStreets = Array.from(uniqueStreets);
      }

      onComplete(geojson, finalStreets);
    };

    map.on('pm:create', onCreate);

    return () => {
      map.off('pm:create', onCreate);
      map.off('pm:drawstart');
      map.pm.disableDraw();
    };
  }, [map, onComplete, setProcessing, onLiveUpdate]);

  return null;
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
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
