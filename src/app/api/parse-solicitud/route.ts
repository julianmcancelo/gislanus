import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta configurar la API Key de OpenAI en las variables de entorno' }, { status: 500 });
    }
    const openai = new OpenAI({ apiKey });
    const prompt = `
Eres un asistente experto que extrae datos de solicitudes de tránsito pesado para la Municipalidad de Lanús. 
El texto copiado suele tener el formato donde el nombre del campo está en una línea y el valor está en la línea de abajo o separada por espacios/saltos de línea.

Extrae la siguiente información en formato JSON siguiendo estas reglas precisas:
- numeroSolicitud (string, busca 'Expediente: ' ej. '1000-2026-964794-O', si no está, usa el ID de solicitud sin el #)
- nombreSolicitante (string, busca debajo de 'Nombre de la empresa (*)' o 'Nombre de la empresa', sino debajo de 'Nombre Solicitante')
- patente (string, busca debajo de "Patente (*)" o "Patente". Ten cuidado, el valor puede estar en la línea siguiente y puede contener espacios, ej: 'AI 121 OS' o 'AB123CD')
- tipoVehiculo (string, busca debajo de "Tipo de vehículo (*)" o "Tipo de vehículo", ej: 'TRACTOR CON CABINA DORMITORIO')
- pesoToneladas (number, busca debajo de 'capacidad de carga (*)', 'Peso Total' o 'Toneladas'. Si el valor es '25.000 KG', conviértelo a 25. Si es '35 Tn', conviértelo a 35)
- cargaPeligrosa (boolean, busca debajo de 'tipo de carga (*)'. Si dice 'CARGAS GENERALES' es false. Si dice algo peligroso es true)
- idSolicitudWeb (string, busca 'ID: #' y extrae solo el número, ej: '61674')
- vigenciaDesde (string, busca la fecha de 'Creación:' o 'Publicación:')
- vigenciaHasta (string, busca la fecha en 'Vigencia hasta:')
- aseguradora (string, busca debajo de 'aseguradora' o 'Aseguradora')
- nroSeguro (string, busca debajo de 'nro de seguro de carga' o 'Póliza')

Texto de la solicitud:
${text}
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
    
    const extractedData = JSON.parse(resultString);
    
    return NextResponse.json({
      numeroSolicitud: extractedData.numeroSolicitud,
      nombreSolicitante: extractedData.nombreSolicitante,
      patente: extractedData.patente,
      tipoVehiculo: extractedData.tipoVehiculo,
      pesoToneladas: extractedData.pesoToneladas,
      cargaPeligrosa: extractedData.cargaPeligrosa,
      idSolicitudWeb: extractedData.idSolicitudWeb,
      vigenciaDesde: extractedData.vigenciaDesde,
      vigenciaHasta: extractedData.vigenciaHasta,
      aseguradora: extractedData.aseguradora,
      nroSeguro: extractedData.nroSeguro,
      calles: [],
      recorridosEscritos: [],
      archivosAdjuntos: [],
      datosGeo: null,
      message: 'Datos extraídos con éxito'
    });

  } catch (error: any) {
    console.error('Error in parse-solicitud API:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
