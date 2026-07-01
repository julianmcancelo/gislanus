'use client';
import React, { useState, useEffect } from 'react';
import { X, Truck, Calendar, Users, MapPin, Copy } from 'lucide-react';

interface CloneRutaModalProps {
  isOpen: boolean;
  ruta: any;
  onClose: () => void;
  onClone: (cloneData: any, fieldsToChange: string[]) => Promise<void>;
  isLoading?: boolean;
}

export default function CloneRutaModal({ isOpen, ruta, onClose, onClone, isLoading = false }: CloneRutaModalProps) {
  console.log('CloneRutaModal renderizado - isOpen:', isOpen, 'ruta:', ruta);
  const [changeVehicle, setChangeVehicle] = useState(true);
  const [changeVigencia, setChangeVigencia] = useState(false);

  const [patente, setPatente] = useState('');
  const [tipoVehiculo, setTipoVehiculo] = useState('');
  const [pesoToneladas, setPesoToneladas] = useState('');
  const [largoVehiculo, setLargoVehiculo] = useState('');
  const [anchoVehiculo, setAnchoVehiculo] = useState('');
  const [alturaVehiculo, setAlturaVehiculo] = useState('');
  const [cantidadEjes, setCantidadEjes] = useState('');
  const [cargaPeligrosa, setCargaPeligrosa] = useState(false);
  const [tipoCarga, setTipoCarga] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [nroSeguro, setNroSeguro] = useState('');

  const [vigenciaDesde, setVigenciaDesde] = useState('');
  const [vigenciaHasta, setVigenciaHasta] = useState('');
  const [numeroSolicitudNuevo, setNumeroSolicitudNuevo] = useState('');
  const [expedienteNuevo, setExpedienteNuevo] = useState('');

  useEffect(() => {
    if (ruta) {
      setPatente(ruta.patente || '');
      setTipoVehiculo(ruta.tipoVehiculo || '');
      setPesoToneladas(ruta.pesoToneladas || '');
      setLargoVehiculo(ruta.largoVehiculo || '');
      setAnchoVehiculo(ruta.anchoVehiculo || '');
      setAlturaVehiculo(ruta.alturaVehiculo || '');
      setCantidadEjes(ruta.cantidadEjes || '');
      setCargaPeligrosa(ruta.cargaPeligrosa || false);
      setTipoCarga(ruta.tipoCarga || '');
      setAseguradora(ruta.aseguradora || '');
      setNroSeguro(ruta.nroSeguro || '');
      setVigenciaDesde(ruta.vigenciaDesde ? new Date(ruta.vigenciaDesde).toISOString().split('T')[0] : '');
      setVigenciaHasta(ruta.vigenciaHasta ? new Date(ruta.vigenciaHasta).toISOString().split('T')[0] : '');
    }
  }, [ruta]);

  const handleClone = async () => {
    if (!numeroSolicitudNuevo.trim()) {
      alert('⚠️ Debe completar el Número de Solicitud');
      return;
    }
    if (!expedienteNuevo.trim()) {
      alert('⚠️ Debe completar el Expediente');
      return;
    }

    const fieldsToChange: string[] = ['numeroSolicitud', 'idSolicitudWeb'];
    const cloneData: any = {
      numeroSolicitud: numeroSolicitudNuevo,
      idSolicitudWeb: expedienteNuevo,
    };

    if (changeVehicle) {
      fieldsToChange.push('patente', 'tipoVehiculo', 'pesoToneladas', 'largoVehiculo', 'anchoVehiculo', 'alturaVehiculo', 'cantidadEjes', 'cargaPeligrosa', 'tipoCarga', 'aseguradora', 'nroSeguro');
      cloneData.patente = patente;
      cloneData.tipoVehiculo = tipoVehiculo;
      cloneData.pesoToneladas = pesoToneladas ? parseFloat(pesoToneladas) : null;
      cloneData.largoVehiculo = largoVehiculo;
      cloneData.anchoVehiculo = anchoVehiculo;
      cloneData.alturaVehiculo = alturaVehiculo;
      cloneData.cantidadEjes = cantidadEjes ? parseInt(cantidadEjes) : null;
      cloneData.cargaPeligrosa = cargaPeligrosa;
      cloneData.tipoCarga = tipoCarga;
      cloneData.aseguradora = aseguradora;
      cloneData.nroSeguro = nroSeguro;
    }

    if (changeVigencia) {
      fieldsToChange.push('vigenciaDesde', 'vigenciaHasta');
      cloneData.vigenciaDesde = vigenciaDesde ? new Date(vigenciaDesde) : null;
      cloneData.vigenciaHasta = vigenciaHasta ? new Date(vigenciaHasta) : null;
    }

    try {
      await onClone(cloneData, fieldsToChange);
      onClose();
    } catch (error) {
      console.error('Error al clonar:', error);
    }
  };

  if (!isOpen || !ruta) return null;

  const originDestino = `${ruta.origenNombre || ruta.origenDireccion || 'Sin origen'} → ${ruta.destinoNombre || ruta.destinoDireccion || 'Sin destino'}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'white', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Copy size={20} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              Clonar Solicitud #{ruta.numeroSolicitud}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
              padding: '4px', display: 'flex', alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Información de la ruta original */}
          <div style={{
            background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '10px',
            padding: '16px', marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Información de la Ruta Original
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} color="#10b981" style={{ flexShrink: 0 }} />
                <strong>{originDestino}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={14} color="#8b5cf6" style={{ flexShrink: 0 }} />
                <span>{ruta.nombreSolicitante || 'N/A'}</span>
                {ruta.empresaSolicitante && <span style={{ color: '#64748b' }}>({ruta.empresaSolicitante})</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span><strong>Patente:</strong> {ruta.patente || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Nueva Solicitud y Expediente */}
          <div style={{
            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px',
            padding: '16px', marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📝 Nueva Solicitud y Expediente
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Número Solicitud *</label>
                <input
                  type="text"
                  value={numeroSolicitudNuevo}
                  onChange={(e) => setNumeroSolicitudNuevo(e.target.value)}
                  disabled={isLoading}
                  placeholder="Ej: 1000-2026-964795-O"
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                    fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#fffbeb'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Expediente/ID Web *</label>
                <input
                  type="text"
                  value={expedienteNuevo}
                  onChange={(e) => setExpedienteNuevo(e.target.value)}
                  disabled={isLoading}
                  placeholder="ID del expediente web"
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                    fontSize: '12px', backgroundColor: '#fffbeb'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Checkboxes - Qué cambiar */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✏️ ¿Qué deseas cambiar?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                padding: '10px', borderRadius: '8px', backgroundColor: changeVehicle ? '#f0fdf4' : 'transparent',
                border: changeVehicle ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                transition: 'all 0.15s'
              }}>
                <input
                  type="checkbox"
                  checked={changeVehicle}
                  onChange={(e) => setChangeVehicle(e.target.checked)}
                  disabled={isLoading}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>🚗 Patente/Vehículo</span>
              </label>

              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                padding: '10px', borderRadius: '8px', backgroundColor: changeVigencia ? '#fef3c7' : 'transparent',
                border: changeVigencia ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                transition: 'all 0.15s'
              }}>
                <input
                  type="checkbox"
                  checked={changeVigencia}
                  onChange={(e) => setChangeVigencia(e.target.checked)}
                  disabled={isLoading}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>📅 Vigencia (desde/hasta)</span>
              </label>
            </div>
          </div>

          {/* Vehículo - Solo si está seleccionado */}
          {changeVehicle && (
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
              padding: '16px', marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} color="#f59e0b" /> Datos del Vehículo
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Patente *</label>
                  <input
                    type="text"
                    value={patente}
                    onChange={(e) => setPatente(e.target.value)}
                    disabled={isLoading}
                    placeholder="AAA-111"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px', fontFamily: 'monospace'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Tipo de Vehículo</label>
                  <input
                    type="text"
                    value={tipoVehiculo}
                    onChange={(e) => setTipoVehiculo(e.target.value)}
                    disabled={isLoading}
                    placeholder="Camión Chasis, Acoplado, etc."
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Peso (Tn)</label>
                  <input
                    type="number"
                    value={pesoToneladas}
                    onChange={(e) => setPesoToneladas(e.target.value)}
                    disabled={isLoading}
                    placeholder="10.5"
                    step="0.1"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Largo (m)</label>
                  <input
                    type="text"
                    value={largoVehiculo}
                    onChange={(e) => setLargoVehiculo(e.target.value)}
                    disabled={isLoading}
                    placeholder="8.5"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Ancho (m)</label>
                  <input
                    type="text"
                    value={anchoVehiculo}
                    onChange={(e) => setAnchoVehiculo(e.target.value)}
                    disabled={isLoading}
                    placeholder="2.5"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Alto (m)</label>
                  <input
                    type="text"
                    value={alturaVehiculo}
                    onChange={(e) => setAlturaVehiculo(e.target.value)}
                    disabled={isLoading}
                    placeholder="3.2"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Cantidad de Ejes</label>
                  <input
                    type="number"
                    value={cantidadEjes}
                    onChange={(e) => setCantidadEjes(e.target.value)}
                    disabled={isLoading}
                    placeholder="3"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Tipo de Carga</label>
                  <input
                    type="text"
                    value={tipoCarga}
                    onChange={(e) => setTipoCarga(e.target.value)}
                    disabled={isLoading}
                    placeholder="Contenedor, Granel, etc."
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    padding: '8px 10px', borderRadius: '6px', backgroundColor: cargaPeligrosa ? '#fee2e2' : '#f9fafb',
                    border: cargaPeligrosa ? '1px solid #fecaca' : '1px solid #e5e7eb'
                  }}>
                    <input
                      type="checkbox"
                      checked={cargaPeligrosa}
                      onChange={(e) => setCargaPeligrosa(e.target.checked)}
                      disabled={isLoading}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 600, color: cargaPeligrosa ? '#dc2626' : '#1e293b' }}>⚠️ Carga Peligrosa</span>
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Aseguradora</label>
                  <input
                    type="text"
                    value={aseguradora}
                    onChange={(e) => setAseguradora(e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre de aseguradora"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>N° de Póliza</label>
                  <input
                    type="text"
                    value={nroSeguro}
                    onChange={(e) => setNroSeguro(e.target.value)}
                    disabled={isLoading}
                    placeholder="POL-123456"
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Vigencia - Solo si está seleccionado */}
          {changeVigencia && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
              padding: '16px', marginBottom: '24px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> Vigencia del Permiso
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Válido desde *</label>
                  <input
                    type="date"
                    value={vigenciaDesde}
                    onChange={(e) => setVigenciaDesde(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#1e293b' }}>Válido hasta *</label>
                  <input
                    type="date"
                    value={vigenciaHasta}
                    onChange={(e) => setVigenciaHasta(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
                background: 'white', color: '#374151', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', transition: 'all 0.15s', opacity: isLoading ? 0.5 : 1,
                pointerEvents: isLoading ? 'none' : 'auto'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleClone}
              disabled={isLoading || !patente}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '13px',
                cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
                opacity: isLoading || !patente ? 0.5 : 1,
                pointerEvents: isLoading || !patente ? 'none' : 'auto'
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  Clonando...
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Clonar
                </>
              )}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
