'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import LanusMask from './LanusMask';
import {
  publicarPresencia, eliminarPresencia, escucharPresencia,
  publicarWaypoints, escucharWaypoints, limpiarWaypoints,
  getPresenceColor, type PresenceEntry,
} from '@/lib/rtdb';

const CENTER: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Routing controller ───────────────────────────────────────────────────────
function EditorController({ color, initialGeo, lineaId, onRouteChange, onWaypointsChange }: {
  color: string;
  initialGeo: any | null;
  lineaId: string | null;
  onRouteChange: (geojson: any | null) => void;
  onWaypointsChange: (wps: [number, number][]) => void;
}) {
  const map = useMap();
  const controlRef = useRef<any>(null);
  const existingLayerRef = useRef<any>(null);
  const collabLayerRef = useRef<any>(null);

  // Show saved trace as muted reference
  useEffect(() => {
    if (existingLayerRef.current) { map.removeLayer(existingLayerRef.current); existingLayerRef.current = null; }
    if (initialGeo) {
      const layer = L.geoJSON(initialGeo, { style: { color: '#94a3b8', weight: 4, dashArray: '6 4', opacity: 0.6 } }).addTo(map);
      existingLayerRef.current = layer;
      const b = layer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [50, 50] });
    }
  }, [initialGeo, map]);

  // Listen to other collaborators' waypoints and draw them
  useEffect(() => {
    if (!lineaId) return;
    const unsub = escucharWaypoints(lineaId, (wps) => {
      if (collabLayerRef.current) { map.removeLayer(collabLayerRef.current); collabLayerRef.current = null; }
      if (wps.length >= 2) {
        const latlngs = wps.map(([lat, lng]) => [lat, lng] as L.LatLngExpression);
        collabLayerRef.current = L.polyline(latlngs, { color: '#a78bfa', weight: 4, dashArray: '8 4', opacity: 0.7 })
          .addTo(map)
          .bindTooltip('Waypoints de otro editor', { sticky: true });
      }
    });
    return () => { unsub(); if (collabLayerRef.current) { map.removeLayer(collabLayerRef.current); } };
  }, [lineaId, map]);

  // Build routing control
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    if (!L.Routing) return;

    if (controlRef.current) { try { map.removeControl(controlRef.current); } catch (_) {} controlRef.current = null; }

    const originalWarn = console.warn;
    console.warn = (msg: any, ...a: any[]) => { if (typeof msg === 'string' && msg.includes('demo server')) return; originalWarn(msg, ...a); };

    // @ts-ignore
    const control = L.Routing.control({
      waypoints: [],
      routeWhileDragging: true,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: { styles: [{ color, opacity: 0.9, weight: 6 }], extendToWaypoints: true, missingRouteTolerance: 0 },
      // @ts-ignore
      router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving' }),
      show: false,
      addWaypoints: true,
      createMarker: (_i: number, wp: any) => L.marker(wp.latLng, { draggable: true }),
    } as any).addTo(map);

    setTimeout(() => { console.warn = originalWarn; }, 1500);

    const emitWaypoints = () => {
      const wps = control.getWaypoints().filter((w: any) => w.latLng);
      const coords: [number, number][] = wps.map((w: any) => [w.latLng.lat, w.latLng.lng]);
      onWaypointsChange(coords);
    };

    control.on('routesfound', (e: any) => {
      const route = e.routes?.[0];
      if (!route) return;
      onRouteChange({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.coordinates.map((c: any) => [c.lng, c.lat]) } });
      emitWaypoints();
    });
    control.on('waypointschanged', (e: any) => {
      const valid = (e.waypoints || []).filter((w: any) => w.latLng);
      if (valid.length === 0) onRouteChange(null);
      emitWaypoints();
    });

    const onClick = (e: any) => {
      const wps = control.getWaypoints().filter((w: any) => w.latLng);
      if (wps.length === 0) control.spliceWaypoints(0, 1, e.latlng);
      else if (wps.length === 1) control.spliceWaypoints(1, 1, e.latlng);
      else control.spliceWaypoints(wps.length, 0, e.latlng);
    };

    map.on('click', onClick);
    controlRef.current = control;
    return () => { map.off('click', onClick); try { map.removeControl(control); } catch (_) {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  // Clear via DOM event
  useEffect(() => {
    const handle = () => {
      if (!controlRef.current) return;
      controlRef.current.setWaypoints([]);
      onRouteChange(null);
      onWaypointsChange([]);
    };
    map.getContainer().addEventListener('linea-editor-clear', handle);
    return () => map.getContainer().removeEventListener('linea-editor-clear', handle);
  }, [map, onRouteChange, onWaypointsChange]);

  return null;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface LineaEditorMapProps {
  lineaId?: string;   // null = nueva línea
  color: string;
  initialGeo?: any;
  sessionId: string;
  userInfo: { uid: string; email: string; nombre: string };
  onSave: (geojson: any) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LineaEditorMap({
  lineaId, color, initialGeo, sessionId, userInfo, onSave, onCancel, isSaving,
}: LineaEditorMapProps) {
  const [pendingGeo, setPendingGeo] = useState<any | null>(null);
  const [collaborators, setCollaborators] = useState<(PresenceEntry & { sessionId: string })[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const myColor = getPresenceColor(userInfo.uid);
  const recurso = lineaId ? `linea:${lineaId}` : 'linea:nueva';

  // Publish own presence
  useEffect(() => {
    publicarPresencia(sessionId, { uid: userInfo.uid, email: userInfo.email, nombre: userInfo.nombre, recurso, color: myColor });
    const interval = setInterval(() => {
      publicarPresencia(sessionId, { uid: userInfo.uid, email: userInfo.email, nombre: userInfo.nombre, recurso, color: myColor });
    }, 15000); // heartbeat every 15s
    return () => { clearInterval(interval); eliminarPresencia(sessionId); };
  }, [sessionId, userInfo, recurso, myColor]);

  // Listen to all presence entries (exclude self, only same recurso)
  useEffect(() => {
    const unsub = escucharPresencia((entries) => {
      const others = entries.filter(e => e.sessionId !== sessionId && e.recurso === recurso);
      setCollaborators(others);
    });
    return unsub;
  }, [sessionId, recurso]);

  // Publish waypoints to RTDB as user edits
  const handleWaypointsChange = useCallback((wps: [number, number][]) => {
    if (lineaId) publicarWaypoints(lineaId, wps);
  }, [lineaId]);

  const handleClear = () => {
    containerRef.current?.querySelector('.leaflet-container')?.dispatchEvent(new CustomEvent('linea-editor-clear'));
    setPendingGeo(null);
  };

  const handleSave = () => {
    if (!pendingGeo) return;
    if (lineaId) limpiarWaypoints(lineaId);
    onSave(pendingGeo);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} ref={containerRef}>
      <MapContainer 
        center={CENTER} 
        zoom={13} 
        minZoom={12}
        maxBounds={[
          [-34.7505, -58.4519], // Sur-Oeste
          [-34.6537, -58.3284]  // Nor-Este
        ]}
        style={{ width: '100%', height: '100%' }} 
        zoomControl
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
        <LanusMask />
        <EditorController
          color={color}
          initialGeo={initialGeo ?? null}
          lineaId={lineaId ?? null}
          onRouteChange={setPendingGeo}
          onWaypointsChange={handleWaypointsChange}
        />
      </MapContainer>

      {/* Collaborator avatars */}
      {collaborators.length > 0 && (
        <div style={{
          position: 'absolute', top: '10px', right: '10px', zIndex: 1001,
          display: 'flex', gap: '6px', alignItems: 'center',
        }}>
          {collaborators.map(c => (
            <div key={c.sessionId} title={`${c.nombre} también está editando`} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: c.color, color: '#fff', fontWeight: 700,
              fontSize: '0.85rem', display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'default',
            }}>
              {c.nombre.charAt(0).toUpperCase()}
            </div>
          ))}
          <span style={{ color: '#fff', fontSize: '0.78rem', background: 'rgba(0,0,0,0.55)', padding: '3px 8px', borderRadius: '10px' }}>
            {collaborators.length === 1 ? `${collaborators[0].nombre} también editando` : `${collaborators.length} editando`}
          </span>
        </div>
      )}

      {/* Instruction banner */}
      <div style={{
        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(30,30,30,0.82)', color: '#fff', padding: '7px 18px',
        borderRadius: '20px', fontSize: '0.82rem', zIndex: 1000, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        {initialGeo ? 'Traza guardada en gris · Hacé clic para agregar waypoints' : 'Hacé clic en el mapa para agregar waypoints'}
        {collaborators.length > 0 && <span style={{ marginLeft: '8px', color: '#a78bfa' }}>· Waypoints en violeta = otro editor</span>}
      </div>

      {/* Action buttons */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000, display: 'flex', gap: '8px' }}>
        <button onClick={handleClear} style={btn('#6b7280')}>Limpiar waypoints</button>
        <button onClick={onCancel} style={btn('#ef4444')}>Cancelar</button>
        <button disabled={!pendingGeo || isSaving} onClick={handleSave} style={btn(pendingGeo ? '#10b981' : '#d1d5db', !pendingGeo)}>
          {isSaving ? 'Guardando…' : 'Guardar traza'}
        </button>
      </div>
    </div>
  );
}

const btn = (bg: string, disabled = false): React.CSSProperties => ({
  background: bg, color: disabled ? '#9ca3af' : '#fff', border: 'none',
  padding: '10px 18px', borderRadius: '8px', fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'background 0.2s',
});
