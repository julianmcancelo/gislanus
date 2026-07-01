import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';
import OpenAI from 'openai';
import { clipGeometryToLanus } from '@/utils/geo';
import * as pdfParseModule from 'pdf-parse';
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (pdfParseModule as any).default ?? pdfParseModule;

async function queryUrl(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'LanusGIS/1.0' } });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
}

async function geocodeIntersection(streetA: string, streetB: string) {
  const usigUrl = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(streetA + ' y ' + streetB + ', Lanus')}&geocodificar=true`;
  try {
    const data = await queryUrl(usigUrl);
    if (data.direccionesNormalizadas && data.direccionesNormalizadas.length > 0) {
      const match = data.direccionesNormalizadas[0];
      if (match.coordenadas && match.coordenadas.x && match.coordenadas.y) {
        return { lat: match.coordenadas.y, lng: match.coordenadas.x };
      }
    }
  } catch (e) {}

  const georefUrl = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(streetA + ' y ' + streetB)}&departamento=Lanus`;
  try {
    const data = await queryUrl(georefUrl);
    if (data.direcciones && data.direcciones.length > 0) {
      const match = data.direcciones[0];
      if (match.ubicacion && match.ubicacion.lat && match.ubicacion.lon) {
        return { lat: match.ubicacion.lat, lng: match.ubicacion.lon };
      }
    }
  } catch (e) {}

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(streetA + ' & ' + streetB + ', Lanus, Buenos Aires, Argentina')}&format=json&limit=1`;
  try {
    const data = await queryUrl(nominatimUrl);
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {}

  return null;
}

async function buildRouteForStreets(streets: string[], index: number, description?: string) {
  const waypoints: { lat: number; lng: number }[] = [];
  
  for (let i = 0; i < streets.length - 1; i++) {
    const streetA = streets[i].trim();
    const streetB = streets[i+1].trim();
    if (!streetA || !streetB) continue;
    const coords = await geocodeIntersection(streetA, streetB);
    if (coords) waypoints.push(coords);
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  if (waypoints.length < 2) return null;

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints.map(w => `${w.lng},${w.lat}`).join(';')}?overview=full&geometries=geojson`;
  try {
    const routeData = await queryUrl(osrmUrl);
    if (routeData.routes && routeData.routes.length > 0) {
      const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
      const color = colors[index % colors.length];
      
      return {
        type: "Feature",
        properties: {
          name: description || `Recorrido ${index + 1}`,
          streets: streets.join(' - '),
          color: color,
          originalIndex: index
        },
        geometry: clipGeometryToLanus(routeData.routes[0].geometry)
      };
    }
  } catch (e) {}
  return null;
}

