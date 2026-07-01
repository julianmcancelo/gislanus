import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/authGuard';
import OpenAI from 'openai';
import * as pdfParseModule from 'pdf-parse';
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (pdfParseModule as any).default ?? pdfParseModule;

/* ─────────────────────────────────────────────────────────
   Helper: Login automático a TramitesWeb (Laravel)
   ───────────────────────────────────────────────────────── */
async function loginToTramitesWeb(email: string, password: string): Promise<string> {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

  // 1. GET /login → obtener CSRF token + cookies iniciales
  const loginPageRes = await fetch('https://tramitesweb.lanus.gob.ar/admin/login', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    redirect: 'manual'
  });

  const loginPageHtml = await loginPageRes.text();
  const setCookiesLogin = loginPageRes.headers.getSetCookie?.() || [];

  // Extraer _token del HTML
  const tokenMatch = loginPageHtml.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error('No se pudo obtener el token CSRF de la página de login de TramitesWeb.');
  const csrfToken = tokenMatch[1];

  // Juntar cookies de la respuesta
  const initialCookies = setCookiesLogin.map(c => c.split(';')[0]).join('; ');

  // Extraer XSRF-TOKEN para el header
  const xsrfMatch = initialCookies.match(/XSRF-TOKEN=([^;]+)/);
  const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : '';

  // 2. POST /login con credenciales
  const formBody = new URLSearchParams({
    _token: csrfToken,
    email: email,
    password: password
  });

  const postLoginRes = await fetch('https://tramitesweb.lanus.gob.ar/admin/login', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': initialCookies,
      'X-XSRF-TOKEN': xsrfToken,
      'Accept': 'text/html',
      'Referer': 'https://tramitesweb.lanus.gob.ar/admin/login',
      'Origin': 'https://tramitesweb.lanus.gob.ar',
    },
    body: formBody.toString(),
    redirect: 'manual' // No seguir el redirect 302 automáticamente
  });

  // Laravel responde 302 si login exitoso, 422/200 si falla
  if (postLoginRes.status !== 302) {
    throw new Error(`Login fallido en TramitesWeb (HTTP ${postLoginRes.status}). Verificá las credenciales.`);
  }

  // Juntar todas las cookies de la respuesta del POST
  const postCookies = postLoginRes.headers.getSetCookie?.() || [];
  const allCookieMap = new Map<string, string>();
  
  // Primero las iniciales
  for (const c of initialCookies.split('; ')) {
    const [key, ...rest] = c.split('=');
    if (key) allCookieMap.set(key.trim(), rest.join('='));
  }
  // Después las del POST (sobreescriben)
  for (const c of postCookies) {
    const cookiePart = c.split(';')[0];
    const [key, ...rest] = cookiePart.split('=');
    if (key) allCookieMap.set(key.trim(), rest.join('='));
  }

  const sessionCookie = Array.from(allCookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  
  if (!sessionCookie.includes('laravel_session')) {
    throw new Error('Login aparentemente exitoso pero no se obtuvo la cookie de sesión de Laravel.');
  }

  return sessionCookie;
}

/* ─────────────────────────────────────────────────────────
   POST handler: Sincronización masiva de TramitesWeb
   ───────────────────────────────────────────────────────── */
