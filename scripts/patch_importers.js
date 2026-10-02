const fs = require('fs');
const path = require('path');

// 1. Patch src/app/admin/page.tsx
const adminPath = path.join(__dirname, '..', 'src', 'app', 'admin', 'page.tsx');
let adminContent = fs.readFileSync(adminPath, 'utf8');

if (!adminContent.includes("import { parseGeojsonToLines } from '@/utils/parseGeojsonLines';")) {
  adminContent = adminContent.replace(
    "import CloneRutaModal from '../../components/CloneRutaModal';",
    "import CloneRutaModal from '../../components/CloneRutaModal';\nimport { parseGeojsonToLines } from '@/utils/parseGeojsonLines';"
  );
}

// Replace the line import parser in admin
const searchAdminBlock = `          // ── Formato profesional (grupo/subgrupo/ramal/sentido) ─────────`;
const endAdminBlock = `        } catch { toast.error(\`Error leyendo \${file.name}\`); }`;

const startIdx = adminContent.indexOf(searchAdminBlock);
const endIdx = adminContent.indexOf(endAdminBlock);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `          const parsedLines = parseGeojsonToLines(geo, file.name);
          parsedLines.forEach(item => {
            previews.push({
              nombre: item.nombre,
              numero: item.numero,
              color: item.color,
              descripcion: item.descripcion,
              subcategoriaAuto: item.subcategoria,
              sentido: item.sentido,
              datosGeo: item.datosGeo,
            });
          });
`;
  adminContent = adminContent.substring(0, startIdx) + replacement + adminContent.substring(endIdx);
  fs.writeFileSync(adminPath, adminContent);
  console.log('✓ src/app/admin/page.tsx patched successfully');
} else {
  console.log('Admin block already patched or not found');
}

// 2. Patch src/app/bitacora-gps/page.tsx
const bitacoraPath = path.join(__dirname, '..', 'src', 'app', 'bitacora-gps', 'page.tsx');
let bitacoraContent = fs.readFileSync(bitacoraPath, 'utf8');

if (!bitacoraContent.includes("import { parseGeojsonToLines } from '@/utils/parseGeojsonLines';")) {
  bitacoraContent = bitacoraContent.replace(
    "import AccessDenied from '@/components/AccessDenied';",
    "import AccessDenied from '@/components/AccessDenied';\nimport { parseGeojsonToLines } from '@/utils/parseGeojsonLines';"
  );
}

// Replace standard GeoJSON upload handler in Bitacora GPS so it splits FeatureCollection into separate items
const bitacoraSearch = `        // Standard JSON / GeoJSON
        const text = await file.text();
        const parsed = JSON.parse(text);

        const res = await fetch('/api/bitacora-gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origen: 'IMPORTACION_GEOJSON',
            datosGeo: parsed,
          }),
        });`;

const bitacoraReplace = `        // Standard JSON / GeoJSON: parse lines intelligently
        const text = await file.text();
        const parsed = JSON.parse(text);
        const parsedLines = parseGeojsonToLines(parsed, file.name);

        if (parsedLines.length > 1) {
          // If it's a multi-route collection (e.g. 256 lines), import them into official lines!
          const res = await fetch('/api/lineas-transporte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineas: parsedLines }),
          });

          if (!res.ok) throw new Error('Error al importar las líneas de transporte');
          toast.success(\`\${parsedLines.length} líneas de transporte importadas con sus empresas y ramales!\`, { id: toastId });
          fetchRelevamientos();
          return;
        }

        // Single line relevamiento
        const single = parsedLines[0];
        const res = await fetch('/api/bitacora-gps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineaNumero: single?.numero || null,
            ramal: single?.subcategoria || null,
            sentido: single?.sentido || null,
            notas: single?.descripcion || null,
            origen: 'IMPORTACION_GEOJSON',
            datosGeo: parsed,
          }),
        });`;

if (bitacoraContent.includes(bitacoraSearch)) {
  bitacoraContent = bitacoraContent.replace(bitacoraSearch, bitacoraReplace);
  fs.writeFileSync(bitacoraPath, bitacoraContent);
  console.log('✓ src/app/bitacora-gps/page.tsx patched successfully');
} else {
  console.log('Bitacora search block not found');
}

// 3. Patch src/app/transporte-publico/page.tsx
const tpPath = path.join(__dirname, '..', 'src', 'app', 'transporte-publico', 'page.tsx');
let tpContent = fs.readFileSync(tpPath, 'utf8');

if (!tpContent.includes("import { parseGeojsonToLines } from '@/utils/parseGeojsonLines';")) {
  tpContent = tpContent.replace(
    "import AccessDenied from '@/components/AccessDenied';",
    "import AccessDenied from '@/components/AccessDenied';\nimport { parseGeojsonToLines } from '@/utils/parseGeojsonLines';\nimport { Upload } from 'lucide-react';"
  );
}

// Add handleGeojsonFileUpload and hidden input
if (!tpContent.includes('handleGeojsonFileUpload')) {
  const handlerCode = `  const geojsonInputRef = React.useRef<HTMLInputElement>(null);
  const [isImportingGeo, setIsImportingGeo] = useState(false);

  const handleGeojsonFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingGeo(true);
    const toastId = toast.loading(\`Analizando \${file.name}...\`);
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      const parsedLines = parseGeojsonToLines(geojson, file.name);

      if (parsedLines.length === 0) {
        throw new Error('No se encontraron trazas de recorrido LineString en el archivo');
      }

      toast.loading(\`Importando \${parsedLines.length} trazas con empresas y sentidos...\`, { id: toastId });

      const res = await authFetch('/api/lineas-transporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas: parsedLines })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar las líneas');

      toast.success(\`¡Éxito! \${parsedLines.length} líneas y ramales importados correctamente.\`, { id: toastId });
      emitirCambioMapa('lineas');
      fetchLineas();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al importar archivo GeoJSON', { id: toastId });
    } finally {
      setIsImportingGeo(false);
      if (geojsonInputRef.current) geojsonInputRef.current.value = '';
    }
  };
`;
  tpContent = tpContent.replace(
    "export default function TransportePublicoPage() {",
    "export default function TransportePublicoPage() {\n" + handlerCode
  );

  // Add the "Importar GeoJSON" button to the action bar
  const actionButtonSearch = `<button
                  type="button"
                  onClick={handleAutoPair}`;

  const actionButtonReplace = `<input
                type="file"
                ref={geojsonInputRef}
                accept=".geojson,.json"
                style={{ display: 'none' }}
                onChange={handleGeojsonFileUpload}
              />
              <button
                type="button"
                onClick={() => geojsonInputRef.current?.click()}
                disabled={isImportingGeo}
                title="Importar un archivo GeoJSON con recorridos de colectivos (detecta automáticamente empresas, líneas, ramales y sentidos)"
                style={{
                  padding: '7px 10px', borderRadius: '8px',
                  border: '1.5px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 700, cursor: isImportingGeo ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  boxShadow: '0 1px 2px rgba(37,99,235,0.08)'
                }}
              >
                <Upload size={13} color="#2563eb" />
                {isImportingGeo ? 'Importando...' : '📥 Importar GeoJSON'}
              </button>

              <button
                  type="button"
                  onClick={handleAutoPair}`;

  tpContent = tpContent.replace(actionButtonSearch, actionButtonReplace);
  fs.writeFileSync(tpPath, tpContent);
  console.log('✓ src/app/transporte-publico/page.tsx patched successfully');
}

console.log('All patches complete.');
