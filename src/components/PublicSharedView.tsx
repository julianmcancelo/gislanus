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

const transitPalette = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];
function stableTransitColor(value: string, fallback: string) {
  if (!value) return fallback;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return transitPalette[hash % transitPalette.length];
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
          const ramalLabel = l.subcategoria || null;
          const lineColor = stableTransitColor(`${cat}-${lineaLabel}`, '#2563eb');
          return {
            id: `linea-${l.id}`,
            nombre: lineaLabel,
            datosGeo: geo,
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
          const idPart = `${props.network}-${props.line}-${props.branch}-${index}`.replace(/[^a-zA-Z0-9_-]+/g, '-');
          const lineColor = stableTransitColor(`${props.network || 'TRANSPORTE'}-${lineaLabel}`, '#2563eb');
          return {
            id: `transporte-base-${idPart}`,
            nombre: ramalLabel,
            datosGeo: feature,
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Header Institucional de Vista Pública */}
      <header style={{ height: '60px', background: '#0f172a', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 2000, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 34, height: 34, background: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>G</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>{meta?.titulo || 'Vista Compartida GIS'}</h1>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>LANÚS GOBIERNO • ACCESO ACCESIBLE PÚBLICO</p>
          </div>
        </div>

        <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          🔒 Menú Acotado ({capasConfig.length} capas)
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
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
                  style={(feature: any) => ({
                    color: capa.color || '#2563eb',
                    weight: 3.5,
                    opacity: 0.9,
                  })}
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
