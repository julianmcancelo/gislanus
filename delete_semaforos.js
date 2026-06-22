const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.capa.deleteMany({
    where: {
      nombre: 'Semáforos'
    }
  });
  console.log('Borradas:', deleted.count);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
