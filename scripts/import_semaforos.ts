import * as xlsx from 'xlsx';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

const prisma = new PrismaClient();

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocode(address: string): Promise<[number, number] | null> {
  const query = encodeURIComponent(address);
  try {
    // 1. Intentamos con USIG (muy bueno para intersecciones AMBA)
    const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${query}`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (data && data.direccionesNormalizadas && data.direccionesNormalizadas.length > 0) {
      const coords = data.direccionesNormalizadas[0].coordenadas;
      if (coords) {
        if (typeof coords === 'object' && coords.x && coords.y) {
          return [parseFloat(coords.x), parseFloat(coords.y)];
        } else if (typeof coords === 'string') {
          const matchX = coords.match(/x=(-?\d+\.\d+)/);
          const matchY = coords.match(/y=(-?\d+\.\d+)/);
          if (matchX && matchY) {
            return [parseFloat(matchX[1]), parseFloat(matchY[1])];
          }
        }
      }
    }
  } catch (error: any) {
    console.error(`Error USIG geocodificando ${address}:`, error.message || error);
  }

  // 2. Fallback a Nominatim
  try {
    // Agregamos Buenos Aires, Argentina para ser más específicos si no lo tiene
    const searchAddress = address.includes('Argentina') ? address : `${address}, Buenos Aires, Argentina`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchAddress)}&format=json&limit=1`;
    const headers = { 'User-Agent': 'LanusGIS/1.0 (contacto@lanusgis.com)' };
    const res = await fetch(nominatimUrl, { headers });
    const data: any = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)]; // Retornamos [lon, lat] para GeoJSON
    }
  } catch (error: any) {
    console.error(`Error Nominatim geocodificando ${address}:`, error.message || error);
  }

  return null;
}



async function main() {
  console.log("1. Leyendo Excel...");
  const workbook = xlsx.readFile('mapas.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Extraer textos hasta la fila 450
  const rawTexts: string[] = [];
  for (let i = 0; i < Math.min(450, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.length > 0) {
      const text = row[1] || row[0]; // Algunas filas tienen el texto en la col 1 (índice 0) y otras en la col 2 (índice 1)
      if (typeof text === 'string' && text.trim().length > 5 && !text.includes('Semáforos por')) {
        rawTexts.push(text.trim());
      }
    }
  }
  
  console.log(`Se encontraron ${rawTexts.length} posibles semáforos para procesar.`);

  const batchSize = 100;
  let allCleanIntersections: string[] = [];

  console.log("2. Procesando textos con OpenAI en lotes de a 100...");
  for (let i = 0; i < rawTexts.length; i += batchSize) {
    const batch = rawTexts.slice(i, i + batchSize);
    console.log(`Procesando lote ${i / batchSize + 1} (${batch.length} items)...`);
    
    const prompt = `Aquí tienes una lista de textos extraídos de un documento de la Municipalidad de Lanús sobre ubicaciones de semáforos.
Necesito que extraigas únicamente la intersección o dirección principal, descartando aclaraciones entre paréntesis o comentarios como 'lo mantenemos nosotros' o 'Fecha inicio'.
Asegúrate de agregar ', Lanús' al final de cada una para ayudar a la geocodificación (NO agregues Buenos Aires ni Argentina). Ejemplo: "Avenida Hipólito Yrigoyen y Brasil, Lanús".

Textos originales:
${batch.map((t, idx) => `[${idx}] ${t}`).join('\n')}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un asistente experto en GIS y extracción de datos geográficos. Debes retornar SIEMPRE un JSON con una sola clave 'intersecciones' que contenga un arreglo de strings." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (content) {
        const result = JSON.parse(content);
        if (result && result.intersecciones) {
          allCleanIntersections = allCleanIntersections.concat(result.intersecciones);
        }
      }
    } catch (e) {
      console.error(`Error en OpenAI para el lote ${i / batchSize + 1}:`, e);
    }
  }

  console.log(`OpenAI devolvió ${allCleanIntersections.length} intersecciones limpias.`);

  console.log("3. Geocodificando con Nominatim (1s de delay por request)...");
  const features = [];
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < allCleanIntersections.length; i++) {
    const address = allCleanIntersections[i];
    process.stdout.write(`[${i+1}/${allCleanIntersections.length}] Buscando: ${address} -> `);
    
    const coords = await geocode(address);
    if (coords) {
      console.log(`Encontrado: ${coords}`);
      found++;
      features.push({
        type: "Feature",
        properties: {
          nombre: "Semáforo",
          direccion: address
        },
        geometry: {
          type: "Point",
          coordinates: coords
        }
      });
    } else {
      console.log(`NO ENCONTRADO`);
      notFound++;
    }
    
    await delay(1100);
  }

  console.log(`Geocodificación terminada. Encontrados: ${found}, No encontrados: ${notFound}`);

  if (features.length > 0) {
    console.log("4. Guardando en la base de datos...");
    const geojson = {
      type: "FeatureCollection",
      features: features
    };

    try {
      // Buscar el Grupo "Infraestructura Urbana" o crearlo
      let grupo = await prisma.grupo.findFirst({ where: { nombre: "Infraestructura Urbana" } });
      if (!grupo) {
        grupo = await prisma.grupo.create({
          data: { nombre: "Infraestructura Urbana", color: "#FFC107" }
        });
      }

      await prisma.capa.create({
        data: {
          nombre: "Semáforos",
          tipo: "geojson",
          color: "#E53935", // Rojo
          datosGeo: JSON.stringify(geojson),
          grupoId: grupo.id,
        }
      });

      console.log("¡Capa 'Semáforos' guardada con éxito en la base de datos!");
    } catch (dbError) {
      console.error("Error guardando en BD:", dbError);
    }
  }
}
main().catch(console.error);
