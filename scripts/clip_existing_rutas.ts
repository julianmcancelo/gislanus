import { PrismaClient } from '@prisma/client';
import { clipGeometryToLanus } from '../src/utils/geo';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all rutas de transporte pesado...');
  const rutas = await prisma.rutaTransporte.findMany();
  
  console.log(`Found ${rutas.length} rutas.`);
  
  let updatedCount = 0;
  for (const ruta of rutas) {
    try {
      let parsedGeo;
      if (typeof ruta.datosGeo === 'string') {
        parsedGeo = JSON.parse(ruta.datosGeo);
      } else {
        parsedGeo = ruta.datosGeo;
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
        await prisma.rutaTransporte.update({
          where: { id: ruta.id },
          data: {
            datosGeo: typeof ruta.datosGeo === 'string' ? JSON.stringify(clippedGeo) : clippedGeo
          }
        });
        updatedCount++;
        console.log(`Updated ruta: ${ruta.numeroSolicitud}`);
      }
    } catch (e) {
      console.error(`Error processing ruta ${ruta.numeroSolicitud}:`, e);
    }
  }

  console.log(`Finished updating ${updatedCount} rutas pesadas.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
