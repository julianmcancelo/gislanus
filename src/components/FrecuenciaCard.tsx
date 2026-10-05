'use client';

import React from 'react';
import { Clock, Truck, ShieldCheck } from 'lucide-react';

interface FrecuenciaCardProps {
  linea: {
    nombre: string;
    numero?: string | null;
    frecuencia?: number | null;
    frecuenciaCalculada?: number | null;
    frecuenciaEsperada?: number | null;
    tiempoDemoraPromedio?: number | null;
    ultimaInspeccion?: string | Date | null;
    estado?: string;
  };
  showCalculada?: boolean;
  onInspeccionar?: () => void;
}

export default function FrecuenciaCard({ linea, showCalculada = true, onInspeccionar }: FrecuenciaCardProps) {
  const nombre = linea.nombre || 'Línea sin nombre';
  const numero = linea.numero ? `#${linea.numero}` : '';
  const freqActual = linea.frecuenciaCalculada ?? linea.frecuencia ?? 0;
  const freqEsperada = linea.frecuenciaEsperada ?? null;
  const tiempoDemora = linea.tiempoDemoraPromedio ?? 0;
  const esActivo = linea.estado !== 'PENDIENTE' && linea.estado !== 'CANCELADO' && linea.estado !== 'INACTIVO';

  // Determinar el color e ícono basado en el estado
  let colorBg = 'rgba(17, 24, 39, 0.8)';
  let Icono = Truck;
  let tituloEstado = 'Sin definir';

  if (!esActivo) {
    colorBg = 'rgba(107, 114, 128, 0.5)';
    Icono = ShieldCheck;
    tituloEstado = 'Inactiva';
  } else if (freqActual > 0 && freqEsperada && freqActual >= freqEsperada * 0.9) {
    colorBg = 'rgba(34, 197, 94, 0.3)'; // verde claro
    Icono = ShieldCheck;
    tituloEstado = 'Óptima';
  } else if (freqActual > 0 && freqEsperada && freqActual < freqEsperada * 0.9) {
    colorBg = 'rgba(239, 68, 68, 0.3)'; // rojo claro
    Icono = Clock;
    tituloEstado = 'Insuficiente';
  } else if (freqActual > 0) {
    colorBg = 'rgba(245, 158, 11, 0.3)'; // ámbar
    Icono = Clock;
    tituloEstado = 'Verificar';
  }

  return (
    <div style={{
      backgroundColor: colorBg,
      border: '1px solid rgba(107, 114, 128, 0.3)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      color: '#f1f5f9',
      minHeight: '200px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icono size={24} color="#f1f5f9" />
        </div>
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: '0' }}>{nombre}</h4>
          <p style={{ fontSize: '0.75rem', margin: '2px 0 0', color: '#94a3b8' }}>
            {numero}
          </p>
          <p style={{ fontSize: '0.75rem', margin: '4px 0 0', color: '#94a3b8' }}>{tituloEstado}</p>
        </div>
      </div>

      {/* Frecuencia info */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Frecuencia</span>
          <span style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: esActivo ? '#10b981' : '#f87171',
            lineHeight: '1'
          }}>
            {Number(freqActual).toFixed(2)} viajes/hr
          </span>
        </div>

        {showCalculada && freqEsperada !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Programada</span>
            <span style={{
              fontSize: '1rem',
              color: '#64748b',
              textDecoration: 'line-through'
            }}>
              {Number(freqEsperada).toFixed(2)} viajes/hr
            </span>
          </div>
        )}

        {showCalculada && tiempoDemora !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Demora avg</span>
            <span style={{
              fontSize: '1rem',
              color: tiempoDemora > 0 ? '#f87171' : '#34d399',
              fontWeight: 500
            }}>
              {tiempoDemora} min
            </span>
          </div>
        )}
      </div>

      {/* Acciones/Inspector */}
      <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(107, 114, 128, 0.2)', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <small style={{ fontSize: '0.7rem', color: '#64748b' }}>
          Última inspección: {linea.ultimaInspeccion
            ? new Date(linea.ultimaInspeccion).toLocaleDateString('es-AR')
            : 'Nunca'}
        </small>
        <button
          onClick={onInspeccionar}
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#93c5fd',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '0.65rem',
            cursor: 'pointer'
          }}
        >
          Inspeccionar
        </button>
      </div>
    </div>
  );
}
