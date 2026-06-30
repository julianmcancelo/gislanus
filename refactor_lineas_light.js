const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'transporte-publico', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const functionStart = content.indexOf('export default function TransportePublicoWizard() {');
const returnStart = content.indexOf('return (', functionStart);
const returnBlockStart = content.indexOf('if (isSuccess) {', functionStart);

if (returnBlockStart === -1) {
  console.log("Could not find return block");
  process.exit(1);
}

const newReturn = `
  if (isSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#ffffff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '24px', padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={40} color="#16a34a" />
          </div>
          <h2 style={{ color: '#0f172a', fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px' }}>Línea Guardada con Éxito</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.6, marginBottom: '32px' }}>
            La línea de transporte público ha sido registrada y ya se encuentra activa y visible en el panel principal.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1, boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' }}>Cargar otra línea</button>
            <button onClick={() => router.push('/admin')} style={{ padding: '12px 24px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600, cursor: 'pointer', flex: 1 }}>Volver al Panel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      {/* SIDEBAR PANEL - LIGHT THEME */}
      <div style={{ width: '420px', background: '#ffffff', display: 'flex', flexDirection: 'column', color: '#0f172a', zIndex: 10, boxShadow: '4px 0 24px rgba(0,0,0,0.05)', position: 'relative', borderRight: '1px solid #e2e8f0' }}>
        <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafbfd' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <Navigation size={22} color="#2563eb" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              Transporte Público
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, paddingLeft: '44px' }}>
            Asistente para digitalización de líneas y ramales.
          </p>
        </div>

        {/* PROGRESS BAR */}
        <div style={{ padding: '0 32px', marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', position: 'relative' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: step >= s ? '#2563eb' : '#f8fafc',
                  border: step >= s ? 'none' : '2px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step >= s ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.8rem',
                  boxShadow: step === s ? '0 0 0 4px rgba(37, 99, 235, 0.2)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {step > s ? <CheckCircle size={14} color="#fff" /> : s}
                </div>
              </div>
            ))}
            <div style={{ position: 'absolute', top: '13px', left: '20px', right: '20px', height: '2px', background: '#e2e8f0', zIndex: 0 }}>
              <div style={{ height: '100%', background: '#2563eb', width: \`\${(step - 1) * 50}%\`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: step >= 1 ? '#0f172a' : '#64748b', fontWeight: step >= 1 ? 700 : 500 }}>Datos</span>
            <span style={{ fontSize: '0.7rem', color: step >= 2 ? '#0f172a' : '#64748b', fontWeight: step >= 2 ? 700 : 500 }}>Ramal</span>
            <span style={{ fontSize: '0.7rem', color: step >= 3 ? '#0f172a' : '#64748b', fontWeight: step >= 3 ? 700 : 500 }}>Traza</span>
          </div>
        </div>

        {/* FORM STEPS */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          
          {step === 1 && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#2563eb" /> Información Base
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Nombre de la Línea *</label>
                <input 
                  value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="ej: Línea 271"
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Número</label>
                  <input 
                    value={numero} onChange={e => setNumero(e.target.value)}
                    placeholder="ej: 271"
                    style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Color (Hex)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="color" value={color} onChange={e => setColor(e.target.value)}
                      style={{ width: '45px', height: '45px', padding: '2px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <input 
                      value={color} onChange={e => setColor(e.target.value)}
                      style={{ flex: 1, padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Jurisdicción / Categoría *</label>
                <select 
                  value={categoria} onChange={e => setCategoria(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                >
                  <option value="MUNICIPAL">Municipal</option>
                  <option value="PROVINCIAL">Provincial</option>
                  <option value="NACIONAL">Nacional</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Route size={18} color="#7c3aed" /> Detalles del Ramal
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Subcategoría / Ramal</label>
                <input 
                  value={subcategoria} onChange={e => setSubcategoria(e.target.value)}
                  placeholder="ej: Ramal A (por Pasco)"
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Sentido (Opcional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" name="sentido" value="IDA" checked={sentido === 'IDA'} onChange={() => setSentido('IDA')} style={{ display: 'none' }} />
                    <div style={{ padding: '10px', textAlign: 'center', borderRadius: '8px', border: sentido === 'IDA' ? '2px solid #2563eb' : '1.5px solid #e2e8f0', background: sentido === 'IDA' ? '#eff6ff' : '#fff', color: sentido === 'IDA' ? '#1d4ed8' : '#64748b', fontWeight: 700, transition: 'all 0.2s', fontSize: '0.85rem' }}>
                      Ida
                    </div>
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" name="sentido" value="VUELTA" checked={sentido === 'VUELTA'} onChange={() => setSentido('VUELTA')} style={{ display: 'none' }} />
                    <div style={{ padding: '10px', textAlign: 'center', borderRadius: '8px', border: sentido === 'VUELTA' ? '2px solid #7c3aed' : '1.5px solid #e2e8f0', background: sentido === 'VUELTA' ? '#f5f3ff' : '#fff', color: sentido === 'VUELTA' ? '#6d28d9' : '#64748b', fontWeight: 700, transition: 'all 0.2s', fontSize: '0.85rem' }}>
                      Vuelta
                    </div>
                  </label>
                  <label style={{ cursor: 'pointer', gridColumn: 'span 2' }}>
                    <input type="radio" name="sentido" value="IDA Y VUELTA" checked={sentido === 'IDA Y VUELTA'} onChange={() => setSentido('IDA Y VUELTA')} style={{ display: 'none' }} />
                    <div style={{ padding: '10px', textAlign: 'center', borderRadius: '8px', border: sentido === 'IDA Y VUELTA' ? '2px solid #059669' : '1.5px solid #e2e8f0', background: sentido === 'IDA Y VUELTA' ? '#ecfdf5' : '#fff', color: sentido === 'IDA Y VUELTA' ? '#047857' : '#64748b', fontWeight: 700, transition: 'all 0.2s', fontSize: '0.85rem' }}>
                      Ida y Vuelta
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Descripción</label>
                <textarea 
                  value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Detalles adicionales del recorrido..."
                  rows={4}
                  style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '0.95rem', outline: 'none', resize: 'vertical', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="#16a34a" /> Trazado Geográfico
              </h3>
              
              <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#16a34a', lineHeight: 1.5, display: 'flex', gap: '10px' }}>
                  <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  Utilizá el panel de mapa a la derecha para dibujar la traza exacta de este ramal.
                </p>
              </div>

              <div style={{ padding: '16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>Estado del trazado:</span>
                {datosGeo ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 700, background: '#dcfce7', padding: '4px 10px', borderRadius: '20px' }}>
                    <CheckCircle size={14} /> Listo
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontSize: '0.85rem', fontWeight: 700, background: '#fef3c7', padding: '4px 10px', borderRadius: '20px' }}>
                    <AlertTriangle size={14} /> Pendiente
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', background: '#fafbfd' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {step > 1 && (
              <button 
                onClick={handlePrev}
                style={{ padding: '12px 20px', borderRadius: '12px', background: '#fff', border: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <ArrowLeft size={18} /> Atrás
              </button>
            )}
            
            {step < 3 ? (
              <button 
                onClick={handleNext}
                style={{ flex: 1, padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(37, 99, 235, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(37, 99, 235, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Siguiente <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px 24px', borderRadius: '12px', background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', border: 'none', color: '#fff', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: isSubmitting ? 'none' : '0 4px 14px 0 rgba(22, 163, 74, 0.3)', transition: 'all 0.2s' }}
                onMouseOver={(e) => { if(!isSubmitting){ e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(22, 163, 74, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseOut={(e) => { if(!isSubmitting){ e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(22, 163, 74, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                {isSubmitting ? 'Guardando...' : 'Finalizar Línea'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAP AREA */}
      <div style={{ flex: 1, position: 'relative', background: '#f1f5f9' }}>
        <WizardMap 
          onComplete={handleGeoDataUpdate}
          initialWaypoints={savedWaypoints}
        />
      </div>

      <style dangerouslySetInnerHTML={{__html: \`
        .fade-in {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      \`}} />
    </div>
  );
};
`;

content = content.substring(0, returnBlockStart) + newReturn;

fs.writeFileSync(filePath, content);
console.log('Done rewriting file.');
