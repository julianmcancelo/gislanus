const fs = require('fs');
const turf = require('@turf/turf');

// Load Lanus polygon
const lanusBase = JSON.parse(fs.readFileSync('public/lanus-base.geojson', 'utf8'));
const lanusPoly = lanusBase.features.find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');

// Create a dummy route that goes in and out of Lanus
const route = turf.lineString([
  [-58.39, -34.70], // Inside
  [-58.38, -34.68], // Out?
  [-58.37, -34.67]  // Out
]);

try {
  const clipped = turf.bboxClip(route, turf.bbox(lanusPoly));
  console.log("BBox Clip:", clipped.geometry.coordinates);
  
  // To strictly clip by polygon (lineIntersect and then pointInPolygon?)
  // Actually, @turf/line-split can split a line by a polygon, but it expects a LineString and a LineString/Polygon.
  const split = turf.lineSplit(route, turf.polygonToLine(lanusPoly));
  console.log("Split features:", split.features.length);
  
  // Keep only segments whose midpoints are inside the polygon
  const kept = split.features.filter(f => {
    const mid = turf.center(f); // or turf.midpoint(f.geometry.coordinates[0], f.geometry.coordinates[1])
    return turf.booleanPointInPolygon(mid, lanusPoly);
  });
  console.log("Kept segments:", kept.length);
} catch(e) {
  console.error(e);
}
