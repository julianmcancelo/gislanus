import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

async function geocodeUSIG(address: string): Promise<[number, number] | null> {
  const query = encodeURIComponent(address);
  try {
    const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${query}`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (data && data.direccionesNormalizadas && data.direccionesNormalizadas.length > 0) {
      const coords = data.direccionesNormalizadas[0].coordenadas;
      if (coords) {
        if (typeof coords === 'object' && coords.x && coords.y) {
          return [parseFloat(coords.x), parseFloat(coords.y)];
        } else if (typeof coords === 'string') {
          const matchX = coords.match(/x=(-?\d+\.\d+)/);
          const matchY = coords.match(/y=(-?\d+\.\d+)/);
          if (matchX && matchY) {
            return [parseFloat(matchX[1]), parseFloat(matchY[1])];
          }
        }
      }
    }
  } catch (error) {
    // Silently fail to fallback
  }
  return null;
}

async function geocodeNominatim(address: string): Promise<[number, number] | null> {
  try {
    const searchAddress = address.includes('Argentina') ? address : `${address}, Argentina`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchAddress)}&format=json&limit=1`;
    const headers = { 'User-Agent': 'LanusGIS/1.0 (contacto@lanusgis.com)' };
    const res = await fetch(nominatimUrl, { headers });
    const data: any = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
  } catch (error) {
    // Silently fail
  }
  return null;
}

async function getCoordinates(address: string) {
  let searchStr = address;
  const lower = searchStr.toLowerCase();
  
  // Forzar Lanús si no está explícito y no es CABA u otro obvio
  if (!lower.includes('lanus') && !lower.includes('lanús') && !lower.includes('caba') && !lower.includes('capital federal') && !lower.includes('avellaneda') && !lower.includes('lomas')) {
    searchStr = `${searchStr}, Lanús, Provincia de Buenos Aires`;
  }

  let coords = await geocodeUSIG(searchStr);
  if (!coords) {
    coords = await geocodeNominatim(searchStr);
  }
  return coords;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Usar OpenAI para extraer la informacion
    const prompt = `
Eres un asistente que extrae datos de solicitudes de tránsito pesado para la Municipalidad de Lanús.
ASUME que TODAS las calles mencionadas pertenecen al partido de Lanús, Provincia de Buenos Aires, a menos que el texto diga explícitamente otro municipio o CABA.
Extrae la siguiente información en formato JSON:
- numeroSolicitud (string, sin el símbolo #)
- nombreSolicitante (string, Nombre y Apellido combinados)
- recorridosEscritos (array de strings): Los textos exactos que el usuario escribió bajo "recorrido escrito 1", "recorrido escrito 2", etc.
- archivosAdjuntos (array de strings): Nombres de los archivos adjuntos (ej: .jpg, .pdf) detectados en el texto, especialmente los croquis.
- puntosRuta (array de strings): Una lista ORDENADA de direcciones que forman la ruta total que debe hacer el camión. 
  Debes incluir:
  1. La dirección de origen completa.
  2. Todas las calles mencionadas en los "recorridos escritos", en orden.
  3. La dirección de destino completa.
  MUY IMPORTANTE: A cada una de las calles, agrégale siempre ", Lanús, Provincia de Buenos Aires, Argentina" para asegurar que el geocodificador no se equivoque de ciudad.

Texto de la solicitud:
${text}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Devuelve únicamente JSON." },
        { role: "user", content: prompt }
      ]
    });

    const resultString = completion.choices[0].message?.content;
    if (!resultString) throw new Error('OpenAI returned empty response');
    
    const extractedData = JSON.parse(resultString);
    const { numeroSolicitud, nombreSolicitante, puntosRuta, recorridosEscritos, archivosAdjuntos } = extractedData;

    // Ahora geocodificamos los puntosRuta
    const coordinates = [];
    for (const punto of puntosRuta) {
      const coords = await getCoordinates(punto);
      if (coords) {
        coordinates.push(coords);
      }
    }

    if (coordinates.length < 2) {
      // No pudimos geocodificar lo suficiente, devolver solo los datos extraídos
      return NextResponse.json({ 
        numeroSolicitud, 
        nombreSolicitante, 
        calles: puntosRuta,
        recorridosEscritos: recorridosEscritos || [],
        archivosAdjuntos: archivosAdjuntos || [],
        datosGeo: null,
        message: 'Datos extraídos pero no se pudo geocodificar la ruta completa.'
      });
    }

    // Consultar a OSRM para armar la ruta
    const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=true`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    let datosGeo = null;
    let callesDetectadas = puntosRuta;

    if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
      const route = osrmData.routes[0];
      datosGeo = { type: 'Feature', properties: { name: `Ruta Solicitud #${numeroSolicitud}` }, geometry: route.geometry };
      
      const orderedStreets: string[] = [];
      if (route.legs) {
        route.legs.forEach((leg: any) => {
          if (leg.steps) {
            leg.steps.forEach((step: any) => {
              const name = step.name?.trim();
              if (name) {
                if (orderedStreets.length === 0 || orderedStreets[orderedStreets.length - 1] !== name) {
                  orderedStreets.push(name);
                }
              }
            });
          }
        });
      }
      
      // OPCION A: No sobreescribir las calles con el reporte cuadra-por-cuadra del GPS.
      // if (orderedStreets.length > 0) {
      //   callesDetectadas = orderedStreets;
      // }
    }

    return NextResponse.json({
      numeroSolicitud,
      nombreSolicitante,
      calles: callesDetectadas, // Solo muestra las declaradas por la IA
      recorridosEscritos: recorridosEscritos || [],
      archivosAdjuntos: archivosAdjuntos || [],
      datosGeo,
      message: 'Procesado con éxito'
    });

  } catch (error: any) {
    console.error('Error in parse-solicitud API:', error);
    return NextResponse.json({ error: error.message || 'Error processing request' }, { status: 500 });
  }
}
