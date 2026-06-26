const https = require('https');

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
  // 1. Try USIG
  const usigUrl = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(streetA + ' y ' + streetB + ', Lanus')}&geocodificar=true`;
  try {
    const data = await queryUrl(usigUrl);
    if (data.direccionesNormalizadas && data.direccionesNormalizadas.length > 0) {
      const match = data.direccionesNormalizadas[0];
      if (match.coordenadas && match.coordenadas.x && match.coordenadas.y) {
        return { lat: match.coordenadas.y, lng: match.coordenadas.x, source: 'usig' };
      }
    }
  } catch (e) {
    console.error("USIG error:", e.message);
  }

  // 2. Try Georef
  const georefUrl = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(streetA + ' y ' + streetB)}&departamento=Lanus`;
  try {
    const data = await queryUrl(georefUrl);
    if (data.direcciones && data.direcciones.length > 0) {
      const match = data.direcciones[0];
      if (match.ubicacion && match.ubicacion.lat && match.ubicacion.lon) {
        return { lat: match.ubicacion.lat, lng: match.ubicacion.lon, source: 'georef' };
      }
    }
  } catch (e) {
    console.error("Georef error:", e.message);
  }

  // 3. Try Nominatim
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(streetA + ' & ' + streetB + ', Lanus, Buenos Aires, Argentina')}&format=json&limit=1`;
  try {
    const data = await queryUrl(nominatimUrl);
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'nominatim' };
    }
  } catch (e) {
    console.error("Nominatim error:", e.message);
  }

  return null;
}

async function buildRouteForStreets(streets) {
  console.log(`Building route for: ${streets.join(' -> ')}`);
  const waypoints = [];
  
  for (let i = 0; i < streets.length - 1; i++) {
    const streetA = streets[i].trim();
    const streetB = streets[i+1].trim();
    console.log(`Geocoding intersection: ${streetA} y ${streetB}`);
    const coords = await geocodeIntersection(streetA, streetB);
    if (coords) {
      console.log(`  Found coords: ${coords.lat}, ${coords.lng} (${coords.source})`);
      waypoints.push(coords);
    } else {
      console.log(`  Failed to geocode intersection: ${streetA} y ${streetB}`);
    }
    // Tiny delay to respect APIs
    await new Promise(r => setTimeout(r, 200));
  }

  if (waypoints.length < 2) {
    console.log("Not enough waypoints to build a route.");
    return null;
  }

  // Fetch from OSRM
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints.map(w => `${w.lng},${w.lat}`).join(';')}?overview=full&geometries=geojson`;
  console.log("Fetching OSRM route:", osrmUrl);
  const routeData = await queryUrl(osrmUrl);
  if (routeData.routes && routeData.routes.length > 0) {
    return {
      type: "Feature",
      properties: {
        streets: streets.join(' - '),
        waypointsCount: waypoints.length
      },
      geometry: routeData.routes[0].geometry
    };
  } else {
    console.log("OSRM route not found:", routeData);
    return null;
  }
}

async function test() {
  const streets = ["Av. San Martín", "Colombia", "Jujuy", "Resistencia"];
  const route = await buildRouteForStreets(streets);
  console.log("Final route GeoJSON:");
  console.log(JSON.stringify(route, null, 2));
}

test();
