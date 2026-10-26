/**
 * lanusGeocoder.ts
 * Geocodificador de máxima precisión para el Municipio de Lanús.
 * Utiliza la API Oficial de Georef del Instituto Geográfico Nacional (IGN / Ministerio del Interior)
 * con diccionario de equivalencias y normalización de nomenclatura de calles del Partido de Lanús.
 */

interface Coordinates {
  lat: number;
  lng: number;
}

// Bounding box estricto del Partido de Lanús:
// Lng Oeste: -58.4600, Lng Este: -58.3200, Lat Sur: -34.7550, Lat Norte: -34.6500
export const LANUS_BBOX = {
  minLng: -58.4600,
  maxLng: -58.3200,
  minLat: -34.7550,
  maxLat: -34.6500,
};

export function isInsideLanus(lat: number, lng: number): boolean {
  return (
    lat >= LANUS_BBOX.minLat &&
    lat <= LANUS_BBOX.maxLat &&
    lng >= LANUS_BBOX.minLng &&
    lng <= LANUS_BBOX.maxLng
  );
}

// Diccionario de normalización para que coincida 1:1 con el Catastro Nacional (Georef) de Lanús
const SYNONYMS: Record<string, string> = {
  'v. de lujan': 'VILLA DE LUJAN',
  'v de lujan': 'VILLA DE LUJAN',
  'virgen de lujan': 'VILLA DE LUJAN',
  'villa de lujan': 'VILLA DE LUJAN',
  'sayos': 'CNL SAYOS',
  'coronel sayos': 'CNL SAYOS',
  'balbin': 'DR RICARDO BALBIN',
  'balbín': 'DR RICARDO BALBIN',
  'dr ricardo balbin': 'DR RICARDO BALBIN',
  'doctor ricardo balbin': 'DR RICARDO BALBIN',
  'liniers': 'VIRREY SANTIAGO DE LINIERS',
  'posadas': 'GERVASIO A DE POSADAS',
  'ruiz de ocaña': 'JUAN RUIZ DE OCANA',
  'ruiz de ocana': 'JUAN RUIZ DE OCANA',
  'namuncura': 'CEFERINO NAMUNCURA',
  'namuncurá': 'CEFERINO NAMUNCURA',
  'del valle iberlucea': 'ENRIQUE DEL VALLE IBERLUCEA',
  'iberlucea': 'ENRIQUE DEL VALLE IBERLUCEA',
  'de la cruz': 'DE LA CRUZ',
  'enrique fernandez': 'ENRIQUE FERNANDEZ',
  'warnes': 'CNL IGNACIO WARNES',
  'blanco encalada': 'BLANCO ENCALADA',
  'murguiondo': 'CNL MURGUIONDO',
  'velloso': 'ENRIQUE G VELLOSO',
  'pringles': 'CNL PRINGLES',
  'guido': 'GRL GUIDO',
  'darragueira': 'DR JOSE DARRAGUEIRA',
  'osorio': 'CNL OSORIO',
  'bolaños': 'JOSE BOLANOS',
  'bolanos': 'JOSE BOLANOS',
  'pergamino': 'PERGAMINO',
  'guidi': 'GUIDI HECTOR',
  'juan bautista guidi': 'GUIDI HECTOR',
  'ferre': 'GRL FERRE',
  'sargento cabral': 'SGT CABRAL',
  'bueras': 'TCNL BUERAS',
  'erezcano': 'CNL EREZCANO',
  'veracruz': 'VERACRUZ',
  'maza': 'MANUEL MAZA',
  'oliden': 'GDOR OLIDEN',
  'tacuari': 'TACUARI',
  'ocampo': 'MANUEL OCAMPO',
  'noya': 'CJAL NOYA',
  'colon': 'COLON',
  'magallanes': 'HERNANDO DE MAGALLANES',
  'cavour': 'CAMILO V CAVOUR',
  'maspero': 'DR LUIS A MASPERO',
  '3 de febrero': '3 DE FEBRERO',
  'hladnik': 'MONS JUAN HLADNIK',
  'felix de alzaga': 'FELIX ALZAGA',
  'alzaga': 'FELIX ALZAGA',
  'chascomus': 'CHASCOMUS',
  'chascomús': 'CHASCOMUS',
  'general paz': 'GENERAL PAZ',
};

