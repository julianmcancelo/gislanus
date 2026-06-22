const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const g = await prisma.grupo.findFirst({
    where: { nombre: 'Semaforos' },
    include: { subGrupos: true, capas: true }
  });
  console.log(JSON.stringify({
    grupo: g.nombre,
    subGrupos: g.subGrupos,
    capas: g.capas.map(c => ({ nombre: c.nombre, tipo: c.tipo, subGrupoId: c.subGrupoId }))
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
