// Import OSM bus lines into LineaTransporte table
// Usage: node scripts/import-lineas-osm.js [path-to-geojson]
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const COLOR_MAP = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#eab308', orange: '#f97316', purple: '#a855f7',
  black: '#1f2937', white: '#9ca3af', brown: '#92400e',
  pink: '#ec4899', cyan: '#06b6d4', grey: '#6b7280', gray: '#6b7280',
};

function resolveColor(raw) {
  if (!raw) return '#3b82f6';
  if (raw.startsWith('#')) return raw;
  return COLOR_MAP[raw.toLowerCase()] || '#3b82f6';
}

async function main() {
  const filePath = process.argv[2] || 'C:/Users/jcanc/Downloads/lanus-colectivos.geojson';
  console.log(`Reading: ${filePath}`);
  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const features = geojson.features || [];
  console.log(`Found ${features.length} features`);

  let created = 0, skipped = 0, errors = 0;

  for (const feature of features) {
    const props = feature.properties || {};
    const nombre = props.name || props.ref || 'Línea sin nombre';
    const numero = props.ref || null;
    const color = resolveColor(props.colour);
    const descripcion = [props.operator, props.from && props.to ? `${props.from} → ${props.to}` : null]
      .filter(Boolean).join(' · ') || null;

    // Skip features with no geometry
    if (!feature.geometry) { skipped++; continue; }

    const datosGeo = JSON.stringify(feature);

    try {
      await prisma.lineaTransporte.create({
        data: { nombre, numero, color, descripcion, datosGeo, activo: true },
      });
      created++;
      if (created % 50 === 0) console.log(`  ${created} importadas...`);
    } catch (e) {
      console.error(`  Error en "${nombre}":`, e.message);
      errors++;
    }
  }

  console.log(`\nDone: ${created} creadas, ${skipped} sin geometría, ${errors} errores`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
