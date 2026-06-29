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
      lines.push(geometry.coordinates);
    } else if (geometry.type === 'MultiLineString') {
      lines = geometry.coordinates;
    } else {
      return geometry;
    }

    const clippedLines: number[][][] = [];

    for (const coords of lines) {
      let currentLine: number[][] = [];
      
      for (const pt of coords) {
        const isInside = turf.booleanPointInPolygon(turf.point(pt), lanus);
        if (isInside) {
          currentLine.push(pt);
        } else {
          if (currentLine.length > 1) {
            clippedLines.push([...currentLine]);
          }
          currentLine = []; // Start a new line segment
        }
      }
      
      if (currentLine.length > 1) {
        clippedLines.push([...currentLine]);
      }
    }

    if (clippedLines.length === 0) {
      // Retornar un punto en blanco si no quedó nada (evitar devolver la original entera)
      return null;
    }

    if (clippedLines.length === 1) {
      return { type: 'LineString', coordinates: clippedLines[0] };
    } else {
      return { type: 'MultiLineString', coordinates: clippedLines };
    }
  } catch (e) {
    console.error('Error clipping geometry:', e);
    return geometry;
  }
}
