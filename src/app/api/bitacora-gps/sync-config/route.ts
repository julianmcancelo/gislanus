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
    syncEndpoint: `${baseUrl}/api/bitacora-gps`,
    documentation: 'Sincronización bidireccional y recepción de relevamientos GPS móviles.',
    supportedFormats: ['application/json', 'application/geo+json', 'multipart/form-data'],
    features: {
      gpsTracking: true,
      stopDetection: true,
      incidentReporting: true,
      lanusClipping: true,
      officialTracePromotion: true,
    },
  });
}
