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
    <div className="min-h-screen relative flex bg-[#1e293b] overflow-hidden">
      {/* Background with Lanús sketch */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: 'url(/lanus-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Subtle stars / dots overlay */}
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />

      {/* Main split container */}
      <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-center p-4 md:p-0">
        
        {/* Left Side: Logo and Title */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center text-center p-8 mb-8 md:mb-0">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-sky-500/20 blur-[60px] rounded-full w-40 h-40 left-1/2 -translate-x-1/2" />
            <img 
              src="/logo-lanus.png" 
              alt="Logo Lanús" 
              className="relative z-10 w-32 h-32 object-contain drop-shadow-2xl" 
            />
          </div>
          <h1 className="text-white text-3xl md:text-4xl font-black tracking-widest uppercase mb-3 drop-shadow-md">
            GIS <span className="text-[#2bb3ff]">Lanús</span>
          </h1>
          <p className="text-[#8ba2c2] text-xs md:text-sm tracking-[0.2em] font-semibold uppercase">
            Sistema de Información Geográfica
          </p>
          <div className="w-12 h-1 bg-[#2bb3ff] rounded-full mt-6 mx-auto opacity-80" />
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl p-10 w-full max-w-md relative overflow-hidden">
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Inicio de sesión</h2>
              <p className="text-sm text-slate-500 font-medium">Acceso exclusivo para personal autorizado</p>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                  {error}
                </div>
              )}
              
              <div>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#f1f5f9] border border-transparent focus:border-[#2bb3ff] focus:bg-white focus:ring-4 focus:ring-[#2bb3ff]/10 rounded-xl px-5 py-3.5 text-slate-700 font-medium outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="relative">
                <input
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#f1f5f9] border border-transparent focus:border-[#2bb3ff] focus:bg-white focus:ring-4 focus:ring-[#2bb3ff]/10 rounded-xl px-5 py-3.5 text-slate-700 font-medium outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2bb3ff] hover:bg-[#1a9cea] text-white font-bold rounded-xl px-6 py-4 mt-2 transition-all shadow-lg shadow-[#2bb3ff]/30 hover:shadow-[#2bb3ff]/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Iniciando...' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <a href="#" className="text-[#2bb3ff] text-sm font-semibold hover:underline">
                Olvidé mi contraseña
              </a>
            </div>

            <div className="mt-8 relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative bg-white px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                O acceder con
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                type="button"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-700 font-bold rounded-xl px-6 py-3.5 transition-all focus:ring-4 focus:ring-slate-100 disabled:opacity-70 disabled:cursor-not-allowed"
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
