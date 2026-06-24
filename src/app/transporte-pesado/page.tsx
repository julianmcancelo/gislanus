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

export default function TransportePesadoWizard() {
  const [step, setStep] = useState(1);
  const [numeroSolicitud, setNumeroSolicitud] = useState('');
  const [nombreSolicitante, setNombreSolicitante] = useState('');
  const [patente, setPatente] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState('');
  const [pesoToneladas, setPesoToneladas] = useState('');
  const [cargaPeligrosa, setCargaPeligrosa] = useState(false);
  const [datosGeo, setDatosGeo] = useState<any>(null);
  const [calles, setCalles] = useState<string[]>([]);
  const [liveStreets, setLiveStreets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showRepetitions, setShowRepetitions] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<any>(null);

  const callesToDisplay = showRepetitions 
    ? calles.map((s, i) => calles.indexOf(s) < i ? `${s} (Vuelve a pasar)` : s)
    : Array.from(new Set(calles));

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
          if (payload.urls) urls = payload.urls;
        }
      } catch (e) {
        // Fallback: no era JSON, era solo texto (marcador viejo)
      }

      if (textToParse && textToParse.trim().length > 10) {
        setImportText(textToParse);
        setMagicUrls(urls);
        setShowImport(true);
        // Clear hash silently
        window.history.replaceState(null, '', window.location.pathname);
        handleImport(textToParse);
      }
    }
  }, []);

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
    setCalles(detectedStreets);
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
          datosGeo: JSON.stringify(datosGeo),
          calles: calles.join(', ')
        })
      });

      if (!response.ok) throw new Error('Error saving route');
      setIsSuccess(true);
    } catch (err) {
      alert('Error al guardar la solicitud. Por favor, intente nuevamente.');
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
            La traza de transporte pesado para la solicitud <strong>#{numeroSolicitud}</strong> ha sido guardada correctamente. Nuestro equipo la verificará.
          </p>
          <button onClick={() => window.location.reload()} style={btnStyle}>Registrar Otra Solicitud</button>
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
              
              <button 
                type="button" 
                onClick={() => setShowImport(!showImport)}
                style={{ ...btnStyle, backgroundColor: '#8B5CF6', marginTop: '15px', width: 'auto', padding: '8px 16px', fontSize: '14px' }}>
                ✨ Importar desde Sistema de Trámites
              </button>
            </div>

            {showImport && (
              <div style={{ backgroundColor: '#F3E8FF', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #D8B4FE' }}>
                <label style={{ ...labelStyle, color: '#6B21A8' }}>Pegue el detalle de la solicitud aquí:</label>
                <textarea 
                  rows={6}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Pegue todo el texto de la solicitud (ID, Solicitante, Recorrido, etc)..."
                  style={{ ...inputStyle, resize: 'vertical', borderColor: '#D8B4FE', marginBottom: '10px' }}
                />
                <button 
                  type="button" 
                  onClick={() => handleImport()}
                  disabled={isImporting || !importText.trim()}
                  style={{ ...btnStyle, backgroundColor: isImporting ? '#C4B5FD' : '#7C3AED', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  {isImporting ? <><Loader2 size={18} className="animate-spin" style={{ marginRight: '8px' }} /> Analizando con IA...</> : 'Procesar Texto'}
                </button>
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>N° de Solicitud</label>
              <input 
                type="text" 
                required 
                value={numeroSolicitud} 
                onChange={e => setNumeroSolicitud(e.target.value)} 
                placeholder="Ej: EXP-2026-12345"
                style={inputStyle}
              />
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
                <div><strong style={{ color: '#0f172a' }}>N° Solicitud:</strong> {numeroSolicitud}</div>
                <div><strong style={{ color: '#0f172a' }}>Solicitante:</strong> {nombreSolicitante}</div>
                <div><strong style={{ color: '#0f172a' }}>Patente:</strong> {patente || <span style={{ color: '#94a3b8' }}>No detectada</span>}</div>
                <div><strong style={{ color: '#0f172a' }}>Vehículo:</strong> {tipoVehiculo || <span style={{ color: '#94a3b8' }}>No detectado</span>}</div>
                <div><strong style={{ color: '#0f172a' }}>Peso (Tn):</strong> {pesoToneladas || <span style={{ color: '#94a3b8' }}>No detectado</span>}</div>
                <div>
                  <strong style={{ color: '#0f172a' }}>Carga Peligrosa:</strong> 
                  <span style={{ color: cargaPeligrosa ? '#ef4444' : '#10b981', fontWeight: 'bold', marginLeft: '5px' }}>
                    {cargaPeligrosa ? 'SÍ' : 'NO'}
                  </span>
                </div>
              </div>
              
              {parsedInfo.calles && parsedInfo.calles.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ color: '#0f172a' }}>Ruta a trazar (Punto a Punto):</strong>
                  <div style={{ margin: '8px 0', padding: '10px', backgroundColor: '#e2e8f0', borderRadius: '6px', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                    {parsedInfo.calles.map((calle: string, i: number) => (
                      <span key={i}>
                        {calle}
                        {i < parsedInfo.calles.length - 1 && <strong style={{ margin: '0 8px', color: '#8b5cf6' }}>→</strong>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                onClick={() => {
                  if (parsedInfo.datosGeo) {
                    setDatosGeo(parsedInfo.datosGeo);
                    setCalles(parsedInfo.calles || []);
                    setStep(3);
                  } else {
                    alert('No se pudo generar la ruta automática. Por favor dibujela en el mapa.');
                    setStep(2);
                  }
                }}
                style={{ ...btnStyle, display: 'flex', justifyContent: 'center' }}>
                Continuar y Dibujar Ruta Automática <ArrowRight size={18} style={{ marginLeft: '8px' }} />
              </button>
              
              <button 
                type="button" 
                onClick={() => setStep(2)}
                style={{ ...btnStyle, backgroundColor: '#fff', color: '#4A4A4A', border: '1px solid #ccc', display: 'flex', justifyContent: 'center' }}>
                Omitir y Dibujar Ruta Manualmente
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', width: '100%', height: '100%' }}>
            {/* Contenedor del Mapa (Ocupa el resto del espacio) */}
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'white', padding: '15px 25px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ backgroundColor: '#E1F5FE', color: '#0288D1', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                <span style={{ fontWeight: 500, color: '#333' }}>Dibuje la ruta en el mapa</span>
              </div>

              {liveStreets.length > 0 && (
                <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '15px 25px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', maxWidth: '80%', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <MapPin color="#0288D1" size={24} />
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>Calle actual</h4>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{liveStreets[liveStreets.length - 1]}</p>
                  </div>
                </div>
              )}

              <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid #E1F5FE' }}>
                <WizardMap 
                  onComplete={handleMapComplete} 
                  onLiveUpdate={setLiveStreets} 
                  suggestedRoute={parsedInfo?.datosGeo}
                />
              </div>
            </div>

            {/* Panel de Asistencia IA (Ocupa 350px a la derecha si hay parsedInfo) */}
            {parsedInfo && (
              <div style={{ width: '350px', marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px' }}>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #D8B4FE', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span style={{ backgroundColor: '#8B5CF6', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>ASISTENCIA IA</span>
                  </div>
                  
                  <h4 style={{ color: '#334155', marginTop: 0, marginBottom: '10px', fontSize: '15px' }}>Recorrido Solicitado:</h4>
                  <div style={{ backgroundColor: '#FFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', color: '#475569', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                    {parsedInfo.calles && parsedInfo.calles.map((calle: string, i: number) => (
                      <span key={i}>
                        {calle}
                        {i < parsedInfo.calles.length - 1 && <strong style={{ margin: '0 5px', color: '#8b5cf6' }}>→</strong>}
                      </span>
                    ))}
                    {(!parsedInfo.calles || parsedInfo.calles.length === 0) && (
                      <i>No se detectaron calles específicas.</i>
                    )}
                  </div>

                  {magicUrls && magicUrls.length > 0 && (
                    <>
                      <h4 style={{ color: '#334155', marginTop: 0, marginBottom: '10px', fontSize: '15px' }}>Croquis Adjuntos:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {magicUrls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                            <img src={url} alt="Croquis" style={{ width: '100%', objectFit: 'contain', backgroundColor: '#f1f5f9' }} />
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
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
              
              <div style={{ marginTop: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#333' }}>Calles detectadas en la ruta:</strong>
                  {calles.length !== new Set(calles).size && (
                    <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: '#666' }}>
                      <input 
                        type="checkbox" 
                        checked={showRepetitions} 
                        onChange={(e) => setShowRepetitions(e.target.checked)} 
                      />
                      Mostrar repetidas
                    </label>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '1.5' }}>
                  {callesToDisplay.length > 0 ? callesToDisplay.map((s, i) => (
                    <li key={i}>{s}</li>
                  )) : <li>Ruta sin calles identificadas</li>}
                </ul>
              </div>
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
