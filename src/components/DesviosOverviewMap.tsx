'use client';
import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bus, MapPin, Printer, Navigation } from 'lucide-react';

const lanusCenter: [number, number] = [-34.7042, -58.3961];

// Helper para crear pines con color y emoji según tipo / empresa
function createCustomPin(color: string, emoji: string, isSelected: boolean = false) {
  const size = isSelected ? 42 : 32;
  return L.divIcon({
    className: 'custom-overview-marker',
    html: `
      <div style="
        background: ${color};
        color: white;
        border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'};
        box-shadow: ${isSelected ? '0 0 0 4px #2563eb, 0 8px 24px rgba(0,0,0,0.35)' : '0 4px 12px rgba(0,0,0,0.25)'};
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '20px' : '15px'};
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
      ">
        ${emoji}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function MapViewController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom || 16, { duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

interface DesviosOverviewMapProps {
  intervenciones: any[];
  selectedId: string | null;
  onSelectIntervencion: (item: any) => void;
  onOpenFicha: (item: any) => void;
}

export default function DesviosOverviewMap({
  intervenciones,
  selectedId,
  onSelectIntervencion,
  onOpenFicha,
}: DesviosOverviewMapProps) {
  // Extraer coordenadas seguras para cada intervención
  const markers = useMemo(() => {
    return intervenciones
      .map((item) => {
        let lat: number | null = null;
        let lng: number | null = null;
        let coords: [number, number] | null = null;

        if (item.datosGeo) {
          const geo = typeof item.datosGeo === 'string' ? JSON.parse(item.datosGeo) : item.datosGeo;
          if (geo?.geometry?.coordinates && Array.isArray(geo.geometry.coordinates)) {
            lng = geo.geometry.coordinates[0];
            lat = geo.geometry.coordinates[1];
          } else if (geo?.coordinates && Array.isArray(geo.coordinates)) {
            lng = geo.coordinates[0];
            lat = geo.coordinates[1];
          }
        }

        if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return null;
        coords = [lat, lng];

        // Determinar color y emoji según estado o empresa
        let color = '#2563eb';
        let emoji = '🚧';
        const estado = item.estado || 'PLANIFICADO';

        if (estado === 'EN_CURSO') {
          color = '#16a34a'; // Verde
          emoji = '🚧';
        } else if (estado === 'FINALIZADO') {
          color = '#64748b'; // Gris
          emoji = '✅';
        } else if (estado === 'PLANIFICADO') {
          color = '#ea580c'; // Naranja
          emoji = '⚠️';
        }

        // Si tiene asignada empresa específica en el título o área
        const texto = `${item.titulo || ''} ${item.areaResponsable || ''}`.toUpperCase();
        if (texto.includes('LÁZARO') || texto.includes('LAZARO')) {
          color = estado === 'FINALIZADO' ? '#64748b' : '#d97706'; // Ambar
        } else if (texto.includes('KAVOS')) {
          color = estado === 'FINALIZADO' ? '#64748b' : '#7c3aed'; // Violeta
        } else if (texto.includes('USIMIX')) {
          color = estado === 'FINALIZADO' ? '#64748b' : '#0891b2'; // Cyan
        }

        const isSelected = item.id === selectedId;

        // Desvíos con líneas de colectivos
        const desviosLines: any[] = [];
        if (Array.isArray(item.desvios)) {
          item.desvios.forEach((d: any) => {
            if (d.datosGeoDesvio) {
              const dGeo = typeof d.datosGeoDesvio === 'string' ? JSON.parse(d.datosGeoDesvio) : d.datosGeoDesvio;
              if (dGeo?.coordinates && Array.isArray(dGeo.coordinates)) {
                // Invertir [lng, lat] a [lat, lng]
                const poly = dGeo.coordinates.map((c: any) => [c[1], c[0]]);
                if (poly.length > 1) {
                  desviosLines.push({
                    lineaNumero: d.lineaNumero,
                    ramal: d.ramal,
                    poly,
                  });
                }
              }
            }
          });
        }

        return {
          id: item.id,
          coords,
          color,
          emoji,
          isSelected,
          item,
          desviosLines,
        };
      })
      .filter(Boolean) as {
        id: string;
        coords: [number, number];
        color: string;
        emoji: string;
        isSelected: boolean;
        item: any;
        desviosLines: any[];
      }[];
  }, [intervenciones, selectedId]);

  // Centro seleccionado para hacer flyTo
  const targetCenter = useMemo<[number, number] | null>(() => {
    if (!selectedId) return null;
    const found = markers.find((m) => m.id === selectedId);
    return found ? found.coords : null;
  }, [selectedId, markers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer
        center={targetCenter || lanusCenter}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewController center={targetCenter} zoom={16} />

        {/* Marcadores de cortes */}
        {markers.map((m) => {
          const icon = createCustomPin(m.color, m.emoji, m.isSelected);
          return (
            <React.Fragment key={m.id}>
              {/* Radio de corte si está seleccionado */}
              {m.isSelected && (
                <Circle
                  center={m.coords}
                  radius={75}
                  pathOptions={{
                    color: '#ef4444',
                    fillColor: '#ef4444',
                    fillOpacity: 0.25,
                    weight: 2,
                    dashArray: '4 4',
                  }}
                />
              )}

              {/* Traza de desvío proyectada en mapa si está seleccionado */}
              {m.isSelected &&
                m.desviosLines.map((dl, idx) => (
                  <Polyline
                    key={`desvio-poly-${idx}`}
                    positions={dl.poly}
                    pathOptions={{
                      color: '#10b981',
                      weight: 5,
                      dashArray: '8 6',
                    }}
                  />
                ))}

              <Marker
                position={m.coords}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectIntervencion(m.item),
                }}
              >
                <Popup className="custom-overview-popup">
                  <div style={{ minWidth: '220px', padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: m.color, background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {m.item.codigo || 'OBRA'}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>
                        {m.item.estado}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                      {m.item.titulo}
                    </h4>

                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b' }}>
                      📍 {m.item.callesAfectadas || 'Lanús'}
                    </p>

                    {m.item.areaResponsable && (
                      <div style={{ fontSize: '10px', color: '#475569', marginBottom: '8px', background: '#f8fafc', padding: '4px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <strong>Grupo:</strong> {m.item.areaResponsable}
                      </div>
                    )}

                    {m.item.desvios && m.item.desvios.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <Bus size={12} color="#2563eb" />
                          Líneas afectadas ({m.item.desvios.length}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {m.item.desvios.map((d: any, i: number) => (
                            <span key={i} style={{ background: '#1e293b', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 5px', borderRadius: '3px' }}>
                              L.{d.lineaNumero}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => onOpenFicha(m.item)}
                      style={{
                        width: '100%',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Printer size={12} />
                      Ver Ficha Técnica
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Leyenda flotante de mapa */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        zIndex: 500,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        padding: '10px 14px',
        borderRadius: '10px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
        fontSize: '11px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>Referencias Mapa:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
          <span>En Curso (Ejecución)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ea580c', display: 'inline-block' }}></span>
          <span>Planificado / Pendiente</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', display: 'inline-block' }}></span>
          <span>Finalizado / Reabierto</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 14, height: 3, background: '#10b981', display: 'inline-block' }}></span>
          <span>Desvío de Colectivo</span>
        </div>
      </div>
    </div>
  );
}