export async function POST(req: Request) {
  const guard = await requirePermission(req, 'editarRutas');
  if (guard.error) return guard.error;

  try {
    const body = await req.json();
    const { email, password, formularioId = '160', estado = 'archivadas' } = body;

    // Soportar ambos modos: cookie directa o login con credenciales
    let sessionCookie: string;

    if (body.cookie && body.cookie.trim()) {
      // Modo legacy: cookie pegada manualmente
      sessionCookie = body.cookie.trim();
    } else if (email && password) {
      // Modo nuevo: login automático
      sessionCookie = await loginToTramitesWeb(email, password);
    } else {
      return NextResponse.json({ error: 'Ingresá email y contraseña de TramitesWeb.' }, { status: 400 });
    }

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

    const listUrl = `https://tramitesweb.lanus.gob.ar/admin/tramites/formularios/${formularioId}/solicitudes?estado=${estado}`;
    
    // Fetch the list of solicitudes
    const listRes = await fetch(listUrl, {
      headers: {
        'Cookie': sessionCookie,
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    if (!listRes.ok) {
      return NextResponse.json({ error: `Error al acceder a TramitesWeb: HTTP ${listRes.status}. ¿Las credenciales son correctas?` }, { status: 500 });
    }

    const listHtml = await listRes.text();

    // Verificar que no nos redirigió al login
    if (listHtml.includes('name="_token"') && listHtml.includes('login')) {
      return NextResponse.json({ error: 'La sesión de TramitesWeb expiró o las credenciales son inválidas.' }, { status: 401 });
    }

    // Extract links to individual solicitudes
    const hrefRegex = /href=["']([^"']*(?:solicitud|solicitudes)\/(\d+)[^"']*)["']/gi;
    const uniqueLinks = new Map<string, string>();
    
    let match;
    while ((match = hrefRegex.exec(listHtml)) !== null) {
      const href = match[1];
      const id = match[2];
      if (href.endsWith('/solicitudes') || href.includes('?')) continue;
      uniqueLinks.set(id, href);
    }

    if (uniqueLinks.size === 0) {
      return NextResponse.json({
        message: 'No se encontraron solicitudes en la página.',
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
      return NextResponse.json({ error: 'Falta configurar OPENAI_API_KEY' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });

    // Process each solicitud (limit 30)
    const listToProcess = Array.from(uniqueLinks.entries()).slice(0, 30);

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
          headers: { 'Cookie': sessionCookie, 'User-Agent': UA }
        });

        if (!detailRes.ok) {
          errors.push({ id: idWeb, error: `HTTP ${detailRes.status} al buscar detalle` });
          continue;
        }

        const detailHtml = await detailRes.text();

        // Extract PDF url
        const pdfFilenameRegex = /Archivo\s+devoluci[oó]n\s*:\s*([\w\-]+\.pdf)/i;
        const pdfMatch = pdfFilenameRegex.exec(detailHtml);
        const resolvedPdfUrl = pdfMatch?.[1] ? `https://tramitesweb.lanus.gob.ar/storage/contenido/formularios/devoluciones/${pdfMatch[1]}` : null;

        // Extract QR url
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

        let finalText = `Detalle de la solicitud #${idWeb}\n\n` + cleanText;

        // Fetch PDF if available
        if (resolvedPdfUrl) {
          try {
            const pdfRes = await fetch(resolvedPdfUrl, {
              headers: { 'Cookie': sessionCookie, 'User-Agent': UA }
            });
            if (pdfRes.ok) {
              const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
              const parsed = await pdfParse(pdfBuffer);
              const pdfText = parsed.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0).join('\n');
              finalText += `\n\n=== PDF DE DEVOLUCIÓN ===\n${pdfText}`;
            }
          } catch (e: any) {
            console.error(`Error reading PDF for ${idWeb}:`, e.message);
          }
        }

        // Fetch QR page if available
        if (resolvedQrUrl) {
          try {
            const qrRes = await fetch(resolvedQrUrl, { headers: { 'User-Agent': UA } });
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
                .split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0).join('\n');
              finalText += "\n\n=== CONTENIDO QR ===\n" + qrText;
            }
          } catch (e: any) {
            console.error(`Error fetching QR for ${idWeb}:`, e.message);
          }
        }

        // OpenAI: extraer solo metadatos (sin geocodificación)
        const prompt = `
Eres un asistente que extrae datos de solicitudes de Permiso de Tránsito Pesado del municipio de Lanús, Argentina.
Devuelve un JSON PLANO (sin sub-objetos). Claves exactas:

=== IDENTIFICACIÓN ===
- idSolicitudWeb: string — Número de ID web (ej. "58731").
- numeroSolicitud: string — Expediente municipal "1000-YYYY-NNNNNN-L".
- fechaCreacion: string DD/MM/YYYY.

=== SOLICITANTE ===
- nombreSolicitante: string — Nombre completo.
- empresaSolicitante: string — Nombre de la empresa (null si no hay).
- cuilCuit: string
- emailSolicitante: string
- telefonoSolicitante: string

=== VEHÍCULO ===
- patente: string
- tipoVehiculo: string
- pesoToneladas: number — Convertir kg a toneladas.
- cargaPeligrosa: boolean
- tipoCarga: string
- largoVehiculo: string
- anchoVehiculo: string
- alturaVehiculo: string
- cantidadEjes: number
- aseguradora: string
- nroSeguro: string

=== ORIGEN Y DESTINO ===
- origenDireccion: string
- origenLocalidad: string
- origenPartido: string
- origenNombre: string
- destinoDireccion: string
- destinoLocalidad: string
- destinoPartido: string
- destinoNombre: string

=== CIRCULACIÓN ===
- frecuencia: string
- horario: string
- observaciones: string

=== VIGENCIA ===
- vigenciaDesde: string DD/MM/YYYY
- vigenciaHasta: string DD/MM/YYYY

=== RECORRIDOS ===
- callesTexto: string — Todas las calles del recorrido separadas por " - " en un solo string.

Texto de entrada:
${finalText}
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
        if (!resultString) throw new Error('OpenAI devolvió respuesta vacía');
        
        let data = JSON.parse(resultString);

        // Flatten nested responses
        const knownKeys = ['idSolicitudWeb','numeroSolicitud','fechaCreacion','nombreSolicitante',
          'empresaSolicitante','cuilCuit','emailSolicitante','telefonoSolicitante','patente',
          'tipoVehiculo','pesoToneladas','cargaPeligrosa','tipoCarga','largoVehiculo','anchoVehiculo',
          'alturaVehiculo','cantidadEjes','aseguradora','nroSeguro','origenDireccion','origenLocalidad',
          'origenPartido','origenNombre','destinoDireccion','destinoLocalidad','destinoPartido',
          'destinoNombre','frecuencia','horario','observaciones','vigenciaDesde','vigenciaHasta','callesTexto'];
        const isNested = Object.keys(data).some(k => !knownKeys.includes(k) && typeof data[k] === 'object' && data[k] !== null && !Array.isArray(data[k]));
        if (isNested) {
          const flat: Record<string, unknown> = {};
          for (const val of Object.values(data)) {
            if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(flat, val);
          }
          data = flat;
        }

        // Limpiar expediente
        if (data.numeroSolicitud) {
          let exp: string = data.numeroSolicitud.trim();
          exp = exp.replace(/^EXTERNO-/i, '');
          exp = exp.replace(/-0+$/, '');
          data.numeroSolicitud = exp;
        }

        const finalNumero = data.numeroSolicitud || `EXP-${idWeb}`;
        const finalNombre = data.nombreSolicitante || 'Sin nombre (Importado)';

        // FeatureCollection vacío — el usuario dibujará la ruta desde el wizard
        const emptyGeo = JSON.stringify({ type: "FeatureCollection", features: [] });

        // Save to DB como PENDIENTE (sin trazo)
        await prisma.rutaTransporte.create({
          data: {
            numeroSolicitud: finalNumero,
            idSolicitudWeb: idWeb,
            fechaCreacion: data.fechaCreacion || null,
            nombreSolicitante: finalNombre,
            empresaSolicitante: data.empresaSolicitante || null,
            cuilCuit: data.cuilCuit || null,
            emailSolicitante: data.emailSolicitante || null,
            telefonoSolicitante: data.telefonoSolicitante || null,
            patente: data.patente || null,
            tipoVehiculo: data.tipoVehiculo || null,
            pesoToneladas: data.pesoToneladas ? parseFloat(data.pesoToneladas) : null,
            cargaPeligrosa: !!data.cargaPeligrosa,
            tipoCarga: data.tipoCarga || null,
            largoVehiculo: data.largoVehiculo || null,
            anchoVehiculo: data.anchoVehiculo || null,
            alturaVehiculo: data.alturaVehiculo || null,
            cantidadEjes: data.cantidadEjes ? parseInt(data.cantidadEjes) : null,
            aseguradora: data.aseguradora || null,
            nroSeguro: data.nroSeguro || null,
            origenDireccion: data.origenDireccion || null,
            origenLocalidad: data.origenLocalidad || null,
            origenPartido: data.origenPartido || null,
            origenNombre: data.origenNombre || null,
            destinoDireccion: data.destinoDireccion || null,
            destinoLocalidad: data.destinoLocalidad || null,
            destinoPartido: data.destinoPartido || null,
            destinoNombre: data.destinoNombre || null,
            frecuencia: data.frecuencia || null,
            horario: data.horario || null,
            observaciones: data.observaciones || null,
            vigenciaDesde: data.vigenciaDesde || null,
            vigenciaHasta: data.vigenciaHasta || null,
            calles: data.callesTexto || null,
            datosGeo: emptyGeo, // Sin trazo — el usuario lo dibuja después
            estado: 'PENDIENTE',
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
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
