const https = require('https');

function queryUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve({ error: e.message, data });
        }
      });
    }).on('error', (e) => resolve({ error: e.message }));
  });
}

async function test() {
  // Test USIG Normalizar
  const usigUrls = [
    "https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=Av.+San+Martin+y+Colombia,+Lanus&geocodificar=true",
    "https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=San+Martin+y+Colombia,+Lanus&geocodificar=true",
    "https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=Avenida+San+Martin+y+Colombia,+Lanus&geocodificar=true"
  ];

  console.log("=== USIG NORMALIZAR TESTS ===");
  for (const url of usigUrls) {
    const res = await queryUrl(url);
    console.log(url);
    console.log(JSON.stringify(res, null, 2));
    console.log("------------------------");
  }

  // Test Georef Argentina
  const georefUrls = [
    "https://apis.datos.gob.ar/georef/api/direcciones?direccion=Av.+San+Martin+y+Colombia&departamento=Lanus",
    "https://apis.datos.gob.ar/georef/api/direcciones?direccion=San+Martin+y+Colombia&departamento=Lanus"
  ];

  console.log("=== GEOREF ARGENTINA TESTS ===");
  for (const url of georefUrls) {
    const res = await queryUrl(url);
    console.log(url);
    console.log(JSON.stringify(res, null, 2));
    console.log("------------------------");
  }
}

test();
