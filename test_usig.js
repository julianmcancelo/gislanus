const address = "Av. Gral. José de San Martín y Ocampo, Lanús";
const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(address)}`;
fetch(url).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
