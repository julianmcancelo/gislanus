# 🗺️ GIS Lanús - Sistema de Información Geográfica

¡Hola! Bienvenido al repositorio del **Sistema de Información Geográfica (GIS)** que estoy desarrollando para el Municipio de Lanús. 

Este proyecto nació con la idea de centralizar y visualizar de manera interactiva toda la información geográfica y urbana del partido. Desde visualizar escuelas y semáforos, hasta demarcar rutas de transporte pesado y los propios límites del municipio, todo pensado para facilitar la gestión y el análisis de nuestra ciudad.

## 🚀 Características Principales

- **Visor de Mapas Interactivo:** Implementado con React Leaflet, con controles personalizados, capas base intercambiables y un diseño limpio.
- **Gestión Dinámica de Capas:** 
  - Organización por Grupos y Subgrupos (ej: Educación > Escuelas Públicas).
  - Importación y conversión automática de archivos KML/KMZ a GeoJSON.
  - Generación de marcadores personalizados con íconos dinámicos basados en la capa.
- **Geocodificación Inteligente:** Integración con la **API de USIG** (Gobierno de la Ciudad de Buenos Aires) para un parseo perfecto de intersecciones en el AMBA, respaldado por un fallback a **Nominatim (OpenStreetMap)**.
- **Procesamiento de Datos con IA:** Scripts en Node.js que utilizan **OpenAI (GPT-4o-mini)** para limpiar y extraer direcciones de planillas de Excel desestructuradas y automatizar la carga de coordenadas.
- **Panel de Administración:** Un dashboard dedicado para crear, editar, reordenar y eliminar grupos, subgrupos y capas geográficas.
- **Rutas Especiales:** Visualización dedicada para Transporte Pesado y límites jurisdiccionales.

## 🛠️ Stack Tecnológico

Elegí herramientas modernas y eficientes para garantizar que la plataforma sea rápida, escalable y fácil de mantener:

- **Frontend:** [Next.js 14](https://nextjs.org/) (App Router), React, TypeScript.
- **Estilos:** CSS Modules y utilidades modernas para una UI responsiva y amigable.
- **Mapas:** [React Leaflet](https://react-leaflet.js.org/) (Leaflet.js) con integraciones de [OpenStreetMap](https://www.openstreetmap.org/).
- **Backend & Base de Datos:** [Prisma ORM](https://www.prisma.io/) con SQLite (configurable para PostgreSQL en producción) y Next.js API Routes.
- **Procesamiento de Datos:** Scripts con TypeScript, `xlsx`, `@tmcw/togeojson` y el SDK de OpenAI.

## ⚙️ Cómo levantar el proyecto

Si querés clonar el repo y probarlo localmente, seguí estos pasos:

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/julianmcancelo/gislanus.git
   cd gislanus
   ```

2. **Instalar las dependencias:**
   ```bash
   npm install
   ```

3. **Configurar las variables de entorno:**
   Creá un archivo `.env` en la raíz del proyecto. Vas a necesitar definir la URL de la base de datos y tu clave de OpenAI (si querés correr los scripts de importación).
   ```env
   DATABASE_URL="file:./dev.db"
   VITE_OPENAI_API_KEY="tu-api-key-aca"
   ```

4. **Inicializar la Base de Datos:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Opcional: podés correr `node scripts/seed-grupos.mjs` para cargar algunos grupos por defecto).*

5. **Correr el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

6. **Listo!** Abrí [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación funcionando. El panel de administración está en `/admin`.

## 📜 Próximos Pasos y Mejoras

Siempre hay espacio para seguir creciendo. Algunas de las cosas que tengo en mente para el futuro:
- [ ] Optimizar la carga masiva de archivos GeoJSON pesados.
- [ ] Integrar sistema de autenticación para el panel de administración.
- [ ] Sumar más capas base (Satelital, Terreno, etc).
- [ ] Permitir edición de polígonos directamente desde el mapa.

---
*Hecho con ❤️ para mejorar Lanús.*
