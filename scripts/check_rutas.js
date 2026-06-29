const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rutas = await prisma.rutaTransporte.findMany({take: 1});
  console.log(JSON.stringify(rutas, null, 2));
}
main().finally(() => prisma.$disconnect());
