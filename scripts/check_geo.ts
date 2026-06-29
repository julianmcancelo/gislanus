import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lines = await prisma.lineaTransporte.findMany({ 
    select: { nombre: true, categoria: true, datosGeo: true }
  });
  console.log(lines.map(l => ({
    nombre: l.nombre, 
    cat: l.categoria, 
    geoLength: JSON.stringify(l.datosGeo).length
  })));
}

main().finally(()=>prisma.$disconnect());
