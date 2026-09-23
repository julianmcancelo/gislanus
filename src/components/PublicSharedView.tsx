'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Sidebar from '@/components/Sidebar';
import MapSearch from '@/components/MapSearch';
import { renderToString } from 'react-dom/server';
import { MapPin, Plus, Minus, Home, Maximize, Printer, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building, Lock } from 'lucide-react';
import MapPrintAtlasModal from '@/components/MapPrintAtlasModal';

const lucideIconsList: any = { MapPin, School, Hospital, Bus, Car, AlertTriangle, Info, TreePine, Building };
const center: [number, number] = [-34.7042, -58.3961];

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const idaPalette = ['#2563eb', '#059669', '#0891b2', '#7c3aed', '#4f46e5', '#0284c7', '#16a34a'];
const vueltaPalette = ['#e11d48', '#ea580c', '#db2777', '#d97706', '#dc2626', '#c026d3', '#b91c1c'];

function stableTransitColor(seed: string, sentido: string = 'IDA', fallback: string = '#2563eb') {
  if (!seed) return fallback;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const palette = sentido.toUpperCase() === 'VUELTA' ? vueltaPalette : idaPalette;
  return palette[hash % palette.length];
}

export default function PublicSharedView({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [capasConfig, setCapasConfig] = useState<any[]>([]);
  const [cacheDatosGeo, setCacheDatosGeo] = useState<Record<string, any>>({});
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [activeTab, setActiveTab] = useState<'layers' | 'info' | 'reclamos' | null>('layers');
  const [baseLayer, setBaseLayer] = useState<any>(null);

  // Estados para contraer Header y Sidebar
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [atlasModalOpen, setAtlasModalOpen] = useState(false);
  const [atlasLineaNombre, setAtlasLineaNombre] = useState('');
  const [atlasCapasLinea, setAtlasCapasLinea] = useState<any[]>([]);

  useEffect(() => {
    const fetchSharedView = async () => {
      try {
        setLoading(true);
        // 1. Fetch metadata del enlace
        const resMeta = await fetch(`/api/compartir/${token}`);
        if (!resMeta.ok) {
          const errData = await resMeta.json();
          throw new Error(errData.error || 'Enlace no válido');
        }
        const metaData = await resMeta.json();
        setMeta(metaData);

        // 2. Fetch capa base
        try {
          const resBase = await fetch('/lanus-base.geojson');
          if (resBase.ok) {
            const baseGeo = await resBase.json();
            setBaseLayer(baseGeo);
          }
        } catch (e) {
          console.error('Error base layer:', e);
        }

        // 3. Fetch todas las capas y filtrar estrictamente por capasPermitidas
        const [resCapas, resRutas, resLineas, resTransportBase] = await Promise.all([
          fetch('/api/capas'),
          fetch('/api/rutas-transporte'),
          fetch('/api/lineas-transporte'),
          fetch('/transporte-lanus.geojson'),
        ]);

        const dataCapas = await resCapas.json();
        const dataRutas = await resRutas.json();
        const dataLineas = await resLineas.json();
        const dataTransportBase = resTransportBase.ok ? await resTransportBase.json() : { features: [] };

        const validCapas = Array.isArray(dataCapas) ? dataCapas : [];
        const validRutas = Array.isArray(dataRutas) ? dataRutas.filter((r: any) => r.activo !== false) : [];
        const validLineas = Array.isArray(dataLineas) ? dataLineas.filter((l: any) => l.activo !== false) : [];

        const CAT_LABELS: Record<string, string> = {
          NACIONAL: 'Líneas Nacionales',
          PROVINCIAL: 'Líneas Provinciales',
          MUNICIPAL: 'Líneas Municipales',
        };

        const formatedLineas = validLineas.map((l: any) => {
          const geo = typeof l.datosGeo === 'string' ? JSON.parse(l.datosGeo) : l.datosGeo;
          const cat = l.categoria || 'NACIONAL';
          const grupoNombre = CAT_LABELS[cat] || 'Líneas de Transporte';
          const lineaLabel = l.numero ? `Línea ${l.numero}` : l.nombre;
          let ramalLabel = l.subcategoria || null;
          let sentidoRaw = (l.sentido || '').toUpperCase();
          if (!ramalLabel || !sentidoRaw) {
            const firstFeature = geo?.type === 'Feature' ? geo : geo?.features?.[0];
            const fp = firstFeature?.properties || {};
            if (!ramalLabel) {
              if (fp.ramal) ramalLabel = `Ramal ${fp.ramal}`;
              else if (fp.subgrupo_detalle) ramalLabel = fp.subgrupo_detalle;
              else if (fp.subgrupo) ramalLabel = fp.subgrupo;
              else if (fp.ramal_nombre) ramalLabel = fp.ramal_nombre;
            }
            if (!sentidoRaw && fp.sentido) sentidoRaw = String(fp.sentido).toUpperCase();
          }
          const sentido = sentidoRaw;
          const lineColor = stableTransitColor(`${cat}-${lineaLabel}-${ramalLabel || ''}`, sentido, '#2563eb');
          const nombre = sentido
            ? sentido.charAt(0) + sentido.slice(1).toLowerCase().replace(/_/g, ' ')
            : lineaLabel;

          const lineaProps = {
            _tipo: 'linea',
            _linea: lineaLabel,
            _ramal: ramalLabel || null,
            _sentido: sentido || null,
            _operador: l.descripcion || null,
            _color: lineColor,
            sentido: sentido || null,
          };

          let geoConProps = geo;
          if (geo?.type === 'Feature') {
            geoConProps = { ...geo, properties: { ...geo.properties, ...lineaProps } };
          } else if (geo?.features) {
            geoConProps = { ...geo, features: geo.features.map((f: any) => ({ ...f, properties: { ...f.properties, ...lineaProps } })) };
          }

          return {
            id: `linea-${l.id}`,
            nombre,
            datosGeo: geoConProps,
            color: lineColor,
            visibilidad: 'PUBLIC',
            grupo: { nombre: grupoNombre },
            subGrupo: { nombre: lineaLabel },
            subSubGrupo: ramalLabel ? { nombre: ramalLabel } : null,
          };
        });

        const formatedRutas = validRutas.map((r: any, index: number) => {
          const hue = (index * 137.5) % 360;
          const colorUnico = `hsl(${hue}, 85%, 55%)`;
          const parsedGeo = typeof r.datosGeo === 'string' ? JSON.parse(r.datosGeo) : r.datosGeo;
          return {
            id: r.id,
            nombre: `#${r.numeroSolicitud} (${r.nombreSolicitante})`,
            datosGeo: parsedGeo,
            color: colorUnico,
            visibilidad: 'PUBLIC',
            grupo: { nombre: 'Solicitudes Transporte Pesado' },
            empresaSolicitante: r.empresaSolicitante || null,
            nombreSolicitante: r.nombreSolicitante,
            numeroSolicitud: r.numeroSolicitud,
          };
        });

        const formatedTransportBase = (Array.isArray(dataTransportBase?.features) ? dataTransportBase.features : []).map((feature: any, index: number) => {
          const props = feature?.properties || {};
          const red = props.network === 'PROVINCIAL' ? 'Provincial' : 'Municipal';
          const lineaLabel = `Línea ${props.line || 's/n'}`;
          const ramalLabel = `Ramal ${props.branch || 'Principal'}`;
          const sentido = String(props.direction || '').toUpperCase();
          const idPart = `${props.network}-${props.line}-${props.branch}-${sentido}-${index}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
          const lineColor = stableTransitColor(`${props.network || 'TRANSPORTE'}-${lineaLabel}-${ramalLabel}`, sentido, '#2563eb');

          const lineaProps = {
            ...props,
            _tipo: 'linea',
            _linea: lineaLabel,
            _ramal: ramalLabel,
            _sentido: sentido,
            _operador: props.operator || props.description || null,
            _color: lineColor,
            sentido: sentido,
          };

          return {
            id: `transporte-base-${idPart}`,
            nombre: sentido === 'VUELTA' ? 'Vuelta' : 'Ida',
            datosGeo: { ...feature, properties: lineaProps },
            color: lineColor,
            visibilidad: 'PUBLIC',
            grupo: { nombre: `Red ${red} de Transporte` },
            subGrupo: { nombre: lineaLabel },
            subSubGrupo: { nombre: ramalLabel },
          };
        });

        const allData = [...validCapas, ...formatedRutas, ...formatedLineas, ...formatedTransportBase];

        // FILTRADO ESTRICTO: Solo las capas permitidas explícitamente en el token
        const idsPermitidos = new Set(metaData.capasPermitidas || []);
        const capasConcedidas = allData
          .filter((c) => idsPermitidos.has(c.id))
          .map((c) => ({ ...c, active: true }));

        setCapasConfig(capasConcedidas);

        // Pre-cargar datosGeo en cache
        const cache: Record<string, any> = {};
        capasConcedidas.forEach((c) => {
          if (c.datosGeo) {
            cache[c.id] = typeof c.datosGeo === 'string' ? JSON.parse(c.datosGeo) : c.datosGeo;
          }
        });
        setCacheDatosGeo(cache);
      } catch (err: any) {
        setError(err.message || 'Error al cargar la vista pública');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedView();
  }, [token]);

  const fetchingRef = useRef<Record<string, boolean>>({});

  // Lazy loading para capas que no traen datosGeo de entrada
  useEffect(() => {
    capasConfig.forEach(async (capa) => {
      if (capa.active && !cacheDatosGeo[capa.id] && !capa.numeroSolicitud && !fetchingRef.current[capa.id]) {
        fetchingRef.current[capa.id] = true;
        try {
          const res = await fetch(`/api/capas/${capa.id}`);
          const data = await res.json();
          if (data.datosGeo) {
            let parsed = typeof data.datosGeo === 'string' ? JSON.parse(data.datosGeo) : data.datosGeo;
            setCacheDatosGeo((prev) => ({ ...prev, [capa.id]: parsed }));
          }
        } catch (e) {
          console.error('Error fetching lazy layer:', e);
        }
      }
    });
  }, [capasConfig, cacheDatosGeo]);

  // Encuadrar automáticamente el mapa sobre los elementos compartidos
  useEffect(() => {
    if (!mapInstance || Object.keys(cacheDatosGeo).length === 0) return;
    try {
      const bounds = L.latLngBounds([]);
      Object.values(cacheDatosGeo).forEach((geo) => {
        if (!geo) return;
        const layer = L.geoJSON(geo);
        const b = layer.getBounds();
        if (b.isValid()) bounds.extend(b);
      });
      if (bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [40, 40] });
      }
    } catch (e) {
      console.error('Fit bounds error:', e);
    }
  }, [mapInstance, cacheDatosGeo]);

  const alternarCapa = (id: string) => {
    setCapasConfig((prev) => prev.map((l) => (l.id === id ? { ...l, active: !l.active } : l)));
  };

  const capaActiva = (id: string) => capasConfig.find((l) => l.id === id)?.active;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ width: 60, height: 60, background: '#2563eb', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '30px', animation: 'pulse 1.5s infinite' }}>G</div>
        <h3 style={{ marginTop: '20px', color: '#94a3b8', fontSize: '1rem', fontWeight: 600 }}>Cargando vista pública de Lanús GIS...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff', textAlign: 'center', padding: '20px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <Lock size={32} color="#f87171" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>Acceso Restringido</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '400px' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Header Institucional de Vista Pública - Collapsible */}
      {!headerCollapsed && (
        <header style={{ height: '54px', background: '#0f172a', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 2000, borderBottom: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 30, height: 30, background: '#2563eb', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>G</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc' }}>{meta?.titulo || 'Vista Compartida GIS'}</h1>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700 }}>LANÚS GOBIERNO • ACCESO PÚBLICO</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
              Menú Acotado ({capasConfig.length} capas)
            </div>
            <button
              onClick={() => setHeaderCollapsed(true)}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', borderRadius: '6px', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
              title="Ocultar encabezado para mayor mapa"
            >
              ▲ Ocultar Encabezado
            </button>
          </div>
        </header>
      )}

      {/* Botón flotante para restaurar Encabezado cuando está contraído */}
      {headerCollapsed && (
        <button
          onClick={() => setHeaderCollapsed(false)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '16px',
            zIndex: 2500,
            background: '#0f172a',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '20px',
            padding: '5px 12px',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          ▼ Mostrar Encabezado
        </button>
      )}

      {/* Main Container */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar contraíble */}
        {!sidebarCollapsed && (
          <Sidebar
            capas={capasConfig}
            alternarCapa={alternarCapa}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            reclamos={[]}
            loadingReclamos={false}
            verReclamosCalor={false}
            setVerReclamosCalor={() => {}}
            verReclamosMarcadores={false}
            setVerReclamosMarcadores={() => {}}
            motivosSeleccionados={[]}
            setMotivosSeleccionados={() => {}}
            estadoFiltro="TODOS"
            setEstadoFiltro={() => {}}
            prioridadFiltro="TODAS"
            setPrioridadFiltro={() => {}}
            recargarReclamos={() => {}}
            mapInstance={mapInstance}
            descargarCapas={() => {}}
            abrirImpresionAtlas={(nombre, capas) => {
              setAtlasLineaNombre(nombre);
              setAtlasCapasLinea(capas);
              setAtlasModalOpen(true);
            }}
          />
        )}

        {/* Botón flotante para contraer / expandir Sidebar */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            position: 'absolute',
            bottom: '24px',
            left: sidebarCollapsed ? '16px' : activeTab ? '356px' : '64px',
            zIndex: 2500,
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            transition: 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
        >
          {sidebarCollapsed ? '▶ Ver Menú' : '◀ Ocultar Menú'}
        </button>

        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={center} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false} ref={setMapInstance}>
            <TileLayer attribution='&copy; Mapbox &copy; OpenStreetMap' url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`} maxZoom={19} zIndex={0} />
            <MapSearch />

            {baseLayer && <GeoJSON data={baseLayer} style={{ color: '#3B82F6', weight: 4, fillColor: '#3B82F6', fillOpacity: 0.08, dashArray: '10, 8' }} interactive={false} />}

            {capasConfig.map((capa) => {
              if (!capaActiva(capa.id) || !cacheDatosGeo[capa.id]) return null;
              return (
                <GeoJSON
                  key={capa.id}
                  data={cacheDatosGeo[capa.id]}
                  style={(feature: any) => {
                    const properties = feature?.properties || {};
                    const isCollectiveLine = Boolean(
                      properties.network || properties._tipo === 'linea' || properties.sentido
                    );
                    const isReturn = String(
                      properties.direction || properties.sentido || properties._sentido || ''
                    ).toUpperCase() === 'VUELTA';
                    const routeColor = String(
                      properties.color_hex || properties.color || properties._color || capa.color
                    );
                    return {
                      color: routeColor,
                      weight: isCollectiveLine ? 2.5 : 4,
                      opacity: 0.9,
                      dashArray: isCollectiveLine && isReturn ? '7 8' : undefined,
                      lineCap: 'round',
                      lineJoin: 'round',
                    };
                  }}
                />
              );
            })}
          </MapContainer>
        </div>
      </div>

      <MapPrintAtlasModal isOpen={atlasModalOpen} onClose={() => setAtlasModalOpen(false)} lineaNombre={atlasLineaNombre} capasLinea={atlasCapasLinea} cacheDatosGeo={cacheDatosGeo} mapInstance={mapInstance} />
    </div>
  );
}

