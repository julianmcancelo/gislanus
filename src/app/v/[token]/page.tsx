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

import { use } from 'react';

export default function SharedTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <PublicSharedView token={token} />;
}
