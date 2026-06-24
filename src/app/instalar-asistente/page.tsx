'use client';
import React from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';
import Link from 'next/link';

export default function InstalarAsistente() {
  const bookmarkletCode = `javascript:(function(){const e=document.body.innerText;const t=new URLSearchParams;t.append("importData",encodeURIComponent(e));const n=document.createElement("a");n.href="https://lanus-gis.vercel.app/transporte-pesado?"+t.toString();n.target="_blank";n.click()})();`;

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <Link href="/transporte-pesado" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', textDecoration: 'none', marginBottom: '20px', fontWeight: 'bold' }}>
        <ArrowLeft size={20} /> Volver a Transporte Pesado
      </Link>

      <h1 style={{ color: '#333', fontSize: '32px', marginBottom: '10px' }}>Instalar el Asistente Mágico ✨</h1>
      <p style={{ color: '#666', fontSize: '18px', lineHeight: '1.6', marginBottom: '40px' }}>
        Con este botón mágico vas a poder procesar cualquier solicitud de GDEBA o TramitesWeb con un solo clic, sin tener que copiar y pegar el texto manualmente.
      </p>

      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>1</span>
          Asegurate de ver tu barra de marcadores
        </h2>
        <p style={{ color: '#475569', marginBottom: '30px', paddingLeft: '42px' }}>
          En Google Chrome, tocá <strong>Ctrl + Shift + B</strong> (o Cmd + Shift + B en Mac) para mostrar la barra de marcadores en la parte superior.
        </p>

        <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>2</span>
          Arrastrá el botón a tu barra
        </h2>
        <p style={{ color: '#475569', marginBottom: '20px', paddingLeft: '42px' }}>
          Hacé clic y mantené presionado el siguiente botón violeta. Arrastralo hacia arriba y soltalo en tu barra de marcadores de Chrome.
        </p>

        <div style={{ paddingLeft: '42px', marginBottom: '40px' }}>
          <a 
            href={bookmarkletCode}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: '#8b5cf6', 
              color: 'white', 
              padding: '12px 24px', 
              borderRadius: '30px', 
              textDecoration: 'none', 
              fontWeight: 'bold', 
              fontSize: '16px',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
              cursor: 'grab'
            }}
            onClick={(e) => e.preventDefault()} // Prevenir clic accidental normal
          >
            <Bookmark size={20} />
            Mágia GIS Lanús
          </a>
          <span style={{ marginLeft: '15px', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>← ¡Arrastrame a tu barra!</span>
        </div>

        <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>3</span>
          ¡Listo para usar!
        </h2>
        <p style={{ color: '#475569', margin: 0, paddingLeft: '42px' }}>
          La próxima vez que abras una solicitud en TramitesWeb, simplemente hacé clic en el marcador "Mágia GIS Lanús" que guardaste en tu barra. El sistema extraerá toda la información automáticamente y te abrirá el asistente.
        </p>
      </div>
    </div>
  );
}
