const fs = require('fs');

console.log('Iniciando actualización integral de visor_colectivos.html...');

const htmlPath = 'C:/Users/Julian/Downloads/visor_colectivos.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Cargar lanus-base.geojson
const lanusBasePath = 'C:/Users/Julian/Downloads/lanus-base.geojson';
const lanusBaseData = JSON.parse(fs.readFileSync(lanusBasePath, 'utf8'));

// 2. Cargar logo blanco oficial en base64
const logoWhitePath = 'C:/Users/Julian/Downloads/lanus_gobierno_white.png';
const logoWhiteB64 = 'data:image/png;base64,' + fs.readFileSync(logoWhitePath).toString('base64');

// 3. Agregar librería jsPDF en el <head>
if (!html.includes('jspdf.umd.min.js')) {
  html = html.replace('<!-- Leaflet JS -->', '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\n<!-- Leaflet JS -->');
}

// 4. Inyectar botón de Plano Arquitectónico en la barra lateral
const botonPlanoHtml = `
      <!-- BOTÓN IMPRIMIR PLANO ARQUITECTÓNICO OFICIAL -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #7b1828; border-radius: 8px; padding: 10px; margin-top: 6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <b style="font-size: 11px; color: #f43f5e; text-transform: uppercase; display:flex; align-items:center; gap:5px;">
            <span>📐</span> Plano Arquitectónico
          </b>
          <span style="font-size:9px; background:#7b1828; color:#fff; padding:2px 6px; border-radius:3px; font-weight:700;">OFICIAL</span>
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin: 0 0 8px;">Generá láminas de impresión técnica con carátula de urbanismo y anexo A4.</p>
        <button id="btnAbrirModalPlano" onclick="abrirModalPlano()" style="width:100%; background: linear-gradient(135deg, #7b1828 0%, #991b1b 100%); color:#fff; border:none; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 8px rgba(123,24,40,0.5);">
          <span>🖨️</span> Generar Lámina A0 / A1 / A4
        </button>
      </div>
`;

if (!html.includes('btnAbrirModalPlano')) {
  html = html.replace('<div class="tracks-header">', botonPlanoHtml + '\n    <div class="tracks-header">');
}

