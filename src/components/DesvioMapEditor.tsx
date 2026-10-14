'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import { AlertTriangle, MapPin, Navigation, Trash2, CheckCircle2, RotateCcw, Bus, Layers } from 'lucide-react';
import MapSearch from './MapSearch';

const lanusCenter: [number, number] = [-34.7042, -58.3961];

// Icono personalizado para el punto de corte (🚧 Obra Vial)
const corteIcon = L.divIcon({
  className: 'custom-corte-marker',
  html: `<div style="
    background: #ef4444; 
    color: white; 
    border: 3px solid white; 
    box-shadow: 0 4px 16px rgba(239,68,68,0.7); 
    border-radius: 50%; 
    width: 38px; 
    height: 38px; 
    display: flex; 
    align-items: center; 
    justify-content: center;
    font-size: 20px;">
    🚧
  </div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

// Icono para waypoints del desvío alternativo
const desvioWaypointIcon = L.divIcon({
  className: 'custom-waypoint-marker',
  html: `<div style="
    background: #10b981; 
    color: white; 
    border: 2px solid white; 
    box-shadow: 0 2px 10px rgba(16,185,129,0.6); 
    border-radius: 50%; 
    width: 26px; 
    height: 26px; 
    display: flex; 
    align-items: center; 
    justify-content: center;
    font-size: 13px;
    font-weight: 800;">
    📍
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

interface DesvioMapEditorProps {
  corteCoords: [number, number] | null;
  setCorteCoords: (coords: [number, number]) => void;
  radioMetros: number;
  lineaOriginalGeo: any | null; // GeoJSON de la línea afectada para comparar
  onDesvioCalculado: (geojson: any, callesText: string) => void;
  modo: 'marcar_corte' | 'trazar_desvio';
  todasLasLineas?: any[]; // Todas las líneas de transporte cargadas en el GIS para verlas en el mapa
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
  todasLasLineas = [],
}: DesvioMapEditorProps) {
  const [waypoints, setWaypoints] = useState<L.LatLng[]>([]);
  const routingControlRef = useRef<any>(null);
  const mapRef = useRef<L.Map | null>(null);
  const corteCircleRef = useRef<L.Circle | null>(null);
  const corteMarkerRef = useRef<L.Marker | null>(null);
  const lineaOriginalLayerRef = useRef<L.GeoJSON | null>(null);
  const [baseLayer, setBaseLayer] = useState<any>(null);
  const [mostrarTodasLasLineas, setMostrarTodasLasLineas] = useState<boolean>(false);
  const [lineasDeFondo, setLineasDeFondo] = useState<any[]>([]);
  const [cargandoLineasFondo, setCargandoLineasFondo] = useState<boolean>(false);

  // Cargar líneas de fondo solo si el usuario prende el interruptor
  const handleToggleLineasFondo = async (activar: boolean) => {
    setMostrarTodasLasLineas(activar);
    if (activar && lineasDeFondo.length === 0) {
      setCargandoLineasFondo(true);
      try {
        const res = await fetch('/api/lineas-transporte');
        if (res.ok) {
          const data = await res.json();
          setLineasDeFondo(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Error loading lines:', e);
      } finally {
        setCargandoLineasFondo(false);
      }
    }
  };

  // Cargar polígono del Municipio de Lanús (mismo que en Map.tsx)
  useEffect(() => {
    async function loadBase() {
      try {
        const res = await fetch('/lanus-base.geojson');
        if (res.ok) {
          const data = await res.json();
          setBaseLayer(data);
        }
      } catch (e) {
        console.error('Error loading lanus-base:', e);
      }
    }
    loadBase();
  }, []);

  // Manejo del punto de corte y radio de impacto
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
        dashArray: '5, 5',
      }).addTo(map);
      corteCircleRef.current = circle;

      map.panTo(corteCoords);
    }
  }, [corteCoords, radioMetros]);

  // Dibujar la traza de la línea afectada seleccionada para trazar
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
            weight: 6,
            opacity: 0.8,
            dashArray: '8, 6',
          },
        }).addTo(map);
        lineaOriginalLayerRef.current = layer;
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
      } catch (e) {
        console.error('Error dibujando traza original:', e);
      }
    }
  }, [lineaOriginalGeo]);

  // Manejo de ruteo con Leaflet Routing Machine
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routingControlRef.current) {
      try { map.removeControl(routingControlRef.current); } catch {}
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

          // Función de traducción y limpieza a español de las instrucciones de tránsito
          const cleanSpanishInstructions = (r.instructions || [])
            .map((inst: any) => {
              let text = (inst.text || '').trim();
              if (!text) return null;

              // Si es un cartel genérico de destino o llegada, omitirlo para dejar la lista limpia de calles
              if (/you have arrived|destination|has llegado/i.test(text)) return null;

              // Traducciones de maniobras y direcciones
              text = text
                .replace(/^Head\s+(northwest|north|northeast|southwest|south|southeast|east|west)\s+on\s+/i, 'Por ')
                .replace(/^Turn\s+left\s+onto\s+/i, 'Girar a la izquierda en ')
                .replace(/^Turn\s+right\s+onto\s+/i, 'Girar a la derecha en ')
                .replace(/^Turn\s+slight\s+left\s+onto\s+/i, 'Girar levemente a la izquierda en ')
                .replace(/^Turn\s+slight\s+right\s+onto\s+/i, 'Girar levemente a la derecha en ')
                .replace(/^Make\s+a\s+U-turn\s+onto\s+/i, 'Girar en U por ')
                .replace(/^Continue\s+onto\s+/i, 'Continuar por ')
                .replace(/^Continue\s+on\s+/i, 'Continuar por ')
                .replace(/^Take\s+the\s+ramp\s+onto\s+/i, 'Tomar la bajada hacia ')
                .replace(/^At\s+the\s+roundabout,\s+take\s+the\s+(\d+)(st|nd|rd|th)?\s+exit\s+onto\s+/i, 'En la rotonda, tomar la salida $1 por ');

              return text;
            })
            .filter((t: any) => t && t.length > 0);

          // Si quedaron pasos, unir con flechas; si no, extraer las calles únicas
          let textoItinerario = '';
          if (cleanSpanishInstructions.length > 0) {
            // Eliminar instrucciones duplicadas contiguas (ej: "Continuar por Pergamino ➔ Continuar por Pergamino")
            const unicos = cleanSpanishInstructions.filter((val: string, idx: number, arr: string[]) => val !== arr[idx - 1]);
            textoItinerario = unicos.join(' ➔ ');
          } else {
            // Fallback: listar las calles directas
            const streets = Array.from(new Set(
              (r.instructions || []).map((i: any) => i.road).filter(Boolean)
            ));
            textoItinerario = streets.length > 0 ? `Desvía por: ${streets.join(' ➔ ')}` : 'Desvío trazado por calles paralelas';
          }

          onDesvioCalculado(geojsonLine, textoItinerario);
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
      try { mapRef.current.removeControl(routingControlRef.current); } catch {}
      routingControlRef.current = null;
    }
    onDesvioCalculado(null, '');
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <MapContainer
        center={corteCoords || lanusCenter}
        zoom={14}
        minZoom={12}
        preferCanvas={true}
        style={{ width: '100%', height: '100%' }}
        ref={(m) => { if (m) mapRef.current = m; }}
      >
        {/* Usamos Mapbox Streets estándar idéntico al mapa principal GIS */}
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          maxZoom={19}
          zIndex={0}
        />

        {/* Límite Municipal de Lanús */}
        {baseLayer && (
          <GeoJSON 
            data={baseLayer}
            style={{
              color: '#3B82F6',
              weight: 3,
              fillColor: '#3B82F6',
              fillOpacity: 0.05,
              dashArray: '10, 8'
            }}
            interactive={false}
          />
        )}

        {/* Líneas de Colectivo de Fondo (bajo demanda) */}
        {mostrarTodasLasLineas && lineasDeFondo.map((linea: any) => {
          if (!linea.datosGeo) return null;
          let parsed = null;
          try {
            parsed = typeof linea.datosGeo === 'string' ? JSON.parse(linea.datosGeo) : linea.datosGeo;
          } catch {}
          if (!parsed) return null;

          return (
            <GeoJSON
              key={linea.id}
              data={parsed}
              style={{
                color: linea.color || '#2563eb',
                weight: 2.5,
                opacity: 0.4,
              }}
              interactive={false}
            />
          );
        })}

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
        top: 14,
        left: 56,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(10px)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
      }}>
        {modo === 'marcar_corte' ? (
          <>
            <div style={{ background: '#ef4444', width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🚧
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '13px' }}>Modo: Marcar lugar de obra o corte</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Hacé clic sobre cualquier calle en el mapa para ubicar el corte.</p>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: '#10b981', width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={16} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '13px' }}>Modo: Trazar recorrido de desvío provisorio ({waypoints.length} puntos)</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Hacé clics sucesivos en las esquinas por donde debe doblar y circular el colectivo.</p>
            </div>
          </>
        )}
      </div>

      {/* Switch Flotante: Ver/Ocultar Líneas de Transporte en el mapa */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '10px',
        padding: '8px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        fontWeight: 700,
        color: '#1e293b',
      }}>
        <Bus size={15} color="#2563eb" />
        <span>Ver red de colectivos</span>
        {cargandoLineasFondo ? (
          <span style={{ fontSize: '10px', color: '#64748b' }}>Cargando...</span>
        ) : (
          <input
            type="checkbox"
            checked={mostrarTodasLasLineas}
            onChange={(e) => handleToggleLineasFondo(e.target.checked)}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
        )}
      </div>

      {/* Controles de desvío cuando está en modo trazado */}
      {modo === 'trazar_desvio' && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          padding: '10px 14px',
          borderRadius: '12px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}>
          <button
            type="button"
            onClick={limpiarDesvio}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={14} />
            Reiniciar Puntos
          </button>

          {waypoints.length >= 2 && (
            <span style={{ fontSize: '13px', color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> ¡Ruta de desvío calculada!
            </span>
          )}
        </div>
      )}

      {/* Ocultar el panel de indicaciones por defecto de Leaflet Routing Machine */}
      <style>{`
        .leaflet-routing-container {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
