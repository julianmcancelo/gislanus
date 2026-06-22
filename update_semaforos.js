const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Find or create group "Tránsito"
  let grupoTransito = await prisma.grupo.findUnique({ where: { nombre: 'Tránsito' } });
  if (!grupoTransito) {
    grupoTransito = await prisma.grupo.create({
      data: { nombre: 'Tránsito', color: '#F59E0B' } // Orange color for traffic
    });
  }

  // 2. Find or create subgroup "Semáforos"
  let subGrupoSemaforos = await prisma.subGrupo.findFirst({
    where: { nombre: 'Semáforos', grupoId: grupoTransito.id }
  });
  if (!subGrupoSemaforos) {
    subGrupoSemaforos = await prisma.subGrupo.create({
      data: { nombre: 'Semáforos', color: '#10B981', grupoId: grupoTransito.id }
    });
  }

  // 3. Find old group "Semaforos"
  const oldGrupo = await prisma.grupo.findUnique({ where: { nombre: 'Semaforos' }, include: { capas: true } });
  
  if (oldGrupo) {
    // 4. Update layers
    for (const capa of oldGrupo.capas) {
      let newName = capa.nombre;
      if (newName.includes('Autotrol')) newName = 'Autotrol';
      else if (newName.includes('2023')) newName = '2023';
      else if (newName.includes('Periferico')) newName = 'Periférico';
      else if (newName.includes('Municipal')) newName = 'Municipal';

      await prisma.capa.update({
        where: { id: capa.id },
        data: {
          nombre: newName,
          grupoId: grupoTransito.id,
          subGrupoId: subGrupoSemaforos.id
        }
      });
      console.log(`Updated layer: ${capa.nombre} -> ${newName}`);
    }

    // 5. Clean up old group
    await prisma.grupo.delete({ where: { id: oldGrupo.id } });
    console.log('Old group "Semaforos" deleted.');
  } else {
    console.log('Old group "Semaforos" not found. Might have been updated already.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
