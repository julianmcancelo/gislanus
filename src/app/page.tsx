'use client';
import dynamic from 'next/dynamic';

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
      <h2 style={{ letterSpacing: '1px', fontWeight: '500', color: '#ccc' }}>Cargando GIS Lanús...</h2>
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
