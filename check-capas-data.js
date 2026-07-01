const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const layer = await prisma.capa.findFirst({
    where: { nombre: 'Escuelas Secundarias' }
  });
  if (layer) {
    console.log("Capa encontrada:");
    console.log("Tipo:", layer.tipo);
    console.log("DatosGeo start:", layer.datosGeo.substring(0, 100));
    try {
      const parsed = JSON.parse(layer.datosGeo);
      console.log("Valid JSON?", true);
      console.log("Feature count:", parsed.features ? parsed.features.length : 'No features array');
      if (parsed.features && parsed.features.length > 0) {
        console.log("First feature geometry:", JSON.stringify(parsed.features[0].geometry));
      }
    } catch (e) {
      console.log("Valid JSON?", false);
      console.log("Parse Error:", e.message);
    }
  } else {
    console.log("Capa no encontrada");
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
