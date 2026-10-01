import { MercatorViewportProjection, LatLng } from '../src/utils/cartographicProjection';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

function assertCloseTo(actual: number, expected: number, tolerance: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.error(`❌ FAILED: ${message} - esperado ${expected}, obtenido ${actual} (diff: ${diff})`);
    process.exit(1);
  }
}

console.log('--- TEST 1: 4 Esquinas de Lanús con Padding 0 (Coincidencia Exacta de Límites) ---');
{
  const corners: LatLng[] = [
    { lat: -34.70, lng: -58.40 }, // Noroeste (Top-Left)
    { lat: -34.70, lng: -58.38 }, // Noreste (Top-Right)
    { lat: -34.72, lng: -58.40 }, // Suroeste (Bottom-Left)
    { lat: -34.72, lng: -58.38 }, // Sureste (Bottom-Right)
  ];

  // Calculamos el ratio natural en coordenadas de mundo
  const minWorldX = MercatorViewportProjection.lngToWorldX(-58.40);
  const maxWorldX = MercatorViewportProjection.lngToWorldX(-58.38);
  const minWorldY = MercatorViewportProjection.latToWorldY(-34.70); // Norte es menor Y
  const maxWorldY = MercatorViewportProjection.latToWorldY(-34.72); // Sur es mayor Y

  const naturalWidth = 1000;
  const naturalHeight = naturalWidth / ((maxWorldX - minWorldX) / (maxWorldY - minWorldY));

  const proj = new MercatorViewportProjection(corners, naturalWidth, naturalHeight, 0);

  const topLeft = proj.project(-34.70, -58.40);
  const topRight = proj.project(-34.70, -58.38);
  const bottomLeft = proj.project(-34.72, -58.40);
  const bottomRight = proj.project(-34.72, -58.38);

  console.log('Top-Left:', topLeft);
  console.log('Bottom-Right:', bottomRight);

  assertCloseTo(topLeft.x, 0, 1e-4, 'Top-Left X debe ser exactamente 0');
  assertCloseTo(topLeft.y, 0, 1e-4, 'Top-Left Y debe ser exactamente 0');
  assertCloseTo(topRight.x, naturalWidth, 1e-4, 'Top-Right X debe ser naturalWidth');
  assertCloseTo(topRight.y, 0, 1e-4, 'Top-Right Y debe ser 0');
  assertCloseTo(bottomLeft.x, 0, 1e-4, 'Bottom-Left X debe ser 0');
  assertCloseTo(bottomLeft.y, naturalHeight, 1e-4, 'Bottom-Left Y debe ser naturalHeight');
  assertCloseTo(bottomRight.x, naturalWidth, 1e-4, 'Bottom-Right X debe ser naturalWidth');
  assertCloseTo(bottomRight.y, naturalHeight, 1e-4, 'Bottom-Right Y debe ser naturalHeight');
  console.log('✅ TEST 1 PASÓ: Mapeo exacto de las 4 esquinas de Lanús sin deformación');
}

console.log('\n--- TEST 2: Preservación Isométrica en Viewport Desigual (A4 Landscape: 297 x 210) ---');
{
  const corners: LatLng[] = [
    { lat: -34.70, lng: -58.40 },
    { lat: -34.72, lng: -58.38 },
  ];

  const width = 1200;
  const height = 800; // Aspect ratio 1.5

  const proj = new MercatorViewportProjection(corners, width, height, 0.08);

  // Escala en X y escala en Y deben ser matemáticamente idénticas
  const scaleX = width / proj.spanX;
  const scaleY = height / proj.spanY;
  assertCloseTo(scaleX, scaleY, 1e-8, 'Escala X e Y deben ser rigurosamente idénticas (Isometría 1:1)');

  // El centro de los datos debe proyectarse exactamente al centro del viewport
  const centerWorldX = (MercatorViewportProjection.lngToWorldX(-58.40) + MercatorViewportProjection.lngToWorldX(-58.38)) / 2;
  const centerWorldY = (MercatorViewportProjection.latToWorldY(-34.70) + MercatorViewportProjection.latToWorldY(-34.72)) / 2;
  const centerLat = MercatorViewportProjection.worldYToLat(centerWorldY);
  const centerLng = MercatorViewportProjection.worldXToLng(centerWorldX);

  const centerPixel = proj.project(centerLat, centerLng);
  assertCloseTo(centerPixel.x, width / 2, 0.05, 'Centro X debe ser exactamente el centro del viewport');
  assertCloseTo(centerPixel.y, height / 2, 0.05, 'Centro Y debe ser exactamente el centro del viewport');

  console.log('✅ TEST 2 PASÓ: Escala 1:1 idéntica en X e Y, y centrado isométrico perfecto');
}

console.log('\n--- TEST 3: Generación de Mapbox Static URL y Escalímetro ---');
{
  const points: LatLng[] = [
    { lat: -34.7045, lng: -58.3912 },
    { lat: -34.7180, lng: -58.3820 },
  ];
  const proj = new MercatorViewportProjection(points, 800, 600, 0.08);
  const { url, requestWidth, requestHeight } = proj.getMapboxStaticUrl('pk.test_token', 'streets-v12', true);

  assert(url.includes('streets-v12'), 'URL debe contener streets-v12');
  assert(url.includes('access_token=pk.test_token'), 'URL debe incluir el token');
  assert(url.includes('@2x'), 'URL debe incluir @2x');
  assert(requestWidth === 800 && requestHeight === 600, 'Dimensiones deben coincidir');

  const scaleBar = proj.getCartographicScaleBar();
  console.log('Escala Gráfica calculada:', scaleBar);
  assert(scaleBar.widthPx > 0 && scaleBar.meters > 0, 'La escala gráfica debe ser válida');

  console.log('✅ TEST 3 PASÓ: Mapbox URL y Escala Gráfica generadas correctamente');
}

console.log('\n🎉 TODOS LOS TESTS DEL MOTOR DE PROYECCIÓN CARTOGRÁFICA PASARON EXITOSAMENTE!');
