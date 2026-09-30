/**
 * Utilidades de exportación y descarga para Relevamientos GPS de Lanús Digital
 */

export function triggerDownload(content: string | Blob, filename: string, mimeType: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function parseTripGeo(trip: any): any {
  if (!trip?.datosGeo) return null;
  try {
    return typeof trip.datosGeo === 'string' ? JSON.parse(trip.datosGeo) : trip.datosGeo;
  } catch {
    return null;
  }
}

export function generateFilename(trip: any, extension: string): string {
  const linea = trip.lineaNumero ? `linea_${trip.lineaNumero}` : 'relevamiento';
  const ramal = trip.ramal ? `_${trip.ramal.replace(/\s+/g, '_')}` : '';
  const sentido = trip.sentido ? `_${trip.sentido.toLowerCase()}` : '';
  const dateStr = trip.creadoEn ? new Date(trip.creadoEn).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${linea}${ramal}${sentido}_${dateStr}.${extension}`.toLowerCase();
}

/**
 * Descarga en formato GeoJSON FeatureCollection
 */
export function downloadGeoJson(trip: any) {
  const geoObj = parseTripGeo(trip);
  if (!geoObj) throw new Error('No hay geometría válida para exportar');

  // Enriquecer FeatureCollection con propiedades del relevamiento
  const enriched = {
    type: 'FeatureCollection',
    metadata: {
      id: trip.id,
      uuid: trip.uuid,
      lineaNumero: trip.lineaNumero,
      ramal: trip.ramal,
      sentido: trip.sentido,
      interno: trip.interno,
      patente: trip.patente,
      chofer: trip.chofer,
      notas: trip.notas,
      distanciaMeters: trip.distanciaMeters,
      duracionMs: trip.duracionMs,
      velocidadProm: trip.velocidadProm,
      velocidadMax: trip.velocidadMax,
      puntosCount: trip.puntosCount,
      paradasCount: trip.paradasCount,
      incidenciasCount: trip.incidenciasCount,
      fechaInicio: trip.fechaInicio,
      fechaFin: trip.fechaFin,
      origen: trip.origen,
      generadoPor: 'Lanús Digital — GIS Municipal',
    },
    features: geoObj.features || (geoObj.type === 'Feature' ? [geoObj] : []),
  };

  const filename = generateFilename(trip, 'geojson');
  triggerDownload(JSON.stringify(enriched, null, 2), filename, 'application/geo+json');
}

/**
 * Convierte el relevamiento a formato GPX 1.1 estándar (Waypoints y Track)
 */
export function downloadGpx(trip: any) {
  const geoObj = parseTripGeo(trip);
  if (!geoObj) throw new Error('No hay geometría válida para exportar');

  const title = `Línea ${trip.lineaNumero || 'S/N'} - ${trip.ramal || 'Principal'} (${trip.sentido || 'IDA'})`;
  const time = trip.fechaInicio ? new Date(trip.fechaInicio).toISOString() : new Date().toISOString();

  let waypointsXml = '';
  let trackpointsXml = '';

  const features = geoObj.features || (geoObj.type === 'Feature' ? [geoObj] : []);

  for (const feat of features) {
    if (feat.geometry?.type === 'Point') {
      const [lon, lat, ele] = feat.geometry.coordinates;
      const type = feat.properties?.type || 'wpt';
      const name = feat.properties?.name || (type === 'stop' ? `Parada ${feat.properties?.sequence || ''}` : 'Incidencia');
      const desc = feat.properties?.description || feat.properties?.incidentType || '';

      waypointsXml += `  <wpt lat="${lat}" lon="${lon}">\n`;
      if (ele !== undefined) waypointsXml += `    <ele>${ele}</ele>\n`;
      waypointsXml += `    <name>${escapeXml(name)}</name>\n`;
      if (desc) waypointsXml += `    <desc>${escapeXml(desc)}</desc>\n`;
      waypointsXml += `    <type>${type === 'stop' ? 'BusStop' : 'Hazard'}</type>\n`;
      waypointsXml += `  </wpt>\n`;
    } else if (feat.geometry?.type === 'LineString') {
      for (const coord of feat.geometry.coordinates) {
        const [lon, lat, ele] = coord;
        trackpointsXml += `      <trkpt lat="${lat}" lon="${lon}">\n`;
        if (ele !== undefined) trackpointsXml += `        <ele>${ele}</ele>\n`;
        trackpointsXml += `      </trkpt>\n`;
      }
    } else if (feat.geometry?.type === 'MultiLineString') {
      for (const line of feat.geometry.coordinates) {
        for (const coord of line) {
          const [lon, lat, ele] = coord;
          trackpointsXml += `      <trkpt lat="${lat}" lon="${lon}">\n`;
          if (ele !== undefined) trackpointsXml += `        <ele>${ele}</ele>\n`;
          trackpointsXml += `      </trkpt>\n`;
        }
      }
    }
  }

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Lanús Digital — BusTrackerGPS" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(title)}</name>
    <desc>Relevamiento de campo municipal. Interno: ${trip.interno || 'N/A'}, Chofer: ${trip.chofer || 'N/A'}</desc>
    <time>${time}</time>
  </metadata>
${waypointsXml}  <trk>
    <name>${escapeXml(title)}</name>
    <trkseg>
${trackpointsXml}    </trkseg>
  </trk>
</gpx>`;

  const filename = generateFilename(trip, 'gpx');
  triggerDownload(gpxContent, filename, 'application/gpx+xml');
}

/**
 * Convierte el relevamiento a formato KML para Google Earth
 */
export function downloadKml(trip: any) {
  const geoObj = parseTripGeo(trip);
  if (!geoObj) throw new Error('No hay geometría válida para exportar');

  const title = `Línea ${trip.lineaNumero || 'S/N'} - ${trip.ramal || 'Principal'} (${trip.sentido || 'IDA'})`;
  const features = geoObj.features || (geoObj.type === 'Feature' ? [geoObj] : []);

  let placemarksXml = '';

  for (const feat of features) {
    if (feat.geometry?.type === 'LineString') {
      const coordsStr = feat.geometry.coordinates
        .map((c: number[]) => `${c[0]},${c[1]},${c[2] || 0}`)
        .join(' ');

      placemarksXml += `    <Placemark>
      <name>Trazo de Recorrido</name>
      <styleUrl>#busLineStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordsStr}</coordinates>
      </LineString>
    </Placemark>\n`;
    } else if (feat.geometry?.type === 'Point') {
      const [lon, lat, ele] = feat.geometry.coordinates;
      const type = feat.properties?.type || 'punto';
      const name = feat.properties?.name || (type === 'stop' ? `Parada ${feat.properties?.sequence || ''}` : 'Incidencia');
      const desc = feat.properties?.description || feat.properties?.incidentType || '';

      placemarksXml += `    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}</description>
      <styleUrl>${type === 'stop' ? '#stopStyle' : '#incidentStyle'}</styleUrl>
      <Point>
        <coordinates>${lon},${lat},${ele || 0}</coordinates>
      </Point>
    </Placemark>\n`;
    }
  }

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(title)}</name>
    <description>Relevamiento GPS Lanús Digital — Distancia: ${(trip.distanciaMeters / 1000).toFixed(1)} km</description>
    <Style id="busLineStyle">
      <LineStyle>
        <color>ffeb6325</color>
        <width>5</width>
      </LineStyle>
    </Style>
    <Style id="stopStyle">
      <IconStyle>
        <color>ff10b981</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="incidentStyle">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href>
        </Icon>
      </IconStyle>
    </Style>
${placemarksXml}  </Document>
</kml>`;

  const filename = generateFilename(trip, 'kml');
  triggerDownload(kmlContent, filename, 'application/vnd.google-earth.kml+xml');
}

/**
 * Descarga masiva de todos los relevamientos en un solo archivo GeoJSON
 */
export function downloadAllRelevamientosGeoJson(trips: any[]) {
  if (!trips || trips.length === 0) {
    throw new Error('No hay relevamientos para exportar');
  }

  const allFeatures: any[] = [];

  for (const trip of trips) {
    const geo = parseTripGeo(trip);
    if (geo && Array.isArray(geo.features)) {
      for (const feat of geo.features) {
        allFeatures.push({
          ...feat,
          properties: {
            ...feat.properties,
            tripId: trip.id,
            lineaNumero: trip.lineaNumero,
            ramal: trip.ramal,
            sentido: trip.sentido,
            interno: trip.interno,
            patente: trip.patente,
            chofer: trip.chofer,
            fecha: trip.creadoEn,
          },
        });
      }
    }
  }

  const bundle = {
    type: 'FeatureCollection',
    metadata: {
      totalTrips: trips.length,
      exportDate: new Date().toISOString(),
      origen: 'Lanús Digital GIS — Exportación Completa de Bitácora GPS',
    },
    features: allFeatures,
  };

  const filename = `lanus_bitacora_gps_todos_${new Date().toISOString().slice(0, 10)}.geojson`;
  triggerDownload(JSON.stringify(bundle, null, 2), filename, 'application/geo+json');
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
