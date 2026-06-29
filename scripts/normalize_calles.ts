import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando normalización de calles y colores para Transporte Pesado...");

  const rutas = await prisma.rutaTransporte.findMany();
  let updatedCount = 0;

  for (const ruta of rutas) {
    if (!ruta.datosGeo) continue;

    let geo: any;
    if (typeof ruta.datosGeo === 'string') {
      try { geo = JSON.parse(ruta.datosGeo); } catch (e) { continue; }
    } else {
      geo = ruta.datosGeo;
    }

    let changed = false;
    let newCalles: string[] = [];
    const oldCallesString = ruta.calles || "";

    const colors = ['#3b82f6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];

    if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
      geo.features = geo.features.map((feature: any, idx: number) => {
        let featureChanged = false;
        if (!feature.properties) feature.properties = {};
        
        if (!feature.properties.name) {
          feature.properties.name = `Recorrido ${idx + 1}`;
          featureChanged = true;
        }
        
        if (!feature.properties.color) {
          feature.properties.color = colors[idx % colors.length];
          featureChanged = true;
        }

        // Recuperar calles de las properties del feature o usar un fallback
        let streetStr = feature.properties.streets || "";
        if (!streetStr) {
           // Intentar recuperar de la cadena global
           const splits = oldCallesString.split(' | ').map(s => s.trim());
           if (splits[idx]) {
             streetStr = splits[idx];
           } else {
             // Fallback al viejo separador si existía
             const oldSplits = oldCallesString.split(' - ').map(s => s.trim());
             if (oldSplits.length > 1) {
               streetStr = oldCallesString;
             }
           }
           if (streetStr) {
             feature.properties.streets = streetStr;
             featureChanged = true;
           }
        }
        newCalles.push(streetStr);

        if (featureChanged) changed = true;
        return feature;
      });
      
    } else if (geo.type === 'Feature') {
        if (!geo.properties) geo.properties = {};
        if (!geo.properties.name) { geo.properties.name = "Recorrido Confirmado"; changed = true; }
        if (!geo.properties.color) { geo.properties.color = colors[0]; changed = true; }
        
        let streetStr = geo.properties.streets || "";
        if (!streetStr && oldCallesString) {
            streetStr = oldCallesString;
            geo.properties.streets = streetStr;
            changed = true;
        }
        newCalles.push(streetStr);
    }

    const finalCallesString = newCalles.join(' | ');
    if (oldCallesString !== finalCallesString) {
      changed = true;
    }

    if (changed) {
      await prisma.rutaTransporte.update({
        where: { id: ruta.id },
        data: {
          datosGeo: JSON.stringify(geo),
          calles: finalCallesString
        }
      });
      console.log(`✅ Actualizada solicitud #${ruta.numeroSolicitud} (ID: ${ruta.id})`);
      updatedCount++;
    }
  }

  console.log(`\n🎉 Migración completada! Se actualizaron ${updatedCount} registros antiguos.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
