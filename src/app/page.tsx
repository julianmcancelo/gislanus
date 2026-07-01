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
      <div style={{ width: 80, height: 80, background: '#3b82f6', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '40px', marginBottom: '20px', animation: 'pulse-logo 2s infinite ease-in-out' }}>G</div>
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
        <div style={{ width: 60, height: 60, background: '#3b82f6', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '30px', opacity: 0.6 }}>G</div>
      </div>
    );
  }

  return (
    <main>
      <MapComponent />
    </main>
  );
}
