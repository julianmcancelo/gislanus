'use client';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

export default function PendingBlocker({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (loading) return null;

  if (user && dbUser && dbUser.rol === 'PENDIENTE' && pathname !== '/login') {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-slate-50 overflow-hidden">
        {/* Background matching Login */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out opacity-60"
          style={{ backgroundImage: 'url(/lanus-bg.png)' }}
        />
        <div className="absolute inset-0 z-0 bg-white/40 backdrop-blur-[2px] pointer-events-none" />

        <div className="relative z-10 w-full flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-[32px] shadow-[0_20px_60px_-15px_rgba(14,165,233,0.15)] p-10 w-full max-w-md relative overflow-hidden text-center">
            
            <div className="flex justify-center mb-6 relative">
              <div className="absolute inset-0 bg-[#0ea5e9]/10 blur-xl rounded-full w-20 h-20 left-1/2 -translate-x-1/2" />
              <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-[#0ea5e9]/10 to-[#38bdf8]/10 rounded-full flex items-center justify-center border border-[#0ea5e9]/20">
                <svg className="w-10 h-10 text-[#0ea5e9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-800 mb-4 tracking-tight">Acceso Pendiente</h2>
            
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              Tu cuenta ha sido registrada correctamente, pero se encuentra a la espera de aprobación por un administrador.
            </p>
            
            <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-5 mb-8 shadow-sm">
              <p className="text-sm text-slate-500 font-medium">
                Cuenta actual:<br/>
                <strong className="text-[#0ea5e9] text-base mt-1 inline-block">{user.email}</strong>
              </p>
            </div>
            
            <button 
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="w-full bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] hover:from-[#0284c7] hover:to-[#0ea5e9] text-white font-bold py-4 px-4 rounded-2xl transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(14,165,233,0.4)] hover:shadow-[0_12px_24px_-8px_rgba(14,165,233,0.5)] transform hover:-translate-y-[1px]"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
