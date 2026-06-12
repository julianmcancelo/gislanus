import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

function FitBounds({ geoData }: { geoData: any }) {
  const map = useMap();
  useEffect(() => {
    if (geoData) {
      const group = L.geoJSON(geoData);
      if (group.getBounds().isValid()) {
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
      }
    }
  }, [map, geoData]);
  return null;
}

export default function StaticMapPreview({ geoData }: { geoData: any }) {
  return (
    <div style={{ height: '200px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', marginBottom: '15px', position: 'relative', zIndex: 0 }}>
      <MapContainer 
        center={[-34.7042, -58.3961]} 
        zoom={13} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {geoData && <GeoJSON data={geoData} style={{ color: '#29B6F6', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />}
        <FitBounds geoData={geoData} />
      </MapContainer>
    </div>
  );
}
