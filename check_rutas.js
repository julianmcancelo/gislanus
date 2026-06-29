const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const rutas = await prisma.rutaTransporte.findMany();
  console.log('Total rutas:', rutas.length);
  
  const byStatus = rutas.reduce((acc, ruta) => {
    acc[ruta.estado] = (acc[ruta.estado] || 0) + 1;
    return acc;
  }, {});
  console.log('Status count:', byStatus);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
