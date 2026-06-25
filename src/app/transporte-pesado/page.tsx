'use client';
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Truck, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

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

export default function TransportePesadoWizard() {
  const { dbUser, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [numeroSolicitud, setNumeroSolicitud] = useState('');
  const [idSolicitudWeb, setIdSolicitudWeb] = useState('');
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
        handleImport(textToParse, pdfUrl, qrUrl);
      }
    }
  }, []);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>;
  }

  if (!dbUser || (dbUser.rol !== 'SUPER_ADMIN' && dbUser.rol !== 'ADMINISTRADOR' && dbUser.rol !== 'USUARIO')) {
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

  const handleImport = async (textToImport?: string, pdfUrl?: string | null, qrUrl?: string | null) => {
    // Si viene por argumento (del useEffect) lo usamos, sino usamos el state
    const text = typeof textToImport === 'string' ? textToImport : importText;
    if (!text.trim()) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/parse-solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, pdfUrl: pdfUrl ?? null, qrUrl: qrUrl ?? null })
      });
      const data = await res.json();
      console.log('[parse-solicitud response]', JSON.stringify(data, null, 2));
      if (!res.ok) throw new Error(data.error || 'Error processing text');

      setNumeroSolicitud(data.numeroSolicitud || '');
      setIdSolicitudWeb(data.idSolicitudWeb || '');
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

  const handleSelectRoute = (idx: number) => {
    setSelectedRouteIndex(idx);
    if (parsedInfo && parsedInfo.datosGeo && parsedInfo.datosGeo.features) {
      const feature = parsedInfo.datosGeo.features.find((f: any) => f.properties.originalIndex === idx);
      if (feature) {
        setDatosGeo({
          type: "FeatureCollection",
          features: [feature]
        });
      } else {
        setDatosGeo(null);
      }
    } else {
      setDatosGeo(null);
    }
  };

  const handleNextRouteProcess = () => {
    const nextIdx = selectedRouteIndex + 1;
    setSelectedRouteIndex(nextIdx);
    
    if (parsedInfo && parsedInfo.datosGeo && parsedInfo.datosGeo.features) {
      const feature = parsedInfo.datosGeo.features.find((f: any) => f.properties.originalIndex === nextIdx);
      if (feature) {
        setDatosGeo({
          type: "FeatureCollection",
          features: [feature]
        });
      } else {
        setDatosGeo(null);
      }
    } else {
      setDatosGeo(null);
    }
    
    setStep(1.5);
  };

  const handleMapComplete = (data: any, detectedStreets: string[]) => {
    setDatosGeo(data);
    setStep(3);
  };

  const handleSubmitFinal = async () => {
    setIsSubmitting(true);
    try {
      const routeText = parsedInfo && parsedInfo.recorridosDetalle && parsedInfo.recorridosDetalle[selectedRouteIndex]
        ? parsedInfo.recorridosDetalle[selectedRouteIndex].calles.join(' - ')
        : "";

      const response = await fetch('/api/rutas-transporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroSolicitud,
          idSolicitudWeb,
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
        })
      });

      if (!response.ok) throw new Error('Error saving route');
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
    setSelectedRouteIndex(0);
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
    } catch (err) {
      alert('Error al finalizar la solicitud. Por favor, intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <CheckCircle size={64} color="#10B981" style={{ marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>¡Solicitud Registrada!</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: '30px' }}>
            La solicitud <strong>#{numeroSolicitud}</strong> y todos sus vehículos han sido guardados correctamente. Nuestro equipo los verificará.
          </p>
          <button onClick={() => window.location.reload()} style={btnStyle}>Registrar Otra Solicitud</button>
        </div>
      </div>
    );
  }

  if (step === 2.5) {
    const hasNextRoute = parsedInfo && parsedInfo.recorridosDetalle && selectedRouteIndex < parsedInfo.recorridosDetalle.length - 1;
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <CheckCircle size={48} color="#29B6F6" style={{ marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>¡Recorrido Guardado!</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: '30px' }}>
            El recorrido se ha guardado en la solicitud <strong>#{numeroSolicitud}</strong> como borrador.
            {hasNextRoute && (
              <>
                <br/><br/>
                Esta solicitud contiene múltiples recorridos importados. Quedan <strong>{parsedInfo.recorridosDetalle.length - (selectedRouteIndex + 1)}</strong> recorrido(s) por procesar.
              </>
            )}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
            {hasNextRoute && (
              <button 
                onClick={handleNextRouteProcess} 
                style={{ ...btnStyle, backgroundColor: '#8B5CF6', color: 'white', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}
                disabled={isSubmitting}
              >
                Procesar Siguiente Recorrido ({selectedRouteIndex + 2} de {parsedInfo.recorridosDetalle.length})
              </button>
            )}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', width: '100%' }}>
              <button 
                onClick={handleAddAnotherRoute} 
                style={{ ...btnStyle, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', flex: 1 }}
                disabled={isSubmitting}
              >
                Agregar Otro Vehículo
              </button>
              <button 
                onClick={handleFinishRequest} 
                style={{ ...btnStyle, flex: 1 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Finalizando...' : 'Finalizar Solicitud'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stepLabels = ['Datos', 'Trazado', 'Confirmar'];
  const currentStepNum = step === 1 ? 1 : step === 1.5 ? 1 : step === 2 ? 2 : 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#f0f4f8' }}>
      {/* Wizard Header */}
      <header style={{
        height: '64px',
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 60%, #1565C0 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '7px', display: 'flex' }}>
            <Truck size={24} color="#90CAF9" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '700', letterSpacing: '0.2px' }}>Viabilidad de Transporte Pesado</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#90CAF9', letterSpacing: '0.3px' }}>Municipio de Lanús · Asistente de Registro</p>
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
                {i > 0 && <div style={{ width: '32px', height: '2px', backgroundColor: isDone ? '#90CAF9' : 'rgba(255,255,255,0.25)', margin: '0 4px' }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    backgroundColor: isActive ? '#29B6F6' : isDone ? '#90CAF9' : 'rgba(255,255,255,0.2)',
                    color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 'bold',
                    border: isActive ? '2px solid white' : '2px solid transparent',
                    boxShadow: isActive ? '0 0 0 3px rgba(41,182,246,0.4)' : 'none',
                    transition: 'all 0.3s'
                  }}>
                    {isDone ? '✓' : num}
                  </div>
                  <span style={{ fontSize: '10px', color: isActive ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: isActive ? '600' : '400' }}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: step === 2 ? 'stretch' : 'center' }}>
        
        {step === 1 && (
          <form onSubmit={handleNextStep1} style={cardStyle}>
            {/* Form Header */}
            <div style={{ marginBottom: '24px', textAlign: 'center', borderBottom: '1px solid #e8edf2', paddingBottom: '20px', width: '100%' }}>
              <h2 style={{ margin: '0 0 6px 0', color: '#1a237e', fontSize: '20px', fontWeight: '700' }}>Datos de la Solicitud</h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>Completá los campos o usá el Asistente Mágico para cargar automáticamente.</p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowImport(!showImport)}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(124,58,237,0.35)',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  Asistente Mágico
                </button>
                <a
                  href="/instalar-asistente"
                  target="_blank"
                  style={{
                    backgroundColor: '#f8f5ff',
                    color: '#5b21b6',
                    border: '1.5px solid #c4b5fd',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Instalar Botón
                </a>
              </div>
            </div>

            {showImport && (
              <div style={{ 
                background: 'linear-gradient(to bottom right, #faf5ff, #f3e8ff)', 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '25px', 
                border: '1px solid #e9d5ff',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 6px rgba(0,0,0,0.02)'
              }}>
                <label style={{ ...labelStyle, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                  <span>✨</span> Pegá el texto completo de la solicitud de GDEBA o TramitesWeb:
                </label>
                <textarea 
                  rows={6}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Ejemplo: ID: #61433... Nombre: MONTI OMAR... Patente: AH313BV..."
                  style={{ 
                    ...inputStyle, 
                    resize: 'vertical', 
                    borderColor: '#d8b4fe', 
                    marginBottom: '15px',
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => handleImport()}
                  disabled={isImporting || !importText.trim()}
                  style={{ 
                    ...btnStyle, 
                    background: isImporting ? '#c084fc' : 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)', 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: isImporting ? 'none' : '0 4px 12px rgba(147, 51, 234, 0.3)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                  {isImporting ? <><Loader2 size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Analizando con IA...</> : 'Procesar Texto Mágicamente'}
                </button>
              </div>
            )}

            {/* SECCIÓN: Identificación */}
            <div style={sectionStyle}>
              <div style={sectionLabelStyle}>📋 Identificación del Trámite</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>N° de Solicitud Web (ID)</label>
                  <input type="text" value={idSolicitudWeb} onChange={e => setIdSolicitudWeb(e.target.value)} placeholder="Ej: 61433" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>N° Expediente <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" required value={numeroSolicitud} onChange={e => setNumeroSolicitud(e.target.value)} placeholder="Ej: 1000-2026-964794-O" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Vigencia Desde</label>
                  <input type="text" value={vigenciaDesde} onChange={e => setVigenciaDesde(e.target.value)} placeholder="Ej: 19/06/2026" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Vigencia Hasta</label>
                  <input type="text" value={vigenciaHasta} onChange={e => setVigenciaHasta(e.target.value)} placeholder="Ej: 16/12/2026" style={inputStyle} />
                </div>
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Razón Social / Nombre del Solicitante <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" required value={nombreSolicitante} onChange={e => setNombreSolicitante(e.target.value)} placeholder="Ingrese el nombre legal..." style={inputStyle} />
              </div>
            </div>

            {/* SECCIÓN: Vehículo */}
            <div style={sectionStyle}>
              <div style={sectionLabelStyle}>🚛 Datos del Vehículo</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Patente (Tractor/Acoplado)</label>
                  <input type="text" value={patente} onChange={e => setPatente(e.target.value)} placeholder="Ej: AB123CD" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Tipo de Vehículo</label>
                  <select value={tipoVehiculo} onChange={e => setTipoVehiculo(e.target.value)} style={{ ...inputStyle, backgroundColor: '#fff' }}>
                    <option value="">Seleccione...</option>
                    <option value="Chasis">Chasis</option>
                    <option value="Chasis con Acoplado">Chasis con Acoplado</option>
                    <option value="Semi-remolque">Semi-remolque</option>
                    <option value="Bitrén">Bitrén</option>
                    <option value="Maquinaria Especial">Maquinaria Especial</option>
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Peso Total (Toneladas)</label>
                  <input type="number" step="0.1" value={pesoToneladas} onChange={e => setPesoToneladas(e.target.value)} placeholder="Ej: 45.5" style={inputStyle} />
                </div>
                <div style={{ ...inputGroupStyle, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={labelStyle}>¿Carga Peligrosa?</label>
                  <label style={{
                    display: 'flex', alignItems: 'center', cursor: 'pointer',
                    padding: '11px 14px',
                    border: `2px solid ${cargaPeligrosa ? '#fca5a5' : '#e1e4e8'}`,
                    borderRadius: '8px',
                    backgroundColor: cargaPeligrosa ? '#fef2f2' : '#fafafa',
                    transition: 'all 0.2s',
                    gap: '10px'
                  }}>
                    <input type="checkbox" checked={cargaPeligrosa} onChange={e => setCargaPeligrosa(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#EF4444', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', color: cargaPeligrosa ? '#dc2626' : '#555', fontWeight: cargaPeligrosa ? '600' : '400' }}>
                      {cargaPeligrosa ? '⚠️ Sí, materiales peligrosos' : 'No, carga general'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* SECCIÓN: Seguro */}
            <div style={sectionStyle}>
              <div style={sectionLabelStyle}>🛡️ Datos del Seguro</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Aseguradora</label>
                  <input type="text" value={aseguradora} onChange={e => setAseguradora(e.target.value)} placeholder="Ej: Sancor Seguros" style={inputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>N° de Seguro / Póliza</label>
                  <input type="text" value={nroSeguro} onChange={e => setNroSeguro(e.target.value)} placeholder="Ej: 123456789" style={inputStyle} />
                </div>
              </div>
            </div>

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
                  Seleccione el recorrido que desea procesar y guardar en este paso (se importará 1 por 1):
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {parsedInfo.recorridosDetalle.map((r: any, idx: number) => {
                    const hasGeo = parsedInfo.datosGeo && parsedInfo.datosGeo.features && parsedInfo.datosGeo.features.some((f: any) => f.properties.originalIndex === idx);
                    const isSelected = selectedRouteIndex === idx;
                    return (
                      <label key={idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #a855f7' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#f3e8ff' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 2px 8px rgba(168, 85, 247, 0.15)' : 'none'
                      }}>
                        <input 
                          type="radio" 
                          name="selectedRoute" 
                          checked={isSelected} 
                          onChange={() => handleSelectRoute(idx)}
                          style={{ marginTop: '4px', marginRight: '10px', accentColor: '#7e22ce', width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '13px', color: isSelected ? '#6b21a8' : '#333' }}>{r.descripcion}</span>
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
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button 
                type="button" 
                onClick={() => setStep(2)}
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
  backgroundColor: '#f0f4f8',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '32px 36px',
  borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
  width: '100%',
  maxWidth: '580px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: '24px 0',
  maxHeight: 'calc(100vh - 64px - 48px)',
  overflowY: 'auto',
};

const stepBadgeStyle: React.CSSProperties = {
  backgroundColor: '#EEF2FF',
  color: '#3730a3',
  padding: '4px 14px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const sectionStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '8px',
  backgroundColor: '#f8fafc',
  borderRadius: '10px',
  padding: '16px 18px',
  border: '1px solid #e8edf2',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '700',
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: '14px',
};

const inputGroupStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '12px',
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
  padding: '10px 13px',
  border: '1.5px solid #d1d5db',
  borderRadius: '7px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s',
  backgroundColor: 'white',
  color: '#1f2937',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  backgroundColor: '#374151',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600',
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
