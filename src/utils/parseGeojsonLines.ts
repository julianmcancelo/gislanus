/**
 * Parser universal e inteligente para importar archivos GeoJSON de líneas de colectivos.
 * Detecta automáticamente:
 * - Número de línea
 * - Nombre de ramal / recorrido
 * - Sentido (IDA / VUELTA)
 * - Empresa / Razón Social / Operador
 * - Jurisdicción (Nacional, Provincial, Municipal)
 * - Color distintivo
 */

const DEFAULT_COLORS: Record<string, string> = {
  '9': '#0284c7',   // Celeste azulado
  '15': '#e11d48',  // Rojo carmesí
  '20': '#16a34a',  // Verde
  '28': '#84cc16',  // Verde lima
  '29': '#06b6d4',  // Cian
  '31': '#6366f1',  // Índigo
  '32': '#d97706',  // Ámbar / Naranja
  '33': '#0ea5e9',  // Celeste cielo
  '37': '#14b8a6',  // Verde azulado
  '45': '#9333ea',  // Violeta
  '51': '#ec4899',  // Rosa
  '70': '#f43f5e',  // Rosa fuerte
  '74': '#10b981',  // Esmeralda
  '75': '#0d9488',  // Turquesa / Teal
  '79': '#8b5cf6',  // Púrpura
  '85': '#f59e0b',  // Amarillo dorado
  '100': '#3b82f6', // Azul brillante
  '112': '#64748b', // Gris pizarra
  '128': '#a855f7', // Violeta claro
  '154': '#d946ef', // Fucsia
  '158': '#4f46e5', // Índigo profundo
  '160': '#059669', // Verde oscuro
  '164': '#be123c', // Carmín
  '177': '#ca8a04', // Mostaza
  '178': '#0284c7', // Azul cian
  '179': '#2563eb', // Azul
  '188': '#7c3aed', // Púrpura oscuro
  '247': '#0891b2', // Cian
  '271': '#dc2626', // Rojo
  '283': '#475569', // Gris
  '354': '#15803d', // Verde
  '520': '#b45309', // Bronce
};

export interface ParsedLineFeature {
  id?: string;
  nombre: string;
  numero: string;
  subcategoria: string;
  sentido: 'IDA' | 'VUELTA' | null;
  categoria: 'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL';
  color: string;
  descripcion: string;
  datosGeo: string;
  empresa?: string;
}

