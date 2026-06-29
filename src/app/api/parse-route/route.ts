import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { clipGeometryToLanus } from '@/utils/geo';

async function queryUrl(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'LanusGIS/1.0' } });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

async function geocodeIntersection(streetA: string, streetB: string) {
  const usigUrl = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(streetA + ' y ' + streetB + ', Lanus')}&geocodificar=true`;
  try {
    const data = await queryUrl(usigUrl);
    if (data.direccionesNormalizadas && data.direccionesNormalizadas.length > 0) {
      const match = data.direccionesNormalizadas[0];
      if (match.coordenadas && match.coordenadas.x && match.coordenadas.y) {
        return { lat: match.coordenadas.y, lng: match.coordenadas.x };
      }
    }
  } catch (e) {}

  const georefUrl = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(streetA + ' y ' + streetB)}&departamento=Lanus`;
  try {
    const data = await queryUrl(georefUrl);
    if (data.direcciones && data.direcciones.length > 0) {
      const match = data.direcciones[0];
      if (match.ubicacion && match.ubicacion.lat && match.ubicacion.lon) {
        return { lat: match.ubicacion.lat, lng: match.ubicacion.lon };
      }
    }
  } catch (e) {}

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(streetA + ' & ' + streetB + ', Lanus, Buenos Aires, Argentina')}&format=json&limit=1`;
  try {
    const data = await queryUrl(nominatimUrl);
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {}

  return null;
}

async function buildRouteForStreets(streets: string[], index: number, description?: string) {
  const waypoints: { lat: number; lng: number }[] = [];
  
  for (let i = 0; i < streets.length - 1; i++) {
    const streetA = streets[i].trim();
    const streetB = streets[i+1].trim();
    if (!streetA || !streetB) continue;
    const coords = await geocodeIntersection(streetA, streetB);
    if (coords) waypoints.push(coords);
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  if (waypoints.length < 2) return null;

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints.map(w => `${w.lng},${w.lat}`).join(';')}?overview=full&geometries=geojson`;
  try {
    const routeData = await queryUrl(osrmUrl);
    if (routeData.routes && routeData.routes.length > 0) {
      const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
      const color = colors[index % colors.length];
      
      return {
        type: "Feature",
        properties: {
          name: description || `Recorrido ${index + 1}`,
          streets: streets.join(' - '),
          color: color,
          originalIndex: index
        },
        geometry: clipGeometryToLanus(routeData.routes[0].geometry)
      };
    }
  } catch (e) {}
  return null;
}

export async function POST(req: Request) {
  try {
    const { text, index, description } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta configurar la API Key de OpenAI' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });
    
    const prompt = `
Eres un asistente experto en logística en Lanús, Argentina.
Tengo el siguiente texto que describe un recorrido de calles.
Tu tarea es devolver ÚNICAMENTE un objeto JSON con la clave "calles" que contenga un array de strings, donde cada string es el nombre de una calle del recorrido en orden secuencial.

Ejemplo de texto: "Ingresa por Yrigoyen, dobla en 25 de mayo, y sale por Lanus Este por San Martin"
Salida esperada:
{
  "calles": ["Av. Hipólito Yrigoyen", "25 de Mayo", "Av. San Martín"]
}

Reglas:
- Limpiar y corregir ortografía (ej: "Hypolito Yrigoyen" -> "Av. Hipólito Yrigoyen").
- No incluir números de altura, solo el nombre de la calle.
- Incluir TODAS las calles en el orden en que se transitan.

Texto de entrada:
${text}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Devuelve únicamente JSON con el array de calles." },
        { role: "user", content: prompt }
      ]
    });

    const resultString = completion.choices[0].message?.content;
    if (!resultString) throw new Error('OpenAI returned empty response');
    const extractedData = JSON.parse(resultString);
    
    if (!extractedData.calles || !Array.isArray(extractedData.calles) || extractedData.calles.length < 2) {
      return NextResponse.json({ error: 'No se detectaron suficientes calles. Intentá escribir al menos dos calles del recorrido.' }, { status: 400 });
    }

    const feature = await buildRouteForStreets(extractedData.calles, index || 0, description || 'Recorrido IA');

    if (!feature) {
      return NextResponse.json({ error: `No se pudieron ubicar las calles en el mapa (${extractedData.calles.slice(0,3).join(', ')}…). Verificá los nombres e intentá de nuevo.` }, { status: 400 });
    }

    return NextResponse.json({ feature });
  } catch (error: any) {
    console.error('Error in parse-route:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
