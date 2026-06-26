require('dotenv').config();
const OpenAI = require('openai');
const https = require('https');

const text = `
recorrido escrito 1 (*)
INGRESO Av. Hypolito Yrigoyen desde avellaneda hasta la calle int manuel quindimil hacia derecha red de transito pesado
INGRESO por int. Manuel quindimil hasta calle hector noya hacia derecha red de transito pesado
INGRESO por hector noya hasta calle chaco hacia la izquierda red de transito liviano
INGRESO por calle colombia media cuadras red de transito liviano
DESTINO chaco 950
EGRESO por calle chaco hasta Av. San Martin hacia la derecha red de transito liviano
EGRESO por Av. San Martin hasta Av, remedios de Escalada de Sna Martin hacia la derecha red de transito pesado
EGRESO por Av. Remedios de Escalada de San Martin hasta Av. Yrigoyen hacia la izquierda res de transito pesado
EGRESO por YrigoyeN hasta Avellaneda red de transito pesado

INGRESO Av. Hypolito Yrigoyen desde avellaneda hasta la calle Av. Remedios de escalada de San Martin hacia derecha red de transito pesado
INGRESO Av. Remedios de Escalada de San Martin hasta Av. San Martin hacia derecha red de transito pesado
INGRESO Av. San Martin hasta calle colombia hacia la derecha red de transito pesado
INGRESO por calle colombia dos cuadras red de transito liviano
DESTINO colombia 1136
EGRESO por calle colombia hasta calle jujuy hacia la izquierda red de transito liviano
EGRESO por calle jujuy hasta calle brasil hacia la derecha red de transito liviano
EGRESO por calle brasil hasta Av. Yrigoyen hacia la izquierda res de transito pesado
EGRESO por YrigoyeN hasta Avellaneda red de transito pesado
`;

function queryUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'LanusGIS/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: e.message, data });
        }
      });
    }).on('error', (e) => resolve({ error: e.message }));
  });
}

async function geocodeIntersection(streetA, streetB) {
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

async function buildRouteForStreets(streets, index) {
  const waypoints = [];
  for (let i = 0; i < streets.length - 1; i++) {
    const streetA = streets[i].trim();
    const streetB = streets[i+1].trim();
    if (!streetA || !streetB) continue;
    const coords = await geocodeIntersection(streetA, streetB);
    if (coords) {
      waypoints.push(coords);
    }
    await new Promise(r => setTimeout(r, 100));
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
          name: `Recorrido ${index + 1}`,
          streets: streets.join(' - '),
          color: color
        },
        geometry: routeData.routes[0].geometry
      };
    }
  } catch (e) {}
  return null;
}