export function parseGeojsonToLines(geojsonObj: any, fileName: string = ''): ParsedLineFeature[] {
  if (!geojsonObj) return [];

  let features: any[] = [];
  if (geojsonObj.type === 'FeatureCollection' && Array.isArray(geojsonObj.features)) {
    features = geojsonObj.features;
  } else if (geojsonObj.type === 'Feature') {
    features = [geojsonObj];
  } else if (geojsonObj.type === 'LineString' || geojsonObj.type === 'MultiLineString') {
    features = [{ type: 'Feature', geometry: geojsonObj, properties: {} }];
  }

  const results: ParsedLineFeature[] = [];

  features.forEach((f, idx) => {
    // Filtrar solo líneas reales (LineString / MultiLineString)
    if (!f.geometry) return;
    const gtype = f.geometry.type;
    if (gtype !== 'LineString' && gtype !== 'MultiLineString') return;
    if (f.properties?.tipo === 'vehiculo_activo') return;

    const props = f.properties || {};
    const desc = props.description || '';
    const title = props.title || props.name || props.nombre || '';

    let rawLinea = props.linea || props.line || props.ref || props.numero || '';
    let rawRecorrido = props.ramal || props.recorrido || props.subgrupo_detalle || props.subgrupo || '';
    let rawSentido = props.sentido || props.direction || props.sentido_label || '';
    let rawRazon = props.operador || props.operator || props.empresa || props.Razon_soci || '';
    let rawJurisdiccion = props.jurisdiccion || props.jurisdicci || props.network || '';

    // Si la información viene en formato de texto multilinea en 'description':
    if (typeof desc === 'string' && desc.includes(':')) {
      const lines = desc.split('\n');
      for (const line of lines) {
        const matchL = line.match(/^Linea:\s*(.+)$/i);
        if (matchL && !rawLinea) rawLinea = matchL[1].trim();

        const matchR = line.match(/^Recorrido:\s*(.+)$/i);
        if (matchR && !rawRecorrido) rawRecorrido = matchR[1].trim();

        const matchS = line.match(/^Sentido:\s*(.+)$/i);
        if (matchS && !rawSentido) rawSentido = matchS[1].trim();

        const matchZ = line.match(/^Razon_soci:\s*(.+)$/i);
        if (matchZ && !rawRazon) rawRazon = matchZ[1].trim();

        const matchJ = line.match(/^Jurisdicci:\s*(.+)$/i);
        if (matchJ && !rawJurisdiccion) rawJurisdiccion = matchJ[1].trim();
      }
    }

    // 1. Extraer Número de Línea
    let numero = String(rawLinea).replace(/^0+/, '').trim();
    if (!numero) {
      const matchNum = (title + ' ' + fileName).match(/(?:LINEA|Línea|Linea)?\s*0*([0-9]{1,4})/i);
      if (matchNum && matchNum[1]) {
        numero = matchNum[1];
      }
    }

    // 2. Extraer Ramal
    let subcategoria = '';
    if (rawRecorrido) {
      subcategoria = String(rawRecorrido).trim();
      if (!subcategoria.toUpperCase().startsWith('RAMAL') && subcategoria.length <= 4) {
        subcategoria = `Ramal ${subcategoria}`;
      }
    } else {
      const matchRamal = title.match(/[-–]\s*(?:R|Ramal)\s*([A-Z0-9]+)/i);
      if (matchRamal && matchRamal[1]) {
        subcategoria = `Ramal ${matchRamal[1]}`;
      }
    }

    // 3. Extraer Sentido
    let sentido: 'IDA' | 'VUELTA' | null = null;
    const combinedSentido = `${rawSentido} ${title} ${props.direction || ''}`.toUpperCase();
    if (combinedSentido.includes('VUELTA') || combinedSentido.includes('VUEKTA') || combinedSentido.includes('REGRESO') || combinedSentido.includes('INBOUND')) {
      sentido = 'VUELTA';
    } else if (combinedSentido.includes('IDA') || combinedSentido.includes('OUTBOUND')) {
      sentido = 'IDA';
    }

    // 4. Extraer Jurisdicción
    let categoria: 'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL' = 'NACIONAL';
    if (rawJurisdiccion) {
      const jUpper = String(rawJurisdiccion).toUpperCase();
      if (jUpper.includes('MUNICIPAL')) categoria = 'MUNICIPAL';
      else if (jUpper.includes('PROVINCIAL')) categoria = 'PROVINCIAL';
      else categoria = 'NACIONAL';
    } else {
      const numInt = parseInt(numero, 10);
      if (!isNaN(numInt)) {
        if (numInt >= 500) categoria = 'MUNICIPAL';
        else if (numInt >= 200) categoria = 'PROVINCIAL';
        else categoria = 'NACIONAL';
      }
    }

    // 5. Nombre amigable
    let nombre = '';
    if (numero) {
      const parts = [`Línea ${numero}`];
      if (subcategoria) parts.push(subcategoria);
      if (sentido) parts.push(`(${sentido})`);
      nombre = parts.join(' - ');
    } else if (title) {
      nombre = title.replace(/[-–\s]+$/, '');
    } else {
      nombre = `Línea ${fileName.replace(/\.geojson$/i, '') || idx + 1}`;
    }

    // 6. Color
    const color = props.stroke || props.color || props.colour || props.color_hex || (numero ? DEFAULT_COLORS[numero] : null) || '#2563eb';

    // 7. Descripción con Empresa / Operador
    const descParts: string[] = [];
    if (rawRazon) descParts.push(`Empresa: ${rawRazon}`);
    if (props.from && props.to) descParts.push(`${props.from} ↔ ${props.to}`);
    if (props.ciudad) descParts.push(props.ciudad);
    if (props.distancia_km) descParts.push(`${props.distancia_km} km`);
    if (descParts.length === 0 && typeof desc === 'string' && desc && !desc.includes('\n')) {
      descParts.push(desc);
    }
    const descripcion = descParts.join(' · ');

    // Asegurar que el feature tenga sus propiedades bien formateadas en su GeoJSON
    const individualFeature = {
      type: 'Feature',
      id: f.id || `linea_${numero || idx}_${subcategoria || 'ramal'}_${sentido || 'ida'}_${idx}`,
      geometry: f.geometry,
      properties: {
        ...props,
        linea: numero,
        nombre,
        numero,
        ramal: subcategoria,
        sentido,
        categoria,
        color,
        operador: rawRazon || props.operador || '',
        descripcion,
      }
    };

    results.push({
      id: f.id ? `linea-feat-${f.id}` : undefined,
      nombre,
      numero,
      subcategoria: subcategoria || 'Ramal Principal',
      sentido,
      categoria,
      color,
      descripcion,
      empresa: rawRazon || '',
      datosGeo: JSON.stringify(individualFeature),
    });
  });

  return results;
}
