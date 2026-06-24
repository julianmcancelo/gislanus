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

function WizardMapController({ onComplete }: any) {
  const map = useMap();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Configurar Geoman para que el usuario dibuje líneas libremente
    if (map.pm) {
      map.pm.addControls({ 
        position: 'topleft', 
        drawCircle: false, 
        drawPolygon: false, 
        drawRectangle: false, 
        drawMarker: true, 
        drawPolyline: true, // Permitir trazos libres
        drawText: false,
        drawCircleMarker: false,
        editMode: true, 
        dragMode: true, 
        cutPolygon: false, 
        removalMode: true 
      });
      map.pm.setLang('es');
    }
  }, [map]);

  const confirmRoute = async () => {
    // Obtenemos todas las capas dibujadas por el usuario
    const layers = map.pm.getGeomanDrawLayers();
    if (layers.length === 0) {
      alert("Por favor, dibuje el recorrido o marque un punto en el mapa.");
      return;
    }
    
    // Tomamos la primera capa dibujada (o combinamos)
    const layer = layers[0];
    const geojson = (layer as any).toGeoJSON();

    onComplete(geojson, []);
  };

  return (
    <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000 }}>
      <button 
        onClick={confirmRoute}
        style={{ 
          background: '#10B981', color: 'white', border: 'none', padding: '12px 24px', 
          borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
        }}
      >
        Confirmar Recorrido Manual
      </button>
    </div>
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
