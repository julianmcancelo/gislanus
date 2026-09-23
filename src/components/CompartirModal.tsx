'use client';
import React, { useState } from 'react';
import { Share2, X, Copy, Check, QrCode, Sparkles, CheckSquare, Square, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface CompartirModalProps {
  isOpen: boolean;
  onClose: () => void;
  capasConfig: any[];
}

export default function CompartirModal({ isOpen, onClose, capasConfig }: CompartirModalProps) {
  const [capasSeleccionadas, setCapasSeleccionadas] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('Vista Personalizada GIS Lanús');
  const [permitirReclamos, setPermitirReclamos] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Al abrir el modal, preseleccionar las capas activas en el mapa
  React.useEffect(() => {
    if (isOpen) {
      setGeneratedUrl(null);
      setCopied(false);
      const activas = capasConfig.filter((c) => c.active).map((c) => c.id);
      setCapasSeleccionadas(activas.length > 0 ? activas : capasConfig.map((c) => c.id));
    }
  }, [isOpen, capasConfig]);

  if (!isOpen) return null;

  const toggleCapa = (id: string) => {
    setCapasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const seleccionarTodas = () => setCapasSeleccionadas(capasConfig.map((c) => c.id));
  const deseleccionarTodas = () => setCapasSeleccionadas([]);

  const handleCrearEnlace = async () => {
    if (capasSeleccionadas.length === 0) {
      alert('Seleccioná al menos 1 capa para generar el enlace.');
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch('/api/compartir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          capasPermitidas: capasSeleccionadas,
          permitirReclamos,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar enlace');

      const fullUrl = `${window.location.origin}/v/${data.token}`;
      setGeneratedUrl(fullUrl);
    } catch (err: any) {
      alert(err.message || 'Error al crear enlace');
    } finally {
      setIsGenerating(false);
    }
  };

  const copiarAlPortapapeles = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="hide-on-print"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={18} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                Generar Enlace Directo & QR
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Acceso público sin inicio de sesión con visibilidad acotada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '78vh', overflowY: 'auto' }}>
          
          {!generatedUrl ? (
            <>
              {/* Título de la vista */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '4px' }}>
                  Nombre de la vista personalizada:
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Vista Recorrido Línea 45"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    color: '#0f172a',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Selección de Capas Concedidas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                    Capas y Trazos permitidos ({capasSeleccionadas.length}):
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={seleccionarTodas}
                      style={{ background: '#eff6ff', border: 'none', color: '#2563eb', fontSize: '0.7rem', fontWeight: 700, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={deseleccionarTodas}
                      style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                    >
                      Ninguna
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {capasConfig.map((capa) => {
                    const isChecked = capasSeleccionadas.includes(capa.id);
                    return (
                      <label
                        key={capa.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: isChecked ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                          background: isChecked ? '#f0f6ff' : '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCapa(capa.id)}
                            style={{ width: '15px', height: '15px', accentColor: '#2563eb', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                              {capa.subGrupo?.nombre ? `${capa.subGrupo.nombre} - ` : ''}{capa.nombre}
                            </span>
                            {capa.grupo?.nombre && (
                              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                {capa.grupo.nombre}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: capa.color || '#2563eb' }} />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Opción adicional Reclamos */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={permitirReclamos}
                  onChange={(e) => setPermitirReclamos(e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: 600 }}>
                  Permitir ver la capa de Reclamos SAT en esta vista pública
                </span>
              </label>
            </>
          ) : (
            /* Vista del Enlace Generado y Código QR */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', width: '100%', color: '#166534', fontWeight: 700, fontSize: '0.82rem' }}>
                Enlace directo y Token generados correctamente
              </div>

              <div style={{ padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <QRCodeSVG value={generatedUrl} size={160} />
              </div>

              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Acceso directo sin inicio de sesión acotado a las capas seleccionadas.
              </p>

              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input
                  type="text"
                  readOnly
                  value={generatedUrl}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    background: '#f8fafc',
                    color: '#1e293b',
                    fontWeight: 600,
                  }}
                />
                <button
                  onClick={copiarAlPortapapeles}
                  style={{
                    background: copied ? '#16a34a' : '#2563eb',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '0 16px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? '¡Copiado!' : 'Copiar Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            background: '#fafbfd',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: '#fff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>

          {!generatedUrl && (
            <button
              type="button"
              onClick={handleCrearEnlace}
              disabled={isGenerating || capasSeleccionadas.length === 0}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                background: isGenerating || capasSeleccionadas.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isGenerating || capasSeleccionadas.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isGenerating ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
              }}
            >
              <QrCode size={16} />
              {isGenerating ? 'Generando Token...' : 'Generar Link & QR'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
