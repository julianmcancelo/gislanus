// Script universal de importación de GeoJSON de Líneas de Colectivo a PostgreSQL (LineaTransporte)
// Uso: npx ts-node scripts/import_geojson_lineas.ts [ruta-al-archivo.geojson]
// Ejemplo: npx ts-node scripts/import_geojson_lineas.ts public/lineas_nacionales.geojson

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Paleta de colores distintivos para líneas
const LINE_COLORS: Record<string, string> = {
  '9': '#0284c7',   // Celeste azulado
  '15': '#e11d48',  // Rojo carmesí
  '20': '#16a34a',  // Verde
  '32': '#d97706',  // Ámbar / Naranja
  '45': '#9333ea',  // Violeta
  '75': '#0d9488',  // Turquesa / Teal
  '119': '#ea580c', // Naranja fuerte
  '158': '#4f46e5', // Índigo
  '160': '#059669', // Esmeralda
  '164': '#be123c', // Rosa oscuro
  '177': '#ca8a04', // Mostaza
  '179': '#2563eb', // Azul
  '188': '#7c3aed', // Púrpura
  '247': '#0891b2', // Cian
  '271': '#dc2626', // Rojo
  '283': '#475569', // Gris pizarra
  '354': '#15803d', // Verde oscuro
  '520': '#b45309', // Bronce
};

function parseLineMetadata(props: any, featureId?: any) {
  const rawName = props.name || props.nombre || props.description || props.DESCRIPCIO || props.linea || '';
  const rawRef = props.ref || props.numero || props.LINEA || '';
  
  // Extraer número de línea (ej: "LINEA 009 - R A - S IDA" -> "9")
  let numero = '';
  const matchNum = (rawName + ' ' + rawRef).match(/(?:LINEA|Línea|Linea)?\s*0*([0-9]{1,4})/i);
  if (matchNum && matchNum[1]) {
    numero = matchNum[1];
  }

  // Extraer ramal / subcategoría (ej: "R A" -> "Ramal A", "Ramal 1", etc.)
  let subcategoria = props.subcategoria || props.ramal || props.RAMAL || '';
  if (!subcategoria) {
    const matchRamal = rawName.match(/[-–]\s*(?:R|Ramal)\s*([A-Z0-9]+)/i);
    if (matchRamal && matchRamal[1]) {
      subcategoria = `Ramal ${matchRamal[1]}`;
    }
  }

  // Extraer sentido (IDA vs VUELTA)
  let sentido: 'IDA' | 'VUELTA' | null = null;
  const combinedText = `${rawName} ${props.sentido || ''} ${props.SENTIDO || ''} ${props.direction || ''}`.toUpperCase();
  if (combinedText.includes('VUELTA') || combinedText.includes('REGRESO') || combinedText.includes('INBOUND')) {
    sentido = 'VUELTA';
  } else if (combinedText.includes('IDA') || combinedText.includes('OUTBOUND')) {
    sentido = 'IDA';
  }

  // Categoría según número (1-199 Nacional, 200-499 Provincial, 500+ Municipal)
  let categoria: 'NACIONAL' | 'PROVINCIAL' | 'MUNICIPAL' = 'NACIONAL';
  const numInt = parseInt(numero, 10);
  if (!isNaN(numInt)) {
    if (numInt >= 500) categoria = 'MUNICIPAL';
    else if (numInt >= 200) categoria = 'PROVINCIAL';
    else categoria = 'NACIONAL';
  }

  // Nombre formateado limpio
  let nombre = props.nombre || props.name;
  if (!nombre) {
    if (numero) {
      nombre = `Línea ${numero}${subcategoria ? ` - ${subcategoria}` : ''}${sentido ? ` (${sentido})` : ''}`;
    } else {
      nombre = `Línea ${featureId || 'S/N'}`;
    }
  }

  // Color
  const color = props.color || props.colour || (numero ? LINE_COLORS[numero] : null) || '#2563eb';

  // Descripción
  const descripcion = props.descripcion || props.description || props.operator || props.EMPRESA || null;

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
  const filePath = process.argv[2] || path.join(__dirname, '..', 'public', 'lineas_nacionales.geojson');

  console.log(`\n======================================================`);
  console.log(`🚌 IMPORTADOR INTELIGENTE DE LÍNEAS DE TRANSPORTE GIS`);
  console.log(`======================================================\n`);
  console.log(`📂 Leyendo archivo: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`\n❌ Error: El archivo no existe en la ruta: ${filePath}`);
    console.log(`\n💡 Instrucciones:`);
    console.log(`   1. Guardá tu archivo GeoJSON en la carpeta 'public/' (ej: public/lineas_nacionales.geojson)`);
    console.log(`   2. O ejecutá: npx ts-node scripts/import_geojson_lineas.ts "C:/ruta/a/tu/archivo.geojson"\n`);
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
  console.log(`📊 Se encontraron ${features.length} features para procesar.\n`);

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

    // Guardar el GeoJSON completo del feature
    const datosGeo = JSON.stringify(f);

    try {
      // Si el feature tiene un ID único numérico o string
      const customId = f.id ? `linea-feat-${f.id}` : undefined;

      if (customId) {
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
      } else {
        await prisma.lineaTransporte.create({
          data: {
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
        creadas++;
      }

      if ((i + 1) % 25 === 0 || i === features.length - 1) {
        console.log(`  Procesadas ${i + 1}/${features.length} trazas...`);
      }
    } catch (err: any) {
      console.error(`  ⚠️ Error en feature #${i + 1} (${meta.nombre}):`, err.message);
    }
  }

  const total = await prisma.lineaTransporte.count();
  console.log(`\n✅ Proceso finalizado con éxito!`);
  console.log(`   - Creadas/Actualizadas: ${creadas + actualizadas}`);
  console.log(`   - Omitidas (sin geometría): ${omitidas}`);
  console.log(`   - Total de líneas en la Base de Datos: ${total}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
