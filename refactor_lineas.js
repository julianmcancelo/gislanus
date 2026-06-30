const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'transporte-publico', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace component name
content = content.replace(/TransportePesadoWizard/g, 'TransportePublicoWizard');

// Remove everything inside default export function before the return and replace with new states
const functionStart = content.indexOf('export default function TransportePublicoWizard() {');
const returnStart = content.indexOf('return (', functionStart);

const newStates = `
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, dbUser, loading } = useAuth();
  
  const [step, setStep] = useState(1);
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [color, setColor] = useState('#E53E3E');
  const [categoria, setCategoria] = useState('MUNICIPAL');
  const [subcategoria, setSubcategoria] = useState('');
  const [sentido, setSentido] = useState('');
  const [descripcion, setDescripcion] = useState('');
  
  const [datosGeo, setDatosGeo] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedWaypoints, setSavedWaypoints] = useState<any[]>([]);

  useEffect(() => {
    // Basic init
  }, []);

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    if (!datosGeo) {
      alert("Debes dibujar el recorrido en el mapa antes de finalizar.");
      return;
    }
    if (!nombre) {
      alert("El nombre de la línea es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/lineas-transporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          numero,
          color,
          categoria,
          subcategoria,
          sentido: sentido || null,
          descripcion,
          datosGeo
        })
      });

      if (!res.ok) throw new Error('Error al guardar la línea');
      
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Hubo un error al guardar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeoDataUpdate = (geo: any, waypoints: any) => {
    setDatosGeo(geo);
    setSavedWaypoints(waypoints);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={48} color="#29B6F6" /></div>;
  if (!user || !dbUser?.permisos?.editarLineas) {
    return <AccessDenied 
      message="No tenés permiso para cargar líneas de transporte público. Contactá a un administrador."
      redirectUrl="/" 
    />;
  }
`;

content = content.substring(0, functionStart + 51) + newStates + content.substring(returnStart);

