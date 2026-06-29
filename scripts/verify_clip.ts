import { PrismaClient } from '@prisma/client';
import * as turf from '@turf/turf';
import { getLanusPolygon } from '../src/utils/geo';

const prisma = new PrismaClient();

async function main() {
  const linea = await prisma.lineaTransporte.findFirst({ where: { nombre: 'Línea 33' } });
  if (!linea) return;
  const geo = typeof linea.datosGeo === 'string' ? JSON.parse(linea.datosGeo) : linea.datosGeo;
  
  const lanusPoly = getLanusPolygon();
  
  let lineFeature = turf.feature(geo);
  let intersection = turf.intersect(turf.featureCollection([lineFeature, lanusPoly]));
  
  console.log(intersection?.geometry.type);
}
main().finally(()=>prisma.$disconnect());
