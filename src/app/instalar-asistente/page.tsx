'use client';
import React from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';
import Link from 'next/link';

export default function InstalarAsistente() {
  const [origin, setOrigin] = React.useState('https://lanus-gis.vercel.app');
  const linkRef = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const bookmarkletCode = `javascript:(function(){var main=document.querySelector('.box-body')||document.querySelector('.content-wrapper')||document.querySelector('.content')||document.querySelector('main')||document.body;var text=main.innerText;var pageUrl=window.location.href;var pdfEl=document.querySelector('a[href*="devoluciones/"]');var pdfUrl=pdfEl?pdfEl.href:null;var qrEl=Array.from(document.querySelectorAll('a[href*="/qr/"]')).find(function(a){return!a.href.includes('/img')});var qrUrl=qrEl?qrEl.href:null;var imgs=Array.from(document.querySelectorAll('a[href]')).filter(function(a){return/\.(png|jpg|jpeg|pdf)$/i.test(a.href)&&(a.href.includes('croquis')||a.href.includes('formularios'))}).map(function(a){return a.href});var payload=JSON.stringify({text:text,pageUrl:pageUrl,pdfUrl:pdfUrl,qrUrl:qrUrl,imageUrls:imgs});window.open('${origin}/transporte-pesado#'+encodeURIComponent(payload),'_blank')})();`;

  React.useEffect(() => {
    if (linkRef.current) {
      linkRef.current.setAttribute('href', bookmarkletCode);
    }
  }, [bookmarkletCode]);

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <Link href="/transporte-pesado" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', textDecoration: 'none', marginBottom: '20px', fontWeight: 'bold' }}>
        <ArrowLeft size={20} /> Volver a Transporte Pesado
      </Link>

      <h1 style={{ color: '#333', fontSize: '32px', marginBottom: '10px' }}>Instalar el Asistente Mágico ✨</h1>
      <p style={{ color: '#666', fontSize: '18px', lineHeight: '1.6', marginBottom: '16px' }}>
        Con este botón mágico podés procesar cualquier solicitud de TramitesWeb con un solo clic, sin copiar ni pegar nada.
      </p>
      <div style={{ backgroundColor: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '10px', padding: '14px 20px', marginBottom: '32px', fontSize: '14px', color: '#5b21b6', lineHeight: '1.7' }}>
        <strong>¿Qué hace el botón automáticamente?</strong><br />
        ✅ Captura el texto de la solicitud<br />
        ✅ Descarga y lee el <strong>PDF de devolución</strong> (recorridos aprobados)<br />
        ✅ Consulta el <strong>link QR</strong> de verificación<br />
        ✅ Captura los croquis adjuntos<br />
        ✅ Abre el asistente con todo ya procesado
      </div>

      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>1</span>
          Mostrá tu barra de marcadores
        </h2>
        <p style={{ color: '#475569', marginBottom: '30px', paddingLeft: '42px' }}>
          En Google Chrome, presioná <strong>Ctrl + Shift + B</strong> para mostrar la barra de marcadores en la parte superior del navegador.
        </p>

        <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>2</span>
          Arrastrá el botón a tu barra
        </h2>
        <p style={{ color: '#475569', marginBottom: '20px', paddingLeft: '42px' }}>
          Hacé clic y <strong>mantené presionado</strong> el botón violeta de abajo. Arrastralo hasta tu barra de marcadores y soltalo ahí.
        </p>

        <div style={{ paddingLeft: '42px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a
            ref={linkRef}
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
              cursor: 'grab',
              userSelect: 'none',
            }}
            onClick={(e) => e.preventDefault()}
          >
            <Bookmark size={20} />
            ✨ GIS Lanús
          </a>
          <span style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>← ¡Arrastrame a tu barra!</span>
        </div>

        <h2 style={{ margin: '0 0 20px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ backgroundColor: '#8b5cf6', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>3</span>
          ¡Listo para usar!
        </h2>
        <p style={{ color: '#475569', margin: 0, paddingLeft: '42px' }}>
          Abrí cualquier solicitud aprobada en TramitesWeb y hacé clic en el marcador <strong>"✨ GIS Lanús"</strong> de tu barra. El asistente se abre solo con todos los datos y recorridos ya cargados.
        </p>
      </div>
    </div>
  );
}
