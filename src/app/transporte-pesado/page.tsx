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
  const [datosGeo, setDatosGeo] = useState<any>(null);
  const [calles, setCalles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (numeroSolicitud.trim() && nombreSolicitante.trim()) {
      setStep(2);
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
            </div>

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

            <button type="submit" style={{ ...btnStyle, marginTop: '10px' }}>
              Continuar al Mapa <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </button>
          </form>
        )}

        {step === 2 && (
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'white', padding: '15px 25px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ ...stepBadgeStyle, marginBottom: 0 }}>Paso 2</span>
              <span style={{ fontWeight: 'bold', color: '#333' }}>Dibuje la ruta del transporte.</span>
              <span style={{ color: '#666', fontSize: '13px' }}>(Haga clic en el mapa para trazar, doble clic para terminar)</span>
            </div>
            
            <WizardMap onComplete={handleMapComplete} />
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
                <strong style={{ color: '#333', display: 'block', marginBottom: '8px' }}>Calles detectadas en la ruta:</strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '1.5' }}>
                  {calles.length > 0 ? calles.map((s, i) => (
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
