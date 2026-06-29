import { PrismaClient } from '@prisma/client';
import { clipGeometryToLanus } from '../src/utils/geo';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all lineas de transporte...');
  const lineas = await prisma.lineaTransporte.findMany();
  
  console.log(`Found ${lineas.length} lineas.`);
  
  let updatedCount = 0;
  for (const linea of lineas) {
    try {
      let parsedGeo;
      if (typeof linea.datosGeo === 'string') {
        parsedGeo = JSON.parse(linea.datosGeo);
      } else {
        parsedGeo = linea.datosGeo;
      }

      if (!parsedGeo) continue;

      let clippedGeo = null;
      if (parsedGeo.type === 'FeatureCollection') {
        parsedGeo.features = parsedGeo.features.map((f: any) => ({
          ...f,
          geometry: clipGeometryToLanus(f.geometry)
        }));
        clippedGeo = parsedGeo;
      } else if (parsedGeo.type === 'Feature') {
        parsedGeo.geometry = clipGeometryToLanus(parsedGeo.geometry);
        clippedGeo = parsedGeo;
      } else if (parsedGeo.type === 'LineString' || parsedGeo.type === 'MultiLineString') {
        clippedGeo = clipGeometryToLanus(parsedGeo);
      } else {
        continue; // Unsupported
      }

      if (clippedGeo) {
        await prisma.lineaTransporte.update({
          where: { id: linea.id },
          data: {
            datosGeo: typeof linea.datosGeo === 'string' ? JSON.stringify(clippedGeo) : clippedGeo
          }
        });
        updatedCount++;
        console.log(`Updated linea: ${linea.nombre}`);
      }
    } catch (e) {
      console.error(`Error processing linea ${linea.nombre}:`, e);
    }
  }

  console.log(`Finished updating ${updatedCount} lineas.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
