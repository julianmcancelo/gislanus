'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) {
    router.push('/');
    return null;
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, ingresá tu email y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginWithEmail(email, password);
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError('Credenciales incorrectas o usuario no encontrado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex bg-slate-50 overflow-hidden">
      {/* Background with Lanús sketch */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
        style={{
          backgroundImage: 'url(/lanus-bg.png)',
        }}
      />
      
      {/* Subtle white overlay to ensure text readability over the light map */}
      <div className="absolute inset-0 z-0 bg-white/40 backdrop-blur-[2px] pointer-events-none" />

      {/* Main split container */}
      <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-center p-4 md:p-0">
        
        {/* Left Side: Logo and Title */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center text-center p-8 mb-8 md:mb-0">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-white/60 blur-[40px] rounded-full w-40 h-40 left-1/2 -translate-x-1/2" />
            <img 
              src="/logo-lanus.png" 
              alt="Logo Lanús" 
              className="relative z-10 w-36 h-36 object-contain drop-shadow-xl" 
            />
          </div>
          <h1 className="text-slate-800 text-4xl md:text-5xl font-black tracking-widest uppercase mb-4 drop-shadow-sm">
            Municipio <span className="text-[#0ea5e9]">Lanús</span>
          </h1>
          <p className="text-slate-600/90 text-sm md:text-base tracking-[0.2em] font-bold uppercase bg-white/50 px-4 py-1 rounded-full backdrop-blur-md border border-white/50">
            Portal de Gestión Interna
          </p>
          <div className="w-16 h-1.5 bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] rounded-full mt-8 mx-auto shadow-sm" />
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-[32px] shadow-[0_20px_60px_-15px_rgba(14,165,233,0.15)] p-10 w-full max-w-md relative overflow-hidden">
            
            <div className="text-center mb-10">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Bienvenido</h2>
              <p className="text-sm text-slate-500 font-medium">Ingresá tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center border border-red-100 font-medium shadow-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ejemplo@lanus.gob.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0ea5e9] focus:bg-white focus:ring-4 focus:ring-[#0ea5e9]/10 rounded-2xl px-5 py-4 text-slate-800 font-medium outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0ea5e9] focus:bg-white focus:ring-4 focus:ring-[#0ea5e9]/10 rounded-2xl px-5 py-4 text-slate-800 font-medium outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex justify-end mt-2">
                <a href="#" className="text-[#0ea5e9] text-sm font-semibold hover:text-[#0284c7] transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] hover:from-[#0284c7] hover:to-[#0ea5e9] text-white font-bold rounded-2xl px-6 py-4 mt-4 transition-all shadow-[0_8px_20px_-6px_rgba(14,165,233,0.5)] hover:shadow-[0_12px_25px_-8px_rgba(14,165,233,0.6)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="mt-8 relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative bg-white/0 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider backdrop-blur-sm rounded-full">
                O continuar con
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleGoogleLogin}
                type="button"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-2xl px-6 py-4 transition-all shadow-sm hover:shadow-md focus:ring-4 focus:ring-slate-100 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