// 5. Inyectar el Modal HTML de Configuración de Impresión Técnica
const modalPlanoHtml = `
<!-- MODAL DE CONFIGURACIÓN DE PLANO ARQUITECTÓNICO -->
<div id="modalPlano" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); align-items:center; justify-content:center; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="background:#111827; border:1px solid #374151; border-radius:12px; width:100%; max-width:540px; box-shadow:0 20px 50px rgba(0,0,0,0.7); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
    
    <!-- Header del Modal -->
    <div style="background:#0b0f19; padding:16px 20px; border-bottom:1px solid #1f2937; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:22px;">📐</span>
        <div>
          <h2 style="font-size:16px; font-weight:800; color:#38bdf8; margin:0;">Generador de Planos de Arquitectura & Transporte</h2>
          <p style="font-size:11px; color:#94a3b8; margin:2px 0 0;">Lámina Técnica Oficial · Municipio de Lanús</p>
        </div>
      </div>
      <button onclick="cerrarModalPlano()" style="background:transparent; border:none; color:#9ca3af; font-size:20px; cursor:pointer;">✕</button>
    </div>

    <!-- Contenido del Modal -->
    <div style="padding:18px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:14px;">
      
      <!-- 1. Formato de Hoja -->
      <div>
        <label style="display:block; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; margin-bottom:6px;">
          📄 Formato de Lámina / Plotter:
        </label>
        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;">
          <button type="button" class="btn-fmt" onclick="setFormato('A0')" id="fmt_A0" style="padding:8px 0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">A0<br><span style="font-size:9px; font-weight:normal; color:#94a3b8;">1189×841</span></button>
          <button type="button" class="btn-fmt" onclick="setFormato('A1')" id="fmt_A1" style="padding:8px 0; background:#7b1828; border:1px solid #f43f5e; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">A1<br><span style="font-size:9px; font-weight:normal; color:#fff;">841×594</span></button>
          <button type="button" class="btn-fmt" onclick="setFormato('A2')" id="fmt_A2" style="padding:8px 0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">A2<br><span style="font-size:9px; font-weight:normal; color:#94a3b8;">594×420</span></button>
          <button type="button" class="btn-fmt" onclick="setFormato('A3')" id="fmt_A3" style="padding:8px 0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">A3<br><span style="font-size:9px; font-weight:normal; color:#94a3b8;">420×297</span></button>
          <button type="button" class="btn-fmt" onclick="setFormato('A4')" id="fmt_A4" style="padding:8px 0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">A4<br><span style="font-size:9px; font-weight:normal; color:#94a3b8;">297×210</span></button>
        </div>
      </div>

      <!-- 2. Orientación -->
      <div>
        <label style="display:block; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; margin-bottom:6px;">
          🧭 Orientación de Hoja:
        </label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <button type="button" class="btn-ori" onclick="setOrientacion('landscape')" id="ori_landscape" style="padding:8px; background:#0284c7; border:1px solid #38bdf8; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">🖥️ Horizontal (Landscape)</button>
          <button type="button" class="btn-ori" onclick="setOrientacion('portrait')" id="ori_portrait" style="padding:8px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;">📱 Vertical (Portrait)</button>
        </div>
      </div>

      <!-- 3. Opciones Técnicas de Plano -->
      <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:10px;">
        <b style="font-size:11px; color:#38bdf8; text-transform:uppercase;">⚙️ Elementos Cartográficos IRAM / ISO:</b>
        
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:#e2e8f0;">
          <input type="checkbox" id="chkLimiteLanus" checked style="accent-color:#38bdf8; width:16px; height:16px;">
          <span><b>🏛️ Límite Oficial del Municipio de Lanús</b> (Polígono perimetral con trazo técnico y máscara territorial)</span>
        </label>

        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:#e2e8f0;">
          <input type="checkbox" id="chkAnexoA4" checked style="accent-color:#38bdf8; width:16px; height:16px;">
          <span><b>📋 Anexo de Referencias Técnicas en Hoja A4 Separada</b> (Tabla de cómputos, ramales, longitudes y paradas)</span>
        </label>

        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:#e2e8f0;">
          <input type="checkbox" id="chkCaratula" checked style="accent-color:#38bdf8; width:16px; height:16px;">
          <span><b>🗂️ Rótulo / Carátula de Arquitectura Oficial</b> (Ficha técnica, escalas 1:1, fecha, datum EPSG:3857)</span>
        </label>

        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:#e2e8f0;">
          <input type="checkbox" id="chkReticula" checked style="accent-color:#38bdf8; width:16px; height:16px;">
          <span><b>🌐 Retícula Cartográfica Sexagesimal (DMS) y Cruces de Registro (+)</b></span>
        </label>
      </div>

      <!-- Estado de renderizado -->
      <div id="printProgress" style="display:none; background:#0b0f19; border:1px solid #0284c7; border-radius:6px; padding:10px; text-align:center;">
        <span id="printStatusText" style="font-size:12px; color:#38bdf8; font-weight:bold;">Renderizando lámina técnica vectorial...</span>
      </div>

    </div>

    <!-- Footer del Modal con Acción de Exportación -->
    <div style="background:#0b0f19; padding:14px 20px; border-top:1px solid #1f2937; display:flex; justify-content:flex-end; gap:10px;">
      <button onclick="cerrarModalPlano()" style="background:#374151; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Cancelar</button>
      <button id="btnEjecutarPrint" onclick="generarPlanoPdf()" style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#fff; border:none; padding:8px 20px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 10px rgba(2,132,199,0.5);">
        <span>🚀</span> Generar y Descargar PDF
      </button>
    </div>

  </div>
</div>
`;

if (!html.includes('id="modalPlano"')) {
  html = html.replace('</body>', modalPlanoHtml + '\n</body>');
}

