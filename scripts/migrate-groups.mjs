import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration...');
  const capas = await prisma.capa.findMany();
  console.log(`Found ${capas.length} capas.`);

  for (const capa of capas) {
    if (capa.nombre.includes(' - ')) {
      const parts = capa.nombre.split(' - ');
      const groupName = parts[0].trim();
      const newLayerName = parts.slice(1).join(' - ').trim();

      // Find or create group
      let grupo = await prisma.grupo.findUnique({ where: { nombre: groupName } });
      if (!grupo) {
        grupo = await prisma.grupo.create({
          data: {
            nombre: groupName,
            color: capa.color // inherit color from the first layer
          }
        });
        console.log(`Created group: ${groupName}`);
      }

      // Update layer
      await prisma.capa.update({
        where: { id: capa.id },
        data: {
          nombre: newLayerName,
          grupoId: grupo.id
        }
      });
      console.log(`Updated layer ${capa.id} -> name: ${newLayerName}, group: ${groupName}`);
    } else {
      console.log(`Layer ${capa.id} has no group prefix. Leaving as is.`);
    }
  }

  console.log('Migration finished.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
