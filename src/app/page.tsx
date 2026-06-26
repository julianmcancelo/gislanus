'use client';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#111',
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      <img
        src="/logo-lanus.png"
        alt="Logo Lanús"
        style={{
          height: '100px',
          objectFit: 'contain',
          animation: 'pulse-logo 2s infinite ease-in-out',
          marginBottom: '20px'
        }}
      />
      <h2 style={{ letterSpacing: '1px', fontWeight: '500', color: '#ccc' }}>Cargando...</h2>
    </div>
  )
});

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#111'
      }}>
        <img src="/logo-lanus.png" alt="" style={{ height: '80px', opacity: 0.6 }} />
      </div>
    );
  }

  return (
    <main>
      <MapComponent />
    </main>
  );
}
