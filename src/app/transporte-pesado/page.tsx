'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, Truck, CheckCircle, ArrowRight, Loader2, Plus, Edit2, ArrowLeft, List, LayoutDashboard, User, Shield, Info, Search, Filter, ExternalLink, FileText, Route, Navigation, ClipboardList, Clock, Zap, ChevronUp, ChevronDown, Bot, AlertTriangle, Copy } from 'lucide-react';
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

  const bookmarkletRef = React.useRef<HTMLAnchorElement>(null);
  const [origin, setOrigin] = useState('https://lanus-gis.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const bookmarkletCode = `javascript:(function(){var main=document.querySelector('.box-body')||document.querySelector('.content-wrapper')||document.querySelector('.content')||document.querySelector('main')||document.body;var text=main.innerText;var pageUrl=window.location.href;var pdfEl=document.querySelector('a[href*=\x22devoluciones/\x22]');var pdfUrl=pdfEl?pdfEl.href:null;var qrEl=Array.from(document.querySelectorAll('a[href*=\x22/qr/\x22]')).find(function(a){return!a.href.includes('/img')});var qrUrl=qrEl?qrEl.href:null;var imgs=Array.from(document.querySelectorAll('a[href]')).filter(function(a){return/\.(png|jpg|jpeg|pdf)$/i.test(a.href)&&(a.href.includes('croquis')||a.href.includes('formularios'))}).map(function(a){return a.href});var payload=JSON.stringify({text:text,pageUrl:pageUrl,pdfUrl:pdfUrl,qrUrl:qrUrl,imageUrls:imgs});window.open('${origin}/transporte-pesado#'+encodeURIComponent(payload),'_blank')})();`;

  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute('href', bookmarkletCode);
    }
  }, [bookmarkletCode]);


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

      let token = '';
      if (user) {
        token = await user.getIdToken();
      }

      const res = await fetch('/api/parse-solicitud', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
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
      <div style={{ minHeight: '100vh', width: '100%', background: '#f0f4f8', fontFamily: '"Inter", system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* ── Estilos ── */}
        <style>{`
          @keyframes tp-orb1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} }
          @keyframes tp-orb2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,30px)} }
          @keyframes tp-dash { to { stroke-dashoffset: -200 } }
          @keyframes tp-fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          .tp-card { transition: transform 0.22s ease, box-shadow 0.22s ease !important; }
          .tp-card:hover { transform: translateY(-4px) !important; }
          .tp-card-blue:hover  { box-shadow: 0 20px 40px rgba(37,99,235,0.14) !important; }
          .tp-card-violet:hover{ box-shadow: 0 20px 40px rgba(124,58,237,0.12) !important; }
          .tp-card-slate:hover { box-shadow: 0 20px 40px rgba(0,0,0,0.09) !important; }
          .tp-arrow { transition: transform 0.18s ease; display:inline-flex; }
          .tp-card:hover .tp-arrow { transform: translateX(4px); }
          .tp-back:hover { background: #e2e8f0 !important; }
          .tp-stat { transition: transform 0.18s ease; cursor:default; }
          .tp-stat:hover { transform: scale(1.04); }
        `}</style>

        {/* ── Fondo suave ── */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
          <div style={{ position:'absolute', top:'-5%', left:'-10%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 65%)', animation:'tp-orb1 14s ease-in-out infinite' }} />
          <div style={{ position:'absolute', bottom:'-10%', right:'-8%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 65%)', animation:'tp-orb2 16s ease-in-out infinite' }} />
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(37,99,235,0.04) 1px, transparent 1px)', backgroundSize:'40px 40px' }} />
        </div>

        {/* ── SVG decorativo ── */}
        <div style={{ position:'absolute', bottom:0, right:0, width:'40%', height:'100%', pointerEvents:'none', zIndex:0, opacity:0.06 }}>
          <svg viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width:'100%', height:'100%' }}>
            <path d="M50 600 L50 400 Q50 380 70 370 L200 310 Q230 296 230 270 L230 200 Q230 170 260 155 L350 110 L350 0" stroke="#1e3a8a" strokeWidth="3" strokeDasharray="12 8" style={{ animation:'tp-dash 3s linear infinite' }} />
            <path d="M100 600 L100 420 Q100 400 120 388 L220 335 Q250 320 250 290 L250 210 Q250 178 285 162 L380 115 L380 0" stroke="#1e3a8a" strokeWidth="1.5" strokeDasharray="6 14" style={{ animation:'tp-dash 4s linear infinite' }} />
            <circle cx="230" cy="270" r="8" fill="#1e3a8a" />
            <circle cx="50"  cy="400" r="5" fill="#1e3a8a" />
            <circle cx="350" cy="110" r="9" fill="#1e3a8a" />
          </svg>
        </div>

        {/* ── Header compacto ── */}
        <header style={{ position:'relative', zIndex:10, padding:'10px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.72)', backdropFilter:'blur(12px)', borderBottom:'1px solid #e5e7eb' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:30, height:30, borderRadius:9, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 10px rgba(37,99,235,0.3)' }}>
              <Truck size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'#0f172a', letterSpacing:'-0.2px', lineHeight:1.2 }}>Transporte Pesado</div>
              <div style={{ fontSize:9.5, color:'#94a3b8', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.07em' }}>Municipio de Lanús</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => router.push('/')} className="tp-back"
              style={{ display:'flex', alignItems:'center', gap:5, background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, padding:'5px 12px', color:'#475569', fontSize:12, fontWeight:600, cursor:'pointer', transition:'background 0.15s' }}>
              <ArrowLeft size={13} /> Volver al mapa
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:9, padding:'5px 10px' }}>
              <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#2563eb,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#fff', fontSize:11 }}>
                {firstName[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#0f172a', lineHeight:1.2 }}>{firstName}</div>
                <div style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>{dbUser?.rol?.replace('_',' ')}</div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <div style={{ position:'relative', zIndex:5, textAlign:'center', padding:'52px 24px 0', animation:'tp-fadein 0.45s ease both' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:999, padding:'5px 14px', marginBottom:20 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', display:'inline-block' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', letterSpacing:'0.07em', textTransform:'uppercase' }}>Portal de Permisos · Lanús</span>
          </div>
          <h1 style={{ margin:'0 0 12px', fontSize:'clamp(28px,4.5vw,46px)', fontWeight:900, color:'#0f172a', letterSpacing:'-1.2px', lineHeight:1.08 }}>
            Bienvenido,{' '}
            <span style={{ background:'linear-gradient(135deg,#2563eb,#7c3aed)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {firstName}
            </span>
          </h1>
          <p style={{ margin:'0 auto', fontSize:14.5, color:'#64748b', maxWidth:420, lineHeight:1.7 }}>
            Gestioná permisos de circulación para vehículos de carga pesada en el partido de Lanús.
          </p>

          {/* Stats */}
          <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:36, flexWrap:'wrap' }}>
            {[
              { n: rutasList.length, label:'Total',      color:'#1d4ed8', bg:'#eff6ff', br:'#bfdbfe' },
              { n: pendientes,       label:'Pendientes', color:'#92400e', bg:'#fffbeb', br:'#fde68a' },
              { n: aprobadas,        label:'Aprobadas',  color:'#065f46', bg:'#ecfdf5', br:'#a7f3d0' },
              { n: rechazadas,       label:'Rechazadas', color:'#991b1b', bg:'#fef2f2', br:'#fecaca' },
            ].map(s => (
              <div key={s.label} className="tp-stat" style={{ background:s.bg, border:`1px solid ${s.br}`, borderRadius:14, padding:'11px 20px', minWidth:84, textAlign:'center' }}>
                <div style={{ fontSize:26, fontWeight:900, color:s.color, lineHeight:1 }}>{s.n}</div>
                <div style={{ fontSize:10, color:s.color, fontWeight:700, marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em', opacity:0.75 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cards ── */}
        <div style={{ position:'relative', zIndex:5, maxWidth:900, margin:'0 auto', padding:'40px 24px 56px', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16, animation:'tp-fadein 0.5s 0.08s ease both' }}>

          {canEdit && (
            <div className="tp-card tp-card-blue" onClick={() => { setEditId(null); setViewMode('wizard'); }}
              style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:20, padding:'28px 24px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#2563eb,#60a5fa)' }} />
              <div style={{ width:48, height:48, borderRadius:13, background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                <Plus size={22} color="#2563eb" strokeWidth={2.5} />
              </div>
              <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:800, color:'#0f172a', letterSpacing:'-0.3px' }}>Nueva Solicitud</h3>
              <p style={{ margin:'0 0 24px', color:'#64748b', fontSize:13, lineHeight:1.65 }}>
                Registrá los datos del vehículo y trazá el recorrido. Podés importar desde Tramites Web con un clic.
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:5, color:'#2563eb', fontWeight:700, fontSize:13 }}>
                <span>Comenzar</span><span className="tp-arrow"><ArrowRight size={14} /></span>
              </div>
            </div>
          )}

          <div className="tp-card tp-card-violet" onClick={() => setViewMode('list')}
            style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:20, padding:'28px 24px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
            <div style={{ width:48, height:48, borderRadius:13, background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'1px solid #ddd6fe', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
              <List size={22} color="#7c3aed" strokeWidth={2} />
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'#0f172a', letterSpacing:'-0.3px' }}>Mis Solicitudes</h3>
              {pendientes > 0 && (
                <span style={{ background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', fontSize:11, fontWeight:800, padding:'2px 9px', borderRadius:999 }}>
                  {pendientes} pend.
                </span>
              )}
            </div>
            <p style={{ margin:'0 0 24px', color:'#64748b', fontSize:13, lineHeight:1.65 }}>
              Historial completo de permisos, estados de aprobación y edición de recorridos.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:5, color:'#7c3aed', fontWeight:700, fontSize:13 }}>
              <span>Ver listado</span><span className="tp-arrow"><ArrowRight size={14} /></span>
            </div>
          </div>

          <div className="tp-card tp-card-slate" onClick={() => router.push('/')}
            style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:20, padding:'28px 24px', cursor:'pointer', position:'relative', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#475569,#94a3b8)' }} />
            <div style={{ width:48, height:48, borderRadius:13, background:'#f8fafc', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
              <MapPin size={22} color="#475569" strokeWidth={2} />
            </div>
            <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:800, color:'#0f172a', letterSpacing:'-0.3px' }}>Volver al Mapa</h3>
            <p style={{ margin:'0 0 24px', color:'#64748b', fontSize:13, lineHeight:1.65 }}>
              Regresá al GIS interactivo de Lanús para ver capas, rutas aprobadas y el mapa en tiempo real.
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:5, color:'#475569', fontWeight:700, fontSize:13 }}>
              <span>Ir al mapa</span><span className="tp-arrow"><ArrowRight size={14} /></span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ position:'relative', zIndex:5, textAlign:'center', paddingBottom:28, color:'#94a3b8', fontSize:11, fontWeight:500, letterSpacing:'0.05em' }}>
          GIS Lanús · Sistema de Información Geográfica · Municipio de Lanús
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#f0f4f8', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* ── Header compacto ── */}
        <header style={{ height: 52, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 20, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-lanus.png" alt="Lanús" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Transporte Pesado</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Panel de Solicitudes · Lanús</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setViewMode('home')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <ArrowLeft size={13} /> Inicio
            </button>
            {canEdit && (
              <button
                onClick={() => { setEditId(null); setViewMode('wizard'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', border: 'none', borderRadius: 8, padding: '5px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
              >
                <Plus size={13} /> Nueva Solicitud
              </button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, padding: '24px 24px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1240, width: '100%', margin: '0 auto', alignSelf: 'center', boxSizing: 'border-box' }}>

          {/* Stats */}
          {!loadingRutas && rutasList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { icon: <ClipboardList size={20} />, label: 'Total Solicitudes', value: rutasList.length, bg: '#eff6ff', color: '#2563eb' },
                { icon: <Clock size={20} />, label: 'Pendientes', value: rutasList.filter(r => r.estado === 'PENDIENTE').length, bg: '#fef9c3', color: '#ca8a04' },
                { icon: <CheckCircle size={20} />, label: 'Aprobadas', value: rutasList.filter(r => r.estado === 'APROBADA').length, bg: '#dcfce7', color: '#16a34a' },
              ].map(({ icon, label, value, bg, color }) => (
                <div key={label} style={{ background: '#fff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          <div style={{ background: '#fff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>
            {/* Barra superior filtros */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#fafbfd' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Listado de Recorridos</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Buscar patente, empresa, N°..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '7px 10px 7px 30px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, outline: 'none', width: 220, background: '#fff', color: '#0f172a' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Filter size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '7px 30px 7px 28px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer', appearance: 'none', color: '#374151' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="TODAS">Todos los estados</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="APROBADA">Aprobadas</option>
                    <option value="RECHAZADA">Rechazadas</option>
                  </select>
                  <svg style={{ position: 'absolute', right: 10, pointerEvents: 'none' }} width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>

            {loadingRutas ? (
              <div style={{ padding: 60, textAlign: 'center' }}><Loader2 className="animate-spin" size={32} color="#2563eb" style={{ margin: '0 auto' }}/></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafbfd', textAlign: 'left' }}>
                      <th style={{ padding: '11px 18px', fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Solicitud</th>
                      <th style={{ padding: '11px 18px', fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empresa / Solicitante</th>
                      <th style={{ padding: '11px 18px', fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vehículo</th>
                      <th style={{ padding: '11px 18px', fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</th>
                      <th style={{ padding: '11px 18px', fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Acciones</th>
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
                            <tr style={{ background: '#f8faff', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e9eef6' }}>
                              <td colSpan={5} style={{ padding: '9px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <strong style={{ color: '#0f172a', fontSize: 13 }}>Solicitud: #{groupRoutes[0].numeroSolicitud}</strong>
                                  <span style={{ fontSize: 11, color: '#475569', background: '#e2e8f0', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Patente: {groupRoutes[0].patente || 'N/A'}</span>
                                  <span style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 20, fontWeight: 600, border: '1px solid #bfdbfe' }}>{groupRoutes.length} recorridos</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {groupRoutes.map(ruta => (
                            <tr
                              key={ruta.id}
                              style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: groupRoutes.length > 1 ? '#fafbfd' : '#fff', transition: 'background 0.15s' }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f8faff')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = groupRoutes.length > 1 ? '#fafbfd' : '#fff')}
                            >
                              <td style={{ padding: '13px 18px', paddingLeft: groupRoutes.length > 1 ? 38 : 18 }}>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                                  {groupRoutes.length > 1 ? <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>↳ Recorrido</span> : `#${ruta.numeroSolicitud}`}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{new Date(ruta.creadoEn).toLocaleDateString('es-AR')}</div>
                              </td>
                              <td style={{ padding: '13px 18px' }}>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{ruta.empresaSolicitante || ruta.nombreSolicitante}</div>
                                {ruta.empresaSolicitante && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{ruta.nombreSolicitante}</div>}
                              </td>
                              <td style={{ padding: '13px 18px' }}>
                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{ruta.patente || '—'}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{ruta.tipoVehiculo || '—'}</div>
                              </td>
                              <td style={{ padding: '13px 18px' }}>
                                <span style={{
                                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                                  backgroundColor: ruta.estado === 'APROBADA' ? '#dcfce7' : ruta.estado === 'RECHAZADA' ? '#fee2e2' : '#fef9c3',
                                  color: ruta.estado === 'APROBADA' ? '#15803d' : ruta.estado === 'RECHAZADA' ? '#b91c1c' : '#a16207'
                                }}>
                                  {ruta.estado}
                                </span>
                              </td>
                              <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                                  {ruta.enlaceDocumento && (
                                    <a
                                      href={ruta.enlaceDocumento}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ padding: '6px 11px', fontSize: 12, fontWeight: 600, backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}
                                      title="Ver Documento Original"
                                    >
                                      <FileText size={13} /> PDF
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      // Pre-llenar datos clonados
                                      setNumeroSolicitud('');
                                      setIdSolicitudWeb('');
                                      setEnlaceDocumento(ruta.enlaceDocumento || '');
                                      setFechaCreacion(ruta.fechaCreacion || '');
                                      setNombreSolicitante(ruta.nombreSolicitante || '');
                                      setEmpresaSolicitante(ruta.empresaSolicitante || '');
                                      setCuilCuit(ruta.cuilCuit || '');
                                      setEmailSolicitante(ruta.emailSolicitante || '');
                                      setTelefonoSolicitante(ruta.telefonoSolicitante || '');
                                      setPatente(ruta.patente || '');
                                      setTipoVehiculo(ruta.tipoVehiculo || '');
                                      setPesoToneladas(ruta.pesoToneladas ? String(ruta.pesoToneladas) : '');
                                      setCargaPeligrosa(ruta.cargaPeligrosa || false);
                                      setTipoCarga(ruta.tipoCarga || '');
                                      setLargoVehiculo(ruta.largoVehiculo || '');
                                      setAnchoVehiculo(ruta.anchoVehiculo || '');
                                      setAlturaVehiculo(ruta.alturaVehiculo || '');
                                      setCantidadEjes(ruta.cantidadEjes ? String(ruta.cantidadEjes) : '');
                                      setAseguradora(ruta.aseguradora || '');
                                      setNroSeguro(ruta.nroSeguro || '');
                                      setOrigenDireccion(ruta.origenDireccion || '');
                                      setOrigenLocalidad(ruta.origenLocalidad || '');
                                      setOrigenPartido(ruta.origenPartido || '');
                                      setOrigenNombre(ruta.origenNombre || '');
                                      setDestinoDireccion(ruta.destinoDireccion || '');
                                      setDestinoLocalidad(ruta.destinoLocalidad || '');
                                      setDestinoPartido(ruta.destinoPartido || '');
                                      setDestinoNombre(ruta.destinoNombre || '');
                                      setFrecuencia(ruta.frecuencia || '');
                                      setHorario(ruta.horario || '');
                                      setObservaciones(ruta.observaciones || '');
                                      setVigenciaDesde(ruta.vigenciaDesde ? new Date(ruta.vigenciaDesde).toISOString().split('T')[0] : '');
                                      setVigenciaHasta(ruta.vigenciaHasta ? new Date(ruta.vigenciaHasta).toISOString().split('T')[0] : '');
                                      // Cargar geometría
                                      if (ruta.datosGeo) {
                                        const geo = typeof ruta.datosGeo === 'string' ? JSON.parse(ruta.datosGeo) : ruta.datosGeo;
                                        setDatosGeo(geo);
                                        if (geo.geometry && geo.geometry.coordinates && geo.geometry.type === 'LineString') {
                                          const coords = geo.geometry.coordinates;
                                          if (coords.length >= 2) {
                                            setSavedWaypoints([
                                              { latLng: { lat: coords[0][1], lng: coords[0][0] } },
                                              { latLng: { lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0] } }
                                            ]);
                                          }
                                        }
                                      }
                                      if (ruta.calles) {
                                        setTracedStreets(ruta.calles.split(' | '));
                                      }
                                      setEditId(null);
                                      setStep(1);
                                      setViewMode('wizard');
                                    }}
                                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.88'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                    title="Clonar solicitud"
                                  >
                                    <Copy size={13} /> Clonar
                                  </button>
                                  <button
                                    onClick={() => { setEditId(ruta.id); setViewMode('wizard'); }}
                                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 6px rgba(109,40,217,0.3)' }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.88'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                  >
                                    <Edit2 size={13} /> Editar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ));
                    })()}
                    {filteredRutas.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '56px 20px', textAlign: 'center' }}>
                          <Truck size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }}/>
                          <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>No se encontraron solicitudes</div>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#f0f4f8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <NotificacionToast />

      {/* ── Wizard Header compacto ── */}
      <header style={{ height: 52, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 20, flexShrink: 0 }}>
        {/* Logo + título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-lanus.png" alt="Lanús" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px', lineHeight: 1.2 }}>Transporte Pesado</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>Asistente de registro · Lanús</div>
          </div>
        </div>

        {/* Stepper centrado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const isActive = num === currentStepNum;
            const isDone = num < currentStepNum;
            return (
              <div key={num} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <div style={{ width: 28, height: 2, background: isDone ? '#2563eb' : '#e2e8f0', margin: '0 6px', borderRadius: 2, transition: 'background 0.3s' }} />
                )}
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: isDone ? 'pointer' : 'default' }}
                  onClick={() => isDone && setStep(num)}
                  title={isDone ? `Volver a ${label}` : ''}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: isActive ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : isDone ? '#eff6ff' : '#f1f5f9',
                    color: isActive ? '#fff' : isDone ? '#2563eb' : '#94a3b8',
                    border: isActive ? 'none' : isDone ? '1.5px solid #bfdbfe' : '1.5px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 11,
                    boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.18), 0 2px 8px rgba(37,99,235,0.25)' : 'none',
                    transition: 'all 0.25s ease',
                  }}>
                    {isDone ? <CheckCircle size={13} strokeWidth={2.5} /> : num}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? '#1d4ed8' : isDone ? '#3b82f6' : '#94a3b8', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón volver */}
        <button
          onClick={() => { setViewMode('home'); setEditId(null); fetchRutasList(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          <ArrowLeft size={13} /> Inicio
        </button>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: step === 2 ? 'stretch' : 'flex-start', alignItems: step === 2 ? 'stretch' : 'center', overflowY: step === 2 ? 'hidden' : 'auto', padding: step === 2 ? 0 : '28px 24px 48px' }}>

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
                    <Zap size={16} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e40af' }}>Importar desde Tramites Web Lanús</div>
                    <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '1px' }}>Pegá el link QR o el texto completo — la IA completa todo automáticamente</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <a
                    ref={bookmarkletRef}
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: 'white', border: '1px solid #c4b5fd', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', cursor: 'grab', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={(e) => e.preventDefault()}
                    title="Arrastrá este botón a tu barra de marcadores"
                  >
                    ✨ Instalar Magia GIS
                  </a>
                  <button type="button" onClick={() => setShowImport(!showImport)} style={{ background: showImport ? '#e0e7ff' : '#2563eb', color: showImport ? '#1e40af' : 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {showImport ? <><ChevronUp size={13}/> Cerrar</> : <><ChevronDown size={13}/> Abrir</>}
                  </button>
                </div>
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
                      : <><Bot size={15} style={{ marginRight: 6 }} />Procesar con IA</>}
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
                      {cargaPeligrosa ? <><AlertTriangle size={13} style={{ marginRight: 3 }} />Sí</> : 'No'}
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
                  <Route size={15} /> Múltiples recorridos detectados
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
                            {r.calles.join(' → ')}
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
  padding: '24px 28px 28px',
  borderRadius: '16px',
  boxShadow: '0 2px 16px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.04)',
  border: '1px solid rgba(226,232,240,0.8)',
  width: '100%',
  maxWidth: '680px',
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
  border: 'none',
  borderLeft: '3px solid #2563eb',
  borderRadius: '0 10px 10px 0',
  padding: '14px 18px 8px',
  marginBottom: '16px',
  backgroundColor: '#f8faff',
  boxShadow: 'inset 0 1px 0 rgba(37,99,235,0.06)',
};

const legendStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: '800',
  color: '#2563eb',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0 0 10px',
  backgroundColor: 'transparent',
};

const inputGroupStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '5px',
  fontWeight: '600',
  color: '#475569',
  fontSize: '11.5px',
  letterSpacing: '0.01em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: '13px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const btnStyle: React.CSSProperties = {
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginTop: '10px',
  boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
  letterSpacing: '0.01em',
};

const detailStyle: React.CSSProperties = {
  margin: '0 0 6px 0',
  color: '#374151',
  fontSize: '13px',
};
