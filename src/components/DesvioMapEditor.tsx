'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { AlertTriangle, MapPin, Navigation, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import MapSearch from './MapSearch';

const lanusCenter: [number, number] = [-34.7042, -58.3961];

// Icono personalizado para el punto de corte (🚧 Obra Vial)
const corteIcon = L.divIcon({
  className: 'custom-corte-marker',
  html: `<div style="
    background: #ef4444; 
    color: white; 
    border: 3px solid white; 
    box-shadow: 0 4px 14px rgba(239,68,68,0.6); 
    border-radius: 50%; 
    width: 36px; 
    height: 36px; 
    display: flex; 
    align-items: center; 
    justify-content: center;
    font-size: 18px;">
    🚧
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Icono para waypoints del desvío
const desvioWaypointIcon = L.divIcon({
  className: 'custom-waypoint-marker',
  html: `<div style="
    background: #10b981; 
    color: white; 
    border: 2px solid white; 
    box-shadow: 0 2px 8px rgba(16,185,129,0.5); 
    border-radius: 50%; 
    width: 22px; 
    height: 22px; 
    display: flex; 
    align-items: center; 
    justify-content: center;
    font-size: 11px;
    font-weight: 800;">
    📍
  </div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface DesvioMapEditorProps {
  corteCoords: [number, number] | null;
  setCorteCoords: (coords: [number, number]) => void;
  radioMetros: number;
  lineaOriginalGeo: any | null; // GeoJSON de la línea afectada para comparar
  onDesvioCalculado: (geojson: any, callesText: string) => void;
  modo: 'marcar_corte' | 'trazar_desvio';
}

function MapEventsHandler({ 
  modo, 
  corteCoords, 
  setCorteCoords, 
  addWaypoint 
}: { 
  modo: 'marcar_corte' | 'trazar_desvio';
  corteCoords: [number, number] | null;
  setCorteCoords: (coords: [number, number]) => void;
  addWaypoint: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (modo === 'marcar_corte') {
        setCorteCoords([e.latlng.lat, e.latlng.lng]);
      } else if (modo === 'trazar_desvio') {
        addWaypoint(e.latlng);
      }
    },
  });
  return null;
}

export default function DesvioMapEditor({
  corteCoords,
  setCorteCoords,
  radioMetros,
  lineaOriginalGeo,
  onDesvioCalculado,
  modo,
}: DesvioMapEditorProps) {
  const [waypoints, setWaypoints] = useState<L.LatLng[]>([]);
  const [desvioLayer, setDesvioLayer] = useState<L.Polyline | null>(null);
  const routingControlRef = useRef<any>(null);
  const mapRef = useRef<L.Map | null>(null);
  const corteCircleRef = useRef<L.Circle | null>(null);
  const corteMarkerRef = useRef<L.Marker | null>(null);
  const lineaOriginalLayerRef = useRef<L.GeoJSON | null>(null);

  // Manejo del mapa y dibujo de corte
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpiar marker y circulo anterior
    if (corteMarkerRef.current) map.removeLayer(corteMarkerRef.current);
    if (corteCircleRef.current) map.removeLayer(corteCircleRef.current);

    if (corteCoords) {
      const marker = L.marker(corteCoords, { icon: corteIcon }).addTo(map);
      marker.bindPopup(`<b>Zona de Corte Vial</b><br>Radio de afectación: ${radioMetros} metros`).openPopup();
      corteMarkerRef.current = marker;

      const circle = L.circle(corteCoords, {
        radius: radioMetros,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.25,
        weight: 2,
        dashArray: '4, 4',
      }).addTo(map);
      corteCircleRef.current = circle;

      // Centrar suavemente
      map.panTo(corteCoords);
    }
  }, [corteCoords, radioMetros]);

  // Dibujar la traza original de la línea para referencia visual
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lineaOriginalLayerRef.current) {
      map.removeLayer(lineaOriginalLayerRef.current);
      lineaOriginalLayerRef.current = null;
    }

    if (lineaOriginalGeo) {
      try {
        const layer = L.geoJSON(lineaOriginalGeo, {
          style: {
            color: '#dc2626',
            weight: 5,
            opacity: 0.6,
            dashArray: '8, 6',
          },
        }).addTo(map);
        lineaOriginalLayerRef.current = layer;
        map.fitBounds(layer.getBounds(), { padding: [40, 40] });
      } catch (e) {
        console.error('Error dibujando traza original:', e);
      }
    }
  }, [lineaOriginalGeo]);

  // Manejo del ruteo del desvío alternativo usando Leaflet Routing Machine
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }

    if (waypoints.length >= 2) {
      const router = (L.Routing as any).control({
        waypoints: waypoints,
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        lineOptions: {
          styles: [
            { color: '#059669', opacity: 0.9, weight: 6 },
            { color: '#34d399', opacity: 1, weight: 3, dashArray: '6, 6' },
          ],
        },
        createMarker: (i: number, wp: any) => {
          return L.marker(wp.latLng, { icon: desvioWaypointIcon, draggable: true })
            .on('dragend', (e: any) => {
              const newLatLng = e.target.getLatLng();
              setWaypoints(prev => {
                const next = [...prev];
                next[i] = newLatLng;
                return next;
              });
            });
        },
      }).addTo(map);

      router.on('routesfound', (e: any) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const r = routes[0];
          const coordinates = r.coordinates.map((c: any) => [c.lng, c.lat]);
          const geojsonLine = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates,
            },
            properties: {
              distanciaMetros: r.summary?.totalDistance,
              tiempoSegundos: r.summary?.totalTime,
            },
          };

          const instructions = (r.instructions || [])
            .map((inst: any) => inst.text)
            .filter((t: string) => t && t.trim().length > 0)
            .join(' ➔ ');

          onDesvioCalculado(geojsonLine, instructions || 'Desvío alternativo trazado por calles adyacentes');
        }
      });

      routingControlRef.current = router;
    }
  }, [waypoints, onDesvioCalculado]);

  const addWaypoint = (latlng: L.LatLng) => {
    setWaypoints(prev => [...prev, latlng]);
  };

  const limpiarDesvio = () => {
    setWaypoints([]);
    if (routingControlRef.current && mapRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    onDesvioCalculado(null, '');
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '480px', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer
        center={corteCoords || lanusCenter}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        ref={(m) => { if (m) mapRef.current = m; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapEventsHandler
          modo={modo}
          corteCoords={corteCoords}
          setCorteCoords={setCorteCoords}
          addWaypoint={addWaypoint}
        />
        <MapSearch />
      </MapContainer>

      {/* Barra de Instrucciones Superior */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
      }}>
        {modo === 'marcar_corte' ? (
          <>
            <div style={{ background: '#ef4444', width: 24, height: 24, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🚧
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Modo: Marcar punto o tramo de corte</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Hacé clic sobre la calle afectada en el mapa para ubicar la obra.</p>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: '#10b981', width: 24, height: 24, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={14} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Modo: Trazar recorrido de desvío ({waypoints.length} puntos)</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Hacé clics sucesivos en las esquinas por donde debe desviar el colectivo.</p>
            </div>
          </>
        )}
      </div>

      {/* Controles de desvío cuando está en modo trazado */}
      {modo === 'trazar_desvio' && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          padding: '8px 12px',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
          <button
            type="button"
            onClick={limpiarDesvio}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} />
            Reiniciar Trazado
          </button>

          {waypoints.length >= 2 && (
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Desvío calculado
            </span>
          )}
        </div>
      )}
    </div>
  );
}
