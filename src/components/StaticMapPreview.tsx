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

export default function StaticMapPreview({ geoData, interactive = false, height = '200px' }: { geoData: any, interactive?: boolean, height?: string }) {
  return (
    <div style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', marginBottom: '15px', position: 'relative', zIndex: 0 }}>
      <MapContainer 
        center={[-34.7042, -58.3961]} 
        zoom={13} 
        minZoom={12}
        maxBounds={[
          [-34.7505, -58.4519], // Sur-Oeste
          [-34.6537, -58.3284]  // Nor-Este
        ]}
        style={{ width: '100%', height: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          maxZoom={19}
        />{geoData && <GeoJSON data={geoData} style={{ color: '#29B6F6', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />}
        <FitBounds geoData={geoData} />
      </MapContainer>
    </div>
  );
}
