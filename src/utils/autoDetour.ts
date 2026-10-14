import * as turf from '@turf/turf';

/**
 * Calcula automáticamente un desvío alrededor del punto de corte para una línea dada.
 * 1. Toma la traza de la línea y busca el punto más cercano al corte.
 * 2. Toma un punto antes del corte (origen del desvío) y un punto después del corte (reenganche a la ruta habitual).
 * 3. Devuelve los waypoints [origen, puntoIntermedioEsquivando, reenganche] para consultar el ruteador.
 */
export function sugerirPuntosDesvio(lineaGeo: any, corteCoords: [number, number], radioMetros: number = 80): [number, number][] | null {
  try {
    let coords: [number, number][] = [];

    if (lineaGeo.type === 'LineString') {
      coords = lineaGeo.coordinates;
    } else if (lineaGeo.type === 'Feature' && lineaGeo.geometry?.type === 'LineString') {
      coords = lineaGeo.geometry.coordinates;
    } else if (lineaGeo.type === 'FeatureCollection' && lineaGeo.features?.length > 0) {
      const lineFeat = lineaGeo.features.find((f: any) => f.geometry?.type === 'LineString');
      if (lineFeat) coords = lineFeat.geometry.coordinates;
    }

    if (!coords || coords.length < 2) return null;

    const lineTurf = turf.lineString(coords);
    const cortePt = turf.point([corteCoords[1], corteCoords[0]]); // [lng, lat]

    // Distancia sobre la línea más cercana al corte
    const snapped = turf.nearestPointOnLine(lineTurf, cortePt);
    const distOnLineKm = snapped.properties.location || 0;
    const totalLineDistKm = turf.length(lineTurf, { units: 'kilometers' });

    // Distancia de margen antes y después del corte (aprox 120-150 metros)
    const margenKm = Math.max((radioMetros * 1.6) / 1000, 0.12);

    const distBefore = Math.max(0.01, distOnLineKm - margenKm);
    const distAfter = Math.min(totalLineDistKm - 0.01, distOnLineKm + margenKm);

    const ptBefore = turf.along(lineTurf, distBefore, { units: 'kilometers' }).geometry.coordinates;
    const ptAfter = turf.along(lineTurf, distAfter, { units: 'kilometers' }).geometry.coordinates;

    // Calcular un vector perpendicular al corte para esquivar la calle cortada
    const bearing = turf.bearing(turf.point(ptBefore), turf.point(ptAfter));
    // Nos desviamos 90 grados a la derecha o izquierda según convenga (aprox 100 metros hacia calle paralela)
    const ptBypass = turf.destination(cortePt, (radioMetros * 1.5) / 1000, bearing + 90, { units: 'kilometers' }).geometry.coordinates;

    // Devolvemos [lat, lng] para Leaflet Routing
    return [
      [ptBefore[1], ptBefore[0]],
      [ptBypass[1], ptBypass[0]],
      [ptAfter[1], ptAfter[0]],
    ];
  } catch (e) {
    console.error('Error calculando sugerencia automatica:', e);
    return null;
  }
}