// 6. Inyectar todo el Motor Cartográfico Isométrico EPSG:3857, Carátula Oficial y Anexo A4 en JavaScript
const motorCartograficoJs = `
  // =========================================================================
  // 📐 MOTOR CARTOGRÁFICO DE PLANOS DE ARQUITECTURA & URBANISMO · LANÚS GOBIERNO
  // =========================================================================
  const LANUS_BASE_GEOJSON = ${JSON.stringify(lanusBaseData)};
  const LANUS_LOGO_WHITE_B64 = "${logoWhiteB64}";

  let configPlano = {
    formato: 'A1',
    orientacion: 'landscape',
    incluirLimite: true,
    incluirAnexoA4: true,
    incluirCaratula: true,
    incluirReticula: true
  };

  const SHEET_SPECS = {
    A4: { w: 297, h: 210, marginMm: 6.0, innerPadMm: 1.8, headerMm: 18, caratureMm: 32, gapMm: 2.0, baseDpmm: 8.5 },
    A3: { w: 420, h: 297, marginMm: 8.0, innerPadMm: 2.4, headerMm: 24, caratureMm: 42, gapMm: 2.5, baseDpmm: 7.2 },
    A2: { w: 594, h: 420, marginMm: 11.0, innerPadMm: 3.0, headerMm: 34, caratureMm: 58, gapMm: 3.2, baseDpmm: 5.8 },
    A1: { w: 841, h: 594, marginMm: 15.0, innerPadMm: 4.0, headerMm: 48, caratureMm: 80, gapMm: 4.2, baseDpmm: 4.5 },
    A0: { w: 1189, h: 841, marginMm: 20.0, innerPadMm: 5.0, headerMm: 64, caratureMm: 110, gapMm: 5.5, baseDpmm: 3.6 }
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
    constructor(points, viewportW, viewportH, paddingFrac = 0.08) {
      this.width = viewportW;
      this.height = viewportH;
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      points.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });
      
      const padLat = (maxLat - minLat) * paddingFrac || 0.02;
      const padLng = (maxLng - minLng) * paddingFrac || 0.02;
      minLat -= padLat; maxLat += padLat;
      minLng -= padLng; maxLng += padLng;

      this.worldLeft = (minLng + 180) / 360;
      this.worldRight = (maxLng + 180) / 360;
      
      const toRad = Math.PI / 180;
      const topMerc = Math.log(Math.tan(Math.PI / 4 + (maxLat * toRad) / 2));
      const botMerc = Math.log(Math.tan(Math.PI / 4 + (minLat * toRad) / 2));
      this.worldTop = (1 - topMerc / Math.PI) / 2;
      this.worldBottom = (1 - botMerc / Math.PI) / 2;

      this.worldW = this.worldRight - this.worldLeft;
      this.worldH = this.worldBottom - this.worldTop;

      const scaleX = viewportW / this.worldW;
      const scaleY = viewportH / this.worldH;
      this.scale = Math.min(scaleX, scaleY);

      this.offsetX = (viewportW - this.worldW * this.scale) / 2;
      this.offsetY = (viewportH - this.worldH * this.scale) / 2;
      this.centerLat = (minLat + maxLat) / 2;
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

    getMetersPerPixel() {
      const meanLatRad = (this.centerLat * Math.PI) / 180;
      const metersPerWorld = (40075016.686 * Math.cos(meanLatRad));
      return metersPerWorld / (this.scale * 256);
    }
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

    // Obtener trazas activas
    const featuresActivas = currentFeatures.length > 0 ? currentFeatures : [];
    const lineaActual = document.getElementById('inputLinea').value.trim() || '32';

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

    // Si está activo el límite de Lanús, asegurar que el límite también entre en el visor
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

    progTxt.textContent = 'Dibujando mapa base y trazas vectoriales en lámina ' + fmt + '...';

    // Canvas Principal
    const canvas = document.createElement('canvas');
    canvas.width = sheetWPx;
    canvas.height = sheetHPx;
    const ctx = canvas.getContext('2d');

    // Fondo blanco técnico de lámina
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetWPx, sheetHPx);

    // Fondo tenue del viewport del mapa
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(mapX, mapY, mapW, mapH);

    // CLIP del viewport del mapa
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();

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
      ctx.fillStyle = 'rgba(123, 24, 40, 0.04)'; // Tinte granate Lanús sutil
      ctx.fill();

      // Trazo perimetral técnico
      ctx.strokeStyle = '#7b1828';
      ctx.lineWidth = Math.max(1.5, toPx(0.8));
      ctx.setLineDash([toPx(4), toPx(2), toPx(1.5), toPx(2)]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. CRUCES CARTOGRÁFICAS DE REGISTRO (+)
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = Math.max(1, toPx(0.3));
    const arm = toPx(3);
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
    let totalKmCalculados = 0;
    featuresActivas.forEach((feat, fIdx) => {
      const p = feat.properties || {};
      const sentido = (p.sentido || p.sentido_ci || 'IDA').toUpperCase();
      const geom = feat.geometry;
      if (!geom || !geom.coordinates) return;
      const lines = geom.type === 'LineString' ? [geom.coordinates] : (geom.type === 'MultiLineString' ? geom.coordinates : []);

      lines.forEach(lineCoords => {
        if (lineCoords.length < 2) return;
        
        // Halo blanco para máxima legibilidad
        ctx.beginPath();
        const startPt = proj.project(lineCoords[0][1], lineCoords[0][0]);
        ctx.moveTo(mapX + startPt.x, mapY + startPt.y);
        for (let i = 1; i < lineCoords.length; i++) {
          const pt = proj.project(lineCoords[i][1], lineCoords[i][0]);
          ctx.lineTo(mapX + pt.x, mapY + pt.y);
        }
        ctx.lineWidth = Math.max(3, toPx(1.8));
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Trazo con color distintivo oficial
        const color = colors[fIdx % colors.length] || '#0284c7';
        ctx.lineWidth = Math.max(1.8, toPx(1.0));
        ctx.strokeStyle = color;
        if (sentido === 'VUELTA') {
          ctx.setLineDash([toPx(3), toPx(2)]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
    });

    // 4. RETÍCULA SEXAGESIMAL DMS
    if (chkReticula) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.15)';
      ctx.lineWidth = Math.max(1, toPx(0.25));
      ctx.setLineDash([toPx(2), toPx(2)]);
      for (let c = 1; c <= 3; c++) {
        const x = mapX + (mapW * c) / 4;
        ctx.beginPath();
        ctx.moveTo(x, mapY); ctx.lineTo(x, mapY + mapH);
        ctx.stroke();
      }
      for (let r = 1; r <= 3; r++) {
        const y = mapY + (mapH * r) / 4;
        ctx.beginPath();
        ctx.moveTo(mapX, y); ctx.lineTo(mapX + mapW, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.restore(); // Fin del clip del mapa

    // Borde técnico del mapa
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, toPx(0.4));
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // 5. ENCABEZADO INSTITUCIONAL OFICIAL
    if (chkCaratula && headerHPx > 0) {
      const hX = frameX, hY = frameY, hW = frameW, hH = headerHPx;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hX, hY, hW, hH);

      // Franja superior celeste Lanús (#00aeef)
      ctx.fillStyle = '#00aeef';
      ctx.fillRect(hX, hY, hW, toPx(1.0));

      // Títulos
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + toPx(spec.headerMm * 0.32) + 'px sans-serif';
      ctx.fillText('MUNICIPALIDAD DE LANÚS · SECRETARÍA DE PLANIFICACIÓN URBANA', hX + toPx(12), hY + hH * 0.45);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 ' + toPx(spec.headerMm * 0.22) + 'px sans-serif';
      ctx.fillText('DIRECCIÓN GENERAL DE MOVILIDAD Y TRANSPORTE · PLANO TÉCNICO OFICIAL', hX + toPx(12), hY + hH * 0.78);

      // Badge formato de lámina
      ctx.fillStyle = '#7b1828';
      ctx.fillRect(hX + hW - toPx(26), hY + toPx(3), toPx(22), hH - toPx(6));
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + toPx(spec.headerMm * 0.35) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fmt, hX + hW - toPx(15), hY + hH * 0.65);
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
      ctx.fillText('SISTEMA INTEGRADO DE TRANSPORTE URBANO · LANÚS', cX + toPx(5), cY + cH * 0.22);

      ctx.font = 'bold ' + toPx(spec.caratureMm * 0.26) + 'px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('LÍNEA ' + lineaActual + ' · TRAZADO OFICIAL', cX + toPx(5), cY + cH * 0.58);

      ctx.font = '600 ' + toPx(spec.caratureMm * 0.14) + 'px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Lanús Oeste · Lanús Este · Valentín Alsina · R. de Escalada · Gerli', cX + toPx(5), cY + cH * 0.85);

      // Divisor
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(cX + col1W, cY); ctx.lineTo(cX + col1W, cY + cH);
      ctx.moveTo(cX + col1W + col2W, cY); ctx.lineTo(cX + col1W + col2W, cY + cH);
      ctx.stroke();

      // Columna 2: Ficha Técnica
      const c2X = cX + col1W + toPx(5);
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
      const c3X = cX + col1W + col2W + toPx(5);
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
      a4Ctx.fillText('EXPEDIENTE TÉCNICO DE TRANSPORTE PÚBLICO · LÍNEA ' + lineaActual + ' · HOJA 2 DE 2 (A4)', a4Margin + toA4Px(6), a4Margin + toA4Px(18));

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
        a4Ctx.fillText('Línea ' + lineaActual + ' - ' + ramal, colX2, yOffset + toA4Px(4));

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
    const filename = 'Plano_Arquitectura_Lanus_Linea_' + lineaActual + '_' + fmt + '.pdf';
    pdf.save(filename);

    const printWin = window.open(pdfBlobUrl, '_blank');
    if (printWin) {
      printWin.onload = () => printWin.print();
    }
  }
`;

if (!html.includes('LANUS_BASE_GEOJSON')) {
  html = html.replace('// Inicio rápido', motorCartograficoJs + '\n  // Inicio rápido');
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('visor_colectivos.html actualizado con éxito con todo el sistema de planos, límites de Lanús y hoja A4.');
