require('dotenv').config();
const { OpenAI } = require('openai');

const text = `
Solicitud de Permiso para Circular Fuera de la Red de Tránsito Pesado > Formulario
Solicitudes
Detalle de la solicitud #60308
ID: #60308
Nombre Solicitante (*)
VICTORIO DANIEL PALMINTERI
Calle dirección de origen recorrido (*)
Planta industrial
Número Dirección de Origen (*)
Ruta 24
provincia origen (*)
Buenos Aires
localidad origen (*)
La Reja
Partido dirección de origen (*)
General Rodríguez
Calle dirección de destino recorrido (*)
AVENIDA INTENDENTE MANUEL QUINDIMIL
Número Dirección de Destino (*)
963
Localidad destino (*)
Lanús Oeste
recorrido escrito 1 (*)
Ruta 24 Acceso oeste, autopista 25 de mayo, 9 de julio sur, Hipólito Yrigoyen, intendente Manuel quindimil fray j. Lagos 1565
`;

async function test() {
  const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });
  const prompt = `
Eres un asistente que extrae datos de solicitudes de tránsito pesado.
Extrae en JSON:
- numeroSolicitud (string)
- nombreSolicitante (string)
- puntosRuta (array de strings): Direcciones ordenadas para el ruteo. Origen, waypoints intermedios, Destino.

Texto: ${text}
`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Devuelve únicamente JSON." },
      { role: "user", content: prompt }
    ]
  });
  console.log(completion.choices[0].message.content);
}
test();
