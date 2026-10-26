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
  onInspectElemento?: (el: any) => void;
}

// Subcomponente que renderiza en el mapa todos los elementos dibujados o importados
function DrawnElementsRenderer({
  elementosDibujados,
  selectedElementoIdx,
  onSelectElemento,
  onInspectElemento,
}: {
  elementosDibujados: any[];
  selectedElementoIdx: number | null;
  onSelectElemento: (idx: number) => void;
  onInspectElemento?: (el: any) => void;
}) {
  const map = useMap();
  const layerGroupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = new L.FeatureGroup().addTo(map);
    }
    const group = layerGroupRef.current;
    group.clearLayers();

    elementosDibujados.forEach((el, idx) => {
      if (!el.geo) return;
      if (el.visible === false) return; // Si fue destildado, no se renderiza en el mapa
      const isSelected = selectedElementoIdx === idx;
      const color = el.color || '#ea580c';

      try {
        const geoLayer = L.geoJSON(el.geo, {
          pointToLayer: (_geoJsonPoint, latlng) => {
            // Icono de marcador visual estilizado
            const iconHtml = `
              <div style="
                background: ${color};
                width: ${isSelected ? '32px' : '26px'};
                height: ${isSelected ? '32px' : '26px'};
                border-radius: 50%;
                border: 2px solid #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                font-size: ${isSelected ? '14px' : '11px'};
                font-weight: 800;
                cursor: pointer;
                transition: transform 0.15s ease;
              ">
                🚧
              </div>
            `;
            const customIcon = L.divIcon({
              html: iconHtml,
              className: 'custom-studio-marker',
              iconSize: [isSelected ? 32 : 26, isSelected ? 32 : 26],
              iconAnchor: [isSelected ? 16 : 13, isSelected ? 16 : 13],
            });
            return L.marker(latlng, { icon: customIcon });
          },
          style: () => ({
            color: color,
            weight: isSelected ? 7 : 5,
            opacity: 0.9,
            fillColor: color,
            fillOpacity: 0.35,
          }),
        });

        geoLayer.on('click', () => {
          onSelectElemento(idx);
          if (onInspectElemento) {
            onInspectElemento(el);
          }
        });

        // Popup con datos de la obra
        const p = el.geo.properties || {};
        const popupContent = `
          <div style="font-family: Inter, sans-serif; min-width: 200px;">
            <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
              ${el.nombre || 'Obra / Intervención'}
            </div>
            ${p.empresa ? `<div style="font-size: 11px; font-weight: 700; color: ${color};">Empresa: ${p.empresa}</div>` : ''}
            ${p.zona ? `<div style="font-size: 11px; color: #475569;">${p.zona} · ${p.tipoMaterial || ''}</div>` : ''}
            ${el.descripcion ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;">${el.descripcion}</div>` : ''}
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: flex-end;">
              <span style="font-size: 10px; font-weight: 800; color: #2563eb; cursor: pointer;">
                🔍 Ver líneas afectadas &rarr;
              </span>
            </div>
          </div>
        `;
        geoLayer.bindPopup(popupContent);

        group.addLayer(geoLayer);
      } catch (err) {
        console.error('Error dibujando elemento en mapa:', err);
      }
    });

    // Si se acaban de importar elementos, ajustar la vista del mapa a ellos
    if (elementosDibujados.length > 0 && group.getLayers().length > 0) {
      try {
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      } catch {}
    }
  }, [elementosDibujados, selectedElementoIdx, map, onSelectElemento, onInspectElemento]);

  return null;
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
  onInspectElemento,
}: StandaloneStudioMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [baseLayer, setBaseLayer] = useState<any>(null);
  const [lineasDeFondo, setLineasDeFondo] = useState<any[]>([]);

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

        {/* Renderizado de elementos dibujados e importados por IA */}
        <DrawnElementsRenderer
          elementosDibujados={elementosDibujados}
          selectedElementoIdx={selectedElementoIdx}
          onSelectElemento={onSelectElemento}
          onInspectElemento={onInspectElemento}
        />

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
