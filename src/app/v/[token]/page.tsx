'use client';
import dynamic from 'next/dynamic';

const PublicSharedView = dynamic(() => import('@/components/PublicSharedView'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff' }}>
      <p style={{ color: '#38bdf8', fontWeight: 'bold' }}>Cargando vista compartida...</p>
    </div>
  ),
});

export default function SharedTokenPage({ params }: { params: { token: string } }) {
  return <PublicSharedView token={params.token} />;
}
