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
  const [nombreSolicitante, setNombreSolicitante] = useState('');
  const [patente, setPatente] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState('');
  const [pesoToneladas, setPesoToneladas] = useState('');
  const [cargaPeligrosa, setCargaPeligrosa] = useState(false);
  const [idSolicitudWeb, setIdSolicitudWeb] = useState('');
  const [vigenciaDesde, setVigenciaDesde] = useState('');
  const [vigenciaHasta, setVigenciaHasta] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [nroSeguro, setNroSeguro] = useState('');
  const [datosGeo, setDatosGeo] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<any>(null);
  const [magicUrls, setMagicUrls] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashContent = decodeURIComponent(window.location.hash.substring(1));
      let textToParse = hashContent;
      let urls: string[] = [];

      try {
        const payload = JSON.parse(hashContent);
        if (payload.text) {
          textToParse = payload.text;
        }
        if (payload.urls && Array.isArray(payload.urls)) {
          urls = payload.urls;
        }
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
      if (!res.ok) throw new Error(data.error || 'Error processing text');

      if (data.numeroSolicitud) setNumeroSolicitud(data.numeroSolicitud);
      if (data.nombreSolicitante) setNombreSolicitante(data.nombreSolicitante);
      if (data.patente) setPatente(data.patente);
      if (data.tipoVehiculo) setTipoVehiculo(data.tipoVehiculo);
      if (data.pesoToneladas) setPesoToneladas(data.pesoToneladas.toString());
      if (data.cargaPeligrosa !== undefined) setCargaPeligrosa(data.cargaPeligrosa);
      if (data.idSolicitudWeb) setIdSolicitudWeb(data.idSolicitudWeb);
      if (data.vigenciaDesde) setVigenciaDesde(data.vigenciaDesde);
      if (data.vigenciaHasta) setVigenciaHasta(data.vigenciaHasta);
      if (data.aseguradora) setAseguradora(data.aseguradora);
      if (data.nroSeguro) setNroSeguro(data.nroSeguro);
      
      setParsedInfo(data);
      setStep(1.5); // Vamos al paso de revisión
    } catch (err) {
      alert('Hubo un error importando el texto. Por favor verifique el formato e intente nuevamente.');
      console.error(err);
    } finally {
      setIsImporting(false);
      setShowImport(false);
    }
  };

  const handleMapComplete = (data: any, detectedStreets: string[]) => {
    setDatosGeo(data);
    setStep(3);
  };

  const handleSubmitFinal = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/rutas-transporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroSolicitud,
          nombreSolicitante,
          patente,
          tipoVehiculo,
          pesoToneladas,
          cargaPeligrosa,
          idSolicitudWeb,
          vigenciaDesde,
          vigenciaHasta,
          aseguradora,
          nroSeguro,
          datosGeo: JSON.stringify(datosGeo),
          calles: ""
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
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <CheckCircle size={48} color="#29B6F6" style={{ marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>¡Recorrido Guardado!</h2>
          <p style={{ color: '#666', textAlign: 'center', marginBottom: '30px' }}>
            El recorrido para el vehículo <strong>{patente || 'Sin patente'}</strong> se ha guardado en la solicitud <strong>#{numeroSolicitud}</strong> como borrador.
            <br/><br/>
            ¿Desea registrar otro vehículo para esta misma solicitud o finalizar el proceso?
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button 
              onClick={handleAddAnotherRoute} 
              style={{ ...btnStyle, backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
              disabled={isSubmitting}
            >
              Agregar Otro Vehículo
            </button>
            <button 
              onClick={handleFinishRequest} 
              style={btnStyle}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Finalizando...' : 'Finalizar Solicitud Completa'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#f5f7fa' }}>
      {/* Wizard Header */}
      <header style={{ 
        height: '70px', 
        backgroundColor: '#4A4A4A', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 30px', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        zIndex: 10
      }}>
        <Truck size={28} color="#29B6F6" style={{ marginRight: '15px' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Viabilidad de Transporte Pesado</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#bbb' }}>Asistente de Registro de Traza</p>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: step === 2 ? 'stretch' : 'center' }}>
        
        {step === 1 && (
          <form onSubmit={handleNextStep1} style={cardStyle}>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <span style={stepBadgeStyle}>Paso 1 de 3</span>
              <h2 style={{ margin: '15px 0 5px 0', color: '#333' }}>Datos de la Solicitud</h2>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>Vincule esta traza con su trámite actual.</p>
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowImport(!showImport)}
                  style={{ 
                    ...btnStyle, 
                    background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', 
                    margin: 0,
                    width: 'auto', 
                    padding: '10px 20px', 
                    fontSize: '14px',
                    boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-6-6m6-6v6h-6"/><path d="M17 10c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5Z"/><path d="m3 21 6-6"/><path d="M7 10C4.24 10 2 12.24 2 15s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5Z"/></svg>
                  Asistente Mágico
                </button>
                <a 
                  href="/instalar-asistente" 
                  target="_blank"
                  style={{ 
                    ...btnStyle, 
                    backgroundColor: '#fff', 
                    color: '#6b21a8', 
                    border: '1px solid #d8b4fe',
                    margin: 0,
                    width: 'auto', 
                    padding: '10px 20px', 
                    fontSize: '14px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>N° de Solicitud Web (ID)</label>
                <input 
                  type="text" 
                  value={idSolicitudWeb} 
                  onChange={e => setIdSolicitudWeb(e.target.value)} 
                  placeholder="Ej: 61433"
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>N° Expediente</label>
                <input 
                  type="text" 
                  required 
                  value={numeroSolicitud} 
                  onChange={e => setNumeroSolicitud(e.target.value)} 
                  placeholder="Ej: 1000-2026-964794-O"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Vigencia Desde</label>
                <input 
                  type="text" 
                  value={vigenciaDesde} 
                  onChange={e => setVigenciaDesde(e.target.value)} 
                  placeholder="Ej: 19/06/2026"
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Vigencia Hasta</label>
                <input 
                  type="text" 
                  value={vigenciaHasta} 
                  onChange={e => setVigenciaHasta(e.target.value)} 
                  placeholder="Ej: 16/12/2026"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Razón Social / Nombre del Solicitante</label>
              <input 
                type="text" 
                required 
                value={nombreSolicitante} 
                onChange={e => setNombreSolicitante(e.target.value)} 
                placeholder="Ingrese el nombre legal..."
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Patente (Tractor/Acoplado)</label>
                <input 
                  type="text" 
                  value={patente} 
                  onChange={e => setPatente(e.target.value)} 
                  placeholder="Ej: AB123CD"
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Tipo de Vehículo</label>
                <select 
                  value={tipoVehiculo} 
                  onChange={e => setTipoVehiculo(e.target.value)}
                  style={{...inputStyle, backgroundColor: '#fff'}}
                >
                  <option value="">Seleccione...</option>
                  <option value="Chasis">Chasis</option>
                  <option value="Chasis con Acoplado">Chasis con Acoplado</option>
                  <option value="Semi-remolque">Semi-remolque</option>
                  <option value="Bitrén">Bitrén</option>
                  <option value="Maquinaria Especial">Maquinaria Especial</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Peso Total (Toneladas)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={pesoToneladas} 
                  onChange={e => setPesoToneladas(e.target.value)} 
                  placeholder="Ej: 45.5"
                  style={inputStyle}
                />
              </div>
              <div style={{ ...inputGroupStyle, justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
                <label style={{...labelStyle, marginBottom: '8px'}}>¿Carga Peligrosa?</label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={cargaPeligrosa} 
                    onChange={e => setCargaPeligrosa(e.target.checked)}
                    style={{ width: '18px', height: '18px', marginRight: '8px', accentColor: '#EF4444' }}
                  />
                  <span style={{ fontSize: '14px', color: cargaPeligrosa ? '#EF4444' : '#666', fontWeight: cargaPeligrosa ? 'bold' : 'normal' }}>
                    {cargaPeligrosa ? 'Sí, incluye materiales peligrosos' : 'No, carga general'}
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Aseguradora</label>
                <input 
                  type="text" 
                  value={aseguradora} 
                  onChange={e => setAseguradora(e.target.value)} 
                  placeholder="Ej: Sancor Seguros"
                  style={inputStyle}
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>N° de Seguro / Póliza</label>
                <input 
                  type="text" 
                  value={nroSeguro} 
                  onChange={e => setNroSeguro(e.target.value)} 
                  placeholder="Ej: 123456789"
                  style={inputStyle}
                />
              </div>
            </div>

            <button type="submit" style={{ ...btnStyle, marginTop: '10px' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
  backgroundColor: '#f5f7fa',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white',
  padding: '40px',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  width: '100%',
  maxWidth: '500px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const stepBadgeStyle: React.CSSProperties = {
  backgroundColor: '#29B6F6',
  color: 'white',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const inputGroupStyle: React.CSSProperties = {
  width: '100%',
  marginBottom: '20px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontWeight: 'bold',
  color: '#444',
  fontSize: '14px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 15px',
  border: '2px solid #e1e4e8',
  borderRadius: '8px',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  backgroundColor: '#4A4A4A',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.2s',
};

const detailStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  color: '#444',
  fontSize: '15px',
};
