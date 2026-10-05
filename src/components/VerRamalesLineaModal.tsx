'use client';
import React, { useMemo } from 'react';
import { X, Printer, MapPin, Route } from 'lucide-react';

interface VerRamalesLineaModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineaLabel: string;
  numero: string | null;
  color: string;
  categoria: string;
  records: any[];
  onPrint: (records: any[], label: string) => void;
}

export default function VerRamalesLineaModal({
  isOpen,
  onClose,
  lineaLabel,
  numero,
  color,
  categoria,
  records,
  onPrint,
}: VerRamalesLineaModalProps) {
  const catBadgeColor =
    categoria === 'NACIONAL'
      ? '#0369a1'
      : categoria === 'PROVINCIAL'
        ? '#064e3b'
        : categoria === 'MUNICIPAL'
          ? '#92400e'
          : '#64748b';
  const catBgColor =
    categoria === 'NACIONAL'
      ? '#e0f2fe'
      : categoria === 'PROVINCIAL'
        ? '#dcfce7'
        : categoria === 'MUNICIPAL'
          ? '#fef3c7'
          : '#f8fafc';

  const idas = useMemo(
    () => records.filter((r: any) => (r.sentido || '').toUpperCase() === 'IDA'),
    [records]
  );
  const vueltas = useMemo(
    () => records.filter((r: any) => (r.sentido || '').toUpperCase() === 'VUELTA'),
    [records]
  );
  const sinSentido = useMemo(
    () =>
      records.filter((r: any) => {
        const s = (r.sentido || '').toUpperCase();
        return s !== 'IDA' && s !== 'VUELTA';
      }),
    [records]
  );

  if (!isOpen) return null;

  const renderRecord = (l: any, sentidoLabel: string, sentidoColor: string) => (
    <div
      key={l.id}
      style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
      }}
    >
      <div
        style={{
          width: 36,
          height: 24,
          borderRadius: 6,
          background: l.color || color || '#2563eb',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {l.numero || numero || '#'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
          {l.subcategoria || l.nombre || 'Ramal Principal'}
        </div>
        {l.descripcion && (
          <div
            style={{
              fontSize: '0.7rem',
              color: '#64748b',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {l.descripcion}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 800,
          color: sentidoColor,
          background: sentidoLabel === 'IDA' ? '#eff6ff' : sentidoLabel === 'VUELTA' ? '#f5f3ff' : '#f8fafc',
          border: `1px solid ${sentidoLabel === 'IDA' ? '#bfdbfe' : sentidoLabel === 'VUELTA' ? '#ddd6fe' : '#e2e8f0'}`,
          padding: '3px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {sentidoLabel}
      </span>
      {l.frecuenciaCalculada != null && l.frecuenciaCalculada > 0 && (
        <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>
          {Number(l.frecuenciaCalculada).toFixed(1)} vi/h
        </span>
      )}
    </div>
  );

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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              width: 44,
              height: 34,
              borderRadius: 8,
              background: color || '#2563eb',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}
          >
            {numero || '#'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{lineaLabel}</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  color: catBadgeColor,
                  background: catBgColor,
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}
              >
                {categoria}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Route size={12} />
              {records.length} ramal{records.length !== 1 ? 'es' : ''} · {idas.length} IDA · {vueltas.length} VUELTA
              {sinSentido.length > 0 ? ` · ${sinSentido.length} sin sentido` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: todos los ramales agrupados por sentido */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fafbfc' }}>
          {idas.length > 0 && (
            <div>
              <div
                style={{
                  padding: '10px 16px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#1d4ed8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Ida — {idas.length}
              </div>
              {idas.map((l: any) => renderRecord(l, 'IDA', '#1d4ed8'))}
            </div>
          )}
          {vueltas.length > 0 && (
            <div>
              <div
                style={{
                  padding: '10px 16px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#6d28d9',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Vuelta — {vueltas.length}
              </div>
              {vueltas.map((l: any) => renderRecord(l, 'VUELTA', '#6d28d9'))}
            </div>
          )}
          {sinSentido.length > 0 && (
            <div>
              <div
                style={{
                  padding: '10px 16px 6px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Sin sentido — {sinSentido.length}
              </div>
              {sinSentido.map((l: any) => renderRecord(l, 'S/SENTIDO', '#475569'))}
            </div>
          )}
          {records.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              <MapPin size={28} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
              No hay ramales en esta línea.
            </div>
          )}
        </div>

        {/* Footer: ver en plano + imprimir */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #f1f5f9',
            background: '#fff',
            display: 'flex',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#fff',
              border: '1.5px solid #e2e8f0',
              color: '#475569',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Cerrar
          </button>
          <button
            onClick={() => onPrint(records, lineaLabel)}
            style={{
              flex: 1,
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.85rem',
            }}
          >
            <Printer size={16} /> Imprimir todos los ramales ({records.length})
          </button>
        </div>
      </div>
    </div>
  );
}
