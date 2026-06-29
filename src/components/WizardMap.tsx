import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import MapSearch from './MapSearch';
import { MapPin, Flag, Octagon, X, Ruler, Clock, Trash2, Plus, Route, Wand2, ChevronRight, Pencil } from 'lucide-react';

const center: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ROUTE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2'];

function WizardMapController({ onComplete, initialGeo, initialWaypoints }: any) {
  const map = useMap();
  const [routingControl, setRoutingControl] = useState<any>(null);
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [waypoints, setWaypoints] = useState<any[]>([]);
  const [savedFeatures, setSavedFeatures] = useState<any[]>([]);
  const [isTracing, setIsTracing] = useState(false);
  const [routeName, setRouteName] = useState('Recorrido 1');
  const [aiText, setAiText] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editingFeatureIdx, setEditingFeatureIdx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pendingEditWaypointsRef = useRef<any[]>([]);

  useEffect(() => {
    if (initialGeo?.features && savedFeatures.length === 0) {
      setSavedFeatures(initialGeo.features);
      setRouteName(`Recorrido ${initialGeo.features.length + 1}`);
    } else if (initialGeo?.type === 'Feature' && savedFeatures.length === 0) {
      setSavedFeatures([initialGeo]);
      setRouteName('Recorrido 2');
    }
  }, [initialGeo]);

  useEffect(() => {
    [panelRef, overlayRef].forEach(r => {
      if (r.current) {
        L.DomEvent.disableClickPropagation(r.current);
        L.DomEvent.disableScrollPropagation(r.current);
      }
    });
  }, [waypoints.length, currentRoute, savedFeatures.length, isTracing, aiText, isGeneratingAI]);

  useEffect(() => {
    if (initialGeo) {
      try {
        const bounds = L.geoJSON(initialGeo).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
      } catch {}
    }
  }, [initialGeo, map]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // @ts-ignore
    if (!L.Routing) return;

    if (!isTracing) {
      if (routingControl) {
        map.removeControl(routingControl);
        setRoutingControl(null);
        setCurrentRoute(null);
        setWaypoints([]);
      }
      return;
    }

    const originalWarn = console.warn;
    console.warn = function (msg) {
      if (typeof msg === 'string' && msg.includes("You are using OSRM's demo server")) return;
      originalWarn.apply(console, arguments as any);
    };

    const color = ROUTE_COLORS[savedFeatures.length % ROUTE_COLORS.length];

    // @ts-ignore
    const control = L.Routing.control({
      waypoints: [],
      routeWhileDragging: true,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: {
        styles: [{ color, opacity: 0.85, weight: 5 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      // @ts-ignore
      router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving' }),
      show: false,
      addWaypoints: true,
      createMarker: (_i: number, wp: any) => L.marker(wp.latLng, { draggable: true }),
    } as any).addTo(map);

    const startWps = pendingEditWaypointsRef.current.length > 0
      ? pendingEditWaypointsRef.current
      : (initialWaypoints ?? []);
    if (startWps.length > 0) control.setWaypoints(startWps);
    pendingEditWaypointsRef.current = [];

    setTimeout(() => { console.warn = originalWarn; }, 1000);

    control.on('routesfound', (e: any) => {
      if (e.routes?.length > 0) setCurrentRoute(e.routes[0]);
    });

    control.on('waypointschanged', async (e: any) => {
      const valid = (e.waypoints ?? control.getWaypoints()).filter((w: any) => w.latLng);
      setWaypoints([...valid]);
      const enhanced = await Promise.all(valid.map(async (wp: any) => {
        if (!wp.name && wp.latLng) {
          try {
            const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${wp.latLng.lng},${wp.latLng.lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=address,poi`);
            const data = await res.json();
            if (data.features?.length > 0) return { ...wp, name: data.features[0].text };
          } catch {}
        }
        return wp;
      }));
      setWaypoints(enhanced);
    });

    setRoutingControl(control);

    let lastClick = 0;
    const onMapClick = (e: any) => {
      const now = Date.now();
      if (now - lastClick < 400) return;
      lastClick = now;
      const wps = control.getWaypoints().filter((w: any) => w.latLng);
      if (wps.length === 0) control.spliceWaypoints(0, 1, e.latlng);
      else if (wps.length === 1) control.spliceWaypoints(1, 1, e.latlng);
      else control.spliceWaypoints(wps.length, 0, e.latlng);
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
      try { map.removeControl(control); } catch {}
    };
  }, [map, isTracing]);

  const handleAITrace = async () => {
    if (!aiText.trim()) return;
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const res = await fetch('/api/parse-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, index: savedFeatures.length, description: routeName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al trazar con IA');
      setSavedFeatures(prev => [...prev, data.feature]);
      setRouteName(`Recorrido ${savedFeatures.length + 2}`);
      setAiText('');
      const layer = L.geoJSON(data.feature);
      map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    } catch (err: any) {
      setAiError(err.message || 'No se pudo trazar el recorrido.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const confirmCurrentTrace = () => {
    if (!currentRoute) {
      setAiError('Marcá al menos dos puntos en el mapa antes de guardar.');
      return;
    }
    const coordinates = currentRoute.coordinates.map((c: any) => [c.lng, c.lat]);
    const streets = Array.from(new Set(
      (currentRoute.instructions || []).map((i: any) => i.road).filter(Boolean)
    )) as string[];
    const isEditing = editingFeatureIdx !== null;
    const color = isEditing
      ? (savedFeatures[editingFeatureIdx!]?.properties?.color || ROUTE_COLORS[editingFeatureIdx! % ROUTE_COLORS.length])
      : ROUTE_COLORS[savedFeatures.length % ROUTE_COLORS.length];
    const newFeature = {
      type: 'Feature',
      properties: { name: routeName, streets: streets.join(' - '), color, waypoints },
      geometry: { type: 'LineString', coordinates },
    };
    if (isEditing) {
      setSavedFeatures(prev => prev.map((f, i) => i === editingFeatureIdx ? newFeature : f));
      setEditingFeatureIdx(null);
    } else {
      setSavedFeatures(prev => [...prev, newFeature]);
      setRouteName(`Recorrido ${savedFeatures.length + 2}`);
    }
    setIsTracing(false);
  };

  const deleteFeature = (idx: number) => {
    setSavedFeatures(prev => prev.filter((_, i) => i !== idx));
  };

  const startEditFeature = (idx: number) => {
    const feature = savedFeatures[idx];
    if (!feature) return;
    // Extract up to 6 evenly-spaced waypoints from the geometry
    const coords: [number, number][] = feature.geometry?.coordinates ?? [];
    let wps: any[] = [];
    if (feature.properties?.waypoints?.length >= 2) {
      // Manual route: reuse stored waypoints
      wps = feature.properties.waypoints
        .filter((w: any) => w.latLng)
        .map((w: any) => L.latLng(w.latLng.lat, w.latLng.lng));
    } else if (coords.length >= 2) {
      // AI route: sample 6 points evenly from geometry
      const MAX_SAMPLE = 6;
      const step = Math.max(1, Math.floor(coords.length / (MAX_SAMPLE - 1)));
      const indices = Array.from({ length: MAX_SAMPLE - 1 }, (_, i) => Math.min(i * step, coords.length - 1));
      indices.push(coords.length - 1);
      const unique = [...new Set(indices)];
      wps = unique.map(i => L.latLng(coords[i][1], coords[i][0]));
    }
    if (wps.length < 2) return;
    pendingEditWaypointsRef.current = wps;
    setEditingFeatureIdx(idx);
    setRouteName(feature.properties?.name || `Recorrido ${idx + 1}`);
    setIsTracing(true);
  };

  const finishAll = () => {
    if (savedFeatures.length === 0) {
      setAiError('Necesitás al menos un recorrido guardado para continuar.');
      return;
    }
    onComplete({ type: 'FeatureCollection', features: savedFeatures }, savedFeatures.map(f => f.properties.streets || ''), []);
  };

  const km = currentRoute ? (currentRoute.summary.totalDistance / 1000).toFixed(1) : null;
  const min = currentRoute ? Math.round(currentRoute.summary.totalTime / 60) : null;

  return (
    <>
      {/* ── Panel izquierdo: waypoints activos ── */}
      {waypoints.length > 0 && (
        <div ref={panelRef} style={{
          position: 'absolute', top: 60, left: 10, zIndex: 1000,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 10, padding: '12px', width: 230,
          maxHeight: 360, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Puntos del recorrido
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {waypoints.map((wp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', padding: '6px 8px', borderRadius: 6, border: '1px solid #f3f4f6' }}>
                {i === 0
                  ? <MapPin size={13} color="#16a34a" />
                  : i === waypoints.length - 1
                    ? <Flag size={13} color="#2563eb" />
                    : <Octagon size={13} color="#d97706" />}
                <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {wp.name || (i === 0 ? 'Inicio' : i === waypoints.length - 1 ? 'Destino' : `Parada ${i}`)}
                </span>
                <button onClick={e => { e.stopPropagation(); routingControl.spliceWaypoints(i, 1); }}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
          {km && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ruler size={11} /> {km} km</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {min} min</span>
            </div>
          )}
        </div>
      )}

      {/* ── Panel derecho: mesa de trabajo ── */}
      <div ref={overlayRef} style={{
        position: 'absolute', top: 10, right: 10, zIndex: 1000,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: '14px', width: 270,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
          <Route size={15} color="#2563eb" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Recorridos</span>
          {savedFeatures.length > 0 && (
            <span style={{ marginLeft: 'auto', background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 9999, border: '1px solid #bfdbfe' }}>
              {savedFeatures.length}
            </span>
          )}
        </div>

        {/* Lista de trazos guardados */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {savedFeatures.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, textAlign: 'center', padding: '12px 0' }}>
              Aún no hay recorridos guardados.
            </p>
          ) : savedFeatures.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: editingFeatureIdx === i ? '#eff6ff' : '#f9fafb', borderRadius: 7, border: editingFeatureIdx === i ? '1px solid #bfdbfe' : '1px solid #f3f4f6' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.properties.color || '#2563eb', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: editingFeatureIdx === i ? '#1e40af' : '#374151', flex: 1 }}>{f.properties.name || `Recorrido ${i + 1}`}</span>
              {editingFeatureIdx !== i && (
                <button onClick={() => startEditFeature(i)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2, display: 'flex' }}
                  title="Editar recorrido">
                  <Pencil size={13} />
                </button>
              )}
              {editingFeatureIdx !== i && (
                <button onClick={() => deleteFeature(i)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 2, display: 'flex' }}
                  title="Eliminar">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Modo trazado activo */}
        {isTracing ? (
          <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 12px', border: '1px solid #bfdbfe' }}>
            <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{editingFeatureIdx !== null ? 'Editando: ' : 'Trazando: '}{routeName}</p>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: '#3b82f6' }}>{editingFeatureIdx !== null ? 'Arrastrá los puntos o hacé clic para agregar nuevos.' : 'Hacé clic en el mapa para agregar puntos.'}</p>
            {km && (
              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#3b82f6', display: 'flex', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Ruler size={11} /> {km} km</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {min} min</span>
              </p>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setIsTracing(false); setEditingFeatureIdx(null); }}
                style={{ flex: 1, padding: '7px', fontSize: 12, fontWeight: 600, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={confirmCurrentTrace}
                style={{ flex: 2, padding: '7px', fontSize: 12, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                Guardar trazo
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {/* Nombre del nuevo recorrido */}
            <input
              type="text"
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
              placeholder="Nombre del recorrido (Ej: Ida, Vuelta)"
              style={{ padding: '8px 10px', fontSize: 12, borderRadius: 7, border: '1px solid #d1d5db', outline: 'none', color: '#111827' }}
              onFocus={e => (e.target.style.borderColor = '#2563eb')}
              onBlur={e => (e.target.style.borderColor = '#d1d5db')}
            />
            {/* Dibujar manualmente */}
            <button onClick={() => setIsTracing(true)}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={14} strokeWidth={2.5} /> Dibujar en el mapa
            </button>

            {/* IA */}
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Wand2 size={12} color="#7c3aed" /> Trazar con IA
              </p>
              <textarea
                value={aiText}
                onChange={e => { setAiText(e.target.value); if (aiError) setAiError(null); }}
                placeholder="Escribí las calles del recorrido. Ej: Yrigoyen, 25 de Mayo, salida por Lanús Este..."
                style={{ width: '100%', height: 58, padding: '7px 9px', fontSize: 11, borderRadius: 6, border: '1px solid #d1d5db', resize: 'none', outline: 'none', color: '#374151', boxSizing: 'border-box' as const }}
              />
              <button
                onClick={handleAITrace}
                disabled={isGeneratingAI || !aiText.trim()}
                style={{ width: '100%', marginTop: 5, padding: '8px', fontSize: 12, fontWeight: 600, background: isGeneratingAI || !aiText.trim() ? '#e5e7eb' : '#7c3aed', color: isGeneratingAI || !aiText.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: 6, cursor: isGeneratingAI || !aiText.trim() ? 'not-allowed' : 'pointer' }}>
                {isGeneratingAI ? 'Procesando...' : 'Trazar automáticamente'}
              </button>
              {aiError && (
                <div style={{ marginTop: 6, padding: '7px 9px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, color: '#b91c1c', lineHeight: 1.4 }}>
                  {aiError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botón confirmar todo */}
        <button
          onClick={finishAll}
          style={{ marginTop: 12, background: savedFeatures.length === 0 ? '#f3f4f6' : '#111827', color: savedFeatures.length === 0 ? '#9ca3af' : '#fff', border: 'none', padding: '10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: savedFeatures.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          Confirmar recorridos <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Renderizar trazos guardados en el mapa ── */}
      {savedFeatures.map((f, i) => i === editingFeatureIdx ? null : (
        <GeoJSON
          key={`saved-${i}`}
          data={f}
          style={() => ({ color: f.properties.color || '#2563eb', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' })}
          onEachFeature={(feature, layer) => {
            if (feature.properties?.name) {
              layer.bindPopup(`
                <div style="font-family:system-ui,sans-serif;padding:4px 2px;min-width:140px">
                  <strong style="color:${feature.properties.color||'#2563eb'};font-size:13px;display:block;margin-bottom:3px">${feature.properties.name}</strong>
                  <span style="font-size:11px;color:#6b7280;line-height:1.5;display:block">${feature.properties.streets||''}</span>
                </div>
              `);
            }
          }}
        />
      ))}
    </>
  );
}

interface WizardMapProps {
  onComplete: (geoJson: any, streets: string[], waypoints: any[]) => void;
  initialGeo?: any;
  initialWaypoints?: any[];
}

export default function WizardMap({ onComplete, initialGeo, initialWaypoints }: WizardMapProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={14}
        minZoom={12}
        maxBounds={[[-34.7505, -58.4519], [-34.6537, -58.3284]]}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
          maxZoom={19}
        />
        <MapSearch />
        <WizardMapController onComplete={onComplete} initialGeo={initialGeo} initialWaypoints={initialWaypoints} />
      </MapContainer>
    </div>
  );
}
