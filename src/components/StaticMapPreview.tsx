import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

function FitBounds({ geoData }: { geoData: any }) {
  const map = useMap();
  useEffect(() => {
    if (geoData) {
      try {
        const group = L.geoJSON(geoData);
        if (group.getBounds().isValid()) {
          map.fitBounds(group.getBounds(), { padding: [28, 28] });
        }
      } catch (e) {
        console.warn('Could not fit bounds on geoData:', e);
      }
    }
  }, [map, geoData]);
  return null;
}

interface StaticMapPreviewProps {
  geoData: any;
  interactive?: boolean;
  height?: string;
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
}

export default function StaticMapPreview({
  geoData,
  interactive = false,
  height = '200px',
  strokeColor = '#0284c7',
  strokeWeight = 5,
  strokeOpacity = 0.9,
}: StaticMapPreviewProps) {
  // Generate a key that triggers re-render when geoData, stroke or size change
  const geoKey = useMemo(() => {
    if (!geoData) return 'empty';
    try {
      const coordSample = geoData.features?.[0]?.geometry?.coordinates?.[0] || '';
      const len = geoData.features?.length || 0;
      return `${len}_${strokeColor}_${strokeWeight}_${JSON.stringify(coordSample)}`;
    } catch {
      return Math.random().toString();
    }
  }, [geoData, strokeColor, strokeWeight]);

  const pointToLayer = (feature: any, latlng: L.LatLng) => {
    const props = feature.properties || {};
    if (props.type === 'stop') {
      return L.circleMarker(latlng, {
        radius: 7,
        fillColor: '#10b981',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });
    }
    if (props.type === 'incident') {
      return L.circleMarker(latlng, {
        radius: 8,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });
    }
    return L.circleMarker(latlng, {
      radius: 5,
      fillColor: strokeColor,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    });
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties || {};
    let content = '';
    if (props.type === 'stop') {
      content = `<b>🚏 ${props.name || 'Parada'}</b>${props.sequence ? `<br/>Secuencia: #${props.sequence}` : ''}${props.dwellTimeMs ? `<br/>Espera: ${(props.dwellTimeMs / 1000).toFixed(0)}s` : ''}`;
    } else if (props.type === 'incident') {
      content = `<b>⚠️ Incidencia: ${props.incidentType || props.type || 'Alerta'}</b>${props.severity ? `<br/>Severidad: ${props.severity}` : ''}${props.description ? `<br/>${props.description}` : ''}`;
    } else if (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') {
      content = `<b>🚍 ${props.name || 'Trazo de Colectivo'}</b>${props.distanceMeters ? `<br/>Distancia: ${(props.distanceMeters / 1000).toFixed(1)} km` : ''}`;
    }
    if (content) {
      layer.bindPopup(content);
    }
  };

  return (
    <div style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: '15px', position: 'relative', zIndex: 0 }}>
      <MapContainer 
        center={[-34.7042, -58.3961]} 
        zoom={13} 
        minZoom={11}
        maxBounds={[
          [-34.7800, -58.5000],
          [-34.6200, -58.2800]
        ]}
        style={{ width: '100%', height: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={process.env.NEXT_PUBLIC_MAPBOX_TOKEN 
            ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}` 
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
          maxZoom={19}
          zIndex={0}
        />
        {geoData && (
          <GeoJSON
            key={geoKey}
            data={geoData}
            style={() => ({
              color: strokeColor,
              weight: strokeWeight,
              opacity: strokeOpacity,
              lineCap: 'round',
              lineJoin: 'round',
            })}
            pointToLayer={pointToLayer}
            onEachFeature={onEachFeature}
          />
        )}
        <FitBounds geoData={geoData} />
      </MapContainer>
    </div>
  );
}
