const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'nominatim.openstreetmap.org',
  path: '/search?q=Lanus,Buenos+Aires,Argentina&format=geojson&polygon_geojson=1',
  method: 'GET',
  headers: {
    'User-Agent': 'LanusGIS/1.0'
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const geojson = JSON.parse(data);
    fs.writeFileSync('public/lanus-base.geojson', JSON.stringify(geojson));
    console.log('Saved to public/lanus-base.geojson');
  });
});

req.on('error', console.error);
req.end();
