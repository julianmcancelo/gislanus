import { POST } from './src/app/api/parse-solicitud/route';

async function test() {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({
      text: `
        Expediente: 1000-2026-962447-B
        Creación: 15/05/2026
        Nombre Solicitante: Monti Omar Armando
        Tipo de vehículo: Camion
        pesoToneladas: 10
        === CONTENIDO DETECTADO Y SCRAPEADO DEL LINK QR ===
        Recorrido aprobado: 
        Recorrido 1: Av. San Martin - 25 de Mayo - Obon.
        Recorrido 2: Cnel. D'elia - Viamonte - Rivadavia.
      `
    })
  });
  
  const res = await POST(req);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

test();
