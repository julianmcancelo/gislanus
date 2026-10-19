/**
 * lanusGeocoder.ts
 * Geocodificador especializado en calles, intersecciones y tramos del Municipio de Lanús.
 * Utiliza en cascada USIG (GCBA / Conurbano Bonaerense) y Georef Nacional con filtro de Lanús.
 */

interface Coordinates {
  lat: number;
  lng: number;
}

// Diccionario de normalización de calles conocidas en Lanús
const SYNONYMS: Record<string, string> = {
  'v. de lujan': 'Luján',
  'v de lujan': 'Luján',
  'virgen de lujan': 'Luján',
  'sayos': 'Coronel Sayos',
  'balbin': 'Doctor Ricardo Balbín',
  'balbín': 'Doctor Ricardo Balbín',
  'liniers': 'Virrey Santiago de Liniers',
  'posadas': 'Gervasio Antonio de Posadas',
  'ruiz de ocaña': 'Ruiz de Ocaña',
  'ruiz de ocana': 'Ruiz de Ocaña',
  'namuncura': 'Ceferino Namuncurá',
  'namuncurá': 'Ceferino Namuncurá',
  'carlos gardel': 'Carlos Gardel',
  'gardel': 'Carlos Gardel',
  'del valle iberlucea': 'Del Valle Iberlucea',
  'iberlucea': 'Del Valle Iberlucea',
  'de la cruz': 'Sor Juana Inés de la Cruz',
  'enrique fernandez': 'Enrique Fernández',
  'warnes': 'Ministro Brin', // en Lanús a menudo se cruzan o se normaliza por USIG
};

export function cleanStreetName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim().replace(/\.$/, '');
  const lower = cleaned.toLowerCase();
  if (SYNONYMS[lower]) {
    return SYNONYMS[lower];
  }
  return cleaned;
}

async function queryJson(url: string, timeoutMs: number = 7000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LanusGIS/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Geocodifica una intersección de dos calles en Lanús
 */
export async function geocodeIntersection(streetA: string, streetB: string): Promise<Coordinates | null> {
  const cleanA = cleanStreetName(streetA);
  const cleanB = cleanStreetName(streetB);

  // Intento 1: USIG con partido Lanús
  try {
    const usigUrl = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(cleanA + ' y ' + cleanB + ', Lanus')}&geocodificar=true`;
    const data = await queryJson(usigUrl);
    if (data?.direccionesNormalizadas?.length > 0) {
      const match = data.direccionesNormalizadas[0];
      if (match.coordenadas?.x && match.coordenadas?.y) {
        return { lat: match.coordenadas.y, lng: match.coordenadas.x };
      }
    }
  } catch (e) {}

  // Intento 2: USIG sin forzar partido Lanús (si las calles ya son únicas del conurbano sur)
  try {
    const usigUrl2 = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(cleanA + ' y ' + cleanB)}&geocodificar=true`;
    const data = await queryJson(usigUrl2);
    if (data?.direccionesNormalizadas?.length > 0) {
      const match = data.direccionesNormalizadas.find((d: any) => 
        (d.nombre_partido || '').toLowerCase().includes('lanús') || (d.nombre_partido || '').toLowerCase().includes('lanus')
      ) || data.direccionesNormalizadas[0];
      if (match.coordenadas?.x && match.coordenadas?.y) {
        return { lat: match.coordenadas.y, lng: match.coordenadas.x };
      }
    }
  } catch (e) {}

  // Intento 3: Georef API Nacional con filtro departamento Lanús
  try {
    const georefUrl = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(cleanA + ' y ' + cleanB)}&departamento=Lanus`;
    const data = await queryJson(georefUrl);
    if (data?.direcciones?.length > 0) {
      const match = data.direcciones[0];
      if (match.ubicacion?.lat && match.ubicacion?.lon) {
        return { lat: match.ubicacion.lat, lng: match.ubicacion.lon };
      }
    }
  } catch (e) {}

  // Intento 4: Georef API con filtro provincia Buenos Aires
  try {
    const georefProvUrl = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(cleanA + ' y ' + cleanB)}&provincia=06`;
    const data = await queryJson(georefProvUrl);
    if (data?.direcciones?.length > 0) {
      const match = data.direcciones.find((d: any) => 
        (d.departamento?.nombre || '').toLowerCase().includes('lanús') || (d.departamento?.nombre || '').toLowerCase().includes('lanus')
      ) || data.direcciones[0];
      if (match.ubicacion?.lat && match.ubicacion?.lon) {
        return { lat: match.ubicacion.lat, lng: match.ubicacion.lon };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Geocodifica un tramo entre dos esquinas y genera el trazado de la calle
 */
export async function geocodeSegment(street: string, crossA: string, crossB: string): Promise<{
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  startCoords: Coordinates | null;
  endCoords: Coordinates | null;
}> {
  const p1 = await geocodeIntersection(street, crossA);
  const p2 = await geocodeIntersection(street, crossB);

  if (p1 && p2) {
    // Intentar ruteo OSRM para seguir la geometría de la calle exacta
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
      const data = await queryJson(osrmUrl, 5000);
      if (data?.routes?.[0]?.geometry) {
        return {
          geometry: data.routes[0].geometry,
          startCoords: p1,
          endCoords: p2,
        };
      }
    } catch (e) {}

    // Fallback: Línea recta directa entre ambas esquinas
    return {
      geometry: {
        type: 'LineString',
        coordinates: [
          [p1.lng, p1.lat],
          [p2.lng, p2.lat],
        ],
      },
      startCoords: p1,
      endCoords: p2,
    };
  }

  return {
    geometry: null,
    startCoords: p1,
    endCoords: p2,
  };
}
