const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const points = await prisma.point.groupBy({
    by: ['category', 'subCategory'],
    _count: true,
  });
  console.log(JSON.stringify(points, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
