'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (user) {
    router.push('/');
    return null;
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (error) {
      console.error(error);
      alert('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Premium Background Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-slate-900 z-10" />
        {/* Animated gradient blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-emerald-600/30 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/30 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* Glassmorphic Login Card */}
      <div className="relative z-20 max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden p-1">
        <div className="bg-slate-900/40 rounded-[22px] overflow-hidden">
          {/* Header */}
          <div className="p-10 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 border border-white/20 mb-6 shadow-inner">
              <img src="/logo-lanus.png" alt="Logo Lanús" className="w-10 h-10 object-contain drop-shadow-md opacity-90" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">GIS <span className="text-emerald-400">Lanús</span></h2>
            <p className="text-sm text-slate-300/80 font-medium tracking-wide">SISTEMA DE INFORMACIÓN GEOGRÁFICA</p>
          </div>
          
          {/* Body */}
          <div className="px-10 pb-10">
            <p className="text-center text-slate-300 mb-8 text-sm leading-relaxed">
              Iniciá sesión de forma segura para acceder a tus mapas privados y herramientas de edición exclusivas.
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group relative w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl px-6 py-3.5 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="relative z-10 tracking-wide">{loading ? 'Conectando de forma segura...' : 'Ingresar con Google'}</span>
            </button>
            
            <div className="mt-8 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Acceso restringido a personal autorizado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
