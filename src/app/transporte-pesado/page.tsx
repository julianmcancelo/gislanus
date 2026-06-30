'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, Truck, CheckCircle, ArrowRight, Loader2, Plus, Edit2, ArrowLeft, List, LayoutDashboard, User, Shield, Info, Search, Filter, ExternalLink, FileText, Route, Navigation, ClipboardList, Clock } from 'lucide-react';
import AccessDenied from '@/components/AccessDenied';
import NotificacionToast from '@/components/NotificacionToast';


// Dynamic import for Leaflet component to avoid SSR errors
const WizardMap = dynamic(() => import('../../components/WizardMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>
});

const StaticMapPreview = dynamic(() => import('../../components/StaticMapPreview'), {
  ssr: false,
  loading: () => <div style={{ height: '200px', width: '100%', backgroundColor: '#eee', borderRadius: '8px', marginBottom: '15px' }} />
});

import { useAuth } from '@/context/AuthContext';
import { emitirNuevaSolicitud } from '@/lib/rtdb';

export default function TransportePesadoWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlEditId = searchParams.get('editId');
  const { user, dbUser, loading } = useAuth();
  const [viewMode, setViewMode] = useState<'home' | 'list' | 'wizard'>(urlEditId ? 'wizard' : 'home');
  const [editId, setEditId] = useState<string | null>(urlEditId);
  const [rutasList, setRutasList] = useState<any[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('TODAS');
  const [step, setStep] = useState(1);
  const [numeroSolicitud, setNumeroSolicitud] = useState('');
  const [idSolicitudWeb, setIdSolicitudWeb] = useState('');
  const [enlaceDocumento, setEnlaceDocumento] = useState('');
  const [fechaCreacion, setFechaCreacion] = useState('');
  const [nombreSolicitante, setNombreSolicitante] = useState('');
  const [empresaSolicitante, setEmpresaSolicitante] = useState('');
  const [cuilCuit, setCuilCuit] = useState('');
  const [emailSolicitante, setEmailSolicitante] = useState('');
  const [telefonoSolicitante, setTelefonoSolicitante] = useState('');
  const [patente, setPatente] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState('');
  const [pesoToneladas, setPesoToneladas] = useState('');
  const [cargaPeligrosa, setCargaPeligrosa] = useState(false);
  const [tipoCarga, setTipoCarga] = useState('');
  const [largoVehiculo, setLargoVehiculo] = useState('');
  const [anchoVehiculo, setAnchoVehiculo] = useState('');
  const [alturaVehiculo, setAlturaVehiculo] = useState('');
  const [cantidadEjes, setCantidadEjes] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [nroSeguro, setNroSeguro] = useState('');
  const [origenDireccion, setOrigenDireccion] = useState('');
  const [origenLocalidad, setOrigenLocalidad] = useState('');
  const [origenPartido, setOrigenPartido] = useState('');
  const [origenNombre, setOrigenNombre] = useState('');
  const [destinoDireccion, setDestinoDireccion] = useState('');
  const [destinoLocalidad, setDestinoLocalidad] = useState('');
  const [destinoPartido, setDestinoPartido] = useState('');
  const [destinoNombre, setDestinoNombre] = useState('');
  const [frecuencia, setFrecuencia] = useState('');
  const [horario, setHorario] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [vigenciaDesde, setVigenciaDesde] = useState('');
  const [vigenciaHasta, setVigenciaHasta] = useState('');
  const [datosGeo, setDatosGeo] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tracedStreets, setTracedStreets] = useState<string[]>([]);
  const [savedWaypoints, setSavedWaypoints] = useState<any[]>([]);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<any>(null);
  const [magicUrls, setMagicUrls] = useState<string[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashContent = decodeURIComponent(window.location.hash.substring(1));
      let textToParse = hashContent;
      let urls: string[] = [];
      let pdfUrl: string | null = null;
      let qrUrl: string | null = null;

      try {
        const payload = JSON.parse(hashContent);
        if (payload.text) textToParse = payload.text;
        if (payload.urls && Array.isArray(payload.urls)) urls = payload.urls;
        if (payload.imageUrls && Array.isArray(payload.imageUrls)) urls = payload.imageUrls;
        if (payload.pdfUrl) pdfUrl = payload.pdfUrl;
        if (payload.qrUrl) qrUrl = payload.qrUrl;
      } catch (e) {
        // Fallback: no era JSON, era solo texto
      }

      if (textToParse && textToParse.trim().length > 10) {
        setImportText(textToParse);
        setMagicUrls(urls);
        setShowImport(true);
        window.history.replaceState(null, '', window.location.pathname);
        handleImport(textToParse);
      }
    }
  }, []);

  useEffect(() => {
    if (editId) {
      const fetchEditData = async () => {
        try {
          const res = await fetch(`/api/rutas-transporte/${editId}`);
          if (!res.ok) throw new Error('No se pudo cargar la solicitud');
          const data = await res.json();
          setNumeroSolicitud(data.numeroSolicitud || '');
          setIdSolicitudWeb(data.idSolicitudWeb || '');
          setEnlaceDocumento(data.enlaceDocumento || '');
          setFechaCreacion(data.fechaCreacion || '');
          setNombreSolicitante(data.nombreSolicitante || '');
          setEmpresaSolicitante(data.empresaSolicitante || '');
          setCuilCuit(data.cuilCuit || '');
          setEmailSolicitante(data.emailSolicitante || '');
          setTelefonoSolicitante(data.telefonoSolicitante || '');
          setPatente(data.patente || '');
          setTipoVehiculo(data.tipoVehiculo || '');
          setPesoToneladas(data.pesoToneladas ? String(data.pesoToneladas) : '');
          setCargaPeligrosa(!!data.cargaPeligrosa);
          setTipoCarga(data.tipoCarga || '');
          setLargoVehiculo(data.largoVehiculo || '');
          setAnchoVehiculo(data.anchoVehiculo || '');
          setAlturaVehiculo(data.alturaVehiculo || '');
          setCantidadEjes(data.cantidadEjes ? String(data.cantidadEjes) : '');
          setAseguradora(data.aseguradora || '');
          setNroSeguro(data.nroSeguro || '');
          setOrigenDireccion(data.origenDireccion || '');
          setOrigenLocalidad(data.origenLocalidad || '');
          setOrigenPartido(data.origenPartido || '');
          setOrigenNombre(data.origenNombre || '');
          setDestinoDireccion(data.destinoDireccion || '');
          setDestinoLocalidad(data.destinoLocalidad || '');
          setDestinoPartido(data.destinoPartido || '');
          setDestinoNombre(data.destinoNombre || '');
          setFrecuencia(data.frecuencia || '');
          setHorario(data.horario || '');
          setObservaciones(data.observaciones || '');
          setVigenciaDesde(data.vigenciaDesde || '');
          setVigenciaHasta(data.vigenciaHasta || '');
          if (data.datosGeo) {
            let parsedGeo = typeof data.datosGeo === 'string' ? JSON.parse(data.datosGeo) : data.datosGeo;
            setDatosGeo(parsedGeo);
            if (parsedGeo.properties && parsedGeo.properties.waypoints) {
              setSavedWaypoints(parsedGeo.properties.waypoints);
            } else if (parsedGeo.geometry && parsedGeo.geometry.coordinates && parsedGeo.geometry.type === 'LineString') {
              // Legacy route (no waypoints saved). Use first and last coordinates to initialize the router.
              const coords = parsedGeo.geometry.coordinates;
              if (coords.length >= 2) {
                const start = coords[0];
                const end = coords[coords.length - 1];
                setSavedWaypoints([
                  { latLng: { lat: start[1], lng: start[0] } },
                  { latLng: { lat: end[1], lng: end[0] } }
                ]);
              }
            }
          }
          if (data.calles) {
            setTracedStreets(data.calles.split(' | '));
          }
        } catch (err) {
          console.error(err);
          alert('Error al cargar la ruta para edición.');
        }
      };
      fetchEditData();
    } else {
      // Reset form if no editId
      setNumeroSolicitud(''); setIdSolicitudWeb(''); setEnlaceDocumento(''); setFechaCreacion(''); setNombreSolicitante('');
      setEmpresaSolicitante(''); setCuilCuit(''); setEmailSolicitante(''); setTelefonoSolicitante('');
      setPatente(''); setTipoVehiculo(''); setPesoToneladas(''); setCargaPeligrosa(false);
      setTipoCarga(''); setLargoVehiculo(''); setAnchoVehiculo(''); setAlturaVehiculo('');
      setCantidadEjes(''); setAseguradora(''); setNroSeguro(''); setOrigenDireccion('');
      setOrigenLocalidad(''); setOrigenPartido(''); setOrigenNombre(''); setDestinoDireccion('');
      setDestinoLocalidad(''); setDestinoPartido(''); setDestinoNombre(''); setFrecuencia('');
      setHorario(''); setObservaciones(''); setVigenciaDesde(''); setVigenciaHasta('');
      setDatosGeo(null); setSavedWaypoints([]); setTracedStreets([]);

      // Intentar cargar borrador si no hay editId y estamos en modo wizard
      if (typeof window !== 'undefined' && viewMode === 'wizard') {
        const draft = localStorage.getItem('lanus-transporte-draft');
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            setPendingDraft(parsed);
            setShowDraftModal(true);
          } catch (e) {
            console.error('Error loading draft', e);
          }
        }
      }
    }
  }, [editId, viewMode]);

  // Autoguardado de borrador
  useEffect(() => {
    if (viewMode === 'wizard' && !editId && !isSubmitting && step === 1) {
      const draft = {
        numeroSolicitud, idSolicitudWeb, enlaceDocumento, nombreSolicitante, empresaSolicitante, cuilCuit,
        emailSolicitante, telefonoSolicitante, patente, tipoVehiculo, pesoToneladas,
        cargaPeligrosa, tipoCarga, largoVehiculo, anchoVehiculo, alturaVehiculo,
        cantidadEjes, aseguradora, nroSeguro, origenDireccion, origenLocalidad,
        origenPartido, origenNombre, destinoDireccion, destinoLocalidad,
        destinoPartido, destinoNombre, frecuencia, horario, observaciones,
        vigenciaDesde, vigenciaHasta
      };
      // Solo guardar si hay datos relevantes cargados
      if (patente || nombreSolicitante || empresaSolicitante || numeroSolicitud) {
        localStorage.setItem('lanus-transporte-draft', JSON.stringify(draft));
      }
    }
  }, [
    numeroSolicitud, nombreSolicitante, empresaSolicitante, cuilCuit,
    emailSolicitante, telefonoSolicitante, patente, tipoVehiculo, pesoToneladas,
    cargaPeligrosa, tipoCarga, largoVehiculo, anchoVehiculo, alturaVehiculo,
    cantidadEjes, aseguradora, nroSeguro, origenDireccion, origenLocalidad,
    origenPartido, origenNombre, destinoDireccion, destinoLocalidad,
    destinoPartido, destinoNombre, frecuencia, horario, observaciones,
    vigenciaDesde, vigenciaHasta, viewMode, editId, isSubmitting, step
  ]);

  const fetchRutasList = async () => {
    setLoadingRutas(true);
    try {
      const token = await user?.getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/rutas-transporte', { headers });
      if (res.ok) {
        const data = await res.json();
        setRutasList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRutas(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'list' || viewMode === 'home') {
      fetchRutasList();
    }
  }, [viewMode]);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>;
  }

  const isSuperAdmin = dbUser?.rol === 'SUPER_ADMIN';
  const canView = isSuperAdmin || (dbUser?.permisos?.verRutas ?? false);
  const canEdit = isSuperAdmin || (dbUser?.permisos?.editarRutas ?? false);

  if (!dbUser || !canView) {
    return <AccessDenied mensaje="No tenés permisos para acceder al módulo de Transporte Pesado." />;
  }

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (numeroSolicitud.trim() && nombreSolicitante.trim()) {
      setStep(2);
    }
  };

  const handleImport = async (textToImport?: string) => {
    const text = typeof textToImport === 'string' ? textToImport : importText;
    if (!text.trim()) return;
    setIsImporting(true);
    try {
      // Si el texto es solo una URL de tramitesweb, enviarlo como qrUrl
      const trimmed = text.trim();
      const isTramitesUrl = /^https?:\/\/tramitesweb\.lanus\.gob\.ar\//i.test(trimmed);
      const body = isTramitesUrl
        ? { text: `Solicitud importada desde: ${trimmed}`, qrUrl: trimmed }
        : { text: trimmed };

      const res = await fetch('/api/parse-solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      console.log('[parse-solicitud response]', JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.error || 'Error processing text');

      setNumeroSolicitud(data.numeroSolicitud || '');
      setIdSolicitudWeb(data.idSolicitudWeb || '');
      setEnlaceDocumento(data.enlaceDocumento || '');
      setFechaCreacion(data.fechaCreacion || '');
      setNombreSolicitante(data.nombreSolicitante || '');
      setEmpresaSolicitante(data.empresaSolicitante || '');
      setCuilCuit(data.cuilCuit || '');
      setEmailSolicitante(data.emailSolicitante || '');
      setTelefonoSolicitante(data.telefonoSolicitante || '');
      setPatente(data.patente || '');
      setTipoVehiculo(data.tipoVehiculo || '');
      setPesoToneladas(data.pesoToneladas != null ? String(data.pesoToneladas) : '');
      setCargaPeligrosa(!!data.cargaPeligrosa);
      setTipoCarga(data.tipoCarga || '');
      setLargoVehiculo(data.largoVehiculo || '');
      setAnchoVehiculo(data.anchoVehiculo || '');
      setAlturaVehiculo(data.alturaVehiculo || '');
      setCantidadEjes(data.cantidadEjes != null ? String(data.cantidadEjes) : '');
      setAseguradora(data.aseguradora || '');
      setNroSeguro(data.nroSeguro || '');
      setOrigenDireccion(data.origenDireccion || '');
      setOrigenLocalidad(data.origenLocalidad || '');
      setOrigenPartido(data.origenPartido || '');
      setOrigenNombre(data.origenNombre || '');
      setDestinoDireccion(data.destinoDireccion || '');
      setDestinoLocalidad(data.destinoLocalidad || '');
      setDestinoPartido(data.destinoPartido || '');
      setDestinoNombre(data.destinoNombre || '');
      setFrecuencia(data.frecuencia || '');
      setHorario(data.horario || '');
      setObservaciones(data.observaciones || '');
      setVigenciaDesde(data.vigenciaDesde || '');
      setVigenciaHasta(data.vigenciaHasta || '');
      
      setSelectedRouteIndex(0);
      setParsedInfo(data);

      if (data.datosGeo && data.datosGeo.features && data.datosGeo.features.length > 0) {
        setDatosGeo(data.datosGeo);
      } else {
        setDatosGeo(null);
      }

      setStep(1.5); // Vamos al paso de revisión
    } catch (err) {
      alert('Hubo un error importando el texto. Por favor verifique el formato e intente nuevamente.');
      console.error(err);
    } finally {
      setIsImporting(false);
      setShowImport(false);
    }
  };

  const handleMapComplete = (data: any, detectedStreets: string[], currentWaypoints?: any[]) => {
    setDatosGeo(data);
    setTracedStreets(detectedStreets);
    if (currentWaypoints) {
      setSavedWaypoints(currentWaypoints);
    }
    setStep(3);
  };

  const handleSubmitFinal = async () => {
    setIsSubmitting(true);
    try {
      const routeText = tracedStreets.length > 0 
        ? tracedStreets.join(' | ')
        : (parsedInfo && parsedInfo.calles ? parsedInfo.calles : "");
      
      const payload: any = {
        numeroSolicitud,
        idSolicitudWeb,
        enlaceDocumento,
        fechaCreacion,
        nombreSolicitante,
        empresaSolicitante,
        cuilCuit,
        emailSolicitante,
        telefonoSolicitante,
        patente,
        tipoVehiculo,
        pesoToneladas,
        cargaPeligrosa,
        tipoCarga,
        largoVehiculo,
        anchoVehiculo,
        alturaVehiculo,
        cantidadEjes: cantidadEjes ? parseInt(cantidadEjes) : null,
        aseguradora,
        nroSeguro,
        origenDireccion,
        origenLocalidad,
        origenPartido,
        origenNombre,
        destinoDireccion,
        destinoLocalidad,
        destinoPartido,
        destinoNombre,
        frecuencia,
        horario,
        observaciones,
        vigenciaDesde,
        vigenciaHasta,
        datosGeo: JSON.stringify(datosGeo),
        calles: routeText
      };

      if (editId) {
        payload.editadoPorId = dbUser?.id;
        payload.editadoPorNombre = dbUser?.nombre || dbUser?.email;
      } else {
        payload.creadoPorId = dbUser?.id;
        payload.creadoPorNombre = dbUser?.nombre || dbUser?.email;
      }

      const method = editId ? 'PUT' : 'POST';
      const url = editId ? `/api/rutas-transporte/${editId}` : '/api/rutas-transporte';
      const submitToken = await user?.getIdToken();

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(submitToken ? { Authorization: `Bearer ${submitToken}` } : {}),
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error saving route');
      const saved = await response.json();
      
      if (!editId) {
        emitirNuevaSolicitud({
          solicitudId: saved.id,
          numeroSolicitud: saved.numeroSolicitud,
          nombreSolicitante: saved.nombreSolicitante,
        });
      }
      setStep(2.5);
    } catch (err) {
      alert('Error al guardar la solicitud. Por favor, intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAnotherRoute = () => {
    setPatente('');
    setTipoVehiculo('');
    setPesoToneladas('');
    setCargaPeligrosa(false);
    setAseguradora('');
    setNroSeguro('');
    setDatosGeo(null);
    setParsedInfo(null);
    setSavedWaypoints([]);
    setStep(1);
  };

  const handleAddAnotherRouteSameVehicle = () => {
    setDatosGeo(null);
    setTracedStreets([]);
    setSavedWaypoints([]);
    setStep(1);
  };

  const handleFinishRequest = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/rutas-transporte/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroSolicitud })
      });
      if (!response.ok) throw new Error('Error finalizando la solicitud');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lanus-transporte-draft');
      }
      setIsSuccess(true);
      setStep(1);
    } catch (err) {
      alert('Error al finalizar la solicitud. Por favor, intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ ...cardStyle, maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
          <div style={{ width: '80px', height: '80px', background: '#dcfce3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={40} color="#10B981" />
          </div>
          <h2 style={{ margin: '0 0 10px 0', color: '#111827', fontSize: '1.5rem' }}>¡Trámite Finalizado!</h2>
          <p style={{ color: '#4b5563', marginBottom: '30px', fontSize: '1rem', lineHeight: '1.5' }}>
            La solicitud <strong>#{numeroSolicitud}</strong> ha sido enviada exitosamente a revisión. 
            El equipo evaluará la ruta y los datos técnicos.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={() => {
                setIsSuccess(false);
                setEditId(null);
                setNumeroSolicitud(''); setIdSolicitudWeb(''); setEnlaceDocumento(''); setFechaCreacion(''); setNombreSolicitante('');
                setEmpresaSolicitante(''); setCuilCuit(''); setEmailSolicitante(''); setTelefonoSolicitante('');
                setPatente(''); setTipoVehiculo(''); setPesoToneladas(''); setCargaPeligrosa(false);
                setTipoCarga(''); setLargoVehiculo(''); setAnchoVehiculo(''); setAlturaVehiculo('');
                setCantidadEjes(''); setAseguradora(''); setNroSeguro(''); setOrigenDireccion('');
                setOrigenLocalidad(''); setOrigenPartido('Lanus'); setOrigenNombre(''); setDestinoDireccion('');
                setDestinoLocalidad(''); setDestinoPartido('Lanus'); setDestinoNombre(''); setFrecuencia('');
                setHorario(''); setObservaciones(''); setVigenciaDesde(''); setVigenciaHasta('');
                setDatosGeo(null);
                setStep(1);
                setViewMode('wizard');
              }}
              style={{ ...btnStyle, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}
            >
              <Plus size={18} /> Cargar un nuevo trámite
            </button>
            <button
              onClick={() => { setIsSuccess(false); setStep(1); setViewMode('list'); fetchRutasList(); }}
              style={{ ...btnStyle, width: '100%', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}
            >
              <List size={18} /> Ver panel de solicitudes
            </button>
            <button 
              onClick={() => window.location.href = '/'} 
              style={{ ...btnStyle, width: '100%', backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}
            >
              <MapPin size={18} /> Ir al Mapa Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2.5) {
    return (
      <div style={containerStyle}>
        <div style={{...cardStyle, textAlign: 'center', padding: '40px', maxWidth: '550px', background: 'linear-gradient(145deg, #ffffff, #f8fafc)', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 4px 14px rgba(34, 197, 94, 0.2)' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>¡Recorridos Guardados!</h2>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6', marginBottom: '35px' }}>
            Los recorridos se han procesado y guardado correctamente en la solicitud <strong style={{ color: '#334155' }}>#{numeroSolicitud}</strong> como borrador.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button 
              onClick={handleAddAnotherRouteSameVehicle} 
              style={{ ...btnStyle, backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', width: '100%', fontSize: '15px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontWeight: 'bold' }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.transform = 'translateY(0)'; }}
              disabled={isSubmitting}
            >
              <Plus size={18} /> Agregar Recorrido (Mismo Camión)
            </button>
            <button 
              onClick={handleAddAnotherRoute} 
              style={{ ...btnStyle, backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', width: '100%', fontSize: '15px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontWeight: 'bold' }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.transform = 'translateY(0)'; }}
              disabled={isSubmitting}
            >
              <Truck size={18} /> Cargar Nuevo Camión
            </button>
            <button 
              onClick={handleFinishRequest} 
              style={{ ...btnStyle, background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', color: 'white', border: 'none', width: '100%', fontSize: '15px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)', transition: 'all 0.2s', fontWeight: 'bold' }}
              onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 23, 42, 0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />} 
              {isSubmitting ? 'Finalizando...' : 'Finalizar y Volver al Panel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepLabels = ['Datos', 'Trazado', 'Confirmar'];
  const currentStepNum = step === 1 ? 1 : step === 1.5 ? 1 : step === 2 ? 2 : 3;

  const restoreDraft = () => {
    if (!pendingDraft) return;
    const p = pendingDraft;
    if (p.numeroSolicitud) setNumeroSolicitud(p.numeroSolicitud);
    if (p.nombreSolicitante) setNombreSolicitante(p.nombreSolicitante);
    if (p.empresaSolicitante) setEmpresaSolicitante(p.empresaSolicitante);
    if (p.cuilCuit) setCuilCuit(p.cuilCuit);
    if (p.emailSolicitante) setEmailSolicitante(p.emailSolicitante);
    if (p.telefonoSolicitante) setTelefonoSolicitante(p.telefonoSolicitante);
    if (p.patente) setPatente(p.patente);
    if (p.tipoVehiculo) setTipoVehiculo(p.tipoVehiculo);
    if (p.pesoToneladas) setPesoToneladas(p.pesoToneladas);
    if (p.cargaPeligrosa) setCargaPeligrosa(p.cargaPeligrosa);
    if (p.tipoCarga) setTipoCarga(p.tipoCarga);
    if (p.largoVehiculo) setLargoVehiculo(p.largoVehiculo);
    if (p.anchoVehiculo) setAnchoVehiculo(p.anchoVehiculo);
    if (p.alturaVehiculo) setAlturaVehiculo(p.alturaVehiculo);
    if (p.cantidadEjes) setCantidadEjes(p.cantidadEjes);
    if (p.aseguradora) setAseguradora(p.aseguradora);
    if (p.nroSeguro) setNroSeguro(p.nroSeguro);
    if (p.origenDireccion) setOrigenDireccion(p.origenDireccion);
    if (p.origenLocalidad) setOrigenLocalidad(p.origenLocalidad);
    if (p.origenPartido) setOrigenPartido(p.origenPartido);
    if (p.origenNombre) setOrigenNombre(p.origenNombre);
    if (p.destinoDireccion) setDestinoDireccion(p.destinoDireccion);
    if (p.destinoLocalidad) setDestinoLocalidad(p.destinoLocalidad);
    if (p.destinoPartido) setDestinoPartido(p.destinoPartido);
    if (p.destinoNombre) setDestinoNombre(p.destinoNombre);
    if (p.frecuencia) setFrecuencia(p.frecuencia);
    if (p.horario) setHorario(p.horario);
    if (p.observaciones) setObservaciones(p.observaciones);
    if (p.vigenciaDesde) setVigenciaDesde(p.vigenciaDesde);
    if (p.vigenciaHasta) setVigenciaHasta(p.vigenciaHasta);
    setShowDraftModal(false);
    setPendingDraft(null);
  };

  const discardDraft = () => {
    localStorage.removeItem('lanus-transporte-draft');
    setShowDraftModal(false);
    setPendingDraft(null);
  };

  const filteredRutas = rutasList.filter(ruta => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      (ruta.patente && ruta.patente.toLowerCase().includes(term)) ||
      (ruta.numeroSolicitud && ruta.numeroSolicitud.toString().includes(term));
    
    const matchesStatus = filterStatus === 'TODAS' || ruta.estado === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (viewMode === 'home') {
    const pendientes = rutasList.filter((r: any) => r.estado === 'PENDIENTE').length;
    const aprobadas  = rutasList.filter((r: any) => r.estado === 'APROBADA').length;
    const rechazadas = rutasList.filter((r: any) => r.estado === 'RECHAZADA').length;
    const firstName  = (dbUser?.nombre || dbUser?.email || 'bienvenido').split(' ')[0];

    return (
      <div style={{ minHeight: '100vh', width: '100%', background: '#05091a', fontFamily: '"Inter", system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* ── Estilos de animación ── */}
        <style>{`
          @keyframes tp-orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
          @keyframes tp-orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,40px) scale(0.92)} }
          @keyframes tp-orb3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,25px)} }
          @keyframes tp-dash { to { stroke-dashoffset: -200 } }
          @keyframes tp-fadein { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
          @keyframes tp-glow { 0%,100%{box-shadow:0 0 20px rgba(37,99,235,0.3)} 50%{box-shadow:0 0 40px rgba(37,99,235,0.6)} }
          .tp-card { transition: transform 0.25s ease, box-shadow 0.25s ease !important; }
          .tp-card:hover { transform: translateY(-5px) !important; }
          .tp-card-blue:hover { box-shadow: 0 24px 48px rgba(37,99,235,0.22) !important; }
          .tp-card-violet:hover { box-shadow: 0 24px 48px rgba(124,58,237,0.18) !important; }
          .tp-card-slate:hover { box-shadow: 0 24px 48px rgba(0,0,0,0.3) !important; }
          .tp-arrow { transition: transform 0.2s ease; }
          .tp-card:hover .tp-arrow { transform: translateX(5px); }
          .tp-back:hover { background: rgba(255,255,255,0.12) !important; color: #e2e8f0 !important; }
          .tp-stat { transition: transform 0.2s ease; }
          .tp-stat:hover { transform: scale(1.06); }
        `}</style>

        {/* ── Fondo: orbs animados ── */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
          <div style={{ position:'absolute', top:'-10%', left:'-5%', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(37,99,235,0.13) 0%, transparent 65%)', animation:'tp-orb1 12s ease-in-out infinite' }} />
          <div style={{ position:'absolute', bottom:'-15%', right:'-8%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 65%)', animation:'tp-orb2 14s ease-in-out infinite' }} />
          <div style={{ position:'absolute', top:'50%', left:'50%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(15,23,42,0) 0%, rgba(6,182,212,0.04) 100%)', transform:'translate(-50%,-50%)', animation:'tp-orb3 9s ease-in-out infinite' }} />
          {/* Grid de puntos */}
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize:'36px 36px' }} />
        </div>

        {/* ── SVG decorativo: ruta animada ── */}
        <div style={{ position:'absolute', bottom:0, right:0, width:'45%', height:'100%', pointerEvents:'none', zIndex:0, opacity:0.07 }}>
          <svg viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
            <path d="M50 600 L50 400 Q50 380 70 370 L200 310 Q230 296 230 270 L230 200 Q230 170 260 155 L350 110 L350 0" stroke="white" strokeWidth="2" strokeDasharray="12 8" style={{ animation:'tp-dash 3s linear infinite' }} />
            <path d="M100 600 L100 420 Q100 400 120 388 L220 335 Q250 320 250 290 L250 210 Q250 178 285 162 L380 115 L380 0" stroke="white" strokeWidth="1" strokeDasharray="6 14" style={{ animation:'tp-dash 4s linear infinite' }} />
            <circle cx="230" cy="270" r="8" fill="white" opacity="0.5" />
            <circle cx="50" cy="400" r="6" fill="white" opacity="0.4" />
            <circle cx="350" cy="110" r="10" fill="white" opacity="0.6" />
          </svg>
        </div>

        {/* ── Header flotante ── */}
        <header style={{ position:'relative', zIndex:10, padding:'22px 36px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow:'0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(37,99,235,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Truck size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'#f8fafc', letterSpacing:'-0.3px' }}>Transporte Pesado</div>
              <div style={{ fontSize:10, color:'#475569', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.08em' }}>Municipio de Lanús</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={() => router.push('/')}
              className="tp-back"
              style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 16px', color:'#94a3b8', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}
            >
              <ArrowLeft size={13} /> Volver al mapa
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'8px 14px' }}>
              <div style={{ width:32, height:32, borderRadius:9, background:'linear-gradient(135deg,#2563eb,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:13, boxShadow:'0 4px 12px rgba(37,99,235,0.4)' }}>
                {firstName[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>{firstName}</div>
                <div style={{ fontSize:10, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>{dbUser?.rol?.replace('_',' ')}</div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <div style={{ position:'relative', zIndex:5, textAlign:'center', padding:'48px 24px 0', animation:'tp-fadein 0.5s ease both' }}>
          {/* Pill badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(37,99,235,0.12)', border:'1px solid rgba(37,99,235,0.28)', borderRadius:999, padding:'6px 16px', marginBottom:24 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#3b82f6', display:'inline-block', boxShadow:'0 0 8px #3b82f6', animation:'tp-glow 2s ease-in-out infinite' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#93c5fd', letterSpacing:'0.08em', textTransform:'uppercase' }}>Portal de Permisos · Lanús</span>
          </div>

          <h1 style={{ margin:'0 0 14px', fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#f8fafc', letterSpacing:'-1.5px', lineHeight:1.05 }}>
            Bienvenido,{' '}
            <span style={{ background:'linear-gradient(135deg,#60a5fa,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {firstName}
            </span>
          </h1>
          <p style={{ margin:'0 auto', fontSize:15, color:'#475569', maxWidth:460, lineHeight:1.7, fontWeight:400 }}>
            Gestioná permisos de circulación para vehículos de carga pesada en el partido de Lanús.
          </p>

          {/* ── Stats ── */}
          <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:40, flexWrap:'wrap' }}>
            {[
              { n: rutasList.length, label:'Total', color:'#60a5fa',  glow:'rgba(96,165,250,0.35)',  bg:'rgba(96,165,250,0.08)',  br:'rgba(96,165,250,0.18)' },
              { n: pendientes,       label:'Pendientes', color:'#fbbf24', glow:'rgba(251,191,36,0.35)', bg:'rgba(251,191,36,0.08)', br:'rgba(251,191,36,0.18)' },
              { n: aprobadas,        label:'Aprobadas', color:'#34d399', glow:'rgba(52,211,153,0.35)', bg:'rgba(52,211,153,0.08)', br:'rgba(52,211,153,0.18)' },
              { n: rechazadas,       label:'Rechazadas', color:'#f87171', glow:'rgba(248,113,113,0.35)',bg:'rgba(248,113,113,0.08)',br:'rgba(248,113,113,0.18)' },
            ].map(s => (
              <div key={s.label} className="tp-stat" style={{ background:s.bg, border:`1px solid ${s.br}`, borderRadius:14, padding:'12px 22px', minWidth:88, textAlign:'center', cursor:'default' }}>
                <div style={{ fontSize:28, fontWeight:900, color:s.color, lineHeight:1, textShadow:`0 0 16px ${s.glow}` }}>{s.n}</div>
                <div style={{ fontSize:10, color:'#475569', fontWeight:700, marginTop:4, textTransform:'uppercase', letterSpacing:'0.07em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Acciones ── */}
        <div style={{ position:'relative', zIndex:5, maxWidth:920, margin:'0 auto', padding:'44px 24px 56px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))', gap:18, animation:'tp-fadein 0.6s 0.1s ease both' }}>

          {canEdit && (
            <div
              className="tp-card tp-card-blue"
              onClick={() => { setEditId(null); setViewMode('wizard'); }}
              style={{ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:22, padding:'32px 28px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}
            >
              {/* glow top accent */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#3b82f6,transparent)' }} />
              <div style={{ position:'absolute', top:-40, left:-20, width:120, height:120, borderRadius:'50%', background:'rgba(37,99,235,0.12)', filter:'blur(24px)', pointerEvents:'none' }} />
              <div style={{ width:52, height:52, borderRadius:15, background:'linear-gradient(135deg,rgba(37,99,235,0.3),rgba(59,130,246,0.15))', border:'1px solid rgba(59,130,246,0.3)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22, boxShadow:'0 0 20px rgba(37,99,235,0.2)' }}>
                <Plus size={24} color="#60a5fa" strokeWidth={2.5} />
              </div>
              <h3 style={{ margin:'0 0 10px', fontSize:18, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.4px' }}>Nueva Solicitud</h3>
              <p style={{ margin:'0 0 28px', color:'#64748b', fontSize:13.5, lineHeight:1.65 }}>
                Completá los datos del vehículo y trazá el recorrido en el mapa. Importá desde Tramites Web con un clic.
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:6, color:'#60a5fa', fontWeight:700, fontSize:13 }}>
                <span>Comenzar ahora</span>
                <span className="tp-arrow"><ArrowRight size={15} /></span>
              </div>
            </div>
          )}

          <div
            className="tp-card tp-card-violet"
            onClick={() => setViewMode('list')}
            style={{ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:22, padding:'32px 28px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}
          >
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#8b5cf6,transparent)' }} />
            <div style={{ position:'absolute', top:-40, right:-20, width:120, height:120, borderRadius:'50%', background:'rgba(124,58,237,0.12)', filter:'blur(24px)', pointerEvents:'none' }} />
            <div style={{ width:52, height:52, borderRadius:15, background:'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(139,92,246,0.15))', border:'1px solid rgba(139,92,246,0.3)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22, boxShadow:'0 0 20px rgba(124,58,237,0.2)' }}>
              <List size={24} color="#a78bfa" strokeWidth={2} />
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.4px' }}>Mis Solicitudes</h3>
              {pendientes > 0 && (
                <span style={{ background:'rgba(251,191,36,0.15)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.3)', fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:999, flexShrink:0, boxShadow:'0 0 10px rgba(251,191,36,0.2)' }}>
                  {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p style={{ margin:'0 0 28px', color:'#64748b', fontSize:13.5, lineHeight:1.65 }}>
              Historial completo de permisos, estados de aprobación y posibilidad de editar recorridos.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:6, color:'#a78bfa', fontWeight:700, fontSize:13 }}>
              <span>Ver listado</span>
              <span className="tp-arrow"><ArrowRight size={15} /></span>
            </div>
          </div>

          <div
            className="tp-card tp-card-slate"
            onClick={() => router.push('/')}
            style={{ background:'rgba(255,255,255,0.03)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:22, padding:'32px 28px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}
          >
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(148,163,184,0.5),transparent)' }} />
            <div style={{ width:52, height:52, borderRadius:15, background:'rgba(148,163,184,0.08)', border:'1px solid rgba(148,163,184,0.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:22 }}>
              <MapPin size={24} color="#94a3b8" strokeWidth={2} />
            </div>
            <h3 style={{ margin:'0 0 10px', fontSize:18, fontWeight:800, color:'#94a3b8', letterSpacing:'-0.4px' }}>Volver al Mapa</h3>
            <p style={{ margin:'0 0 28px', color:'#334155', fontSize:13.5, lineHeight:1.65 }}>
              Regresá al GIS interactivo de Lanús para ver capas, rutas aprobadas y el mapa en tiempo real.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:6, color:'#64748b', fontWeight:700, fontSize:13 }}>
              <span>Ir al mapa</span>
              <span className="tp-arrow"><ArrowRight size={15} /></span>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div style={{ position:'relative', zIndex:5, textAlign:'center', paddingBottom:32, color:'#1e293b', fontSize:11, fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>
          GIS Lanús &nbsp;·&nbsp; Sistema de Información Geográfica
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#f0f4f8' }}>
        <header style={{
          height: '70px',
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '12px', padding: '8px', display: 'flex', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
              <Truck size={24} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.3px' }}>Transporte Pesado</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Panel de Solicitudes</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => { setViewMode('home'); }} 
              style={{ ...btnStyle, margin: 0, width: 'auto', padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#e2e8f0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
            >
              <ArrowLeft size={16} /> Volver
            </button>
            {canEdit && (
              <button
                onClick={() => { setEditId(null); setViewMode('wizard'); }}
                style={{ ...btnStyle, margin: 0, width: 'auto', padding: '8px 16px', backgroundColor: '#2563eb', borderColor: '#1d4ed8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: 'white' }}
              >
                <Plus size={16} /> Nueva Solicitud
              </button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Dashboard Stats */}
          {!loadingRutas && rutasList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
              <div style={{ ...cardStyle, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(145deg, #ffffff, #f8fafc)', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Total Solicitudes</p>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{rutasList.length}</h3>
                </div>
              </div>
              <div style={{ ...cardStyle, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(145deg, #ffffff, #f8fafc)', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Pendientes</p>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{rutasList.filter(r => r.estado === 'PENDIENTE').length}</h3>
                </div>
              </div>
              <div style={{ ...cardStyle, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(145deg, #ffffff, #f8fafc)', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Aprobadas</p>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{rutasList.filter(r => r.estado === 'APROBADA').length}</h3>
                </div>
              </div>
            </div>
          )}

          <div style={{ ...cardStyle, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '0', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ margin: 0, color: '#374151', fontSize: '1.2rem' }}>Listado de Recorridos</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                  <input 
                    type="text" 
                    placeholder="Buscar patente, empresa, N°..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '240px', transition: 'all 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)'; }}
                  />
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Filter size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '10px 32px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', backgroundColor: 'white', cursor: 'pointer', appearance: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)'; }}
                  >
                    <option value="TODAS">Todos los estados</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="APROBADA">Aprobadas</option>
                    <option value="RECHAZADA">Rechazadas</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            {loadingRutas ? (
              <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 className="animate-spin" size={36} color="#29B6F6" style={{ margin: '0 auto' }}/></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f3f4f6', textAlign: 'left', color: '#4b5563' }}>
                      <th style={{ padding: '15px 20px', fontWeight: '600' }}>Solicitud</th>
                      <th style={{ padding: '15px 20px', fontWeight: '600' }}>Empresa / Solicitante</th>
                      <th style={{ padding: '15px 20px', fontWeight: '600' }}>Vehículo</th>
                      <th style={{ padding: '15px 20px', fontWeight: '600' }}>Estado</th>
                      <th style={{ padding: '15px 20px', fontWeight: '600', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const groups = filteredRutas.reduce((acc, ruta) => {
                        const key = `${ruta.numeroSolicitud || 'Sin-ID'}-${ruta.patente || 'Sin-Patente'}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(ruta);
                        return acc;
                      }, {} as Record<string, any[]>);
                      
                      return (Object.entries(groups) as [string, any[]][]).map(([groupKey, groupRoutes]) => (
                        <React.Fragment key={groupKey}>
                          {groupRoutes.length > 1 && (
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '2px solid #e2e8f0' }}>
                              <td colSpan={5} style={{ padding: '10px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>Solicitud: #{groupRoutes[0].numeroSolicitud}</strong>
                                  <span style={{ fontSize: '0.85rem', color: '#475569', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Patente: {groupRoutes[0].patente || 'N/A'}</span>
                                  <span style={{ fontSize: '0.75rem', color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, border: '1px solid #bfdbfe' }}>{groupRoutes.length} recorridos</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {groupRoutes.map(ruta => (
                            <tr key={ruta.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.2s', backgroundColor: groupRoutes.length > 1 ? '#fafafa' : 'transparent' }}>
                              <td style={{ padding: '15px 20px', paddingLeft: groupRoutes.length > 1 ? '40px' : '20px' }}>
                                <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1rem' }}>
                                  {groupRoutes.length > 1 ? <span style={{ fontSize: '0.85rem', color: '#64748b' }}>↳ Recorrido</span> : `#${ruta.numeroSolicitud}`}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>{new Date(ruta.creadoEn).toLocaleDateString('es-AR')}</div>
                              </td>
                              <td style={{ padding: '15px 20px' }}>
                                <div style={{ fontWeight: '500', color: '#374151' }}>{ruta.empresaSolicitante || ruta.nombreSolicitante}</div>
                                {ruta.empresaSolicitante && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{ruta.nombreSolicitante}</div>}
                              </td>
                              <td style={{ padding: '15px 20px' }}>
                                <div style={{ fontWeight: '500', color: '#374151' }}>{ruta.patente || '-'}</div>
                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{ruta.tipoVehiculo || '-'}</div>
                              </td>
                              <td style={{ padding: '15px 20px' }}>
                                <span style={{ 
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.025em',
                                  backgroundColor: ruta.estado === 'APROBADA' ? '#d1fae5' : ruta.estado === 'RECHAZADA' ? '#fee2e2' : '#fef3c7',
                                  color: ruta.estado === 'APROBADA' ? '#065f46' : ruta.estado === 'RECHAZADA' ? '#991b1b' : '#92400e'
                                }}>
                                  {ruta.estado}
                                </span>
                              </td>
                              <td style={{ padding: '15px 20px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                {ruta.enlaceDocumento && (
                                  <a 
                                    href={ruta.enlaceDocumento}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: '500', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                                    title="Ver Documento Original"
                                  >
                                    <FileText size={14} /> PDF
                                  </a>
                                )}
                                <button 
                                  onClick={() => { setEditId(ruta.id); setViewMode('wizard'); }}
                                  style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: '500', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'background-color 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
                                >
                                  <Edit2 size={14} /> Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ));
                    })()}
                    {filteredRutas.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
                          <div style={{ marginBottom: '10px' }}><Truck size={48} color="#d1d5db" style={{ margin: '0 auto' }}/></div>
                          No se encontraron solicitudes que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#f8fafc' }}>
      <NotificacionToast />
      {/* Wizard Header */}
      <header style={{
        height: '70px',
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '4px', display: 'flex', background: 'transparent' }}>
            <img src="/logo-lanus.png" alt="Lanús Logo" style={{ width: '48px', height: 'auto', objectFit: 'contain' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.3px' }}>Viabilidad de Transporte Pesado</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Asistente de registro</p>
          </div>
        </div>
        {/* Progress Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const isActive = num === currentStepNum;
            const isDone = num < currentStepNum;
            return (
              <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && <div style={{ width: '32px', height: '2px', backgroundColor: isDone ? '#3b82f6' : '#e2e8f0', margin: '0 4px', transition: 'background-color 0.3s' }} />}
                <div 
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: isDone ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (isDone) {
                      setStep(num);
                    }
                  }}
                  title={isDone ? `Volver al Paso ${num}` : ''}
                >
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: isActive ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : isDone ? '#eff6ff' : '#f8fafc',
                    color: isActive ? 'white' : isDone ? '#3b82f6' : '#94a3b8',
                    border: isDone || isActive ? 'none' : '1px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '800', fontSize: '13px',
                    boxShadow: isActive ? '0 0 0 4px rgba(59, 130, 246, 0.15), 0 4px 10px rgba(37, 99, 235, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isDone ? 'scale(1.05)' : 'scale(1)'
                  }}
                  onMouseOver={(e) => { if(isDone) e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseOut={(e) => { if(isDone) e.currentTarget.style.transform = 'scale(1.05)'; }}
                  >
                    {isDone ? <CheckCircle size={15} /> : num}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: isActive ? '600' : '500', color: isActive ? '#0f172a' : isDone ? '#3b82f6' : '#94a3b8' }}>
                    {label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: step === 2 ? 'stretch' : 'center', alignItems: step === 2 ? 'stretch' : 'center' }}>
        
        {step !== 2 && (
          <button 
            onClick={() => { setViewMode('home'); setEditId(null); fetchRutasList(); }}
            style={{ 
              position: 'absolute', top: '20px', left: '20px', 
              background: 'white', border: '1px solid #e5e7eb', color: '#4b5563', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '8px 16px', borderRadius: '8px', fontWeight: '500', fontSize: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <ArrowLeft size={16} /> Volver al Inicio
          </button>
        )}

        {step === 1 && (
          <form onSubmit={handleNextStep1} style={cardStyle}>
            {editId && (
              <div style={{ width: '100%', marginBottom: '18px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
                <Edit2 size={20} color="#D97706" style={{ marginRight: '10px' }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#92400E' }}>Modo Edición</div>
                  <div style={{ fontSize: '12px', color: '#B45309' }}>Estás editando un recorrido existente. Los cambios sobreescribirán la traza anterior.</div>
                </div>
              </div>
            )}

            {/* Importar desde Tramites Web Lanús */}
            <div style={{ width: '100%', marginBottom: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e40af' }}>⚡ Importar desde Tramites Web Lanús</div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '1px' }}>Pegá el link QR o el texto completo — la IA completa todo automáticamente</div>
                </div>
                <button type="button" onClick={() => setShowImport(!showImport)} style={{ background: showImport ? '#e0e7ff' : '#2563eb', color: showImport ? '#1e40af' : 'white', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {showImport ? '▲ Cerrar' : '▼ Abrir'}
                </button>
              </div>

              {showImport && (
                <div style={{ background: '#faf5ff', padding: '14px 16px', borderTop: '1px solid #e9d5ff' }}>
                  {/* Input URL rápido */}
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '700', color: '#6b21a8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Opción 1 — Link QR (tramitesweb.lanus.gob.ar/qr/…)
                  </label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                    <input
                      type="url"
                      placeholder="https://tramitesweb.lanus.gob.ar/qr/57786/322454"
                      value={/^https?:\/\/tramitesweb/i.test(importText) ? importText : ''}
                      onChange={e => setImportText(e.target.value)}
                      style={{ ...inputStyle, flex: 1, borderColor: '#d8b4fe', fontSize: '12px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleImport()}
                      disabled={isImporting || !/^https?:\/\/tramitesweb/i.test(importText)}
                      style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', opacity: !/^https?:\/\/tramitesweb/i.test(importText) ? 0.4 : 1 }}
                    >
                      Capturar
                    </button>
                  </div>

                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '700', color: '#6b21a8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Opción 2 — Pegá el texto completo de la solicitud
                  </label>
                  <textarea
                    rows={5}
                    value={/^https?:\/\/tramitesweb/i.test(importText) ? '' : importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={'Copiá y pegá todo el contenido de la página de tramitesweb...\n\nEjemplo:\nDetalle de la solicitud #57786\nApellido Solicitante: AMIANO\nNombre Solicitante: LUCAS HORACIO\nPatente: EWZ046\n...'}
                    style={{ ...inputStyle, resize: 'vertical', borderColor: '#d8b4fe', marginBottom: '10px', fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleImport()}
                    disabled={isImporting || !importText.trim() || /^https?:\/\/tramitesweb/i.test(importText)}
                    style={{ ...primaryBtnStyle, background: isImporting ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: 'none' }}
                  >
                    {isImporting
                      ? <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />Analizando con IA…</>
                      : '🤖 Procesar con IA'}
                  </button>
                </div>
              )}
            </div>

            {/* ── FILA 1: Expediente + ID Web + Vigencias ── */}
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Identificación del Trámite</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>
                    N° Expediente <span style={{ color: '#dc2626' }}>*</span>
                    {numeroSolicitud.trim().length > 0 && <CheckCircle size={14} color="#16a34a" style={{ marginLeft: '6px' }} />}
                  </label>
                  <input type="text" required value={numeroSolicitud} onChange={e => setNumeroSolicitud(e.target.value)} placeholder="1000-2026-964794-O" style={{ ...inputStyle, borderColor: numeroSolicitud.trim().length > 0 ? '#86efac' : '#cbd5e1' }} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>ID Web</label>
                  <input type="text" value={idSolicitudWeb} onChange={e => setIdSolicitudWeb(e.target.value)} placeholder="61433" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Vigencia Desde</label>
                  <input type="text" value={vigenciaDesde} onChange={e => setVigenciaDesde(e.target.value)} placeholder="19/06/2026" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Vigencia Hasta</label>
                  <input type="text" value={vigenciaHasta} onChange={e => setVigenciaHasta(e.target.value)} placeholder="16/12/2026" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>
                    Razón Social / Solicitante <span style={{ color: '#dc2626' }}>*</span>
                    {nombreSolicitante.trim().length > 0 && <CheckCircle size={14} color="#16a34a" style={{ marginLeft: '6px' }} />}
                  </label>
                  <input type="text" required value={nombreSolicitante} onChange={e => setNombreSolicitante(e.target.value)} placeholder="Nombre legal o empresa" style={{ ...inputStyle, borderColor: nombreSolicitante.trim().length > 0 ? '#86efac' : '#cbd5e1' }} />
                </div>
              </div>
            </fieldset>

            {/* ── FILA 2: Vehículo ── */}
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Datos del Vehículo</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>
                    Patente
                    {patente.trim().length > 5 && <CheckCircle size={14} color="#16a34a" style={{ marginLeft: '6px' }} />}
                  </label>
                  <input type="text" value={patente} onChange={e => setPatente(e.target.value)} placeholder="AB123CD" style={{ ...inputStyle, textTransform: 'uppercase', borderColor: patente.trim().length > 5 ? '#86efac' : '#cbd5e1' }} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Tipo de Vehículo</label>
                  <select value={tipoVehiculo} onChange={e => setTipoVehiculo(e.target.value)} style={{ ...inputStyle, backgroundColor: '#fff' }}>
                    <option value="">Seleccione...</option>
                    <option value="Chasis">Chasis</option>
                    <option value="Chasis con Acoplado">Chasis c/ Acoplado</option>
                    <option value="Semi-remolque">Semi-remolque</option>
                    <option value="Bitrén">Bitrén</option>
                    <option value="Maquinaria Especial">Maquinaria Especial</option>
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Peso Total (Tn)</label>
                  <input type="number" step="0.1" value={pesoToneladas} onChange={e => setPesoToneladas(e.target.value)} placeholder="45.5" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>¿Carga Peligrosa?</label>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    padding: '9px 12px', height: '38px',
                    border: `1.5px solid ${cargaPeligrosa ? '#fca5a5' : '#d1d5db'}`,
                    borderRadius: '7px',
                    backgroundColor: cargaPeligrosa ? '#fef2f2' : '#f9fafb',
                  }}>
                    <input type="checkbox" checked={cargaPeligrosa} onChange={e => setCargaPeligrosa(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#dc2626', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: cargaPeligrosa ? '#dc2626' : '#6b7280', fontWeight: cargaPeligrosa ? '600' : '400' }}>
                      {cargaPeligrosa ? '⚠️ Sí' : 'No'}
                    </span>
                  </label>
                </div>
              </div>
            </fieldset>

            {/* ── FILA 3: Seguro ── */}
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Seguro</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Aseguradora</label>
                  <input type="text" value={aseguradora} onChange={e => setAseguradora(e.target.value)} placeholder="Ej: Sancor Seguros" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>N° de Póliza</label>
                  <input type="text" value={nroSeguro} onChange={e => setNroSeguro(e.target.value)} placeholder="123456789" style={inputStyle} />
                </div>
              </div>
            </fieldset>

            <button type="submit" style={primaryBtnStyle}>
              Continuar al Mapa <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </form>
        )}

        {step === 1.5 && parsedInfo && (
          <div style={{ ...cardStyle, maxWidth: '600px' }}>
            <div style={{ marginBottom: '16px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={stepBadgeStyle}>Datos importados</span>
              </div>
              <h2 style={{ margin: '8px 0 2px', fontSize: '17px', fontWeight: '800', color: '#111827' }}>Verificar datos</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Revisá que la información sea correcta antes de continuar.</p>
            </div>

            <div style={{ background: '#f9fafb', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb', color: '#374151', width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <div><strong style={{ color: '#0f172a' }}>ID Web:</strong> {idSolicitudWeb || '-'}</div>
                <div><strong style={{ color: '#0f172a' }}>N° Expediente:</strong> {numeroSolicitud}</div>
                <div><strong style={{ color: '#0f172a' }}>Solicitante:</strong> {nombreSolicitante}</div>
                <div><strong style={{ color: '#0f172a' }}>Patente:</strong> {patente || <span style={{ color: '#94a3b8' }}>No detectada</span>}</div>
                <div><strong style={{ color: '#0f172a' }}>Vehículo:</strong> {tipoVehiculo || <span style={{ color: '#94a3b8' }}>No detectado</span>}</div>
                <div><strong style={{ color: '#0f172a' }}>Peso (Tn):</strong> {pesoToneladas || <span style={{ color: '#94a3b8' }}>No detectado</span>}</div>
                <div><strong style={{ color: '#0f172a' }}>Vigencia Desde:</strong> {vigenciaDesde || '-'}</div>
                <div><strong style={{ color: '#0f172a' }}>Vigencia Hasta:</strong> {vigenciaHasta || '-'}</div>
                <div><strong style={{ color: '#0f172a' }}>Aseguradora:</strong> {aseguradora || '-'}</div>
                <div><strong style={{ color: '#0f172a' }}>N° Seguro:</strong> {nroSeguro || '-'}</div>
                <div>
                  <strong style={{ color: '#0f172a' }}>Carga Peligrosa:</strong> 
                  <span style={{ color: cargaPeligrosa ? '#ef4444' : '#10b981', fontWeight: 'bold', marginLeft: '5px' }}>
                    {cargaPeligrosa ? 'SÍ' : 'NO'}
                  </span>
                </div>
              </div>
              
              {parsedInfo.archivosAdjuntos && parsedInfo.archivosAdjuntos.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#0f172a' }}>Archivos/Croquis Adjuntos detectados:</strong>
                  <ul style={{ margin: '5px 0', paddingLeft: '20px', color: '#0284c7', fontSize: '14px' }}>
                    {parsedInfo.archivosAdjuntos.map((arch: string, i: number) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{arch}</li>
                    ))}
                  </ul>
                </div>
              )}

              {magicUrls && magicUrls.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#0f172a' }}>Previsualización de Croquis (capturados del sistema):</strong>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {magicUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <img src={url} alt="Croquis" style={{ width: '150px', height: '150px', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '5px' }}>Haga clic en la imagen para verla en tamaño completo.</p>
                </div>
              )}
            </div>

            {parsedInfo.recorridosDetalle && parsedInfo.recorridosDetalle.length > 1 && (
              <div style={{ 
                backgroundColor: '#faf5ff', 
                padding: '18px', 
                borderRadius: '8px', 
                marginBottom: '20px', 
                border: '1px solid #e9d5ff',
                width: '100%',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <h3 style={{ fontWeight: 'bold', color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', margin: '0 0 5px 0' }}>
                  <span>🛣️</span> Múltiples recorridos detectados
                </h3>
                <p style={{ fontSize: '12px', color: '#7e22ce', margin: '0 0 12px 0' }}>
                  Todos los recorridos siguientes se agruparán y guardarán en esta misma solicitud.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {parsedInfo.recorridosDetalle.map((r: any, idx: number) => {
                    const hasGeo = parsedInfo.datosGeo && parsedInfo.datosGeo.features && parsedInfo.datosGeo.features.some((f: any) => f.properties.originalIndex === idx);
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#fff',
                        boxShadow: 'none'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>{r.descripcion}</span>
                            {hasGeo ? (
                              <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '12px', fontWeight: 'bold' }}>Trazado IA Listo</span>
                            ) : (
                              <span style={{ fontSize: '10px', padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '12px', fontWeight: 'bold' }}>Solo Texto</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                            {r.calles.join(' ➔ ')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={() => { if (parsedInfo?.datosGeo) setDatosGeo(parsedInfo.datosGeo); setStep(2); }}
                style={{ ...primaryBtnStyle }}>
                Continuar al mapa <ArrowRight size={16} style={{ marginLeft: '6px' }} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'white', padding: '8px 18px', borderRadius: '9999px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                <span style={{ fontWeight: 600, color: '#374151', fontSize: '13px' }}>Dibujá la ruta en el mapa</span>
              </div>

              <div style={{ width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <WizardMap 
                  onComplete={handleMapComplete} 
                  initialGeo={datosGeo}
                  initialWaypoints={savedWaypoints}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={cardStyle}>
            <div style={{ marginBottom: '16px', width: '100%' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: '#111827' }}>Confirmar y enviar</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                Solicitud <strong style={{ color: '#374151' }}>#{numeroSolicitud}</strong>
                {frecuencia ? ` · ${frecuencia}` : ''}
              </p>
                
              {tracedStreets.length > 0 && (
                <div style={{ marginTop: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Navigation size={16} color="#3b82f6" /> Calles Trazadas
                  </p>
                  
                  {tracedStreets.map((routeStreets, idx) => {
                    const isMultiple = tracedStreets.length > 1;
                    const title = isMultiple ? `Recorrido ${idx + 1}` : 'Recorrido Confirmado';
                    const colors = ['#3b82f6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
                    const dotColor = isMultiple ? colors[idx % colors.length] : '#3b82f6';
                    
                    // If it has multiple streets joined by " - ", let's display them nicely
                    const streetList = routeStreets.split(' - ').filter(s => s.trim() !== '');

                    return (
                      <div key={idx} style={{ background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor }}></span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>{title}</span>
                        </div>
                        <div style={{ padding: '10px 12px', fontSize: '12px', color: '#0c4a6e', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {streetList.length > 0 ? (
                            streetList.map((street, sIdx) => (
                              <span key={sIdx} style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', fontWeight: 500 }}>
                                {street}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin calles detectadas</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left', width: '100%' }}>
              <StaticMapPreview geoData={datosGeo} />
              
              <p style={detailStyle}><strong>Solicitud:</strong> {numeroSolicitud}</p>
              <p style={detailStyle}><strong>Solicitante:</strong> {nombreSolicitante}</p>
              
              
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
              <button onClick={() => setStep(2)} style={{ ...btnStyle, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '600', flex: 1 }}>
                Redibujar
              </button>
              <button onClick={handleSubmitFinal} disabled={isSubmitting} style={{ ...primaryBtnStyle, flex: 2, marginTop: 0 }}>
                {isSubmitting ? <Loader2 className="animate-spin" size={16} style={{ marginRight: 6 }} /> : null}
                {isSubmitting ? 'Enviando...' : 'Confirmar y enviar'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal: restaurar borrador ── */}
      {showDraftModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <FileText size={24} color="#2563eb" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>Borrador guardado</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
              Tenés una solicitud sin finalizar.<br />¿Querés retomar desde donde la dejaste?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={discardDraft}
                style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 9, cursor: 'pointer' }}>
                Empezar nueva
              </button>
              <button
                onClick={restoreDraft}
                style={{ flex: 2, padding: '10px', fontSize: 13, fontWeight: 700, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer' }}>
                Retomar solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  minHeight: '100vh',
  backgroundColor: '#f1f5f9',
  padding: '24px 16px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '28px 32px',
  borderRadius: '12px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  border: '1px solid #e5e7eb',
  width: '100%',
  maxWidth: '820px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const stepBadgeStyle: React.CSSProperties = {
  backgroundColor: '#eff6ff',
  color: '#2563eb',
  padding: '3px 10px',
  borderRadius: '9999px',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.04em',
  border: '1px solid #bfdbfe',
};

const sectionStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '12px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '700',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '10px',
};

const fieldsetStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '14px 16px 6px',
  marginBottom: '14px',
  backgroundColor: '#f9fafb',
};

const legendStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '700',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '2px 8px',
  backgroundColor: '#f9fafb',
};

const inputGroupStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '4px',
  fontWeight: '600',
  color: '#374151',
  fontSize: '12px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  fontSize: '13px',
  border: '1px solid #d1d5db',
  borderRadius: '7px',
  color: '#111827',
  backgroundColor: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const btnStyle: React.CSSProperties = {
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '8px',
};

const detailStyle: React.CSSProperties = {
  margin: '0 0 6px 0',
  color: '#374151',
  fontSize: '13px',
};
