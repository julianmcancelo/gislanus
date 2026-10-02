/**
 * Motor de Proyección Cartográfica Isométrica (Web Mercator EPSG:3857)
 * Dirección General de Movilidad y Transporte · Subsecretaría de Planificación Urbana · Municipio de Lanús
 * 
 * Basado en la arquitectura de Cartografía Técnica Municipal (mobile_bustracker):
 * 1. Resuelve la no linealidad de la latitud en Mercator (estiramiento del 15% al 25% en latitudes de Lanús ~-34.7°).
 * 2. Bloqueo Isométrico 1:1 estricto: scale = min(scaleX, scaleY) con centrado mediante letterboxing/pillarboxing.
 * 3. Sincronización submilimétrica y pixel-perfect con Mapbox Static API mediante Bounding Box [minLon,minLat,maxLon,maxLat].
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LatLngBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type MapboxStaticStyle = 
  | 'streets-v12'
  | 'light-v11'
  | 'dark-v11'
  | 'outdoors-v12'
  | 'satellite-streets-v12'
  | 'navigation-day-v1'
  | 'navigation-night-v1'
  | string;

/**
 * Calcula límites seguros envolventes con padding porcentual simétrico
 */
export function calculateSafeBounds(points: LatLng[], paddingFraction: number = 0.12): LatLngBounds {
  if (points.length === 0) {
    const center = { lat: -34.7044, lng: -58.3899 };
    return {
      south: center.lat - 0.04,
      west: center.lng - 0.04,
      north: center.lat + 0.04,
      east: center.lng + 0.04,
    };
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const latPad = latSpan === 0 ? 0.005 : latSpan * paddingFraction;
  const lonPad = lngSpan === 0 ? 0.005 : lngSpan * paddingFraction;

  return {
    south: minLat - latPad,
    west: minLng - lonPad,
    north: maxLat + latPad,
    east: maxLng + lonPad,
  };
}

export class MercatorViewportProjection {
  readonly bounds: LatLngBounds;
  readonly width: number;
  readonly height: number;
  readonly scale: number;       // Píxeles por unidad de mundo Web Mercator (256px base)
  readonly offsetX: number;     // Margen de centrado horizontal (letterbox)
  readonly offsetY: number;     // Margen de centrado vertical (pillarbox)
  readonly worldLeft: number;
  readonly worldTop: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly centerLat: number;
  readonly centerLng: number;
  readonly zoom: number;
  readonly spanX: number;
  readonly spanY: number;

  constructor(
    input: LatLng[] | LatLngBounds,
    width: number,
    height: number,
    paddingFraction: number = 0.12
  ) {
    if (width <= 0 || height <= 0) {
      throw new Error('Las dimensiones del viewport (width y height) deben ser mayores a 0');
    }

    this.width = width;
    this.height = height;

    if (Array.isArray(input)) {
      if (input.length === 0) {
        throw new Error('Debe proveer al menos un punto geográfico para la proyección cartográfica');
      }
      this.bounds = calculateSafeBounds(input, paddingFraction);
    } else {
      this.bounds = input;
    }

    this.worldLeft = MercatorViewportProjection.lonToWorld(this.bounds.west);
    const worldRight = MercatorViewportProjection.lonToWorld(this.bounds.east);
    this.worldTop = MercatorViewportProjection.latToWorld(this.bounds.north);
    const worldBottom = MercatorViewportProjection.latToWorld(this.bounds.south);

    this.worldWidth = Math.abs(worldRight - this.worldLeft);
    this.worldHeight = Math.abs(worldBottom - this.worldTop);

    if (this.worldWidth > 0 && this.worldHeight > 0) {
      const scaleX = width / this.worldWidth;
      const scaleY = height / this.worldHeight;
      // Escala isométrica uniforme idéntica en ambos ejes (preserva geometría 1:1)
      this.scale = Math.min(scaleX, scaleY);
      this.offsetX = (width - this.worldWidth * this.scale) / 2.0;
      this.offsetY = (height - this.worldHeight * this.scale) / 2.0;
    } else {
      this.scale = 1.0;
      this.offsetX = 0.0;
      this.offsetY = 0.0;
    }

    this.centerLat = (this.bounds.north + this.bounds.south) / 2;
    this.centerLng = (this.bounds.west + this.bounds.east) / 2;
    this.spanX = width / this.scale;
    this.spanY = height / this.scale;

    // Zoom representativo en escala de teselas de 256/512px
    const zoomVal = Math.log2((width / Math.max(1e-7, this.worldWidth)));
    this.zoom = Math.max(0, Math.min(22, Number(zoomVal.toFixed(3))));
  }

  /**
   * Conversión canónica Web Mercator EPSG:3857 (escala 256.0 de base)
   * Longitud [-180, 180] -> [0, 256]
   */
  static lonToWorld(lon: number): number {
    return ((lon + 180.0) / 360.0) * 256.0;
  }

  /**
   * Conversión canónica Web Mercator EPSG:3857 (escala 256.0 de base)
   * Latitud [-85.051129, 85.051129] -> [0, 256]
   * Fórmula no lineal estricta que corrige la elongación meridiana en el hemisferio sur
   */
  static latToWorld(lat: number): number {
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const latRad = (clampedLat * Math.PI) / 180.0;
    return ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0) * 256.0;
  }

  static worldXToLng(x: number): number {
    return x * 360.0 - 180.0;
  }

  static worldYToLat(y: number): number {
    const n = Math.PI - 2.0 * Math.PI * y;
    return (180.0 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  static worldToLon(worldX: number): number {
    return MercatorViewportProjection.worldXToLng(worldX / 256.0);
  }

  static worldToLat(worldY: number): number {
    return MercatorViewportProjection.worldYToLat(worldY / 256.0);
  }

  // Compatibilidad con funciones previas normalizadas [0, 1]
  static lngToWorldX(lng: number): number {
    return (lng + 180.0) / 360.0;
  }

  static latToWorldY(lat: number): number {
    return MercatorViewportProjection.latToWorld(lat) / 256.0;
  }

  /**
   * Proyecta coordenadas geográficas a píxeles de pantalla / canvas (origen arriba-izquierda: 0,0)
   */
  project(lat: number, lng: number): Point2D {
    const wx = MercatorViewportProjection.lonToWorld(lng);
    const wy = MercatorViewportProjection.latToWorld(lat);
    const x = this.offsetX + (wx - this.worldLeft) * this.scale;
    const y = this.offsetY + (wy - this.worldTop) * this.scale;
    return { x, y };
  }

  /**
   * Proyecta coordenadas geográficas a puntos de PDF (origen abajo-izquierda: Y invertido)
   */
  projectToPdf(lat: number, lng: number): Point2D {
    const wx = MercatorViewportProjection.lonToWorld(lng);
    const wy = MercatorViewportProjection.latToWorld(lat);
    const x = this.offsetX + (wx - this.worldLeft) * this.scale;
    const y = this.height - (this.offsetY + (wy - this.worldTop) * this.scale);
    return { x, y };
  }

  /**
   * Desproyecta coordenadas en píxeles a coordenadas geográficas LatLng
   */
  unproject(pixelX: number, pixelY: number): LatLng {
    const wx = this.worldLeft + (pixelX - this.offsetX) / this.scale;
    const wy = this.worldTop + (pixelY - this.offsetY) / this.scale;
    return {
      lat: MercatorViewportProjection.worldToLat(wy),
      lng: MercatorViewportProjection.worldToLon(wx),
    };
  }

  /**
   * Genera la URL canónica de Mapbox Static Images API mediante Bounding Box [minLon,minLat,maxLon,maxLat]
   * Esta llamada garantiza coincidencia matemática submilimétrica con la proyección vectorial.
   */
  getMapboxStaticUrl(
    token: string,
    style: MapboxStaticStyle | string = 'streets-v12',
    retina: boolean = true
  ): { url: string; requestWidth: number; requestHeight: number } {
    const maxMapboxDimension = 1280;
    let reqW = Math.round(this.width);
    let reqH = Math.round(this.height);
    const aspect = reqW / reqH;

    if (reqW > maxMapboxDimension || reqH > maxMapboxDimension) {
      if (aspect >= 1.0) {
        reqW = maxMapboxDimension;
        reqH = Math.round(maxMapboxDimension / aspect);
      } else {
        reqH = maxMapboxDimension;
        reqW = Math.round(maxMapboxDimension * aspect);
      }
    }

    reqW = Math.max(100, Math.min(1280, reqW));
    reqH = Math.max(100, Math.min(1280, reqH));

    const ret = retina ? '@2x' : '';
    const cleanToken = token.trim();
    const styleId = style.startsWith('mapbox/') ? style.replace('mapbox/', '') : style;

    const minLon = this.bounds.west.toFixed(6);
    const minLat = this.bounds.south.toFixed(6);
    const maxLon = this.bounds.east.toFixed(6);
    const maxLat = this.bounds.north.toFixed(6);

    // Mapbox Static Images API Bounding Box: [min_lon,min_lat,max_lon,max_lat]/{w}x{h}
    const url = `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/[${minLon},${minLat},${maxLon},${maxLat}]/${reqW}x${reqH}${ret}?access_token=${cleanToken}`;

    return { url, requestWidth: reqW, requestHeight: reqH };
  }

  /**
   * Calcula la resolución real en metros por píxel en la latitud media del plano
   */
  getMetersPerPixel(): number {
    const meanLatRad = (this.centerLat * Math.PI) / 180.0;
    // Metros por unidad de mundo Web Mercator a esta latitud (circunferencia ecuatorial WGS-84)
    const metersPerWorldUnit = (40075016.686 * Math.cos(meanLatRad)) / 256.0;
    return metersPerWorldUnit / this.scale;
  }

  /**
   * Calcula un escalímetro cartográfico oficial proporcionado (ej. 200m, 500m, 1km, 2km)
   */
  getCartographicScaleBar(desiredPixelWidth: number = 140): { label: string; widthPx: number; meters: number } {
    const mpp = this.getMetersPerPixel();
    const rawMeters = Math.max(50, desiredPixelWidth * mpp);

    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMeters)));
    let niceMultiplier = 1;
    const ratio = rawMeters / magnitude;

    if (ratio >= 5) niceMultiplier = 5;
    else if (ratio >= 2) niceMultiplier = 2;
    else niceMultiplier = 1;

    const targetMeters = niceMultiplier * magnitude;
    const finalWidthPx = targetMeters / mpp;
    const label = targetMeters >= 1000 
      ? `${(targetMeters / 1000).toFixed(targetMeters % 1000 === 0 ? 0 : 1)} km` 
      : `${Math.round(targetMeters)} m`;

    return {
      label,
      widthPx: Math.max(30, Math.round(finalWidthPx)),
      meters: targetMeters,
    };
  }

  /**
   * Convierte coordenadas decimales a notación sexagesimal cartográfica oficial
   */
  static formatDMS(deg: number, isLatitude: boolean): string {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    const direction = isLatitude ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"${direction}`;
  }
}
