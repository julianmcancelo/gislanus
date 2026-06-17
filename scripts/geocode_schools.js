const fs = require('fs');
const https = require('https');
const { DOMParser } = require('@xmldom/xmldom');

function cleanString(str) {
  if (!str) return '';
  return str.replace(/Valent.n/g, 'Valentin')
            .replace(/Lan.s/g, 'Lanus')
            .replace(/Jos. M./g, 'Jose M.')
            .replace(/[^\x00-\x7F]/g, ''); // strip remaining weird unicode chars
}

function geocode(address) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(`${address}, Buenos Aires, Argentina`);
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?q=${query}&format=json&limit=1`,
      headers: { 'User-Agent': 'LanusGIS-Geocoding-Script/1.0' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0) {
            resolve([parseFloat(json[0].lon), parseFloat(json[0].lat)]);
          } else {
            resolve(null);
          }
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  console.log("Iniciando geocodificación de ESCUELAS.kml...");
  
  // Read KML, ignoring encoding issues
  const kmlText = fs.readFileSync('ESCUELAS.kml', 'latin1'); 
  const kmlDom = new DOMParser().parseFromString(kmlText, 'text/xml');
  
  const placemarks = kmlDom.getElementsByTagName('Placemark');
  
  const features = [];
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < placemarks.length; i++) {
    const p = placemarks[i];
    const nameNode = p.getElementsByTagName('name')[0];
    const addrNode = p.getElementsByTagName('address')[0];
    
    if (!nameNode || !addrNode) continue;
    
    let name = nameNode.textContent;
    let address = addrNode.textContent;
    
    // Convert to UTF-8 properly if it was read as latin1, though cleanString is safer
    address = cleanString(address);
    name = cleanString(name);
    
    // Remove exact match of name from address if necessary, but Nominatim prefers just the street
    // Address often looks like "Paraguay 2119, Valentin Alsina"
    
    console.log(`[${i+1}/${placemarks.length}] Buscando: ${name} -> ${address}`);
    
    const coords = await geocode(address);
    
    if (coords) {
      found++;
      features.push({
        type: "Feature",
        properties: {
          nombre: name,
          direccion: address
        },
        geometry: {
          type: "Point",
          coordinates: coords
        }
      });
      console.log(`  -> Encontrado: ${coords}`);
    } else {
      notFound++;
      console.log(`  -> NO ENCONTRADO`);
    }
    
    // Delay 1 second to respect Nominatim limits
    await new Promise(r => setTimeout(r, 1100));
  }
  
  const geojson = {
    type: "FeatureCollection",
    features: features
  };
  
  fs.writeFileSync('ESCUELAS_corregido.geojson', JSON.stringify(geojson, null, 2), 'utf-8');
  console.log(`\nProceso terminado. Encontrados: ${found}, No encontrados: ${notFound}`);
  console.log("Archivo ESCUELAS_corregido.geojson guardado con éxito.");
}

main();
