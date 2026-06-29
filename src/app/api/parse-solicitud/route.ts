import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { clipGeometryToLanus } from '@/utils/geo';

// Autotracing logic removed, user will trace manually

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, pdfUrl: directPdfUrl, qrUrl: directQrUrl } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    let finalSelectionText = text;

    // El PDF de devolución es binario y no se puede leer sin librerías nativas.
    // Los recorridos aprobados también están en el link QR (texto plano), que se procesa abajo.
    // Solo registramos la URL del PDF en el contexto para que la IA sepa que existe.
    const resolvedPdfUrl: string | null = directPdfUrl || (() => {
      const pdfFilenameRegex = /Archivo\s+devoluci[oó]n\s*:\s*(\d+_[\w]+\.pdf)/i;
      const m = pdfFilenameRegex.exec(text);
      return m?.[1] ? `https://tramitesweb.lanus.gob.ar/storage/contenido/formularios/devoluciones/${m[1]}` : null;
    })();
    if (resolvedPdfUrl) {
      finalSelectionText = text + `\n\n[PDF de devolución disponible en: ${resolvedPdfUrl}]`;
    }

    // --- LINK QR ---
    // Priority: 1) URL passed directly from bookmarklet DOM extraction
    //           2) URL found in text
    let resolvedQrUrl: string | null = directQrUrl || null;
    if (!resolvedQrUrl) {
      const qrUrlRegex = /https?:\/\/tramitesweb\.lanus\.gob\.ar\/qr\/\d+\/\d+(?!\/img)/gi;
      const qrMatch = finalSelectionText.match(qrUrlRegex);
      if (qrMatch?.[0]) resolvedQrUrl = qrMatch[0];
    }

    if (resolvedQrUrl) {
      try {
        const fetchRes = await fetch(resolvedQrUrl, { headers: { 'User-Agent': 'LanusGIS-Scraper/1.0' } });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const qrText = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          finalSelectionText = finalSelectionText + "\n\n=== CONTENIDO DETECTADO Y SCRAPEADO DEL LINK QR ===\n" + qrText;
        }
      } catch (e: any) {
        console.error("Error scraping TramitesWeb QR:", e.message);
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta configurar la API Key de OpenAI en las variables de entorno' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });
    const prompt = `
Eres un asistente que extrae datos de solicitudes de Permiso de Tránsito Pesado del municipio de Lanús, Argentina.
IMPORTANTE: Devuelve un objeto JSON PLANO (sin anidamiento, sin sub-objetos). Todas las claves deben estar al nivel raíz del objeto.
Las claves del JSON son exactamente:

=== IDENTIFICACIÓN DE LA SOLICITUD ===
- idSolicitudWeb: string — El número de ID web (ej. "58731"). Línea "ID: #XXXXX" o "Detalle de la solicitud #XXXXX". Número corto de 4-6 dígitos. NO confundir con el expediente.
- numeroSolicitud: string — El expediente municipal con formato EXACTO "1000-YYYY-NNNNNN-L" (ej. "1000-2026-962447-B").
    a) Prioridad: campo "Expediente:" del formulario.
    b) Del PDF: "EXTERNO-1000-2026-962447-B-0" → extraer solo "1000-2026-962447-B" (sin prefijo ni sufijo "-0").
- fechaCreacion: string DD/MM/YYYY — Campo "Creación:" del formulario.

=== SOLICITANTE ===
- nombreSolicitante: string — Nombre completo de la persona: "Apellido Solicitante" + " " + "Nombre Solicitante" (ej. "BEUTE CARLOS ALBERTO"). Si solo hay empresa, usar el nombre de la empresa.
- empresaSolicitante: string — Campo "Nombre de la empresa" (ej. "Molino Central Norte SA"). null si no hay empresa.
- cuilCuit: string — Campo "CUIL o CUIT del solicitante" (ej. "20204936979").
- emailSolicitante: string — Campo "correo electronico" (el principal, no el alternativo).
- telefonoSolicitante: string — Campo "telefono" (el principal, no el alternativo).

=== VEHÍCULO ===
- patente: string — Patente del vehículo (ej. "PEY726", "AI 121 OS").
- tipoVehiculo: string — Campo "Tipo de vehículo" (ej. "Tractor con semiremolque").
- pesoToneladas: number — "Capacidad de carga" en toneladas. Convertir: "27.500 kg" → 27.5, "25.000 KG" → 25.
- cargaPeligrosa: boolean — true solo si la carga es explosiva, inflamable, tóxica o peligrosa. false para cargas generales, alimentos, pallets, etc.
- tipoCarga: string — Campo "tipo de carga" tal como está escrito (ej. "Pallets de 50 bolsas de harina").
- largoVehiculo: string — Campo "largo del vehículo" (ej. "18.5 metros").
- anchoVehiculo: string — Campo "Ancho del vehículo" (ej. "2.6 metros").
- alturaVehiculo: string — Campo "Altura del vehículo" (ej. "3.9 metros").
- cantidadEjes: number — Campo "cantidad de ejes" (ej. 5).
- aseguradora: string — Nombre de la aseguradora (ej. "MAPFRE").
- nroSeguro: string — Campo "nro de seguro de carga" (ej. "100-00290653").

=== ORIGEN Y DESTINO ===
- origenDireccion: string — "Calle dirección de origen" + " " + "Número Dirección de Origen" (ej. "Barbieri 1634").
- origenLocalidad: string — "localidad origen" o "otras localidades" de origen (ej. "Burzaco").
- origenPartido: string — "Partido dirección de origen" (ej. "Almirante Brown").
- origenNombre: string — "Nombre de lugar de salida" (ej. "Molino Central Norte SA").
- destinoDireccion: string — "Calle dirección de destino" + " " + "Número Dirección de Destino" (ej. "9 de julio 2960").
- destinoLocalidad: string — "Localidad destino" o "otras localidades destino" (ej. "Lanús Este").
- destinoPartido: string — "Partido dirección de destino" (ej. "Lanús").
- destinoNombre: string — "Nombre de lugar de destino" (ej. "Martin Axi").

=== CIRCULACIÓN ===
- frecuencia: string — "Frecuencia de Circulación" (ej. "semanal", "3 VECES POR SEMANA").
- horario: string — "Horarios de circulación" (ej. "7 a 15 hs").
- observaciones: string — "Observaciones Web". null si está vacío.

=== VIGENCIA ===
- vigenciaDesde: string DD/MM/YYYY — Fecha de inicio. Buscar en el PDF "a partir de la fecha DD/MM/YYYY" o campo "Publicación:".
- vigenciaHasta: string DD/MM/YYYY — Campo "Vigencia hasta:" del formulario.

=== RECORRIDOS ===
- recorridos: array de objetos con { descripcion: string, calles: string[] }.

=== REGLA DE PRIORIZACIÓN DE RECORRIDOS ===
Usá la primera fuente disponible, en este orden:

1. PDF DE DEVOLUCIÓN (sección "=== CONTENIDO EXTRAÍDO DEL PDF DE DEVOLUCIÓN ==="):
   - El PDF es una Resolución Municipal con líneas tipo: "Recorrido 1: Av. X – Calle Y – Av. Z."
   - Las calles están separadas por guiones largos (–) o guiones medios (-).
   - Cada "Recorrido N:" es un objeto separado en el array.
   - Ignorar completamente los recorridos escritos del formulario.

2. LINK QR SCRAPEADO (sección "=== CONTENIDO DETECTADO Y SCRAPEADO DEL LINK QR ==="):
   - Buscar el texto "Recorrido aprobado: Recorrido 1: X – Y. Recorrido 2: A – B."
   - Separar por recorrido numerado. Cada uno es un objeto en el array.
   - Ignorar completamente los recorridos escritos del formulario.

3. RECORRIDOS NARRATIVOS DEL FORMULARIO (solo si no hay PDF ni QR con recorridos aprobados):
   - Leer los campos "recorrido escrito 1", "recorrido escrito 2", etc.
   - Cada bloque INGRESO→DESTINO→EGRESO es un trayecto. Si un campo tiene DOS bloques (dos DESTINO separados), crear DOS objetos en el array.
   - Leer las líneas en orden cronológico e identificar la calle principal de cada línea.

=== CÓMO ARMAR EL ARRAY calles ===
- Incluir TODAS las calles en orden, de inicio a fin del recorrido.
- Una calle por elemento del array.
- Limpiar y corregir ortografía:
  - "Hypolito Yrigoyen" / "YrigoyeN" → "Av. Hipólito Yrigoyen"
  - "int manuel quindimil" / "Int. Manuel Quindimil" → "Int. Manuel Quindimil"
  - "hector noya" / "Concejal H. Noya" → "Héctor Noya"
  - "Remedios de Escalada de Sna Martin" / "Remedios de Escalada" → "Av. Remedios de Escalada de San Martín"
  - "Av. San Martin" / "San Martin" → "Av. San Martín"
  - "Av. 9 de julio" / "Av. 9 de Julio" → "Av. 9 de Julio"
  - "Centenario Uruguayo" → "Av. Centenario Uruguayo"
  - "Fray Lagos" / "Fray J. Lagos" → "Fray J. Lagos"
  - "Presbitero Pedro F. Uriarte" → "Av. Presbitero Pedro F. Uriarte"
  - "Presbitero José Malabia" → "Presbitero José Malabia"

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

    // Normalize: sometimes gpt-4o-mini returns nested objects keyed by section headers
    // e.g. { "SOLICITANTE": { "nombreSolicitante": "..." }, ... }
    // Flatten all nested objects into the top level.
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

    // Normalize numeroSolicitud: strip "EXTERNO-" prefix and trailing "-0"
    if (extractedData.numeroSolicitud) {
      let exp: string = extractedData.numeroSolicitud.trim();
      exp = exp.replace(/^EXTERNO-/i, '');
      exp = exp.replace(/-0+$/, '');
      extractedData.numeroSolicitud = exp;
    }

    const datosGeo = null;
    
    return NextResponse.json({
      // Identificación
      numeroSolicitud: extractedData.numeroSolicitud,
      idSolicitudWeb: extractedData.idSolicitudWeb,
      fechaCreacion: extractedData.fechaCreacion,
      // Solicitante
      nombreSolicitante: extractedData.nombreSolicitante,
      empresaSolicitante: extractedData.empresaSolicitante,
      cuilCuit: extractedData.cuilCuit,
      emailSolicitante: extractedData.emailSolicitante,
      telefonoSolicitante: extractedData.telefonoSolicitante,
      // Vehículo
      patente: extractedData.patente,
      tipoVehiculo: extractedData.tipoVehiculo,
      pesoToneladas: extractedData.pesoToneladas,
      cargaPeligrosa: extractedData.cargaPeligrosa,
      tipoCarga: extractedData.tipoCarga,
      largoVehiculo: extractedData.largoVehiculo,
      anchoVehiculo: extractedData.anchoVehiculo,
      alturaVehiculo: extractedData.alturaVehiculo,
      cantidadEjes: extractedData.cantidadEjes,
      aseguradora: extractedData.aseguradora,
      nroSeguro: extractedData.nroSeguro,
      // Origen / destino
      origenDireccion: extractedData.origenDireccion,
      origenLocalidad: extractedData.origenLocalidad,
      origenPartido: extractedData.origenPartido,
      origenNombre: extractedData.origenNombre,
      destinoDireccion: extractedData.destinoDireccion,
      destinoLocalidad: extractedData.destinoLocalidad,
      destinoPartido: extractedData.destinoPartido,
      destinoNombre: extractedData.destinoNombre,
      // Circulación
      frecuencia: extractedData.frecuencia,
      horario: extractedData.horario,
      observaciones: extractedData.observaciones,
      // Vigencia
      vigenciaDesde: extractedData.vigenciaDesde,
      vigenciaHasta: extractedData.vigenciaHasta,
      // Recorridos
      calles: extractedData.recorridos ? extractedData.recorridos.map((r: any) => r.calles.join(' - ')).join(' | ') : '',
      recorridosEscritos: extractedData.recorridos ? extractedData.recorridos.map((r: any) => r.calles.join(' - ')) : [],
      recorridosDetalle: extractedData.recorridos || [],
      archivosAdjuntos: [],
      datosGeo: datosGeo,
      message: 'Datos extraídos con éxito'
    });

  } catch (error: any) {
    console.error('Error in parse-solicitud API:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
