const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, '..', 'mobile_bustracker', 'assets', 'data', 'lanus_official_routes.json');
  console.log(`Leyendo rutas oficiales desde: ${jsonPath}`);
  
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Archivo no encontrado: ${jsonPath}`);
  }

  const routes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Procesando ${routes.length} rutas oficiales...`);

  let count = 0;
  for (const r of routes) {
    await prisma.lineaTransporte.upsert({
      where: { id: r.id },
      update: {
        nombre: r.nombre,
        numero: r.numero,
        color: r.color,
        descripcion: r.descripcion,
        categoria: r.categoria || 'NACIONAL',
        subcategoria: r.subcategoria,
        sentido: r.sentido,
        activo: r.activo ?? true,
        datosGeo: typeof r.datosGeo === 'string' ? r.datosGeo : JSON.stringify(r.datosGeo),
      },
      create: {
        id: r.id,
        nombre: r.nombre,
        numero: r.numero,
        color: r.color,
        descripcion: r.descripcion,
        categoria: r.categoria || 'NACIONAL',
        subcategoria: r.subcategoria,
        sentido: r.sentido,
        activo: r.activo ?? true,
        datosGeo: typeof r.datosGeo === 'string' ? r.datosGeo : JSON.stringify(r.datosGeo),
      },
    });
    count++;
    if (count % 50 === 0) {
      console.log(`  Sincronizadas ${count} / ${routes.length} rutas...`);
    }
  }

  const totalInDb = await prisma.lineaTransporte.count();
  console.log(`\n✅ Éxito: ${totalInDb} rutas de transporte cargadas en la base de datos PostgreSQL!`);
}

main()
  .catch((e) => {
    console.error('❌ Error sembrando rutas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