async function run() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `
Eres un asistente experto que extrae datos de solicitudes de tránsito pesado para la Municipalidad de Lanús. 
El texto copiado suele tener el formato donde el nombre del campo está en una línea y el valor está en la línea de abajo o separada por espacios/saltos de línea.

Extrae la siguiente información en formato JSON siguiendo estas reglas precisas:
- numeroSolicitud (string, busca 'Expediente: ' ej. '1000-2026-964794-O', si no está, usa el ID de solicitud sin el #)
- nombreSolicitante (string, busca debajo de 'Nombre de la empresa (*)' o 'Nombre de la empresa', sino debajo de 'Nombre Solicitante')
- patente (string, busca debajo de "Patente (*)" o "Patente". Ten cuidado, el valor puede estar en la línea siguiente y puede contener espacios, ej: 'AI 121 OS' o 'AB123CD')
- tipoVehiculo (string, busca debajo de "Tipo de vehículo (*)" o "Tipo de vehículo", ej: 'TRACTOR CON CABINA DORMITORIO')
- pesoToneladas (number, busca debajo de 'capacidad de carga (*)', 'Peso Total' o 'Toneladas'. Si el valor es '25.000 KG', conviértelo a 25. Si es '35 Tn', conviértelo a 35)
- cargaPeligrosa (boolean, busca debajo de 'tipo de carga (*)'. Si dice 'CARGAS GENERALES' es false. Si dice algo peligroso es true)
- idSolicitudWeb (string, busca 'ID: #' o 'ID de solicitud:' y extrae solo el número, ej: '61674')
- vigenciaDesde (string, busca la fecha de 'Creación:', 'Publicación:' o 'Fecha:')
- vigenciaHasta (string, busca la fecha en 'Vigencia hasta:' o 'Vigente:')
- aseguradora (string, busca debajo de 'aseguradora' o 'Aseguradora')
- nroSeguro (string, busca debajo de 'nro de seguro de carga' o 'Póliza')
- recorridos (array de arrays de strings): Busca descripciones de recorridos, ya sean secuenciales (ej: 'Calle A - Calle B') o narrativos con bloques de 'INGRESO', 'EGRESO', 'DESTINO' (ej: 'recorrido escrito 1', 'recorrido escrito 2'). 
  Cada recorrido o sub-recorrido separado por líneas vacías o bloques debe extraerse como una secuencia cronológica independiente de nombres de calles limpias en orden.
  Normas para limpiar y formatear las calles:
  1. Extrae solo el nombre de la calle o avenida (ej: 'Av. Hipólito Yrigoyen', 'Int. Manuel Quindimil', 'Héctor Noya', 'Chaco', 'Avellaneda').
  2. Elimina palabras narrativas como 'INGRESO', 'EGRESO', 'DESTINO', 'hasta la calle', 'por calle', 'desde', 'hacia derecha', 'red de transito', 'media cuadras', ni números de altura (como '950' o '1136').
  3. Corrige errores ortográficos de las calles de Lanús para asegurar que geocodifiquen bien (ej: 'Av. Hypolito Yrigoyen', 'Av. Yrigoyen' o 'YrigoyeN' -> 'Av. Hipólito Yrigoyen'; 'hector noya' -> 'Héctor Noya'; 'Sna Martin' -> 'San Martín').
  4. Si una sección de recorrido (ej: 'recorrido escrito 1') tiene múltiples bloques de rutas separados por un salto de línea, extrae cada bloque como un recorrido individual (un array de strings independiente).
  Ejemplo de salida esperado para texto narrativo:
  "recorridos": [
    ["Av. Hipólito Yrigoyen", "Int. Manuel Quindimil", "Héctor Noya", "Chaco", "Colombia", "Av. San Martín", "Av. Remedios de Escalada de San Martín", "Av. Hipólito Yrigoyen", "Avellaneda"],
    ["Av. Hipólito Yrigoyen", "Av. Remedios de Escalada de San Martín", "Av. San Martín", "Colombia", "Jujuy", "Brasil", "Av. Hipólito Yrigoyen", "Avellaneda"]
  ]

Texto de la solicitud:
${text}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Devuelve únicamente JSON con los datos requeridos." },
      { role: "user", content: prompt }
    ]
  });

  const resultString = completion.choices[0].message?.content;
  console.log("=== EXTRACTED DATA ===");
  console.log(resultString);

  const extractedData = JSON.parse(resultString);
  const routeFeatures = [];
  if (extractedData.recorridos && Array.isArray(extractedData.recorridos)) {
    for (let i = 0; i < extractedData.recorridos.length; i++) {
      const streets = extractedData.recorridos[i];
      if (Array.isArray(streets) && streets.length >= 2) {
        const routeFeature = await buildRouteForStreets(streets, i);
        if (routeFeature) {
          routeFeatures.push(routeFeature);
        }
      }
    }
  }

  const datosGeo = routeFeatures.length > 0 ? {
    type: "FeatureCollection",
    features: routeFeatures
  } : null;

  console.log("=== DATOS GEO ===");
  console.log(JSON.stringify(datosGeo, null, 2));
}

run();
