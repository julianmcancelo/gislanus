'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import MapSearch from './MapSearch';

const lanusCenter: [number, number] = [-34.7042, -58.3961];

interface StandaloneStudioMapProps {
  activeDrawMode: 'marker' | 'line' | 'polygon' | null;
  formColor: string;
  onElementCreated: (shape: string, layer: any, geo: any) => void;
  onDrawModeEnded: () => void;
  mostrarRedTransporte: boolean;
  elementosDibujados: any[];
  selectedElementoIdx: number | null;
  onSelectElemento: (idx: number) => void;
}

function GeomanController({
  activeDrawMode,
  formColor,
  onElementCreated,
  onDrawModeEnded,
}: {
  activeDrawMode: 'marker' | 'line' | 'polygon' | null;
  formColor: string;
  onElementCreated: (shape: string, layer: any, geo: any) => void;
  onDrawModeEnded: () => void;
}) {
  const map = useMap();
  const onElementCreatedRef = useRef(onElementCreated);
  onElementCreatedRef.current = onElementCreated;
  const onDrawModeEndedRef = useRef(onDrawModeEnded);
  onDrawModeEndedRef.current = onDrawModeEnded;

  // Registrar listeners de Geoman
  useEffect(() => {
    if (!map || !(map as any).pm) return;

    const handleCreate = (e: any) => {
      const layer = e.layer;
      const shape = e.shape;

      if (layer.setStyle) {
        layer.setStyle({ color: formColor, fillColor: formColor, fillOpacity: 0.35, weight: 4 });
      }

      const geo = layer.toGeoJSON();
      onElementCreatedRef.current(shape, layer, geo);
      (map as any).pm.disableDraw();
      onDrawModeEndedRef.current();
    };

    map.on('pm:create', handleCreate);

    return () => {
      map.off('pm:create', handleCreate);
    };
  }, [map, formColor]);

  // Actualizar modo de dibujo
  useEffect(() => {
    if (!map || !(map as any).pm) return;

    if (!activeDrawMode) {
      (map as any).pm.disableDraw();
      return;
    }

    (map as any).pm.setGlobalOptions({
      templineStyle: { color: formColor, dashArray: '5, 5' },
      hintlineStyle: { color: formColor, dashArray: '5, 5' },
      pathOptions: { color: formColor, fillColor: formColor, fillOpacity: 0.35, weight: 4 },
    });

    if (activeDrawMode === 'marker') {
      (map as any).pm.enableDraw('Marker', { snappable: true });
    } else if (activeDrawMode === 'line') {
      (map as any).pm.enableDraw('Line', { snappable: true, allowSelfIntersection: true });
    } else if (activeDrawMode === 'polygon') {
      (map as any).pm.enableDraw('Polygon', { snappable: true, allowSelfIntersection: false });
    }
  }, [activeDrawMode, formColor, map]);

  return null;
}

export default function StandaloneStudioMap({
  activeDrawMode,
  formColor,
  onElementCreated,
  onDrawModeEnded,
  mostrarRedTransporte,
  elementosDibujados,
  selectedElementoIdx,
  onSelectElemento,
}: StandaloneStudioMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [baseLayer, setBaseLayer] = useState<any>(null);
  const [lineasDeFondo, setLineasDeFondo] = useState<any[]>([]);
  const drawnGroupRef = useRef<L.FeatureGroup | null>(null);

  // Cargar límite municipal
  useEffect(() => {
    async function loadBase() {
      try {
        const res = await fetch('/lanus-base.geojson');
        if (res.ok) {
          const data = await res.json();
          setBaseLayer(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadBase();
  }, []);

  // Cargar líneas de transporte de fondo cuando el usuario las prende
  useEffect(() => {
    if (mostrarRedTransporte && lineasDeFondo.length === 0) {
      fetch('/api/lineas-transporte')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setLineasDeFondo(data);
        })
        .catch(console.error);
    }
  }, [mostrarRedTransporte, lineasDeFondo.length]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <MapContainer
        center={lanusCenter}
        zoom={14}
        minZoom={12}
        preferCanvas={true}
        style={{ width: '100%', height: '100%' }}
        ref={(m) => { if (m) mapRef.current = m; }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          maxZoom={19}
          zIndex={0}
        />

        {baseLayer && (
          <GeoJSON
            data={baseLayer}
            style={{
              color: '#3B82F6',
              weight: 3,
              fillColor: '#3B82F6',
              fillOpacity: 0.04,
              dashArray: '10, 8',
            }}
            interactive={false}
          />
        )}

        {/* Líneas de colectivos de referencia de fondo */}
        {mostrarRedTransporte && lineasDeFondo.map((linea) => {
          if (!linea.datosGeo) return null;
          let parsed = null;
          try {
            parsed = typeof linea.datosGeo === 'string' ? JSON.parse(linea.datosGeo) : linea.datosGeo;
          } catch { return null; }
          return (
            <GeoJSON
              key={linea.id}
              data={parsed}
              style={{
                color: linea.color || '#64748b',
                weight: 2.5,
                opacity: 0.5,
              }}
              interactive={false}
            />
          );
        })}

        <GeomanController
          activeDrawMode={activeDrawMode}
          formColor={formColor}
          onElementCreated={onElementCreated}
          onDrawModeEnded={onDrawModeEnded}
        />

        <MapSearch />
      </MapContainer>
    </div>
  );
}