export async function POST(req: Request) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const { cookie, formularioId = '160', estado = 'archivadas' } = await req.json();

    if (!cookie) {
      return NextResponse.json({ error: 'Cookie de sesión es requerida' }, { status: 400 });
    }

    const listUrl = `https://tramitesweb.lanus.gob.ar/admin/tramites/formularios/${formularioId}/solicitudes?estado=${estado}`;
    
    // Fetch the list of solicitudes
    const listRes = await fetch(listUrl, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });

    if (!listRes.ok) {
      return NextResponse.json({ error: `Error al acceder a la lista en TramitesWeb: HTTP ${listRes.status}` }, { status: 500 });
    }

    const listHtml = await listRes.text();

    // Extract links to individual solicitudes
    // Match href="/admin/tramites/formularios/160/solicitud/XXXXX" or similar
    const hrefRegex = /href=["']([^"']*(?:solicitud|solicitudes)\/(\d+)[^"']*)["']/gi;
    const uniqueLinks = new Map<string, string>(); // idSolicitudWeb -> href
    
    let match;
    while ((match = hrefRegex.exec(listHtml)) !== null) {
      const href = match[1];
      const id = match[2];
      
      // Evitar links de la lista principal o paginación que tengan "solicitudes" sin id de detalle
      if (href.endsWith('/solicitudes') || href.includes('?')) continue;
      
      uniqueLinks.set(id, href);
    }

    if (uniqueLinks.size === 0) {
      return NextResponse.json({
        message: 'No se encontraron enlaces a solicitudes en la página.',
        totalFound: 0,
        imported: [],
        skipped: [],
        errors: []
      });
    }

    const importedIds: string[] = [];
    const skippedIds: string[] = [];
    const errors: { id: string; error: string }[] = [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta configurar la API Key de OpenAI (OPENAI_API_KEY)' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });

    // Process each link (limited to first 25 to avoid timeout or rate limit issues)
    const listToProcess = Array.from(uniqueLinks.entries()).slice(0, 25);

    for (const [idWeb, rawHref] of listToProcess) {
      try {
        // Check if already exists
        const existing = await prisma.rutaTransporte.findFirst({
          where: { idSolicitudWeb: idWeb }
        });

        if (existing) {
          skippedIds.push(idWeb);
          continue;
        }

        const href = rawHref.startsWith('http') ? rawHref : `https://tramitesweb.lanus.gob.ar${rawHref}`;
        
        // Fetch detail page
        const detailRes = await fetch(href, {
          headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          }
        });

        if (!detailRes.ok) {
          errors.push({ id: idWeb, error: `HTTP ${detailRes.status} al buscar detalle` });
          continue;
        }

        const detailHtml = await detailRes.text();

        // Extract PDF and QR urls from the HTML
        const pdfFilenameRegex = /Archivo\s+devoluci[oó]n\s*:\s*([\w\-]+\.pdf)/i;
        const pdfMatch = pdfFilenameRegex.exec(detailHtml);
        const resolvedPdfUrl = pdfMatch?.[1] ? `https://tramitesweb.lanus.gob.ar/storage/contenido/formularios/devoluciones/${pdfMatch[1]}` : null;

        const qrUrlRegex = /https?:\/\/tramitesweb\.lanus\.gob\.ar\/qr\/\d+\/\d+(?!\/img)/gi;
        const qrMatch = detailHtml.match(qrUrlRegex);
        const resolvedQrUrl = qrMatch?.[0] || null;

        // Clean HTML to text
        let cleanText = detailHtml
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/(?:p|div|td|th|li|tr|h[1-6]|label|span)>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#\d+;/g, ' ')
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0)
          .join('\n');

        let finalSelectionText = `Detalle de la solicitud #${idWeb}\n\n` + cleanText;

        // Fetch PDF if available
        if (resolvedPdfUrl) {
          try {
            const pdfRes = await fetch(resolvedPdfUrl, {
              headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
              }
            });
            if (pdfRes.ok) {
              const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
              const parsed = await pdfParse(pdfBuffer);
              const pdfText = parsed.text
                .split('\n')
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0)
                .join('\n');
              finalSelectionText += `\n\n=== CONTENIDO EXTRAÍDO DEL PDF DE DEVOLUCIÓN (${resolvedPdfUrl}) ===\n${pdfText}`;
            }
          } catch (e: any) {
            console.error(`Error reading PDF for ${idWeb}:`, e.message);
          }
        }

        // Fetch QR if available
        if (resolvedQrUrl) {
          try {
            const qrRes = await fetch(resolvedQrUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
              }
            });
            if (qrRes.ok) {
              const html = await qrRes.text();
              const qrText = html
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(?:p|div|td|th|li|tr|h[1-6]|label|span)>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .split('\n')
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0)
                .join('\n');
              finalSelectionText += "\n\n=== CONTENIDO SCRAPEADO DEL LINK QR (tramitesweb.lanus.gob.ar) ===\n" + qrText;
            }
          } catch (e: any) {
            console.error(`Error fetching QR for ${idWeb}:`, e.message);
          }
        }

        // Run OpenAI parser
        const prompt = `
Eres un asistente que extrae datos de solicitudes de Permiso de Tránsito Pesado del municipio de Lanús, Argentina.
IMPORTANTE: Devuelve un objeto JSON PLANO (sin anidamiento, sin sub-objetos). Todas las claves deben estar al nivel raíz del objeto.
Las claves del JSON son exactamente:

=== IDENTIFICACIÓN DE LA SOLICITUD ===
- idSolicitudWeb: string — El número de ID web (ej. "58731"). Línea "ID: #XXXXX" o "Detalle de la solicitud #XXXXX". Número corto de 4-6 dígitos. NO confundir con el expediente.
- numeroSolicitud: string — El expediente municipal con formato EXACTO "1000-YYYY-NNNNNN-L" (ej. "1000-2026-962447-B").
- fechaCreacion: string DD/MM/YYYY — Campo "Creación:" del formulario.

=== SOLICITANTE ===
- nombreSolicitante: string — Nombre completo de la persona: "Apellido Solicitante" + " " + "Nombre Solicitante" (ej. "BEUTE CARLOS ALBERTO"). Si solo hay empresa, usar el nombre de la empresa.
- empresaSolicitante: string — Campo "Nombre de la empresa". null si no hay empresa.
- cuilCuit: string — Campo "CUIL o CUIT del solicitante".
- emailSolicitante: string — Campo "correo electronico" (el principal).
- telefonoSolicitante: string — Campo "telefono" (el principal).

=== VEHÍCULO ===
- patente: string — Patente del vehículo.
- tipoVehiculo: string — Campo "Tipo de vehículo".
- pesoToneladas: number — "Capacidad de carga" en toneladas. Convertir: "27.500 kg" → 27.5.
- cargaPeligrosa: boolean — true solo si la carga es peligrosa.
- tipoCarga: string — Campo "tipo de carga".
- largoVehiculo: string — Campo "largo del vehículo".
- anchoVehiculo: string — Campo "Ancho del vehículo".
- alturaVehiculo: string — Campo "Altura del vehículo".
- cantidadEjes: number — Campo "cantidad de ejes".
- aseguradora: string — Campo "aseguradora".
- nroSeguro: string — Campo "nro de seguro de carga".

=== ORIGEN Y DESTINO ===
- origenDireccion: string — "Calle dirección de origen" + " " + "Número Dirección de Origen".
- origenLocalidad: string — "localidad origen".
- origenPartido: string — "Partido dirección de origen".
- origenNombre: string — "Nombre de lugar de salida".
- destinoDireccion: string — "Calle dirección de destino" + " " + "Número Dirección de Destino".
- destinoLocalidad: string — "Localidad destino".
- destinoPartido: string — "Partido dirección de destino".
- destinoNombre: string — "Nombre de lugar de destino".

=== CIRCULACIÓN ===
- frecuencia: string — "Frecuencia de Circulación".
- horario: string — "Horarios de circulación".
- observaciones: string — "Observaciones Web".

=== VIGENCIA ===
- vigenciaDesde: string DD/MM/YYYY — Fecha de inicio.
- vigenciaHasta: string DD/MM/YYYY — Fecha de fin.

=== RECORRIDOS ===
- recorridos: array de objetos con { descripcion: string, calles: string[] }.

Texto de entrada:
${finalSelectionText}
        `;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Devuelve únicamente JSON con los datos requeridos." },
            { role: "user", content: prompt }
          ]
        });

        const resultString = completion.choices[0].message?.content;
        if (!resultString) throw new Error('OpenAI returned empty response');
        
        let extractedData = JSON.parse(resultString);

        // Normalize nested JSON
        const knownFlatKeys = ['idSolicitudWeb','numeroSolicitud','fechaCreacion','nombreSolicitante',
          'empresaSolicitante','cuilCuit','emailSolicitante','telefonoSolicitante','patente',
          'tipoVehiculo','pesoToneladas','cargaPeligrosa','tipoCarga','largoVehiculo','anchoVehiculo',
          'alturaVehiculo','cantidadEjes','aseguradora','nroSeguro','origenDireccion','origenLocalidad',
          'origenPartido','origenNombre','destinoDireccion','destinoLocalidad','destinoPartido',
          'destinoNombre','frecuencia','horario','observaciones','vigenciaDesde','vigenciaHasta','recorridos'];
        const isNested = Object.keys(extractedData).some(k => !knownFlatKeys.includes(k) && typeof extractedData[k] === 'object' && extractedData[k] !== null && !Array.isArray(extractedData[k]));
        if (isNested) {
          const flat: Record<string, unknown> = {};
          for (const val of Object.values(extractedData)) {
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              Object.assign(flat, val);
            }
          }
          extractedData = flat;
        }

        if (extractedData.numeroSolicitud) {
          let exp: string = extractedData.numeroSolicitud.trim();
          exp = exp.replace(/^EXTERNO-/i, '');
          exp = exp.replace(/-0+$/, '');
          extractedData.numeroSolicitud = exp;
        }

        // Fallback for missing mandatory fields
        const finalNumero = extractedData.numeroSolicitud || `EXP-${idWeb}`;
        const finalNombre = extractedData.nombreSolicitante || 'Desconocido (Importado)';

        // Geocoding
        let datosGeo: any = null;
        if (extractedData.recorridos && Array.isArray(extractedData.recorridos)) {
          const features = [];
          for (let i = 0; i < extractedData.recorridos.length; i++) {
            const r = extractedData.recorridos[i];
            if (r.calles && Array.isArray(r.calles)) {
              const feat = await buildRouteForStreets(r.calles, i, r.descripcion);
              if (feat && feat.geometry) {
                features.push(feat);
              }
            }
          }
          if (features.length > 0) {
            datosGeo = {
              type: "FeatureCollection",
              features: features
            };
          }
        }

        // If no coordinates were geocoded, build a placeholder route at Lanús center
        if (!datosGeo) {
          datosGeo = {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { name: "Traza Importada (Sin geocodificar)", color: "#8B5CF6" },
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [-58.406, -34.701],
                    [-58.396, -34.706]
                  ]
                }
              }
            ]
          };
        }

        // Clip geo
        datosGeo.features = datosGeo.features.map((f: any) => ({
          ...f,
          geometry: clipGeometryToLanus(f.geometry)
        }));

        // Save to DB
        await prisma.rutaTransporte.create({
          data: {
            numeroSolicitud: finalNumero,
            idSolicitudWeb: idWeb,
            fechaCreacion: extractedData.fechaCreacion || null,
            nombreSolicitante: finalNombre,
            empresaSolicitante: extractedData.empresaSolicitante || null,
            cuilCuit: extractedData.cuilCuit || null,
            emailSolicitante: extractedData.emailSolicitante || null,
            telefonoSolicitante: extractedData.telefonoSolicitante || null,
            patente: extractedData.patente || null,
            tipoVehiculo: extractedData.tipoVehiculo || null,
            pesoToneladas: extractedData.pesoToneladas ? parseFloat(extractedData.pesoToneladas) : null,
            cargaPeligrosa: !!extractedData.cargaPeligrosa,
            tipoCarga: extractedData.tipoCarga || null,
            largoVehiculo: extractedData.largoVehiculo || null,
            anchoVehiculo: extractedData.anchoVehiculo || null,
            alturaVehiculo: extractedData.alturaVehiculo || null,
            cantidadEjes: extractedData.cantidadEjes ? parseInt(extractedData.cantidadEjes) : null,
            aseguradora: extractedData.aseguradora || null,
            nroSeguro: extractedData.nroSeguro || null,
            origenDireccion: extractedData.origenDireccion || null,
            origenLocalidad: extractedData.origenLocalidad || null,
            origenPartido: extractedData.origenPartido || null,
            origenNombre: extractedData.origenNombre || null,
            destinoDireccion: extractedData.destinoDireccion || null,
            destinoLocalidad: extractedData.destinoLocalidad || null,
            destinoPartido: extractedData.destinoPartido || null,
            destinoNombre: extractedData.destinoNombre || null,
            frecuencia: extractedData.frecuencia || null,
            horario: extractedData.horario || null,
            observaciones: extractedData.observaciones || null,
            vigenciaDesde: extractedData.vigenciaDesde || null,
            vigenciaHasta: extractedData.vigenciaHasta || null,
            datosGeo: JSON.stringify(datosGeo),
            calles: extractedData.recorridos ? extractedData.recorridos.map((r: any) => r.calles.join(' - ')).join(' | ') : null,
            estado: 'APROBADA', // Como están archivadas las importamos ya aprobadas y activas
            enlaceDocumento: resolvedPdfUrl,
          }
        });

        importedIds.push(idWeb);
      } catch (e: any) {
        console.error(`Error syncing solicitud ${idWeb}:`, e);
        errors.push({ id: idWeb, error: e.message || 'Error desconocido' });
      }
    }

    return NextResponse.json({
      message: 'Sincronización finalizada.',
      totalFound: uniqueLinks.size,
      imported: importedIds,
      skipped: skippedIds,
      errors: errors
    });

  } catch (error: any) {
    console.error('Error in sync-tramites route:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
