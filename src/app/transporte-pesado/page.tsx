'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, Truck, CheckCircle, ArrowRight, Loader2, Plus, Edit2, ArrowLeft, List, LayoutDashboard, User, Shield, Info, Search, Filter, ExternalLink, FileText, Route, Navigation } from 'lucide-react';


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
  const urlEditId = searchParams.get('editId');
  const { dbUser, loading } = useAuth();
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
          if (window.confirm('Tenés una solicitud a medio cargar guardada en borrador. ¿Querés restaurarla?')) {
            try {
              const parsed = JSON.parse(draft);
              if (parsed.numeroSolicitud) setNumeroSolicitud(parsed.numeroSolicitud);
              if (parsed.nombreSolicitante) setNombreSolicitante(parsed.nombreSolicitante);
              if (parsed.empresaSolicitante) setEmpresaSolicitante(parsed.empresaSolicitante);
              if (parsed.cuilCuit) setCuilCuit(parsed.cuilCuit);
              if (parsed.emailSolicitante) setEmailSolicitante(parsed.emailSolicitante);
              if (parsed.telefonoSolicitante) setTelefonoSolicitante(parsed.telefonoSolicitante);
              if (parsed.patente) setPatente(parsed.patente);
              if (parsed.tipoVehiculo) setTipoVehiculo(parsed.tipoVehiculo);
              if (parsed.pesoToneladas) setPesoToneladas(parsed.pesoToneladas);
              if (parsed.cargaPeligrosa) setCargaPeligrosa(parsed.cargaPeligrosa);
              if (parsed.tipoCarga) setTipoCarga(parsed.tipoCarga);
              if (parsed.largoVehiculo) setLargoVehiculo(parsed.largoVehiculo);
              if (parsed.anchoVehiculo) setAnchoVehiculo(parsed.anchoVehiculo);
              if (parsed.alturaVehiculo) setAlturaVehiculo(parsed.alturaVehiculo);
              if (parsed.cantidadEjes) setCantidadEjes(parsed.cantidadEjes);
              if (parsed.aseguradora) setAseguradora(parsed.aseguradora);
              if (parsed.nroSeguro) setNroSeguro(parsed.nroSeguro);
              if (parsed.origenDireccion) setOrigenDireccion(parsed.origenDireccion);
              if (parsed.origenLocalidad) setOrigenLocalidad(parsed.origenLocalidad);
              if (parsed.origenPartido) setOrigenPartido(parsed.origenPartido);
              if (parsed.origenNombre) setOrigenNombre(parsed.origenNombre);
              if (parsed.destinoDireccion) setDestinoDireccion(parsed.destinoDireccion);
              if (parsed.destinoLocalidad) setDestinoLocalidad(parsed.destinoLocalidad);
              if (parsed.destinoPartido) setDestinoPartido(parsed.destinoPartido);
              if (parsed.destinoNombre) setDestinoNombre(parsed.destinoNombre);
              if (parsed.frecuencia) setFrecuencia(parsed.frecuencia);
              if (parsed.horario) setHorario(parsed.horario);
              if (parsed.observaciones) setObservaciones(parsed.observaciones);
              if (parsed.vigenciaDesde) setVigenciaDesde(parsed.vigenciaDesde);
              if (parsed.vigenciaHasta) setVigenciaHasta(parsed.vigenciaHasta);
            } catch (e) {
              console.error('Error loading draft', e);
            }
          } else {
            localStorage.removeItem('lanus-transporte-draft');
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
      const res = await fetch('/api/rutas-transporte');
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
    if (viewMode === 'list') {
      fetchRutasList();
    }
  }, [viewMode]);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>;
  }

  const isSuperAdmin = dbUser?.rol === 'SUPER_ADMIN';
  const hasAccess = isSuperAdmin || (dbUser?.permisos?.verRutas ?? false);

  if (!dbUser || !hasAccess) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa', padding: '20px', textAlign: 'center' }}>
        <Truck size={64} color="#ccc" style={{ marginBottom: '20px' }} />
        <h2 style={{ color: '#333' }}>Acceso Restringido</h2>
        <p style={{ color: '#666', maxWidth: '400px', lineHeight: '1.6' }}>
          No tenés permisos para acceder al Asistente de Transporte Pesado. Por favor, iniciá sesión con una cuenta autorizada o contactá a un administrador.
        </p>
        <a href="/" style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#29B6F6', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
          Volver al Mapa
        </a>
      </div>
    );
  }

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (numeroSolicitud.trim() && nombreSolicitante.trim()) {
      setStep(2);
    }
  };

  const handleImport = async (textToImport?: string) => {
    // Si viene por argumento (del useEffect) lo usamos, sino usamos el state
    const text = typeof textToImport === 'string' ? textToImport : importText;
    if (!text.trim()) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/parse-solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
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
        const firstFeature = data.datosGeo.features.find((f: any) => f.properties.originalIndex === 0) || data.datosGeo.features[0];
        setDatosGeo({
          type: "FeatureCollection",
          features: [firstFeature]
        });
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

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      setIsSuccess(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lanus-transporte-draft');
      }
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
              }} 
              style={{ ...btnStyle, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}
            >
              <Plus size={18} /> Cargar un nuevo trámite
            </button>
            <button 
              onClick={() => { setIsSuccess(false); setViewMode('list'); fetchRutasList(); }} 
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

  const filteredRutas = rutasList.filter(ruta => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      (ruta.patente && ruta.patente.toLowerCase().includes(term)) ||
      (ruta.numeroSolicitud && ruta.numeroSolicitud.toString().includes(term));
    
    const matchesStatus = filterStatus === 'TODAS' || ruta.estado === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (viewMode === 'home') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc' }}>
        {/* Modern Header */}
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
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Municipio de Lanús</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>{dbUser?.nombre || dbUser?.email}</div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{dbUser?.rol}</div>
            </div>
            <div style={{ background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
              <User size={20} color="#64748b" />
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', letterSpacing: '-0.5px' }}>
              Hola, {dbUser?.nombre?.split(' ')[0] || 'Usuario'}
            </h2>
            <p style={{ fontSize: '16px', color: '#475569', lineHeight: '1.6' }}>
              Bienvenido al portal de Transporte Pesado. Seleccioná qué acción deseás realizar para continuar.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', width: '100%', maxWidth: '800px' }}>
            
            {/* Card Nueva Solicitud */}
            <div 
              onClick={() => { setEditId(null); setViewMode('wizard'); }}
              style={{
                background: 'white',
                borderRadius: '24px',
                padding: '40px 32px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}></div>
              <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={32} color="#2563eb" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px 0' }}>Nueva Solicitud</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
                Crear una nueva solicitud de tránsito pesado. Vas a poder registrar los datos del vehículo y dibujar el recorrido.
              </p>
              <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', color: '#2563eb', fontWeight: '600', fontSize: '14px', gap: '6px' }}>
                Comenzar ahora <ArrowRight size={16} />
              </div>
            </div>

            {/* Card Gestionar */}
            <div 
              onClick={() => setViewMode('list')}
              style={{
                background: 'white',
                borderRadius: '24px',
                padding: '40px 32px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = '#c4b5fd';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }}></div>
              <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <List size={32} color="#7c3aed" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px 0' }}>Gestionar Solicitudes</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
                Visualizá el listado completo de solicitudes cargadas. Podés ver estados y editar recorridos existentes.
              </p>
              <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', color: '#7c3aed', fontWeight: '600', fontSize: '14px', gap: '6px' }}>
                Ver listado <ArrowRight size={16} />
              </div>
            </div>

          </div>
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
            <button 
              onClick={() => { setEditId(null); setViewMode('wizard'); }} 
              style={{ ...btnStyle, margin: 0, width: 'auto', padding: '8px 16px', backgroundColor: '#2563eb', borderColor: '#1d4ed8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: 'white' }}
            >
              <Plus size={16} /> Nueva Solicitud
            </button>
          </div>
        </header>

        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
          <div style={{ ...cardStyle, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <h2 style={{ margin: 0, color: '#374151', fontSize: '1.2rem' }}>Listado de Recorridos</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input 
                    type="text" 
                    placeholder="Buscar patente o N°..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '8px 12px 8px 32px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', width: '200px' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Filter size={16} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px 8px 32px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', backgroundColor: 'white', cursor: 'pointer' }}
                  >
                    <option value="TODAS">Todos los estados</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="APROBADA">Aprobadas</option>
                    <option value="RECHAZADA">Rechazadas</option>
                  </select>
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
                    {filteredRutas.map(ruta => (
                      <tr key={ruta.id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '15px 20px' }}>
                          <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1rem' }}>#{ruta.numeroSolicitud}</div>
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
          <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '12px', padding: '8px', display: 'flex', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
            <Truck size={24} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.3px' }}>Viabilidad de Transporte Pesado</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Municipio de Lanús · Asistente de Registro</p>
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: isActive ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : isDone ? '#eff6ff' : '#f8fafc',
                    color: isActive ? 'white' : isDone ? '#3b82f6' : '#94a3b8',
                    border: isDone || isActive ? 'none' : '1px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '800', fontSize: '13px',
                    boxShadow: isActive ? '0 0 0 4px rgba(59, 130, 246, 0.15), 0 4px 10px rgba(37, 99, 235, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}>
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

            {/* Asistente Mágico banner */}
            <div style={{ width: '100%', marginBottom: '18px', background: 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#4c1d95' }}>✨ Asistente Mágico</div>
                <div style={{ fontSize: '12px', color: '#6d28d9', marginTop: '2px' }}>Pegá el texto de GDEBA y completamos todo automáticamente</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button type="button" onClick={() => setShowImport(!showImport)} style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: 'white', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {showImport ? 'Cerrar' : 'Usar'}
                </button>
                <a href="/instalar-asistente" target="_blank" style={{ backgroundColor: 'white', color: '#5b21b6', border: '1px solid #c4b5fd', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Instalar
                </a>
              </div>
            </div>

            {showImport && (
              <div style={{ width: '100%', background: '#faf5ff', padding: '14px 16px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e9d5ff' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#6b21a8', fontSize: '13px' }}>
                  Pegá el texto completo de la solicitud:
                </label>
                <textarea rows={5} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Ejemplo: ID: #61433... Nombre: MONTI OMAR... Patente: AH313BV..." style={{ ...inputStyle, resize: 'vertical', borderColor: '#d8b4fe', marginBottom: '10px' }} />
                <button type="button" onClick={() => handleImport()} disabled={isImporting || !importText.trim()} style={{ ...primaryBtnStyle, background: isImporting ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: 'none' }}>
                  {isImporting ? <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />Analizando con IA...</> : 'Procesar automáticamente'}
                </button>
              </div>
            )}

            {/* ── FILA 1: Expediente + ID Web + Vigencias ── */}
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Identificación del Trámite</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>N° Expediente <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" required value={numeroSolicitud} onChange={e => setNumeroSolicitud(e.target.value)} placeholder="1000-2026-964794-O" style={inputStyle} />
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
                  <label style={labelStyle}>Razón Social / Solicitante <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" required value={nombreSolicitante} onChange={e => setNombreSolicitante(e.target.value)} placeholder="Nombre legal o empresa" style={inputStyle} />
                </div>
              </div>
            </fieldset>

            {/* ── FILA 2: Vehículo ── */}
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Datos del Vehículo</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Patente</label>
                  <input type="text" value={patente} onChange={e => setPatente(e.target.value)} placeholder="AB123CD" style={{ ...inputStyle, textTransform: 'uppercase' }} />
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
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <span style={{ ...stepBadgeStyle, backgroundColor: '#F3E8FF', color: '#6B21A8' }}>Revisión de IA</span>
              <h2 style={{ margin: '15px 0 5px 0', color: '#333' }}>Datos Extraídos</h2>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Por favor, verifique que la información detectada sea correcta.</p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0', color: '#334155' }}>
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
                onClick={() => {
                  setDatosGeo(parsedInfo.datosGeo);
                  setStep(2);
                }}
                style={{ ...btnStyle, display: 'flex', justifyContent: 'center' }}>
                Continuar al Mapa para Dibujar la Ruta <ArrowRight size={18} style={{ marginLeft: '8px' }} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'white', padding: '15px 25px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ backgroundColor: '#E1F5FE', color: '#0288D1', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                <span style={{ fontWeight: 500, color: '#333' }}>Dibuje la ruta en el mapa</span>
              </div>

              <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid #E1F5FE' }}>
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
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <span style={stepBadgeStyle}>Paso 3 de 3</span>
              <h2 style={{ margin: '15px 0 5px 0', color: '#333' }}>Confirmar Traza</h2>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}><strong>Frecuencia:</strong> {parsedInfo?.frecuencia || 'No especificada'}</p>
                
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

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={() => setStep(2)} style={{ ...btnStyle, backgroundColor: '#888', flex: 1 }}>Re-dibujar</button>
              <button onClick={handleSubmitFinal} disabled={isSubmitting} style={{ ...btnStyle, flex: 2, display: 'flex', justifyContent: 'center' }}>
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar y Enviar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Inline Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#f8fafc',
  backgroundImage: 'radial-gradient(circle at top right, rgba(41, 182, 246, 0.08) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.08) 0%, transparent 40%)',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(12px)',
  padding: '32px',
  borderRadius: '20px',
  boxShadow: '0 10px 40px -10px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(15, 23, 42, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.7)',
  width: '100%',
  maxWidth: '820px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: '24px 16px',
  maxHeight: 'calc(100vh - 64px - 40px)',
  overflowY: 'auto',
  transition: 'all 0.3s ease',
};

const stepBadgeStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#334155',
  padding: '6px 16px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
};

const sectionStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '12px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '20px 22px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '800',
  color: '#0f172a',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '18px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const fieldsetStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '16px 18px 8px',
  marginBottom: '16px',
  backgroundColor: '#f8fafc',
  transition: 'all 0.2s ease',
};

const legendStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '800',
  color: '#334155',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  padding: '4px 12px',
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
};

const inputGroupStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '8px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: '600',
  color: '#374151',
  fontSize: '13px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  fontSize: '13px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  color: '#334155',
  backgroundColor: '#ffffff',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
  transition: 'all 0.2s',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '9px',
  fontSize: '16px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(29,78,216,0.35)',
  marginTop: '8px',
  letterSpacing: '0.2px',
};

const detailStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  color: '#444',
  fontSize: '15px',
};
