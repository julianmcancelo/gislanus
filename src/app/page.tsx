'use client';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      background: '#111', 
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      <h2>Cargando Mapa Interactivo...</h2>
    </div>
  )
});

export default function Home() {
  return (
    <main>
      <MapComponent />
    </main>
  );
}
