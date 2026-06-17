# Sistema de Información Geográfica - Lanús

Bienvenido al repositorio del **Sistema de Información Geográfica (GIS)** desarrollado para el Municipio de Lanús.

Este proyecto fue concebido con el objetivo fundamental de centralizar y visualizar de manera interactiva toda la información geográfica y urbana del partido. Desde la disposición de escuelas y la red de semáforos, hasta la demarcación de rutas exclusivas de transporte pesado y los límites jurisdiccionales, la plataforma está diseñada para facilitar la gestión territorial y el análisis estratégico de nuestra ciudad.

---

## Características Principales

**Visor de Mapas Interactivo**
Implementado sobre React Leaflet, ofrece controles personalizados, alternancia de capas base y un diseño limpio centrado en la usabilidad del operador.

**Gestión Dinámica de Capas**
- Organización jerárquica mediante Grupos y Subgrupos (ej. Educación > Escuelas Públicas).
- Importación nativa y conversión automatizada de formatos geográficos estándar (KML/KMZ a GeoJSON).
- Renderizado de marcadores personalizados con iconografía dinámica según la categoría de la capa.

**Geocodificación Inteligente**
Integración directa con la API de Normalización de Direcciones de **USIG** (Gobierno de la Ciudad de Buenos Aires), garantizando una resolución precisa de intersecciones dentro del AMBA, respaldado por un sistema de redundancia utilizando **Nominatim (OpenStreetMap)**.

**Procesamiento de Datos Automatizado**
Implementación de rutinas de extracción asistidas por Inteligencia Artificial (**OpenAI GPT-4o-mini**). Estos procesos limpian, estructuran y geocodifican grandes volúmenes de datos provenientes de planillas desestructuradas, reduciendo significativamente la carga manual.

**Panel de Administración**
Un centro de control integral para operar el sistema. Permite la creación, edición, reordenamiento y eliminación de entidades geográficas e infraestructuras en tiempo real.

---

## Arquitectura y Tecnologías

El sistema está construido sobre una base tecnológica moderna que asegura escalabilidad, velocidad y facilidad de mantenimiento.

- **Frontend:** Next.js 14 (App Router), React, TypeScript.
- **Mapas:** React Leaflet apoyado sobre el motor de renderizado de OpenStreetMap.
- **Estilización:** CSS Modules combinados con utilidades modernas para una interfaz limpia y responsiva.
- **Backend y Almacenamiento:** Prisma ORM operando sobre SQLite en el entorno de desarrollo (fácilmente escalable a PostgreSQL para producción), acoplado con Next.js API Routes.
- **Automatización:** Scripts dedicados en Node.js y TypeScript para el procesamiento pesado de información geográfica.

---

## Despliegue Local

Para clonar el repositorio e iniciar el entorno de desarrollo local, siga las siguientes instrucciones:

1. **Obtener el código fuente:**
   ```bash
   git clone https://github.com/julianmcancelo/gislanus.git
   cd gislanus
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar el entorno:**
   Cree un archivo `.env` en la raíz del proyecto. Defina la ruta de su base de datos local y, si planea ejecutar los scripts de importación con IA, su clave de acceso.
   ```env
   DATABASE_URL="file:./dev.db"
   VITE_OPENAI_API_KEY="su_clave_api_aqui"
   ```

4. **Inicializar la estructura de datos:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Opcional: ejecute `node scripts/seed-grupos.mjs` para establecer las categorías fundamentales).*

5. **Iniciar el servidor:**
   ```bash
   npm run dev
   ```

El sistema estará disponible en `http://localhost:3000`. Puede acceder al panel de administración navegando hacia la ruta `/admin`.

---

## Evolución del Sistema

El proyecto se encuentra en constante iteración. Los próximos horizontes de desarrollo incluyen:

- Optimización del pipeline de renderizado para capas GeoJSON de alta densidad.
- Implementación de un módulo de seguridad y autenticación para el panel de administración.
- Incorporación de proveedores de mapas satelitales y topográficos.
- Herramientas de edición poligonal in-situ directamente sobre el visor web.
