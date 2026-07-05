# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { upsertUsuario, createCapa, updateCapa, deleteCapa, createGrupo, updateGrupo, deleteGrupo, createRutaTransporte, updateRutaTransporteEstado, deleteRutaTransporte } from '@lanus-gis/dataconnect';


// Operation UpsertUsuario:  For variables, look at type UpsertUsuarioVars in ../index.d.ts
const { data } = await UpsertUsuario(dataConnect, upsertUsuarioVars);

// Operation CreateCapa:  For variables, look at type CreateCapaVars in ../index.d.ts
const { data } = await CreateCapa(dataConnect, createCapaVars);

// Operation UpdateCapa:  For variables, look at type UpdateCapaVars in ../index.d.ts
const { data } = await UpdateCapa(dataConnect, updateCapaVars);

// Operation DeleteCapa:  For variables, look at type DeleteCapaVars in ../index.d.ts
const { data } = await DeleteCapa(dataConnect, deleteCapaVars);

// Operation CreateGrupo:  For variables, look at type CreateGrupoVars in ../index.d.ts
const { data } = await CreateGrupo(dataConnect, createGrupoVars);

// Operation UpdateGrupo:  For variables, look at type UpdateGrupoVars in ../index.d.ts
const { data } = await UpdateGrupo(dataConnect, updateGrupoVars);

// Operation DeleteGrupo:  For variables, look at type DeleteGrupoVars in ../index.d.ts
const { data } = await DeleteGrupo(dataConnect, deleteGrupoVars);

// Operation CreateRutaTransporte:  For variables, look at type CreateRutaTransporteVars in ../index.d.ts
const { data } = await CreateRutaTransporte(dataConnect, createRutaTransporteVars);

// Operation UpdateRutaTransporteEstado:  For variables, look at type UpdateRutaTransporteEstadoVars in ../index.d.ts
const { data } = await UpdateRutaTransporteEstado(dataConnect, updateRutaTransporteEstadoVars);

// Operation DeleteRutaTransporte:  For variables, look at type DeleteRutaTransporteVars in ../index.d.ts
const { data } = await DeleteRutaTransporte(dataConnect, deleteRutaTransporteVars);


```