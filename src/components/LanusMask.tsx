import React, { useEffect, useState } from 'react';
import { Polygon } from 'react-leaflet';

const OUTER_WORLD: [number, number][] = [
  [90, -180],
  [90, 180],
  [-90, 180],
  [-90, -180]
];

export default function LanusMask() {
  const [hole, setHole] = useState<[number, number][] | null>(null);

  useEffect(() => {
    fetch('/lanus-base.geojson')
      .then(res => res.json())
      .then(data => {
        // Find the full municipality polygon (not the point)
        const polyFeature = data.features.find((f: any) => 
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
        );

        if (polyFeature) {
          let coords = [];
          if (polyFeature.geometry.type === 'Polygon') {
            coords = polyFeature.geometry.coordinates[0];
          } else {
            // Pick largest polygon in MultiPolygon
            const largest = polyFeature.geometry.coordinates.reduce((prev: any, current: any) => {
              return (prev[0].length > current[0].length) ? prev : current;
            });
            coords = largest[0];
          }

          // GeoJSON is [lng, lat], Leaflet Polygon expects [lat, lng]
          const leafletCoords = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setHole(leafletCoords);
        }
      })
      .catch(err => console.error("Error loading Lanus mask:", err));
  }, []);

  if (!hole) return null;

  return (
    <Polygon 
      positions={[OUTER_WORLD, hole]} 
      pathOptions={{
        color: 'transparent', // Sin borde
        fillColor: '#ffffff', // Color blanco (o cambiar a gris/negro según gusto)
        fillOpacity: 1.0,     // Totalmente opaco para no ver nada afuera
      }}
      interactive={false} // No bloquear los clics
    />
  );
}
