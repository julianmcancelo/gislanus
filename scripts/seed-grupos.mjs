import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const gruposToCreate = [
    { nombre: 'Transporte Escolar', color: '#FFB300' }, // Amber/Yellow
    { nombre: 'Colegios', color: '#1E88E5' }, // Blue
    { nombre: 'Semáforos', color: '#E53935' } // Red
  ];

  for (const g of gruposToCreate) {
    const existing = await prisma.grupo.findUnique({ where: { nombre: g.nombre } });
    if (!existing) {
      await prisma.grupo.create({ data: g });
      console.log(`Created group: ${g.nombre}`);
    } else {
      console.log(`Group already exists: ${g.nombre}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
