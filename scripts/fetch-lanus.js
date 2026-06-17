const fs = require('fs');
const https = require('https');

const query = `
[out:json];
relation["name"="Partido de Lanús"]["admin_level"="8"];
out geom;
`;

const req = https.request('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const coords = [];
    if (json.elements && json.elements.length > 0) {
      json.elements[0].members.forEach(member => {
        if (member.type === 'way' && member.geometry) {
          member.geometry.forEach(pt => {
            coords.push([pt.lon, pt.lat]);
          });
        }
      });
      // Just make a polygon out of the ways
      const geojson = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { name: "Límites del Partido de Lanús" },
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        }]
      };
      fs.writeFileSync('public/lanus.geojson', JSON.stringify(geojson));
      console.log('Saved public/lanus.geojson');
    } else {
      console.log('No elements found');
    }
  });
});

req.write(`data=${encodeURIComponent(query)}`);
req.end();
