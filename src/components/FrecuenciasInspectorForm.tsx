'use client';

import React, { useState, useMemo } from 'react';
import { X, Calculator, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FrecuenciasInspectorFormProps {
  lineaId: string;
  lineaLabel: string;
  inspectorId?: string;
  onGuardado?: (resultado: any) => void;
  onCancelar: () => void;
}

const toMinutes = (v: string): number | null => {
  const s = (v || '').trim();
  if (!s) return null;
  if (s.includes(':')) {
    const [h, m] = s.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n * 60;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: '#fff',
  border: '1.5px solid #e2e8f0',
  borderRadius: '8px',
  color: '#0f172a',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const hintStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#94a3b8',
  marginTop: '3px',
};

export default function FrecuenciasInspectorForm({
  lineaId,
  lineaLabel,
  inspectorId,
  onGuardado,
  onCancelar,
}: FrecuenciasInspectorFormProps) {
  const [vehiculosObservados, setVehiculosObservados] = useState('8');
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('60');
  const [horaProgramada, setHoraProgramada] = useState('');
  const [horaLlegadaReal, setHoraLlegadaReal] = useState('');
  const [atrasos, setAtrasos] = useState('0');
  const [frecuenciaEsperada, setFrecuenciaEsperada] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  // Vista previa en vivo del cálculo
  const preview = useMemo(() => {
    const veh = Math.max(0, Number(vehiculosObservados) || 0);
    const mins = Math.max(1, Number(tiempoTranscurrido) || 1);
    const freq = Number((veh / (mins / 60)).toFixed(2));
    const prog = toMinutes(horaProgramada);
    const real = toMinutes(horaLlegadaReal);
    const demora = prog !== null && real !== null ? Math.round(real - prog) : 0;
    return { freq, demora };
  }, [vehiculosObservados, tiempoTranscurrido, horaProgramada, horaLlegadaReal]);

  const handleGuardar = async () => {
    const veh = Number(vehiculosObservados);
    const mins = Number(tiempoTranscurrido);
    if (!lineaId || isNaN(veh) || veh < 0 || isNaN(mins) || mins < 1) {
      toast.error('Completá vehículos observados y tiempo de observación válidos');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/frecuencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineaId,
          inspectorId: inspectorId || undefined,
          vehiculosObservados: veh,
          tiempoTranscurrido: mins,
          horaProgramada: horaProgramada || undefined,
          horaLlegadaReal: horaLlegadaReal || undefined,
          atrasos: Number(atrasos) || 0,
          frecuenciaEsperada: frecuenciaEsperada === '' ? undefined : Number(frecuenciaEsperada),
          observaciones: observaciones || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la inspección');
      setResultado(data);
      toast.success(`Frecuencia real: ${data.frecuenciaReal} viajes/h`);
      onGuardado?.(data);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar la inspección');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onCancelar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Inspección de frecuencia</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{lineaLabel}</div>
          </div>
          <button onClick={onCancelar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '6px', display: 'flex' }} title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Vista previa del cálculo */}
          <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Frecuencia real (previa)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>{preview.freq.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>vi/h</span></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Demora (previa)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: preview.demora > 0 ? '#f87171' : '#34d399' }}>
                {preview.demora > 0 ? `+${preview.demora}` : preview.demora} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>min</span>
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Vehículos observados *</label>
            <input type="number" min="0" step="1" value={vehiculosObservados} onChange={(e) => setVehiculosObservados(e.target.value)} placeholder="Ej: 8" style={inputStyle} />
            <div style={hintStyle}>Cantidad de colectivos vistos durante la observación</div>
          </div>

          <div>
            <label style={labelStyle}>Tiempo de observación (minutos) *</label>
            <input type="number" min="1" step="1" value={tiempoTranscurrido} onChange={(e) => setTiempoTranscurrido(e.target.value)} placeholder="Ej: 60" style={inputStyle} />
            <div style={hintStyle}>Duración de la observación en minutos</div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Hora programada</label>
              <input type="text" value={horaProgramada} onChange={(e) => setHoraProgramada(e.target.value)} placeholder="08:00" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Hora llegada real</label>
              <input type="text" value={horaLlegadaReal} onChange={(e) => setHoraLlegadaReal(e.target.value)} placeholder="08:12" style={inputStyle} />
            </div>
          </div>
          <div style={hintStyle}>Formato HH:MM (ej. 08:00) u horas decimales (ej. 8.5 = 8:30)</div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Atrasos observados</label>
              <input type="number" min="0" step="1" value={atrasos} onChange={(e) => setAtrasos(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Frec. programada (vi/h)</label>
              <input type="number" min="0" step="0.1" value={frecuenciaEsperada} onChange={(e) => setFrecuenciaEsperada(e.target.value)} placeholder="Ej: 4" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Observaciones del inspector</label>
            <textarea rows={3} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Tráfico, clima, eventos que afectaron el servicio..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {resultado && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CheckCircle size={18} color="#16a34a" />
              <div style={{ fontSize: '0.82rem', color: '#14532d' }}>
                Guardado: <strong>{resultado.frecuenciaReal} vi/h</strong> · demora <strong>{resultado.tiempoDemoraMinutos} min</strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancelar}
            disabled={isSaving}
            style={{ padding: '10px 16px', borderRadius: '8px', background: '#fff', border: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Cerrar
          </button>
          <button
            onClick={handleGuardar}
            disabled={isSaving}
            style={{ flex: 1, padding: '10px 20px', borderRadius: '8px', background: isSaving ? '#94a3b8' : 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            {isSaving ? 'Guardando...' : 'Calcular y guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
