'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Smartphone, MapPin, Bus, Route, ArrowLeft, Download, Upload, Plus, Trash2,
  RefreshCw, CheckCircle2, AlertTriangle, Clock, Gauge, Navigation, Share2,
  SlidersHorizontal, Search, Eye, Sparkles, Shield, ChevronRight, Layers,
  ExternalLink, QrCode, FileText, Check, HelpCircle, Edit3, Sliders, FileCode, X
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';
import JSZip from 'jszip';
import GpsTraceEditorModal from '@/components/GpsTraceEditorModal';
import {
  downloadGeoJson,
  downloadGpx,
  downloadKml,
  downloadAllRelevamientosGeoJson
} from '@/utils/exportGps';

const StaticMapPreview = dynamic(() => import('@/components/StaticMapPreview'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b' }}>
      <RefreshCw className="animate-spin" size={32} color="#0284c7" />
      <span style={{ marginTop: 12, fontSize: '0.85rem', fontWeight: 600 }}>Cargando visor cartográfico unificado...</span>
    </div>
  ),
});

export default function BitacoraGPSPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [relevamientos, setRelevamientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalRelevamientos: 0,
    totalKm: '0.0',
    totalParadas: 0,
    totalIncidencias: 0,
    velocidadPromedioKmh: '0.0',
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sentidoFilter, setSentidoFilter] = useState<'TODOS' | 'IDA' | 'VUELTA'>('TODOS');
  const [activeBottomTab, setActiveBottomTab] = useState<'resumen' | 'paradas' | 'incidencias'>('resumen');

  // Modals
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedServerMode, setSelectedServerMode] = useState<'wifi' | 'emulator' | 'origin'>('wifi');
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any | null>(null);
  const [exportModalTrip, setExportModalTrip] = useState<any | null>(null);

  // Promotion form state
  const [promoteNombre, setPromoteNombre] = useState('');
  const [promoteNumero, setPromoteNumero] = useState('');
  const [promoteRamal, setPromoteRamal] = useState('');
  const [promoteSentido, setPromoteSentido] = useState('IDA');
  const [promoteCategoria, setPromoteCategoria] = useState('MUNICIPAL');
  const [promoteColor, setPromoteColor] = useState('#0284c7');
  const [promoteClipLanus, setPromoteClipLanus] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch surveys
  const fetchRelevamientos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bitacora-gps');
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setRelevamientos(items);
        if (data.stats) setStats(data.stats);
        if (items.length > 0 && !selectedId) {
          setSelectedId(items[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching relevamientos:', e);
      toast.error('No se pudieron cargar los relevamientos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelevamientos();
  }, []);

  // Filtered surveys
  const filteredRelevamientos = useMemo(() => {
    return relevamientos.filter(r => {
      if (sentidoFilter !== 'TODOS' && r.sentido !== sentidoFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (r.lineaNumero && r.lineaNumero.toLowerCase().includes(term)) ||
        (r.ramal && r.ramal.toLowerCase().includes(term)) ||
        (r.chofer && r.chofer.toLowerCase().includes(term)) ||
        (r.interno && r.interno.toLowerCase().includes(term)) ||
        (r.patente && r.patente.toLowerCase().includes(term))
      );
    });
  }, [relevamientos, searchTerm, sentidoFilter]);

  const selectedTrip = useMemo(() => {
    return relevamientos.find(r => r.id === selectedId) || null;
  }, [relevamientos, selectedId]);

  // Parsed GeoJSON of selected trip
  const selectedGeo = useMemo(() => {
    if (!selectedTrip?.datosGeo) return null;
    try {
      return typeof selectedTrip.datosGeo === 'string'
        ? JSON.parse(selectedTrip.datosGeo)
        : selectedTrip.datosGeo;
    } catch {
      return null;
    }
  }, [selectedTrip]);

  // Stops and incidents list
  const { stopsList, incidentsList } = useMemo(() => {
    if (!selectedGeo?.features) return { stopsList: [], incidentsList: [] };
    const stops = selectedGeo.features.filter((f: any) => f.properties?.type === 'stop');
    const incidents = selectedGeo.features.filter((f: any) => f.properties?.type === 'incident');
    return { stopsList: stops, incidentsList: incidents };
  }, [selectedGeo]);

  // Delete survey
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('¿Eliminar este relevamiento GPS?')) return;
    try {
      const res = await fetch(`/api/bitacora-gps/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Relevamiento eliminado');
        setRelevamientos(prev => prev.filter(r => r.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
        }
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // Open promotion modal
  const openPromote = (trip: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const num = trip.lineaNumero || '523';
    const ram = trip.ramal || 'Ramal A';
    const sent = trip.sentido || 'IDA';
    setPromoteNumero(num);
    setPromoteRamal(ram);
    setPromoteSentido(sent);
    setPromoteNombre(`Línea ${num} - ${ram} (${sent})`);
    setPromoteCategoria(['520', '521', '522', '523', '524', '526', '527'].includes(num) ? 'MUNICIPAL' : 'PROVINCIAL');
    setPromoteColor(sent === 'VUELTA' ? '#8b5cf6' : '#0284c7');
    setPromoteClipLanus(true);
    setShowPromoteModal(true);
  };

  // Promote to official LineaTransporte
  const handleConfirmPromote = async () => {
    if (!selectedTrip) return;
    setIsPromoting(true);
    try {
      const res = await fetch(`/api/bitacora-gps/${selectedTrip.id}/convertir-linea`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: promoteNombre,
          numero: promoteNumero,
          subcategoria: promoteRamal,
          sentido: promoteSentido,
          categoria: promoteCategoria,
          color: promoteColor,
          clipToLanus: promoteClipLanus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al promover');

      toast.success(data.message || 'Línea creada en la Red Oficial');
      setShowPromoteModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al promover a línea oficial');
    } finally {
      setIsPromoting(false);
    }
  };

  // Download GeoJSON
  const handleDownloadGeoJson = (trip: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const dataStr = typeof trip.datosGeo === 'string' ? trip.datosGeo : JSON.stringify(trip.datosGeo, null, 2);
      const blob = new Blob([dataStr], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relevamiento_linea_${trip.lineaNumero || 'gps'}_${trip.sentido || 'ida'}_${trip.id}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Archivo GeoJSON descargado');
    } catch {
      toast.error('Error al exportar');
    }
  };

  // Handle file upload (.geojson, .json, .zip)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading(`Procesando ${file.name}...`);

    try {
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.zip')) {
        // Unpack BusTrackerGPS ZIP package
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);

        let geojsonStr = '';
        let metadataObj: any = {};

        // Look for track.geojson or *.geojson
        const geojsonFile = zipContent.file('track.geojson') || Object.values(zipContent.files).find(f => f.name.endsWith('.geojson'));
        if (geojsonFile) {
          geojsonStr = await geojsonFile.async('text');
        }

        // Look for metadata.json
        const metaFile = zipContent.file('metadata.json');
        if (metaFile) {
          try {
            metadataObj = JSON.parse(await metaFile.async('text'));
          } catch {}
        }

        if (!geojsonStr) {
          throw new Error('El archivo ZIP no contiene un track.geojson válido de Bitácora GPS');
        }

        const payload = {
          lineaNumero: metadataObj.line || metadataObj.linea,
          ramal: metadataObj.branch || metadataObj.ramal,
          sentido: metadataObj.direction || metadataObj.sentido,
          interno: metadataObj.internal,
          patente: metadataObj.domain,
          distanceMeters: metadataObj.distanceMeters,
          durationMs: metadataObj.durationMs,
          pointCount: metadataObj.pointCount,
          stopCount: metadataObj.stopCount,
          incidentCount: metadataObj.incidentCount,
          origen: 'IMPORTACION_ZIP',
          datosGeo: geojsonStr,
        };

        const res = await fetch('/api/bitacora-gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al guardar en el servidor');
        }

        toast.success('Paquete ZIP de Bitácora GPS importado con éxito', { id: toastId });
        fetchRelevamientos();
      } else {
        // Standard JSON / GeoJSON
        const text = await file.text();
        const parsed = JSON.parse(text);

        const res = await fetch('/api/bitacora-gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origen: 'IMPORTACION_GEOJSON',
            datosGeo: parsed,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al guardar en el servidor');
        }

        toast.success('Relevamiento GeoJSON importado exitosamente', { id: toastId });
        fetchRelevamientos();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error procesando el archivo', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const localWifiUrl = 'http://192.168.0.229:3000';
  const emulatorUrl = 'http://10.0.2.2:3000';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  
  const activeServerBase = customServerUrl.trim() 
    || (selectedServerMode === 'wifi' ? localWifiUrl : selectedServerMode === 'emulator' ? emulatorUrl : currentOrigin);
  const syncApiUrl = `${activeServerBase}/api/bitacora-gps`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      <Toaster position="top-right" />

      {/* TOP NAVBAR */}
      <header style={{
        background: 'linear-gradient(135deg, #091325 0%, #172a4d 100%)',
        color: '#fff',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        flexShrink: 0
      }}>
        {/* Left branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <ArrowLeft size={14} /> Volver
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
            }}>
              <Smartphone size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  Bitácora GPS
                </h1>
                <span style={{
                  background: 'rgba(56,189,248,0.15)',
                  border: '1px solid rgba(56,189,248,0.3)',
                  color: '#38bdf8',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Mobile Gateway
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>
                Relevamiento y telemetría de colectivos con BusTrackerGPS
              </p>
            </div>
          </div>
        </div>

        {/* Right action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".geojson,.json,.zip"
            style={{ display: 'none' }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(2,132,199,0.25)',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => { if (!isUploading) e.currentTarget.style.background = '#0369a1'; }}
            onMouseOut={e => { if (!isUploading) e.currentTarget.style.background = '#0284c7'; }}
          >
            {isUploading ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />}
            <span>Importar Relevamiento</span>
          </button>

          <button
            onClick={() => {
              try {
                downloadAllRelevamientosGeoJson(relevamientos);
                toast.success(`Descargando ${relevamientos.length} relevamientos en GeoJSON`);
              } catch (e: any) {
                toast.error(e.message || 'Error al exportar');
              }
            }}
            disabled={relevamientos.length === 0}
            style={{
              background: 'rgba(255,255,255,0.09)',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: relevamientos.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
            title="Descargar todos los recorridos registrados en un archivo GeoJSON unificado"
            onMouseOver={e => { if (relevamientos.length > 0) e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
            onMouseOut={e => { if (relevamientos.length > 0) e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
          >
            <Download size={14} color="#38bdf8" />
            <span>Descargar Todos ({relevamientos.length})</span>
          </button>

          <button
            onClick={() => setShowConnectModal(true)}
            style={{
              background: 'rgba(255,255,255,0.09)',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
          >
            <QrCode size={14} color="#38bdf8" />
            <span>Conectar App Móvil</span>
          </button>

          <button
            onClick={() => router.push('/transporte-publico')}
            style={{
              background: 'transparent',
              color: '#cbd5e1',
              border: 'none',
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseOver={e => e.currentTarget.style.color = '#fff'}
            onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}
          >
            <Bus size={14} />
            <span>Red de Colectivos</span>
          </button>
        </div>
      </header>

      {/* STATS STRIP */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Relevamientos Registrados:</span>
            <span style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 800 }}>{stats.totalRelevamientos}</span>
          </div>
          <div style={{ width: 1, height: 16, background: '#cbd5e1' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Km Relevados:</span>
            <span style={{ fontSize: '0.95rem', color: '#0284c7', fontWeight: 800 }}>{stats.totalKm} km</span>
          </div>
          <div style={{ width: 1, height: 16, background: '#cbd5e1' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Paradas Mapeadas:</span>
            <span style={{ fontSize: '0.95rem', color: '#10b981', fontWeight: 800 }}>{stats.totalParadas}</span>
          </div>
          <div style={{ width: 1, height: 16, background: '#cbd5e1' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Incidencias Detectadas:</span>
            <span style={{ fontSize: '0.95rem', color: '#f59e0b', fontWeight: 800 }}>{stats.totalIncidencias}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '3px 8px', borderRadius: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
            API Sync Online
          </span>
          <button
            onClick={fetchRelevamientos}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: '0.75rem',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Refrescar lista"
          >
            <RefreshCw size={12} /> Refrescar
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE: SPLIT VIEW */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* LEFT PANEL: TRIP LIST */}
        <div style={{
          width: 380,
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 10,
        }}>
          {/* Search and Filter */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
              <input
                type="text"
                placeholder="Buscar por línea, ramal, chofer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              {(['TODOS', 'IDA', 'VUELTA'] as const).map(sent => (
                <button
                  key={sent}
                  onClick={() => setSentidoFilter(sent)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: 5,
                    border: sentidoFilter === sent ? '1px solid #0284c7' : '1px solid #e2e8f0',
                    background: sentidoFilter === sent ? '#e0f2fe' : '#f8fafc',
                    color: sentidoFilter === sent ? '#0369a1' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {sent}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
                <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.82rem', margin: 0 }}>Cargando relevamientos...</p>
              </div>
            ) : filteredRelevamientos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <Smartphone size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569', margin: '0 0 6px' }}>
                  Sin relevamientos GPS
                </p>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  Utilizá la app <strong>BusTrackerGPS</strong> en Android o hacé clic en &ldquo;Importar Relevamiento&rdquo; para cargar un archivo GeoJSON o paquete ZIP.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredRelevamientos.map(trip => {
                  const isSelected = trip.id === selectedId;
                  const isVuelta = trip.sentido === 'VUELTA';
                  const distKm = (trip.distanciaMeters / 1000).toFixed(1);
                  const durMin = Math.round(trip.duracionMs / 60000);

                  return (
                    <div
                      key={trip.id}
                      onClick={() => setSelectedId(trip.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: isSelected ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? '0 4px 12px rgba(2,132,199,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                      }}
                    >
                      {/* Line header & badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            background: '#0f172a',
                            color: '#fff',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontFamily: 'monospace'
                          }}>
                            {trip.lineaNumero ? `Línea ${trip.lineaNumero}` : 'Sin línea'}
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                            {trip.ramal || 'Ramal Principal'}
                          </span>
                        </div>

                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isVuelta ? '#f3e8ff' : '#e0f2fe',
                          color: isVuelta ? '#7e22ce' : '#0369a1',
                          border: isVuelta ? '1px solid #e9d5ff' : '1px solid #bae6fd',
                        }}>
                          {trip.sentido || 'IDA'} {isVuelta ? '╌' : '—'}
                        </span>
                      </div>

                      {/* Details row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.74rem', color: '#64748b', marginBottom: 8 }}>
                        {trip.interno && (
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                            Int. <strong>{trip.interno}</strong>
                          </span>
                        )}
                        {trip.patente && (
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                            {trip.patente}
                          </span>
                        )}
                        {trip.chofer && (
                          <span>Chofer: <strong>{trip.chofer}</strong></span>
                        )}
                      </div>

                      {/* Telemetry pill */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span>📏 <strong>{distKm} km</strong></span>
                          <span>⏱️ <strong>{durMin} min</strong></span>
                          {trip.paradasCount > 0 && <span>🚏 <strong>{trip.paradasCount}</strong></span>}
                          {trip.incidenciasCount > 0 && <span style={{ color: '#d97706' }}>⚠️ <strong>{trip.incidenciasCount}</strong></span>}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {new Date(trip.creadoEn).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Action buttons strip */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={e => openPromote(trip, e)}
                          title="Promover a Línea de Colectivo Oficial"
                          style={{
                            background: '#0284c7',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 5,
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Sparkles size={11} /> Promover a Oficial
                        </button>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setEditingTrip(trip);
                          }}
                          title="Editar trazo cartográfico y datos del viaje"
                          style={{
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: 5,
                            padding: '3px 6px',
                            color: '#0284c7',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Sliders size={12} />
                        </button>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setExportModalTrip(trip);
                          }}
                          title="Descargar recorrido (GeoJSON / GPX / KML)"
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 5,
                            padding: '3px 6px',
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Download size={12} />
                        </button>

                        <button
                          onClick={e => handleDelete(trip.id, e)}
                          title="Eliminar relevamiento"
                          style={{
                            background: '#fff1f2',
                            border: '1px solid #ffe4e6',
                            borderRadius: 5,
                            padding: '3px 6px',
                            color: '#e11d48',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: MAP & TELEMETRY INSPECTOR */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {selectedTrip ? (
            <>
              {/* Map header pill */}
              <div style={{
                position: 'absolute',
                top: 14,
                left: 14,
                right: 14,
                zIndex: 1000,
                pointerEvents: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  pointerEvents: 'auto',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(8px)',
                  padding: '10px 16px',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: '1px solid rgba(226,232,240,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        {selectedTrip.lineaNumero ? `Línea ${selectedTrip.lineaNumero}` : 'Relevamiento GPS'} — {selectedTrip.ramal || 'Principal'}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: selectedTrip.sentido === 'VUELTA' ? '#f3e8ff' : '#e0f2fe',
                        color: selectedTrip.sentido === 'VUELTA' ? '#7e22ce' : '#0369a1',
                      }}>
                        {selectedTrip.sentido || 'IDA'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: '#64748b', marginTop: 3 }}>
                      {selectedTrip.interno && <span>Interno: <strong>#{selectedTrip.interno}</strong></span>}
                      {selectedTrip.patente && <span>Patente: <strong>{selectedTrip.patente}</strong></span>}
                      {selectedTrip.chofer && <span>Chofer: <strong>{selectedTrip.chofer}</strong></span>}
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/')}
                    style={{
                      background: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title="Ver en el mapa principal de Lanús GIS"
                  >
                    <Layers size={14} color="#0284c7" /> Ver en Mapa GIS
                  </button>
                  <button
                    onClick={() => setEditingTrip(selectedTrip)}
                    style={{
                      background: '#f0f9ff',
                      color: '#0284c7',
                      border: '1px solid #bae6fd',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 1px 4px rgba(2,132,199,0.1)',
                      transition: 'all 0.2s',
                    }}
                    title="Editar trazo cartográfico, suavizar curvas y actualizar datos municipales"
                    onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
                    onMouseOut={e => e.currentTarget.style.background = '#f0f9ff'}
                  >
                    <Sliders size={14} color="#0284c7" /> Editar Trazo & Info
                  </button>

                  <button
                    onClick={() => setExportModalTrip(selectedTrip)}
                    style={{
                      background: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title="Descargar este recorrido en GeoJSON, GPX o KML"
                  >
                    <Download size={14} color="#0284c7" /> Descargar
                  </button>

                  <button
                    onClick={() => openPromote(selectedTrip)}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 14px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
                    }}
                  >
                    <Sparkles size={14} /> Promover a Red Oficial
                  </button>
                </div>

                {/* Floating telemetry pills */}
                <div style={{
                  pointerEvents: 'auto',
                  background: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: '0.75rem',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>DISTANCIA</span>
                    <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>{(selectedTrip.distanciaMeters / 1000).toFixed(1)} km</strong>
                  </div>
                  <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>VEL. PROM</span>
                    <strong style={{ fontSize: '0.85rem', color: '#4ade80' }}>{selectedTrip.velocidadProm || '—'} km/h</strong>
                  </div>
                  <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>PARADAS</span>
                    <strong style={{ fontSize: '0.85rem', color: '#facc15' }}>{selectedTrip.paradasCount || stopsList.length}</strong>
                  </div>
                </div>
              </div>

              {/* Map Canvas */}
              <div style={{ flex: 1, position: 'relative' }}>
                <StaticMapPreview
                  geoData={selectedGeo}
                  interactive={true}
                  height="100%"
                />
              </div>

              {/* Bottom drawer: detail tabs */}
              <div style={{
                height: 180,
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
                zIndex: 20,
              }}>
                {/* Tabs bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '0 16px', background: '#fafafa' }}>
                  <button
                    onClick={() => setActiveBottomTab('resumen')}
                    style={{
                      padding: '10px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderBottom: activeBottomTab === 'resumen' ? '2px solid #0284c7' : '2px solid transparent',
                      color: activeBottomTab === 'resumen' ? '#0284c7' : '#64748b',
                    }}
                  >
                    Telemetría & Datos
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('paradas')}
                    style={{
                      padding: '10px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderBottom: activeBottomTab === 'paradas' ? '2px solid #0284c7' : '2px solid transparent',
                      color: activeBottomTab === 'paradas' ? '#0284c7' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>Paradas ({stopsList.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveBottomTab('incidencias')}
                    style={{
                      padding: '10px 16px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderBottom: activeBottomTab === 'incidencias' ? '2px solid #0284c7' : '2px solid transparent',
                      color: activeBottomTab === 'incidencias' ? '#0284c7' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>Incidencias ({incidentsList.length})</span>
                  </button>
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
                  {activeBottomTab === 'resumen' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Conductor & Móvil</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                          {selectedTrip.chofer || 'No especificado'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Interno: {selectedTrip.interno || 'S/D'} · Dominio: {selectedTrip.patente || 'S/D'}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Tiempos de Marcha</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                          Duración Total: {Math.round(selectedTrip.duracionMs / 60000)} min
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          En movimiento: {Math.round((selectedTrip.movingTimeMs || 0) / 60000)} min · Detenido: {Math.round((selectedTrip.stoppedTimeMs || 0) / 60000)} min
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Puntos de Calidad GPS</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                          {selectedTrip.puntosCount || '—'} coordenadas registradas
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Origen: {selectedTrip.origen} · {new Date(selectedTrip.creadoEn).toLocaleString()}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Notas de Campo</span>
                        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>
                          {selectedTrip.notas || 'Sin notas registradas para este viaje.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeBottomTab === 'paradas' && (
                    <div>
                      {stopsList.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>No se registraron paradas durante este relevamiento.</p>
                      ) : (
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                          {stopsList.map((st: any, idx: number) => {
                            const p = st.properties || {};
                            const seq = p.sequence ?? idx + 1;
                            const dwell = p.dwellTimeMs ? Math.round(p.dwellTimeMs / 1000) : null;
                            return (
                              <div key={idx} style={{
                                minWidth: 160,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 8,
                                padding: '8px 10px',
                                flexShrink: 0
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.78rem', color: '#0369a1' }}>
                                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{seq}</span>
                                  <span>{p.name || `Parada ${seq}`}</span>
                                </div>
                                {dwell !== null && (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                                    Detención: <strong>{dwell} s</strong>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeBottomTab === 'incidencias' && (
                    <div>
                      {incidentsList.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>No se registraron incidencias ni advertencias durante este viaje.</p>
                      ) : (
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                          {incidentsList.map((inc: any, idx: number) => {
                            const p = inc.properties || {};
                            return (
                              <div key={idx} style={{
                                minWidth: 200,
                                background: '#fffbeb',
                                border: '1px solid #fef3c7',
                                borderRadius: 8,
                                padding: '8px 10px',
                                flexShrink: 0
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.78rem', color: '#b45309' }}>
                                  <AlertTriangle size={14} color="#d97706" />
                                  <span>{p.incidentType || p.type || 'Incidencia'}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#78350f', marginTop: 3 }}>
                                  {p.description || 'Sin descripción'}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#92400e', marginTop: 2 }}>
                                  Severidad: <strong>{p.severity || 'MEDIA'}</strong>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: 24 }}>
              <Route size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 6px', color: '#475569', fontSize: '1rem', fontWeight: 700 }}>
                Seleccioná un relevamiento GPS
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
                Elegí un viaje del panel lateral izquierdo para inspeccionar su trazo cartográfico, paradas e incidencias, o importá un paquete nuevo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: PROMOVER A LÍNEA OFICIAL */}
      {showPromoteModal && selectedTrip && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#fff',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={20} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Promover a Línea Oficial</h3>
              </div>
              <button
                onClick={() => setShowPromoteModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
                Este asistente convertirá el trazo GPS registrado en campo en una línea de transporte oficial en la base de datos de Lanús GIS.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Nombre descriptivo de la traza
                  </label>
                  <input
                    type="text"
                    value={promoteNombre}
                    onChange={e => setPromoteNombre(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Número de Línea
                    </label>
                    <input
                      type="text"
                      value={promoteNumero}
                      onChange={e => setPromoteNumero(e.target.value)}
                      placeholder="Ej: 523"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Ramal / Subcategoría
                    </label>
                    <input
                      type="text"
                      value={promoteRamal}
                      onChange={e => setPromoteRamal(e.target.value)}
                      placeholder="Ej: Ramal A"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Sentido
                    </label>
                    <select
                      value={promoteSentido}
                      onChange={e => {
                        const s = e.target.value;
                        setPromoteSentido(s);
                        setPromoteColor(s === 'VUELTA' ? '#8b5cf6' : '#0284c7');
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    >
                      <option value="IDA">IDA (Trazo continuo azul)</option>
                      <option value="VUELTA">VUELTA (Trazo punteado violeta)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Jurisdicción
                    </label>
                    <select
                      value={promoteCategoria}
                      onChange={e => setPromoteCategoria(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                    >
                      <option value="MUNICIPAL">MUNICIPAL (500-599)</option>
                      <option value="PROVINCIAL">PROVINCIAL (200-499)</option>
                      <option value="NACIONAL">NACIONAL (1-199)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: '#1e293b', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={promoteClipLanus}
                      onChange={e => setPromoteClipLanus(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#0284c7' }}
                    />
                    <span>Recortar automáticamente el trazado a los límites del Partido de Lanús</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setShowPromoteModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPromote}
                  disabled={isPromoting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: isPromoting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 8px rgba(2,132,199,0.25)',
                  }}
                >
                  {isPromoting ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  <span>Confirmar y Guardar Línea</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONECTAR APP MÓVIL (BUSTRACKERGPS) */}
      {showConnectModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15,23,42,0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 18,
            width: '100%',
            maxWidth: 540,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #091325 0%, #1e3a8a 100%)',
              color: '#fff',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Smartphone size={22} color="#38bdf8" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Vincular BusTrackerGPS Móvil</h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>Lanús Digital Mobile Sync Hub</p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: '#2563eb', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>
                    RELEASE v1.0.23
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#1e3a8a', fontWeight: 600 }}>
                    Shorebird OTA · Mapbox Streets-v12 · Lanús Digital
                  </div>
                </div>
                <a
                  href="https://github.com/julianmcancelo/BusTrackerGPS/releases/download/v1.0.23/BitacoraGPS-v1.0.23.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    textDecoration: 'none',
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Download size={13} /> Descargar APK v1.0.10
                </a>
              </div>

              {/* Selector de Entorno de Conexión */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Elegí la red donde corre tu servidor GIS:
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button
                    onClick={() => { setSelectedServerMode('wifi'); setCustomServerUrl(''); }}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: 7,
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedServerMode === 'wifi' && !customServerUrl ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: selectedServerMode === 'wifi' && !customServerUrl ? '#e0f2fe' : '#f8fafc',
                      color: selectedServerMode === 'wifi' && !customServerUrl ? '#0369a1' : '#475569',
                    }}
                  >
                    📶 Wi-Fi Local (192.168.0.229)
                  </button>
                  <button
                    onClick={() => { setSelectedServerMode('origin'); setCustomServerUrl(''); }}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: 7,
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedServerMode === 'origin' && !customServerUrl ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: selectedServerMode === 'origin' && !customServerUrl ? '#e0f2fe' : '#f8fafc',
                      color: selectedServerMode === 'origin' && !customServerUrl ? '#0369a1' : '#475569',
                    }}
                  >
                    🌐 Este Navegador ({currentOrigin.replace('http://', '').replace('https://', '')})
                  </button>
                  <button
                    onClick={() => { setSelectedServerMode('emulator'); setCustomServerUrl(''); }}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: 7,
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: selectedServerMode === 'emulator' && !customServerUrl ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                      background: selectedServerMode === 'emulator' && !customServerUrl ? '#e0f2fe' : '#f8fafc',
                      color: selectedServerMode === 'emulator' && !customServerUrl ? '#0369a1' : '#475569',
                    }}
                  >
                    💻 Emulador (10.0.2.2)
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18, background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ background: '#fff', padding: 8, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', flexShrink: 0 }}>
                  <QRCodeSVG value={activeServerBase} size={110} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                    URL del Servidor Municipal
                  </h4>
                  <p style={{ margin: '0 0 8px', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.4 }}>
                    Copiá esta URL en <strong>Ajustes &gt; Sincronización Lanús Digital</strong> en tu celular:
                  </p>
                  <div style={{
                    background: '#0f172a',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '8px 10px',
                    borderRadius: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>{activeServerBase}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeServerBase);
                        toast.success('URL copiada al portapapeles');
                      }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>

              <h5 style={{ margin: '0 0 8px', fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                ¿Cómo funciona la conexión?
              </h5>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: '#475569', lineHeight: 1.6 }}>
                <li><strong>Captura Offline:</strong> El chofer o inspector registra el trayecto en el colectivo con el GPS activo (incluso con la pantalla apagada).</li>
                <li><strong>Marcado en Campo:</strong> Se pulsan los botones grandes de 📍 Parada o ⚠️ Incidencia en tiempo real.</li>
                <li><strong>Sincronización:</strong> Al finalizar el recorrido o conectarse a WiFi/datos, la app sube el relevamiento automáticamente o genera un paquete <code>.zip</code> / <code>.geojson</code> para importar aquí.</li>
              </ol>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <a
                  href="https://github.com/julianmcancelo/BusTrackerGPS"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={14} /> Ver Repositorio GitHub (BusTrackerGPS)
                </a>

                <button
                  onClick={() => setShowConnectModal(false)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN Y ESTILIZACIÓN DE TRAZO GPS */}
      {editingTrip && (
        <GpsTraceEditorModal
          isOpen={!!editingTrip}
          trip={editingTrip}
          onClose={() => setEditingTrip(null)}
          onSaved={(updatedTrip) => {
            setRelevamientos(prev => prev.map(r => r.id === updatedTrip.id ? updatedTrip : r));
            if (selectedId === updatedTrip.id) {
              setSelectedId(updatedTrip.id);
            }
          }}
        />
      )}

      {/* MODAL DE DESCARGA EN FORMATOS CARTOGRÁFICOS */}
      {exportModalTrip && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            maxWidth: 480,
            width: '100%',
            padding: 22,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 8, borderRadius: 8 }}>
                  <Download size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Descargar Relevamiento GPS
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {exportModalTrip.lineaNumero ? `Línea ${exportModalTrip.lineaNumero}` : 'Relevamiento'} — {exportModalTrip.ramal || 'Principal'} ({exportModalTrip.sentido || 'IDA'})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setExportModalTrip(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: '#64748b' }}>
              Elegí el formato cartográfico en el que deseás descargar el recorrido con sus paradas e incidencias:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* GeoJSON Option */}
              <button
                onClick={() => {
                  try {
                    downloadGeoJson(exportModalTrip);
                    toast.success('Archivo GeoJSON generado');
                    setExportModalTrip(null);
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#0284c7'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '0.84rem', color: '#0f172a' }}>
                    GeoJSON (.geojson)
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Estándar cartográfico para web, Leaflet, Mapbox y APIs GIS
                  </span>
                </div>
                <span style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                  Recomendado
                </span>
              </button>

              {/* GPX Option */}
              <button
                onClick={() => {
                  try {
                    downloadGpx(exportModalTrip);
                    toast.success('Archivo GPX generado');
                    setExportModalTrip(null);
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#10b981'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '0.84rem', color: '#0f172a' }}>
                    GPX Exchange Format (.gpx)
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Compatible con GPS Garmin, Strava, QGIS y OpenStreetMap
                  </span>
                </div>
                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                  GPS Track
                </span>
              </button>

              {/* KML Option */}
              <button
                onClick={() => {
                  try {
                    downloadKml(exportModalTrip);
                    toast.success('Archivo KML generado');
                    setExportModalTrip(null);
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#f59e0b'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '0.84rem', color: '#0f172a' }}>
                    Google Earth (.kml)
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Visualización 3D y trazado de recorridos en Google Earth Pro
                  </span>
                </div>
                <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>
                  Google Earth
                </span>
              </button>
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setExportModalTrip(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
