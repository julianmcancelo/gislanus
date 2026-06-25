'use client';
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';

const CENTER: [number, number] = [-34.7042, -58.3961];

// Patch default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ------------------------------------------------------------------
// Inner controller – lives inside MapContainer so it can useMap()
// ------------------------------------------------------------------
function EditorController({ color, initialGeo, onRouteChange }: {
  color: string;
  initialGeo: any | null;
  onRouteChange: (geojson: any | null) => void;
}) {
  const map = useMap();
  const controlRef = useRef<any>(null);
  const existingLayerRef = useRef<any>(null);

  // Draw the existing/saved trace in muted style so user can see it as reference
  useEffect(() => {
    if (existingLayerRef.current) {
      map.removeLayer(existingLayerRef.current);
      existingLayerRef.current = null;
    }
    if (initialGeo) {
      const layer = L.geoJSON(initialGeo, {
        style: { color: '#94a3b8', weight: 4, dashArray: '6 4', opacity: 0.7 },
      }).addTo(map);
      existingLayerRef.current = layer;
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [initialGeo, map]);

  // Build / rebuild routing control when color changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    if (!L.Routing) return;

    // Remove old control
    if (controlRef.current) {
      try { map.removeControl(controlRef.current); } catch (_) {}
      controlRef.current = null;
    }

    const originalWarn = console.warn;
    console.warn = (msg: any, ...args: any[]) => {
      if (typeof msg === 'string' && msg.includes("demo server")) return;
      originalWarn(msg, ...args);
    };

    // @ts-ignore
    const control = L.Routing.control({
      waypoints: [],
      routeWhileDragging: true,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: {
        styles: [{ color, opacity: 0.9, weight: 6 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      // @ts-ignore
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
      show: false,
      addWaypoints: true,
      createMarker: (_i: number, wp: any) =>
        L.marker(wp.latLng, { draggable: true }),
    } as any).addTo(map);

    setTimeout(() => { console.warn = originalWarn; }, 1500);

    control.on('routesfound', (e: any) => {
      const route = e.routes?.[0];
      if (!route) return;
      const coords = route.coordinates.map((c: any) => [c.lng, c.lat]);
      onRouteChange({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      });
    });

    control.on('waypointschanged', (e: any) => {
      const valid = (e.waypoints || []).filter((w: any) => w.latLng);
      if (valid.length === 0) onRouteChange(null);
    });

    const onClick = (e: any) => {
      const wps = control.getWaypoints().filter((w: any) => w.latLng);
      if (wps.length === 0) {
        control.spliceWaypoints(0, 1, e.latlng);
      } else if (wps.length === 1) {
        control.spliceWaypoints(1, 1, e.latlng);
      } else {
        control.spliceWaypoints(wps.length, 0, e.latlng);
      }
    };

    map.on('click', onClick);
    controlRef.current = control;

    return () => {
      map.off('click', onClick);
      try { map.removeControl(control); } catch (_) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  // Expose clear method through a DOM event so parent can call it
  useEffect(() => {
    const handle = () => {
      if (!controlRef.current) return;
      const wps = controlRef.current.getWaypoints();
      wps.forEach((_: any, i: number) => {
        try { controlRef.current.spliceWaypoints(i, 1); } catch (_) {}
      });
      controlRef.current.setWaypoints([]);
      onRouteChange(null);
    };
    map.getContainer().addEventListener('linea-editor-clear', handle);
    return () => map.getContainer().removeEventListener('linea-editor-clear', handle);
  }, [map, onRouteChange]);

  return null;
}

// ------------------------------------------------------------------
// Public component
// ------------------------------------------------------------------
interface LineaEditorMapProps {
  color: string;
  initialGeo?: any;
  onSave: (geojson: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function LineaEditorMap({ color, initialGeo, onSave, onCancel, isSaving }: LineaEditorMapProps) {
  const [pendingGeo, setPendingGeo] = useState<any | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClear = () => {
    containerRef.current
      ?.querySelector('.leaflet-container')
      ?.dispatchEvent(new CustomEvent('linea-editor-clear'));
    setPendingGeo(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} ref={containerRef}>
      <MapContainer
        center={CENTER}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <EditorController
          color={color}
          initialGeo={initialGeo ?? null}
          onRouteChange={setPendingGeo}
        />
      </MapContainer>

      {/* Instruction banner */}
      <div style={{
        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(30,30,30,0.82)', color: '#fff', padding: '7px 18px',
        borderRadius: '20px', fontSize: '0.82rem', zIndex: 1000, pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        {initialGeo
          ? 'Traza guardada en gris · Hacé clic para agregar waypoints y crear nueva ruta'
          : 'Hacé clic en el mapa para agregar waypoints · La ruta se calcula automáticamente'}
      </div>

      {/* Action buttons */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000,
        display: 'flex', gap: '8px',
      }}>
        <button
          onClick={handleClear}
          style={{
            background: '#6b7280', color: '#fff', border: 'none',
            padding: '10px 18px', borderRadius: '8px', fontWeight: 600,
            cursor: 'pointer', fontSize: '0.9rem',
          }}
        >
          Limpiar waypoints
        </button>
        <button
          onClick={onCancel}
          style={{
            background: '#ef4444', color: '#fff', border: 'none',
            padding: '10px 18px', borderRadius: '8px', fontWeight: 600,
            cursor: 'pointer', fontSize: '0.9rem',
          }}
        >
          Cancelar
        </button>
        <button
          disabled={!pendingGeo || isSaving}
          onClick={() => pendingGeo && onSave(pendingGeo)}
          style={{
            background: pendingGeo ? '#10b981' : '#d1d5db',
            color: pendingGeo ? '#fff' : '#9ca3af',
            border: 'none', padding: '10px 22px', borderRadius: '8px',
            fontWeight: 700, cursor: pendingGeo ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem', transition: 'background 0.2s',
          }}
        >
          {isSaving ? 'Guardando…' : 'Guardar traza'}
        </button>
      </div>
    </div>
  );
}