// Coordenadas fijas de intersecciones conocidas especiales en Lanús
const KNOWN_INTERSECTIONS: Record<string, Coordinates> = {
  'colon y general paz': { lat: -34.718045, lng: -58.419685 },
  'general paz y colon': { lat: -34.718045, lng: -58.419685 },
  'del valle iberlucea y de la cruz': { lat: -34.720713, lng: -58.395565 },
  'enrique del valle iberlucea y de la cruz': { lat: -34.720713, lng: -58.395565 },
  'guido y darragueira': { lat: -34.705651, lng: -58.381531 },
  'darragueira y guido': { lat: -34.705651, lng: -58.381531 },
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

async function queryGeoref(queryStr: string): Promise<Coordinates | null> {
  try {
    const url = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(queryStr)}&departamento=Lanus`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LanusGIS/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.direcciones && data.direcciones.length > 0) {
      const match = data.direcciones[0];
      if (match.ubicacion?.lat && match.ubicacion?.lon) {
        const lat = match.ubicacion.lat;
        const lng = match.ubicacion.lon;
        if (isInsideLanus(lat, lng)) {
          return { lat, lng };
        }
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Geocodifica una intersección de dos calles en Lanús utilizando Catastro Oficial
 */
export async function geocodeIntersection(streetA: string, streetB: string): Promise<Coordinates | null> {
  const normA = streetA.trim().toLowerCase().replace(/\.$/, '');
  const normB = streetB.trim().toLowerCase().replace(/\.$/, '');
  const key = `${normA} y ${normB}`;
  const keyInv = `${normB} y ${normA}`;

  // 1. Revisar intersecciones fijas conocidas
  if (KNOWN_INTERSECTIONS[key]) return KNOWN_INTERSECTIONS[key];
  if (KNOWN_INTERSECTIONS[keyInv]) return KNOWN_INTERSECTIONS[keyInv];

  const cleanA = cleanStreetName(streetA);
  const cleanB = cleanStreetName(streetB);

  // 2. Intento con nombres normalizados
  let coords = await queryGeoref(`${cleanA} y ${cleanB}`);
  if (coords) return coords;

  coords = await queryGeoref(`${cleanB} y ${cleanA}`);
  if (coords) return coords;

  // 3. Intento con nombres originales directos
  coords = await queryGeoref(`${streetA} y ${streetB}`);
  if (coords) return coords;

  coords = await queryGeoref(`${streetB} y ${streetA}`);
  if (coords) return coords;

  return null;
}

/**
 * Geocodifica una dirección con altura (ej: "Bueras 1818" o "Colon 1600")
 */
export async function geocodeStreetWithNumber(streetWithNumber: string): Promise<Coordinates | null> {
  // Limpiar y normalizar el nombre
  let search = streetWithNumber.trim();
  const match = search.match(/(.+?)\s+(\d+)$/);
  if (match) {
    const street = cleanStreetName(match[1]);
    const num = match[2];
    search = `${street} ${num}`;
  }
  return await queryGeoref(search);
}

/**
 * Geocodifica un tramo entre dos esquinas
 */
export async function geocodeSegment(street: string, crossA: string, crossB: string): Promise<{
  startCoords: Coordinates | null;
  endCoords: Coordinates | null;
}> {
  const p1 = await geocodeIntersection(street, crossA);
  const p2 = await geocodeIntersection(street, crossB);

  return {
    startCoords: p1,
    endCoords: p2,
  };
}
