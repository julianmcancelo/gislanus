import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const host = req.headers.get('host') || 'lanusgis-ca546.web.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  return NextResponse.json({
    status: 'online',
    appName: 'Lanús Digital — Servidor GIS',
    version: '1.0.0',
    targetApp: 'BusTrackerGPS',
    currentRelease: 'v1.0.23',
    apkDownloadUrl: 'https://github.com/julianmcancelo/BusTrackerGPS/releases/download/v1.0.23/BitacoraGPS-v1.0.23.apk',
    releaseTagUrl: 'https://github.com/julianmcancelo/BusTrackerGPS/releases/tag/v1.0.23',
    syncEndpoint: `${baseUrl}/api/bitacora-gps`,
    localNetworkEndpoint: 'http://192.168.0.229:3000/api/bitacora-gps',
    documentation: 'Sincronización directa sin login para relevamientos de campo de colectivos en Lanús.',
    supportedFormats: ['application/json', 'application/geo+json', 'multipart/form-data'],
    features: {
      gpsTracking: true,
      stopDetection: true,
      incidentReporting: true,
      lanusClipping: true,
      officialTracePromotion: true,
      kalmanFilter2D: true,
      snapToRoads: true,
    },
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
