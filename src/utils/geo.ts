import * as turf from '@turf/turf';
import fs from 'fs';
import path from 'path';

let lanusPolygon: any = null;

export function getLanusPolygon() {
  if (lanusPolygon) return lanusPolygon;
  try {
    const filePath = path.join(process.cwd(), 'public', 'lanus-base.geojson');
    const geojson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    lanusPolygon = geojson.features.find((f: any) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
  } catch (e) {
    console.error('Error loading lanus-base.geojson:', e);
  }
  return lanusPolygon;
}

export function clipGeometryToLanus(geometry: any): any {
  const lanus = getLanusPolygon();
  if (!lanus) return geometry;

  try {
    let lines = [];
    if (geometry.type === 'LineString') {
      lines.push(geometry);
    } else if (geometry.type === 'MultiLineString') {
      lines = geometry.coordinates.map((c: any) => turf.lineString(c));
    } else {
      return geometry; // No soportado, devolver sin modificar
    }

    const clippedSegments: any[] = [];
    const lanusBorder = turf.polygonToLine(lanus.geometry);

    for (const line of lines) {
      // 1. Check if completely inside
      const isCompletelyInside = turf.booleanWithin(line, lanus);
      if (isCompletelyInside) {
        clippedSegments.push(line.coordinates);
        continue;
      }
      
      // 2. Check if completely outside
      const intersects = turf.booleanIntersects(line, lanus);
      if (!intersects) {
        continue;
      }

      // 3. Split the line by the polygon border
      const split = turf.lineSplit(line, lanusBorder as any);
      
      if (split.features.length === 0) {
        // Line doesn't cross border but intersects (e.g. inside, or touched border)
        // Check midpoint to be sure
        const mid = turf.midpoint(turf.point(line.coordinates[0]), turf.point(line.coordinates[line.coordinates.length - 1]));
        if (turf.booleanPointInPolygon(mid, lanus)) {
          clippedSegments.push(line.coordinates);
        }
      } else {
        // Keep only segments that are inside
        for (const feature of split.features) {
          // turf.center can sometimes be outside a curving line, use along or midpoint
          const midPoint = turf.along(feature as any, turf.length(feature as any) / 2);
          if (turf.booleanPointInPolygon(midPoint, lanus)) {
            clippedSegments.push(feature.geometry.coordinates);
          }
        }
      }
    }

    if (clippedSegments.length === 0) {
      return geometry; // Opcional: si todo quedó fuera, devolvemos original o null. Dejamos original por seguridad.
    }

    if (clippedSegments.length === 1) {
      return { type: 'LineString', coordinates: clippedSegments[0] };
    } else {
      return { type: 'MultiLineString', coordinates: clippedSegments };
    }
  } catch (e) {
    console.error('Error clipping geometry:', e);
    return geometry; // Si falla, devolvemos el original
  }
}
