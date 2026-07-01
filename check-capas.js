const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const capas = await prisma.capa.findMany({
    select: { id: true, nombre: true, tipo: true, visibilidad: true }
  });
  console.log(capas);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
