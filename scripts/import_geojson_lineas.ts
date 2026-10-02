// Script universal de importación de GeoJSON de Líneas de Colectivo a PostgreSQL (LineaTransporte)
// Uso: npx tsx scripts/import_geojson_lineas.ts [ruta-al-archivo.geojson]
// Ejemplo: npx tsx scripts/import_geojson_lineas.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Paleta de colores distintivos por número de línea
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

function parseLineMetadata(props: any, featureId?: any) {
  const desc = props.description || '';
  const title = props.title || props.name || props.nombre || '';

  // 1. Extraer campos estructurados de la descripción si existen
  let rawLinea = '';
  let rawRecorrido = '';
  let rawSentido = '';
  let rawRazon = '';
  let rawJurisdiccion = '';

  const lines = desc.split('\n');
  for (const line of lines) {
    const matchL = line.match(/^Linea:\s*(.+)$/i);
    if (matchL) rawLinea = matchL[1].trim();

    const matchR = line.match(/^Recorrido:\s*(.+)$/i);
    if (matchR) rawRecorrido = matchR[1].trim();

    const matchS = line.match(/^Sentido:\s*(.+)$/i);
    if (matchS) rawSentido = matchS[1].trim();

    const matchZ = line.match(/^Razon_soci:\s*(.+)$/i);
    if (matchZ) rawRazon = matchZ[1].trim();

    const matchJ = line.match(/^Jurisdicci:\s*(.+)$/i);
    if (matchJ) rawJurisdiccion = matchJ[1].trim();
  }

  // 2. Número de línea normalizado (ej: "009" -> "9")
  let numero = rawLinea ? rawLinea.replace(/^0+/, '') : '';
  if (!numero) {
    const matchNum = (title + ' ' + (props.ref || '')).match(/(?:LINEA|Línea|Linea)?\s*0*([0-9]{1,4})/i);
    if (matchNum && matchNum[1]) {
      numero = matchNum[1];
    }
  }

  // 3. Ramal / Recorrido / Subcategoría
  let subcategoria = '';
  if (rawRecorrido) {
    subcategoria = rawRecorrido.toUpperCase().startsWith('RAMAL') ? rawRecorrido : `Ramal ${rawRecorrido}`;
  } else {
    const matchRamal = title.match(/[-–]\s*(?:R|Ramal)\s*([A-Z0-9]+)/i);
    if (matchRamal && matchRamal[1]) {
      subcategoria = `Ramal ${matchRamal[1]}`;
    }
  }

  // 4. Sentido (IDA vs VUELTA)
  let sentido: 'IDA' | 'VUELTA' | null = null;
  const combinedSentido = `${rawSentido} ${title} ${props.sentido || ''} ${props.direction || ''}`.toUpperCase();
  if (combinedSentido.includes('VUELTA') || combinedSentido.includes('VUEKTA') || combinedSentido.includes('REGRESO') || combinedSentido.includes('INBOUND')) {
    sentido = 'VUELTA';
  } else if (combinedSentido.includes('IDA') || combinedSentido.includes('OUTBOUND')) {
    sentido = 'IDA';
  }

  // 5. Jurisdicción / Categoría
  let categoria: 'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL' = 'NACIONAL';
  if (rawJurisdiccion) {
    const jUpper = rawJurisdiccion.toUpperCase();
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

  // 6. Nombre amigable
  let nombre = '';
  if (numero) {
    const parts = [`Línea ${numero}`];
    if (subcategoria) parts.push(subcategoria);
    if (sentido) parts.push(`(${sentido})`);
    nombre = parts.join(' - ');
  } else if (title) {
    nombre = title.replace(/[-–\s]+$/, '');
  } else {
    nombre = `Línea ${featureId || 'S/N'}`;
  }

  // 7. Color
  const color = props.stroke || props.color || props.colour || (numero ? DEFAULT_COLORS[numero] : null) || '#2563eb';

  // 8. Descripción / Operador
  const descParts = [];
  if (rawRazon) descParts.push(`Operador: ${rawRazon}`);
  if (props.description && !rawRazon) descParts.push(props.description);
  const descripcion = descParts.length > 0 ? descParts.join(' · ') : null;

  return {
    nombre,
    numero: numero || null,
    subcategoria: subcategoria || null,
    sentido,
    categoria,
    color,
    descripcion,
  };
}

async function main() {
  const defaultPath = path.join(__dirname, '..', 'public', 'MovilidadyTransporteLanus-recorridos-lineas-de-transporte-lanus.geojson');
  const filePath = process.argv[2] || (fs.existsSync(defaultPath) ? defaultPath : path.join(__dirname, '..', 'public', 'lineas_nacionales.geojson'));

  console.log(`\n======================================================`);
  console.log(`🚌 IMPORTADOR INTELIGENTE DE LÍNEAS DE TRANSPORTE GIS`);
  console.log(`======================================================\n`);
  console.log(`📂 Leyendo archivo: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: El archivo no existe en la ruta: ${filePath}`);
    console.log(`\n💡 Instrucciones:`);
    console.log(`   1. Verificá que el archivo esté en 'public/MovilidadyTransporteLanus-recorridos-lineas-de-transporte-lanus.geojson'`);
    console.log(`   2. O ejecutá: npx tsx scripts/import_geojson_lineas.ts "C:/ruta/a/tu/archivo.geojson"\n`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');
  let geojson: any;
  try {
    geojson = JSON.parse(rawContent);
  } catch (err: any) {
    console.error(`❌ Error al parsear JSON:`, err.message);
    process.exit(1);
  }

  const features = geojson.type === 'FeatureCollection' ? geojson.features : (geojson.type === 'Feature' ? [geojson] : []);
  console.log(`📊 Se encontraron ${features.length} trazas / recorridos en el archivo.\n`);

  let creadas = 0;
  let actualizadas = 0;
  let omitidas = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (!f.geometry || !f.geometry.coordinates || f.geometry.coordinates.length === 0) {
      omitidas++;
      continue;
    }

    const meta = parseLineMetadata(f.properties || {}, f.id || i + 1);

    // Guardar el Feature completo como datosGeo
    const datosGeo = JSON.stringify(f);

    try {
      const customId = f.id ? `linea-feat-${f.id}` : `linea-auto-${i + 1}`;

      await prisma.lineaTransporte.upsert({
        where: { id: customId },
        update: {
          nombre: meta.nombre,
          numero: meta.numero,
          subcategoria: meta.subcategoria,
          sentido: meta.sentido,
          categoria: meta.categoria,
          color: meta.color,
          descripcion: meta.descripcion,
          datosGeo,
          activo: true,
        },
        create: {
          id: customId,
          nombre: meta.nombre,
          numero: meta.numero,
          subcategoria: meta.subcategoria,
          sentido: meta.sentido,
          categoria: meta.categoria,
          color: meta.color,
          descripcion: meta.descripcion,
          datosGeo,
          activo: true,
        },
      });
      actualizadas++;

      if ((i + 1) % 50 === 0 || i === features.length - 1) {
        console.log(`  ✓ Procesadas ${i + 1}/${features.length} trazas...`);
      }
    } catch (err: any) {
      console.error(`  ⚠️ Error en feature #${i + 1} (${meta.nombre}):`, err.message);
    }
  }

  const total = await prisma.lineaTransporte.count();
  console.log(`\n======================================================`);
  console.log(`🎉 ÉXITO: Importación completada correctamente!`);
  console.log(`   - Trazas importadas/actualizadas: ${actualizadas}`);
  console.log(`   - Trazas omitidas (sin geometría): ${omitidas}`);
  console.log(`   - Total de líneas en la Base de Datos: ${total}`);
  console.log(`======================================================\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
