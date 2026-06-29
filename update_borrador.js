const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateBorradores() {
  const result = await prisma.rutaTransporte.updateMany({
    where: { estado: 'BORRADOR' },
    data: { estado: 'PENDIENTE' }
  });
  console.log(`Updated ${result.count} routes from BORRADOR to PENDIENTE`);
}

updateBorradores().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