// Now we need to replace the return statement with our wizard UI.
// We will replace the entire return block.
const returnBlockStart = content.indexOf('return (', functionStart);
const newReturn = `
  if (isSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.5)' }}>
            <CheckCircle size={40} color="white" />
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700, marginBottom: '16px' }}>Línea Guardada con Éxito</h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6, marginBottom: '32px' }}>
            La línea de transporte público ha sido registrada y ya se encuentra activa y visible en el panel principal.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1, boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}>Cargar otra línea</button>
            <button onClick={() => router.push('/admin')} style={{ padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1 }}>Volver al Panel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      {/* SIDEBAR PANEL */}
      <div style={{ width: '420px', background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)', display: 'flex', flexDirection: 'column', color: '#f8fafc', zIndex: 10, boxShadow: '4px 0 24px rgba(0,0,0,0.4)', position: 'relative' }}>
        <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
              <Navigation size={22} color="white" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Transporte Público
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, paddingLeft: '44px' }}>
            Asistente para digitalización de líneas y ramales.
          </p>
        </div>

        {/* PROGRESS BAR */}
        <div style={{ padding: '0 32px', marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1 }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: step >= s ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#1e293b',
                  border: step >= s ? 'none' : '2px solid #334155',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step >= s ? '#fff' : '#64748b', fontWeight: 700, fontSize: '0.8rem',
                  boxShadow: step === s ? '0 0 0 4px rgba(59, 130, 246, 0.2)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {step > s ? <CheckCircle size={14} /> : s}
                </div>
              </div>
            ))}
            <div style={{ position: 'absolute', top: '155px', left: '46px', right: '46px', height: '2px', background: '#334155', zIndex: 0 }}>
              <div style={{ height: '100%', background: '#3b82f6', width: \`\${(step - 1) * 50}%\`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: step >= 1 ? '#e2e8f0' : '#475569', fontWeight: step >= 1 ? 600 : 400 }}>Datos</span>
            <span style={{ fontSize: '0.7rem', color: step >= 2 ? '#e2e8f0' : '#475569', fontWeight: step >= 2 ? 600 : 400 }}>Ramal</span>
            <span style={{ fontSize: '0.7rem', color: step >= 3 ? '#e2e8f0' : '#475569', fontWeight: step >= 3 ? 600 : 400 }}>Traza</span>
          </div>
        </div>

        {/* FORM STEPS */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          
          {step === 1 && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#3b82f6" /> Información Base
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Nombre de la Línea *</label>
                <input 
                  value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="ej: Línea 271"
                  style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
                />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Número</label>
                  <input 
                    value={numero} onChange={e => setNumero(e.target.value)}
                    placeholder="ej: 271"
                    style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Color (Hex)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="color" value={color} onChange={e => setColor(e.target.value)}
                      style={{ width: '45px', height: '45px', padding: '2px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', cursor: 'pointer' }}
                    />
                    <input 
                      value={color} onChange={e => setColor(e.target.value)}
                      style={{ flex: 1, padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Jurisdicción / Categoría *</label>
                <select 
                  value={categoria} onChange={e => setCategoria(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Route size={18} color="#8b5cf6" /> Detalles del Ramal
              </h3>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Subcategoría / Ramal</label>
                <input 
                  value={subcategoria} onChange={e => setSubcategoria(e.target.value)}
                  placeholder="ej: Ramal A (por Pasco)"
                  style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Sentido (Opcional)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ flex: 1, cursor: 'pointer' }}>
                    <input type="radio" name="sentido" value="IDA" checked={sentido === 'IDA'} onChange={() => setSentido('IDA')} style={{ display: 'none' }} />
                    <div style={{ padding: '10px', textAlign: 'center', borderRadius: '8px', border: sentido === 'IDA' ? '2px solid #3b82f6' : '1px solid #334155', background: sentido === 'IDA' ? 'rgba(59,130,246,0.1)' : '#0f172a', color: sentido === 'IDA' ? '#60a5fa' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
                      Ida
                    </div>
                  </label>
                  <label style={{ flex: 1, cursor: 'pointer' }}>
                    <input type="radio" name="sentido" value="VUELTA" checked={sentido === 'VUELTA'} onChange={() => setSentido('VUELTA')} style={{ display: 'none' }} />
                    <div style={{ padding: '10px', textAlign: 'center', borderRadius: '8px', border: sentido === 'VUELTA' ? '2px solid #8b5cf6' : '1px solid #334155', background: sentido === 'VUELTA' ? 'rgba(139,92,246,0.1)' : '#0f172a', color: sentido === 'VUELTA' ? '#a78bfa' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
                      Vuelta
                    </div>
                  </label>
                  <label style={{ flex: 1, cursor: 'pointer' }}>
                    <input type="radio" name="sentido" value="" checked={sentido === ''} onChange={() => setSentido('')} style={{ display: 'none' }} />
                    <div style={{ padding: '10px', textAlign: 'center', borderRadius: '8px', border: sentido === '' ? '2px solid #64748b' : '1px solid #334155', background: sentido === '' ? 'rgba(100,116,139,0.1)' : '#0f172a', color: sentido === '' ? '#cbd5e1' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
                      N/A
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Descripción</label>
                <textarea 
                  value={descripcion} onChange={e => setDescripcion(e.target.value)}
                  placeholder="Detalles adicionales del recorrido..."
                  rows={4}
                  style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', color: '#f8fafc', fontSize: '0.95rem', outline: 'none', resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="#10b981" /> Trazado Geográfico
              </h3>
              
              <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#34d399', lineHeight: 1.5, display: 'flex', gap: '10px' }}>
                  <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  Utilizá el panel de mapa a la derecha para dibujar la traza exacta de este ramal.
                </p>
              </div>

              <div style={{ padding: '16px', background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Estado del trazado:</span>
                {datosGeo ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(52, 211, 153, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                    <CheckCircle size={14} /> Listo
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                    <AlertTriangle size={14} /> Pendiente
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div style={{ padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.05)', background: '#0f172a' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {step > 1 && (
              <button 
                onClick={handlePrev}
                style={{ padding: '12px 20px', borderRadius: '12px', background: 'transparent', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
              >
                <ArrowLeft size={18} /> Atrás
              </button>
            )}
            
            {step < 3 ? (
              <button 
                onClick={handleNext}
                style={{ flex: 1, padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}
              >
                Siguiente <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '12px 24px', borderRadius: '12px', background: isSubmitting ? '#475569' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: isSubmitting ? 'none' : '0 4px 14px 0 rgba(16, 185, 129, 0.39)', transition: 'all 0.2s' }}
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
          onGeoDataUpdate={handleGeoDataUpdate}
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
