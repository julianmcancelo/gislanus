'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) router.push('/bienvenida');
  }, [user, router]);

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row relative overflow-hidden bg-slate-50 font-sans">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.97) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-float {
          animation: float 4.6s ease-in-out infinite;
        }
        .animate-fade-in-scale {
          animation: fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* ── HUD Elements for GIS feeling ── */}
      <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-full shadow-sm text-[10px] font-bold text-slate-500 tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>SYS_STATUS: ONLINE</span>
      </div>

      <div className="absolute top-4 right-4 z-20 hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-full shadow-sm text-[9px] font-mono text-slate-400 tracking-wider">
        <span>LAT: 34.7016° S</span>
        <span className="text-slate-300">|</span>
        <span>LON: 58.3960° W</span>
      </div>

      {/* ── Background Map ── */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-[0.1]"
        style={{ backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />
      <div className="absolute inset-0 z-0 bg-slate-100/40 backdrop-blur-[2px] pointer-events-none" />

      {/* ── Main Split Layout Container ── */}
      <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-center p-6 md:p-12 gap-8 md:gap-0">
        
        {/* ── Left Side: Generic Branding ── */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center text-center p-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-600 text-[10px] font-extrabold uppercase tracking-wider mb-2">
            Sistema Restringido
          </div>
          
          <h1 className="text-slate-800 text-3xl md:text-4xl font-black tracking-wider uppercase mb-2 drop-shadow-sm">
            Portal de <span className="text-[#0ea5e9]">Acceso</span>
          </h1>
          <p className="text-slate-500 text-xs md:text-sm tracking-[0.18em] font-bold uppercase max-w-sm leading-relaxed mb-6">
            Plataforma Geográfica y de Gestión
          </p>
          
          {/* Subtle capabilities pills */}
          <div className="hidden lg:flex flex-wrap justify-center gap-2 max-w-md opacity-75">
            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-200/50 border border-slate-300/30 text-slate-500 rounded-full">Gestión de Rutas</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-200/50 border border-slate-300/30 text-slate-500 rounded-full">Módulos Logísticos</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-200/50 border border-slate-300/30 text-slate-500 rounded-full">Administración</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-slate-200/50 border border-slate-300/30 text-slate-500 rounded-full">Mapas y Capas</span>
          </div>
          
          <div className="w-16 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full mt-6 opacity-80" />
        </div>

        {/* ── Right Side: Consolidated Login Card ── */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-4">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 shadow-[0_20px_50px_rgba(15,23,42,0.06)] rounded-[32px] p-8 w-full max-w-md relative overflow-hidden transition-all duration-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.09)] animate-fade-in-scale">
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Iniciar sesión</h2>
              <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wider">Acceso de Personal Autorizado</p>
            </div>

            {error && (
              <div 
                className="bg-rose-50/80 border border-rose-100 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl mb-5 flex items-center gap-2"
                style={{ animation: 'shake 0.4s ease-in-out' }}
              >
                <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4 py-2">
              <button
                onClick={async () => {
                  setLoadingGoogle(true); setError('');
                  try { await loginWithGoogle(); router.push('/bienvenida'); }
                  catch { setError('Error al iniciar sesión con Google.'); }
                  finally { setLoadingGoogle(false); }
                }}
                disabled={loadingGoogle}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-extrabold rounded-2xl text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20"
              >
                {loadingGoogle ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Conectando...
                  </span>
                ) : (
                  <>
                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center p-1 flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    Ingresar con cuenta Google
                  </>
                )}
              </button>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold tracking-wider uppercase">
              <span>Acceso Restringido</span>
              <span className="hover:text-sky-500 cursor-pointer transition-colors">Soporte Municipal</span>
            </div>

          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <footer className="absolute bottom-0 left-0 right-0 py-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center pointer-events-none hidden md:block">
        © 2026 Municipio de Lanús · Área de Modernización y Sistemas
      </footer>
    </div>
  );
}
