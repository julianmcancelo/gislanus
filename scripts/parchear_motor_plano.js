const fs = require('fs');

console.log('Iniciando parche definitivo del motor cartográfico y mapa base...');

const htmlPath = 'C:/Users/Julian/Downloads/visor_colectivos.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Cargar las 6 líneas clave empaquetadas (32, 75, 158, 160, 247, 527)
function cleanJson(p) {
  let s = fs.readFileSync(p, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return JSON.parse(s);
}

const bundledLines = {};
['32', '75', '158', '160'].forEach(l => {
  bundledLines[l] = cleanJson('C:/Users/Julian/Downloads/Lineas_Colectivos_Nacionales/linea_' + l + '_completa.geojson').features;
});
bundledLines['247'] = cleanJson('C:/Users/Julian/Downloads/Lineas_Colectivos_Provinciales_BA/linea_247_provincial_completa.geojson').features;
bundledLines['527'] = cleanJson('C:/Users/Julian/Downloads/Lineas_Municipales_Lanus/linea_527_lanus_completa.geojson').features;

// Reemplazar la sección del motor anterior por el nuevo motor perfeccionado
const sIdx = html.indexOf('// =========================================================================\n  // 📐 MOTOR CARTOGRÁFICO DE PLANOS DE ARQUITECTURA & URBANISMO · LANÚS GOBIERNO');
const endIdx = html.indexOf('// Inicio rápido');

if (sIdx === -1 || endIdx === -1) {
  console.error('No se encontraron los delimitadores del bloque anterior.');
  process.exit(1);
}

const nuevoMotor = `// =========================================================================
  // 📐 MOTOR CARTOGRÁFICO DE PLANOS DE ARQUITECTURA & URBANISMO · LANÚS GOBIERNO
  // =========================================================================
  const BUNDLED_TRANSIT_LINES = ${JSON.stringify(bundledLines)};

  let configPlano = {
    formato: 'A1',
    orientacion: 'landscape',
    incluirLimite: true,
    incluirAnexoA4: true,
    incluirCaratula: true,
    incluirReticula: true
  };

  const SHEET_SPECS = {
    A4: { w: 297, h: 210, marginMm: 6.0, innerPadMm: 1.8, headerMm: 18, caratureMm: 32, gapMm: 2.0, baseDpmm: 8.0 },
    A3: { w: 420, h: 297, marginMm: 8.0, innerPadMm: 2.4, headerMm: 24, caratureMm: 42, gapMm: 2.5, baseDpmm: 6.8 },
    A2: { w: 594, h: 420, marginMm: 11.0, innerPadMm: 3.0, headerMm: 34, caratureMm: 58, gapMm: 3.2, baseDpmm: 5.2 },
    A1: { w: 841, h: 594, marginMm: 15.0, innerPadMm: 4.0, headerMm: 48, caratureMm: 80, gapMm: 4.2, baseDpmm: 4.0 },
    A0: { w: 1189, h: 841, marginMm: 20.0, innerPadMm: 5.0, headerMm: 64, caratureMm: 110, gapMm: 5.5, baseDpmm: 3.2 }
  };

  function abrirModalPlano() {
    document.getElementById('modalPlano').style.display = 'flex';
  }

  function cerrarModalPlano() {
    document.getElementById('modalPlano').style.display = 'none';
  }

  function setFormato(fmt) {
    configPlano.formato = fmt;
    ['A0','A1','A2','A3','A4'].forEach(f => {
      const b = document.getElementById('fmt_' + f);
      if (f === fmt) {
        b.style.background = '#7b1828';
        b.style.borderColor = '#f43f5e';
      } else {
        b.style.background = '#1f2937';
        b.style.borderColor = '#374151';
      }
    });
  }

  function setOrientacion(ori) {
    configPlano.orientacion = ori;
    const bL = document.getElementById('ori_landscape');
    const bP = document.getElementById('ori_portrait');
    if (ori === 'landscape') {
      bL.style.background = '#0284c7';
      bL.style.borderColor = '#38bdf8';
      bP.style.background = '#1f2937';
      bP.style.borderColor = '#374151';
    } else {
      bP.style.background = '#0284c7';
      bP.style.borderColor = '#38bdf8';
      bL.style.background = '#1f2937';
      bL.style.borderColor = '#374151';
    }
  }

  // Clase de Proyección Isométrica EPSG:3857 exacta para canvas de plano
  class CartoProjection {
    constructor(points, viewportW, viewportH, paddingFrac = 0.06) {
      this.width = viewportW;
      this.height = viewportH;
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      points.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });
      
      const padLat = Math.max((maxLat - minLat) * paddingFrac, 0.015);
      const padLng = Math.max((maxLng - minLng) * paddingFrac, 0.015);
      this.minLat = minLat - padLat; 
      this.maxLat = maxLat + padLat;
      this.minLng = minLng - padLng; 
      this.maxLng = maxLng + padLng;

      this.worldLeft = (this.minLng + 180) / 360;
      this.worldRight = (this.maxLng + 180) / 360;
      
      const toRad = Math.PI / 180;
      const topMerc = Math.log(Math.tan(Math.PI / 4 + (this.maxLat * toRad) / 2));
      const botMerc = Math.log(Math.tan(Math.PI / 4 + (this.minLat * toRad) / 2));
      this.worldTop = (1 - topMerc / Math.PI) / 2;
      this.worldBottom = (1 - botMerc / Math.PI) / 2;

      this.worldW = this.worldRight - this.worldLeft;
      this.worldH = this.worldBottom - this.worldTop;

      const scaleX = viewportW / this.worldW;
      const scaleY = viewportH / this.worldH;
      this.scale = Math.min(scaleX, scaleY);

      this.offsetX = (viewportW - this.worldW * this.scale) / 2;
      this.offsetY = (viewportH - this.worldH * this.scale) / 2;
      this.centerLat = (this.minLat + this.maxLat) / 2;
    }

    project(lat, lng) {
      const toRad = Math.PI / 180;
      const wx = (lng + 180) / 360;
      const merc = Math.log(Math.tan(Math.PI / 4 + (lat * toRad) / 2));
      const wy = (1 - merc / Math.PI) / 2;
      return {
        x: this.offsetX + (wx - this.worldLeft) * this.scale,
        y: this.offsetY + (wy - this.worldTop) * this.scale
      };
    }

    unproject(px, py) {
      const wx = this.worldLeft + (px - this.offsetX) / this.scale;
      const wy = this.worldTop + (py - this.offsetY) / this.scale;
      const lng = wx * 360 - 180;
      const merc = (1 - 2 * wy) * Math.PI;
      const lat = (2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180 / Math.PI;
      return { lat, lng };
    }

    getMetersPerPixel() {
      const meanLatRad = (this.centerLat * Math.PI) / 180;
      const metersPerWorld = (40075016.686 * Math.cos(meanLatRad));
      return metersPerWorld / (this.scale * 256);
    }
  }

  // Descargador concurrente de tiles con CORS abierto
  async function downloadAndRenderTiles(ctx, proj, mapX, mapY, mapW, mapH) {
    const mpp = proj.getMetersPerPixel();
    // Calcular nivel de zoom ideal según metersPerPixel
    let zoom = 13;
    if (mpp < 6) zoom = 15;
    else if (mpp < 12) zoom = 14;
    else if (mpp < 25) zoom = 13;
    else zoom = 12;

    const lat2tile = (lat, z) => Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 * Math.pow(2, z));
    const lon2tile = (lon, z) => Math.floor((lon + 180)/360 * Math.pow(2, z));

    const minX = lon2tile(proj.minLng, zoom);
    const maxX = lon2tile(proj.maxLng, zoom);
    const minY = lat2tile(proj.maxLat, zoom);
    const maxY = lat2tile(proj.minLat, zoom);

    const tilePromises = [];
    const subdomains = ['a', 'b', 'c', 'd'];

    for (let tx = minX; tx <= maxX; tx++) {
      for (let ty = minY; ty <= maxY; ty++) {
        const sub = subdomains[(tx + ty) % subdomains.length];
        const url = 'https://' + sub + '.basemaps.cartocdn.com/rastertiles/voyager/' + zoom + '/' + tx + '/' + ty + '.png';

        // Esquinas del tile en coordenadas WGS84
        const n = Math.PI - 2 * Math.PI * ty / Math.pow(2, zoom);
        const tileLatTop = (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
        const s = Math.PI - 2 * Math.PI * (ty + 1) / Math.pow(2, zoom);
        const tileLatBot = (180 / Math.PI * Math.atan(0.5 * (Math.exp(s) - Math.exp(-s))));
        const tileLngLeft = tx / Math.pow(2, zoom) * 360 - 180;
        const tileLngRight = (tx + 1) / Math.pow(2, zoom) * 360 - 180;

        const pTopLeft = proj.project(tileLatTop, tileLngLeft);
        const pBotRight = proj.project(tileLatBot, tileLngRight);

        tilePromises.push(new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const dx = mapX + pTopLeft.x;
            const dy = mapY + pTopLeft.y;
            const dw = pBotRight.x - pTopLeft.x + 0.6;
            const dh = pBotRight.y - pTopLeft.y + 0.6;
            ctx.drawImage(img, dx, dy, dw, dh);
            resolve();
          };
          img.onerror = () => resolve(); // Si falla un tile individual, continuar
          img.src = url;
          setTimeout(resolve, 4000);
        }));
      }
    }

    await Promise.all(tilePromises);
  }

  // Generador principal de lámina arquitectónica
  async function generarPlanoPdf() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      alert('Error: La librería jsPDF no cargó correctamente.');
      return;
    }

    const fmt = configPlano.formato;
    const ori = configPlano.orientacion;
    const spec = SHEET_SPECS[fmt];
    const isLand = ori === 'landscape';
    const pdfW = isLand ? spec.w : spec.h;
    const pdfH = isLand ? spec.h : spec.w;

    const progEl = document.getElementById('printProgress');
    const progTxt = document.getElementById('printStatusText');
    progEl.style.display = 'block';
    progTxt.textContent = 'Inicializando proyección cartográfica EPSG:3857 (' + fmt + ')...';

    const chkLimite = document.getElementById('chkLimiteLanus').checked;
    const chkAnexo = document.getElementById('chkAnexoA4').checked;
    const chkCaratula = document.getElementById('chkCaratula').checked;
    const chkReticula = document.getElementById('chkReticula').checked;

    const lineaInput = document.getElementById('inputLinea').value.trim() || '32';

    // Obtener trazas activas: si currentFeatures está vacío, usar el bundle local
    let featuresActivas = (currentFeatures && currentFeatures.length > 0) ? currentFeatures : [];
    if (featuresActivas.length === 0 && BUNDLED_TRANSIT_LINES[lineaInput]) {
      featuresActivas = BUNDLED_TRANSIT_LINES[lineaInput];
      currentFeatures = featuresActivas;
    }

    // Recopilar puntos para bounding box
    const allPoints = [];
    featuresActivas.forEach(f => {
      if (!f.geometry || !f.geometry.coordinates) return;
      if (f.geometry.type === 'LineString') {
        f.geometry.coordinates.forEach(c => allPoints.push({ lat: c[1], lng: c[0] }));
      } else if (f.geometry.type === 'MultiLineString') {
        f.geometry.coordinates.forEach(line => line.forEach(c => allPoints.push({ lat: c[1], lng: c[0] })));
      }
    });

    // Si está activo el límite de Lanús, asegurar que el límite también entre en el plano
    if (chkLimite && LANUS_BASE_GEOJSON.features) {
      const ring = LANUS_BASE_GEOJSON.features[0].geometry.coordinates[0];
      ring.forEach(c => allPoints.push({ lat: c[1], lng: c[0] }));
    }

    if (allPoints.length === 0) {
      allPoints.push({ lat: -34.70, lng: -58.40 }, { lat: -34.72, lng: -58.38 });
    }

    const dpmm = spec.baseDpmm;
    const toPx = mm => Math.round(mm * dpmm);

    const sheetWPx = toPx(pdfW);
    const sheetHPx = toPx(pdfH);
    const marginPx = toPx(spec.marginMm);
    const innerPadPx = toPx(spec.innerPadMm);
    const headerHPx = chkCaratula ? toPx(spec.headerMm) : 0;
    const caratureHPx = chkCaratula ? toPx(spec.caratureMm) : 0;
    const gapPx = toPx(spec.gapMm);

    const frameX = marginPx + innerPadPx;
    const frameY = marginPx + innerPadPx;
    const frameW = sheetWPx - 2 * (marginPx + innerPadPx);
    const frameH = sheetHPx - 2 * (marginPx + innerPadPx);

    const mapX = frameX;
    const mapY = frameY + (headerHPx ? headerHPx + gapPx : 0);
    const mapW = frameW;
    const mapH = frameH - (headerHPx ? headerHPx + gapPx : 0) - (caratureHPx ? caratureHPx + gapPx : 0);

    const proj = new CartoProjection(allPoints, mapW, mapH, 0.05);

    // Canvas Principal
    const canvas = document.createElement('canvas');
    canvas.width = sheetWPx;
    canvas.height = sheetHPx;
    const ctx = canvas.getContext('2d');

    // Fondo blanco técnico de lámina
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetWPx, sheetHPx);

    // Fondo tenue del viewport del mapa
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    // CLIP del viewport del mapa
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

    // 0. DESCARGAR Y DIBUJAR MAPA BASE RÁSTER (CartoDB Voyager)
    progTxt.textContent = 'Descargando mosaico de mapa base de calles...';
    try {
      await downloadAndRenderTiles(ctx, proj, mapX, mapY, mapW, mapH);
    } catch(err) {
      console.warn('Advertencia al renderizar tiles de mapa:', err);
    }

    progTxt.textContent = 'Dibujando límites de Lanús y trazados vectoriales...';

    // 1. DIBUJAR LÍMITE MUNICIPAL DE LANÚS
    if (chkLimite && LANUS_BASE_GEOJSON.features) {
      const ring = LANUS_BASE_GEOJSON.features[0].geometry.coordinates[0];
      
      // Sombreado de área municipal de Lanús
      ctx.beginPath();
      const p0 = proj.project(ring[0][1], ring[0][0]);
      ctx.moveTo(mapX + p0.x, mapY + p0.y);
      for (let i = 1; i < ring.length; i++) {
        const pt = proj.project(ring[i][1], ring[i][0]);
        ctx.lineTo(mapX + pt.x, mapY + pt.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(123, 24, 40, 0.06)'; // Tinte granate Lanús sutil
      ctx.fill();

      // Trazo perimetral técnico
      ctx.strokeStyle = '#7b1828';
      ctx.lineWidth = Math.max(2, toPx(1.2));
      ctx.setLineDash([toPx(5), toPx(2.5), toPx(2), toPx(2.5)]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. CRUCES CARTOGRÁFICAS DE REGISTRO (+)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = Math.max(1, toPx(0.35));
    const arm = toPx(3.5);
    for (let i = 1; i <= 3; i++) {
      for (let j = 1; j <= 3; j++) {
        const cx = mapX + (mapW * i) / 4;
        const cy = mapY + (mapH * j) / 4;
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
        ctx.stroke();
      }
    }

    // 3. DIBUJAR TRAZAS DE COLECTIVOS (IDA Y VUELTA)
    const officialColor = '#0284c7';
    featuresActivas.forEach((feat, fIdx) => {
      const p = feat.properties || {};
      const sentido = (p.sentido || p.sentido_ci || 'IDA').toUpperCase();
      const geom = feat.geometry;
      if (!geom || !geom.coordinates) return;
      const lines = geom.type === 'LineString' ? [geom.coordinates] : (geom.type === 'MultiLineString' ? geom.coordinates : []);

      lines.forEach(lineCoords => {
        if (lineCoords.length < 2) return;
        
        // Halo blanco para máxima legibilidad sobre las calles
        ctx.beginPath();
        const startPt = proj.project(lineCoords[0][1], lineCoords[0][0]);
        ctx.moveTo(mapX + startPt.x, mapY + startPt.y);
        for (let i = 1; i < lineCoords.length; i++) {
          const pt = proj.project(lineCoords[i][1], lineCoords[i][0]);
          ctx.lineTo(mapX + pt.x, mapY + pt.y);
        }
        ctx.lineWidth = Math.max(4, toPx(2.6));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Trazo con color distintivo oficial
        const color = colors[fIdx % colors.length] || officialColor;
        ctx.lineWidth = Math.max(2.4, toPx(1.5));
        ctx.strokeStyle = color;
        if (sentido === 'VUELTA') {
          ctx.setLineDash([toPx(3.5), toPx(2.2)]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
    });

    // 4. RETÍCULA SEXAGESIMAL DMS
    if (chkReticula) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.2)';
      ctx.lineWidth = Math.max(1, toPx(0.3));
      ctx.setLineDash([toPx(2), toPx(2)]);
      ctx.font = 'bold ' + toPx(spec.caratureMm * 0.12) + 'px sans-serif';
      ctx.fillStyle = '#0f172a';

      for (let c = 1; c <= 3; c++) {
        const x = mapX + (mapW * c) / 4;
        ctx.beginPath();
        ctx.moveTo(x, mapY); ctx.lineTo(x, mapY + mapH);
        ctx.stroke();

        const geo = proj.unproject((mapW * c) / 4, 10);
        ctx.fillText(geo.lng.toFixed(3) + '° O', x + toPx(1.5), mapY + toPx(4));
      }
      for (let r = 1; r <= 3; r++) {
        const y = mapY + (mapH * r) / 4;
        ctx.beginPath();
        ctx.moveTo(mapX, y); ctx.lineTo(mapX + mapW, y);
        ctx.stroke();

        const geo = proj.unproject(10, (mapH * r) / 4);
        ctx.fillText(geo.lat.toFixed(3) + '° S', mapX + toPx(2), y - toPx(1.5));
      }
      ctx.setLineDash([]);
    }

    ctx.restore(); // Fin del clip del mapa

    // Borde técnico del mapa
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.5, toPx(0.6));
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // 5. ENCABEZADO INSTITUCIONAL OFICIAL
    if (chkCaratula && headerHPx > 0) {
      const hX = frameX, hY = frameY, hW = frameW, hH = headerHPx;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hX, hY, hW, hH);

      // Franja superior celeste Lanús (#00aeef)
      ctx.fillStyle = '#00aeef';
      ctx.fillRect(hX, hY, hW, toPx(1.2));

      // Títulos
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + toPx(spec.headerMm * 0.32) + 'px sans-serif';
      ctx.fillText('MUNICIPALIDAD DE LANÚS · SECRETARÍA DE PLANIFICACIÓN URBANA', hX + toPx(12), hY + hH * 0.45);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 ' + toPx(spec.headerMm * 0.22) + 'px sans-serif';
      ctx.fillText('DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE · PLANO TÉCNICO OFICIAL', hX + toPx(12), hY + hH * 0.78);

      // Badge formato de lámina
      ctx.fillStyle = '#7b1828';
      ctx.fillRect(hX + hW - toPx(28), hY + toPx(3), toPx(24), hH - toPx(6));
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + toPx(spec.headerMm * 0.36) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fmt, hX + hW - toPx(16), hY + hH * 0.65);
      ctx.textAlign = 'start';
    }

    // 6. CARÁTULA ARQUITECTÓNICA DE URBANISMO
    if (chkCaratula && caratureHPx > 0) {
      const cX = frameX, cY = mapY + mapH + gapPx, cW = frameW, cH = caratureHPx;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cX, cY, cW, cH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, toPx(0.4));
      ctx.strokeRect(cX, cY, cW, cH);

      const col1W = Math.round(cW * 0.42);
      const col2W = Math.round(cW * 0.30);
      const col3W = cW - col1W - col2W;

      // Columna 1: Proyecto y Jurisdicción
      ctx.font = 'bold ' + toPx(spec.caratureMm * 0.16) + 'px sans-serif';
      ctx.fillStyle = '#7b1828';
      ctx.fillText('SISTEMA INTEGRADO DE TRANSPORTE URBANO · LANÚS', cX + toPx(6), cY + cH * 0.22);

      ctx.font = 'bold ' + toPx(spec.caratureMm * 0.28) + 'px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('LÍNEA ' + lineaInput + ' · TRAZADO OFICIAL', cX + toPx(6), cY + cH * 0.58);

      ctx.font = '600 ' + toPx(spec.caratureMm * 0.14) + 'px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Lanús Oeste · Lanús Este · Valentín Alsina · R. de Escalada · Gerli', cX + toPx(6), cY + cH * 0.85);

      // Divisor
      ctx.strokeStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(cX + col1W, cY); ctx.lineTo(cX + col1W, cY + cH);
      ctx.moveTo(cX + col1W + col2W, cY); ctx.lineTo(cX + col1W + col2W, cY + cH);
      ctx.stroke();

      // Columna 2: Ficha Técnica
      const c2X = cX + col1W + toPx(6);
      ctx.font = 'bold ' + toPx(spec.caratureMm * 0.14) + 'px sans-serif';
      ctx.fillStyle = '#7b1828';
      ctx.fillText('DATOS CARTOGRÁFICOS:', c2X, cY + cH * 0.22);

      const mpp = proj.getMetersPerPixel();
      const escalaDenom = Math.round(dpmm * 1000 * mpp);
      ctx.font = '500 ' + toPx(spec.caratureMm * 0.13) + 'px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('• Datum: WGS84 / EPSG:3857 (Web Mercator)', c2X, cY + cH * 0.44);
      ctx.fillText('• Escala aproximada: 1:' + (escalaDenom > 0 ? escalaDenom.toLocaleString('es-AR') : '25.000'), c2X, cY + cH * 0.65);
      ctx.fillText('• Emisión: ' + new Date().toLocaleDateString('es-AR'), c2X, cY + cH * 0.86);

      // Columna 3: Referencias Rápidas
      const c3X = cX + col1W + col2W + toPx(6);
      ctx.font = 'bold ' + toPx(spec.caratureMm * 0.14) + 'px sans-serif';
      ctx.fillStyle = '#7b1828';
      ctx.fillText('REFERENCIAS BÁSICAS:', c3X, cY + cH * 0.22);

      ctx.fillStyle = '#334155';
      ctx.font = '600 ' + toPx(spec.caratureMm * 0.13) + 'px sans-serif';
      ctx.fillText('— Trazo continuo: Recorrido IDA', c3X, cY + cH * 0.44);
      ctx.fillText('╌ Trazo discontinuo: Recorrido VUELTA', c3X, cY + cH * 0.65);
      ctx.fillText('╌ Límite rojo: Contorno Municipal Lanús', c3X, cY + cH * 0.86);
    }

    // 7. DOBLE RECUADRO TÉCNICO PERIMETRAL
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(1.5, toPx(1.0));
    ctx.strokeRect(marginPx, marginPx, sheetWPx - 2 * marginPx, sheetHPx - 2 * marginPx);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, toPx(0.5));
    ctx.strokeRect(frameX, frameY, frameW, frameH);

    progTxt.textContent = 'Ensamblando documento PDF y preparando Anexo A4...';

    // Iniciar PDF
    const pdf = new jsPDF({
      orientation: ori,
      unit: 'mm',
      format: fmt.toLowerCase()
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');

    // ─────────────────────────────────────────────────────────────────────────
    // PÁGINA 2: ANEXO DE REFERENCIAS TÉCNICAS EN HOJA A4 SEPARADA (SI ESTÁ ACTIVO)
    // ─────────────────────────────────────────────────────────────────────────
    if (chkAnexo) {
      progTxt.textContent = 'Generando Hoja A4 de Anexo de Referencias Técnicas...';
      pdf.addPage('a4', 'portrait');

      const a4W = 210, a4H = 297;
      const a4Canvas = document.createElement('canvas');
      const a4Dpmm = 6.0;
      const toA4Px = mm => Math.round(mm * a4Dpmm);

      a4Canvas.width = toA4Px(a4W);
      a4Canvas.height = toA4Px(a4H);
      const a4Ctx = a4Canvas.getContext('2d');

      // Fondo blanco A4
      a4Ctx.fillStyle = '#FFFFFF';
      a4Ctx.fillRect(0, 0, a4Canvas.width, a4Canvas.height);

      // Recuadro A4
      const a4Margin = toA4Px(12);
      a4Ctx.strokeStyle = '#0f172a';
      a4Ctx.lineWidth = toA4Px(0.8);
      a4Ctx.strokeRect(a4Margin, a4Margin, a4Canvas.width - 2 * a4Margin, a4Canvas.height - 2 * a4Margin);

      // Encabezado A4
      a4Ctx.fillStyle = '#1e293b';
      a4Ctx.fillRect(a4Margin, a4Margin, a4Canvas.width - 2 * a4Margin, toA4Px(24));

      a4Ctx.fillStyle = '#00aeef';
      a4Ctx.fillRect(a4Margin, a4Margin, a4Canvas.width - 2 * a4Margin, toA4Px(1.0));

      a4Ctx.fillStyle = '#FFFFFF';
      a4Ctx.font = 'bold ' + toA4Px(5.5) + 'px sans-serif';
      a4Ctx.fillText('ANEXO DE REFERENCIAS TÉCNICAS Y DESGLOSE DE RECORRIDOS', a4Margin + toA4Px(6), a4Margin + toA4Px(11));

      a4Ctx.font = '600 ' + toA4Px(3.6) + 'px sans-serif';
      a4Ctx.fillStyle = '#94a3b8';
      a4Ctx.fillText('EXPEDIENTE TÉCNICO DE TRANSPORTE PÚBLICO · LÍNEA ' + lineaInput + ' · HOJA 2 DE 2 (A4)', a4Margin + toA4Px(6), a4Margin + toA4Px(18));

      // Tabla de Ramales y Trazas
      let yOffset = a4Margin + toA4Px(36);
      a4Ctx.fillStyle = '#7b1828';
      a4Ctx.font = 'bold ' + toA4Px(4.5) + 'px sans-serif';
      a4Ctx.fillText('1. DESGLOSE DETALLADO DE RAMALES Y SENTIDOS EN PLANO:', a4Margin + toA4Px(4), yOffset);

      yOffset += toA4Px(8);

      // Cabecera de Tabla
      const colX1 = a4Margin + toA4Px(4);
      const colX2 = colX1 + toA4Px(24);
      const colX3 = colX2 + toA4Px(60);
      const colX4 = colX3 + toA4Px(35);
      const tableW = a4Canvas.width - 2 * a4Margin - toA4Px(8);

      a4Ctx.fillStyle = '#f1f5f9';
      a4Ctx.fillRect(colX1, yOffset, tableW, toA4Px(8));
      a4Ctx.fillStyle = '#0f172a';
      a4Ctx.font = 'bold ' + toA4Px(3.4) + 'px sans-serif';
      a4Ctx.fillText('REF', colX1 + toA4Px(2), yOffset + toA4Px(5.5));
      a4Ctx.fillText('RAMAL / IDENTIFICADOR', colX2, yOffset + toA4Px(5.5));
      a4Ctx.fillText('SENTIDO', colX3, yOffset + toA4Px(5.5));
      a4Ctx.fillText('COLOR DE TRAZA', colX4, yOffset + toA4Px(5.5));

      yOffset += toA4Px(9);

      featuresActivas.forEach((f, idx) => {
        const p = f.properties || {};
        const ramal = p.ramal || p.ramal_letr || p.nombre || ('Ramal ' + (idx + 1));
        const sentido = (p.sentido || p.sentido_ci || 'IDA').toUpperCase();
        const color = colors[idx % colors.length] || '#0284c7';

        // Fila
        if (idx % 2 === 1) {
          a4Ctx.fillStyle = '#f8fafc';
          a4Ctx.fillRect(colX1, yOffset - toA4Px(1), tableW, toA4Px(8));
        }

        // Badge Ref
        a4Ctx.beginPath();
        a4Ctx.arc(colX1 + toA4Px(6), yOffset + toA4Px(3), toA4Px(3), 0, Math.PI * 2);
        a4Ctx.fillStyle = '#0f172a';
        a4Ctx.fill();
        a4Ctx.fillStyle = '#fff';
        a4Ctx.font = 'bold ' + toA4Px(3) + 'px sans-serif';
        a4Ctx.textAlign = 'center';
        a4Ctx.fillText(String(idx + 1), colX1 + toA4Px(6), yOffset + toA4Px(4.2));
        a4Ctx.textAlign = 'start';

        a4Ctx.font = '600 ' + toA4Px(3.4) + 'px sans-serif';
        a4Ctx.fillStyle = '#1e293b';
        a4Ctx.fillText('Línea ' + lineaInput + ' - ' + ramal, colX2, yOffset + toA4Px(4));

        a4Ctx.fillStyle = sentido === 'IDA' ? '#059669' : '#d97706';
        a4Ctx.fillText(sentido === 'IDA' ? 'IDA (Continuo —)' : 'VUELTA (Discontinuo ╌)', colX3, yOffset + toA4Px(4));

        // Muestra de color
        a4Ctx.fillStyle = color;
        a4Ctx.fillRect(colX4, yOffset + toA4Px(1.5), toA4Px(25), toA4Px(3));

        yOffset += toA4Px(8.5);
      });

      // Sección 2: Ficha Municipal
      yOffset += toA4Px(10);
      a4Ctx.fillStyle = '#7b1828';
      a4Ctx.font = 'bold ' + toA4Px(4.5) + 'px sans-serif';
      a4Ctx.fillText('2. DATOS DE JURISDICCIÓN Y CERTIFICACIÓN MUNICIPAL:', a4Margin + toA4Px(4), yOffset);

      yOffset += toA4Px(8);
      const certBoxW = tableW;
      const certBoxH = toA4Px(45);
      a4Ctx.fillStyle = '#f8fafc';
      a4Ctx.strokeStyle = '#cbd5e1';
      a4Ctx.lineWidth = toA4Px(0.4);
      a4Ctx.fillRect(colX1, yOffset, certBoxW, certBoxH);
      a4Ctx.strokeRect(colX1, yOffset, certBoxW, certBoxH);

      a4Ctx.font = '500 ' + toA4Px(3.2) + 'px sans-serif';
      a4Ctx.fillStyle = '#334155';
      a4Ctx.fillText('• Ente Emisor: Municipalidad de Lanús · Subsecretaría de Planificación Urbana y Transporte.', colX1 + toA4Px(4), yOffset + toA4Px(8));
      a4Ctx.fillText('• Base Cartográfica Oficial: IDE Transporte de la Nación & Catastro Municipal de Lanús.', colX1 + toA4Px(4), yOffset + toA4Px(16));
      a4Ctx.fillText('• Cobertura Geográfica: 100% del Partido de Lanús (Lanús Este, Lanús Oeste, Caraza, Diamante, Alsina, Escalada).', colX1 + toA4Px(4), yOffset + toA4Px(24));
      a4Ctx.fillText('• Uso Oficial: Documento apto para pliegos de licitación, fiscalización en calle, desvíos y cartografía comunal.', colX1 + toA4Px(4), yOffset + toA4Px(32));
      a4Ctx.fillText('• Firma de Aprobación: Dirección General de Movilidad y Transporte · GIS Lanús.', colX1 + toA4Px(4), yOffset + toA4Px(40));

      const a4ImgData = a4Canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(a4ImgData, 'JPEG', 0, 0, a4W, a4H, undefined, 'FAST');
    }

    progTxt.textContent = '¡Completado! Abriendo y descargando documento oficial...';
    setTimeout(() => {
      progEl.style.display = 'none';
      cerrarModalPlano();
    }, 1500);

    const pdfBlobUrl = pdf.output('bloburl');
    const filename = 'Plano_Arquitectura_Lanus_Linea_' + lineaInput + '_' + fmt + '.pdf';
    pdf.save(filename);

    const printWin = window.open(pdfBlobUrl, '_blank');
    if (printWin) {
      printWin.onload = () => printWin.print();
    }
  }
`;

html = html.substring(0, sIdx) + nuevoMotor + '\n  ' + html.substring(endIdx);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Parche aplicado exitosamente a visor_colectivos.html.');
