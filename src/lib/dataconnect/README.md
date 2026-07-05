# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListCapas*](#listcapas)
  - [*ListGrupos*](#listgrupos)
  - [*ListSubGrupos*](#listsubgrupos)
  - [*ListLineasTransporte*](#listlineastransporte)
  - [*ListRutasTransporte*](#listrutastransporte)
  - [*GetRutaTransporte*](#getrutatransporte)
  - [*ListReclamos*](#listreclamos)
  - [*GetUsuario*](#getusuario)
  - [*GetRolPermisos*](#getrolpermisos)
- [**Mutations**](#mutations)
  - [*UpsertUsuario*](#upsertusuario)
  - [*CreateCapa*](#createcapa)
  - [*UpdateCapa*](#updatecapa)
  - [*DeleteCapa*](#deletecapa)
  - [*CreateGrupo*](#creategrupo)
  - [*UpdateGrupo*](#updategrupo)
  - [*DeleteGrupo*](#deletegrupo)
  - [*CreateRutaTransporte*](#createrutatransporte)
  - [*UpdateRutaTransporteEstado*](#updaterutatransporteestado)
  - [*DeleteRutaTransporte*](#deleterutatransporte)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@lanus-gis/dataconnect` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@lanus-gis/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@lanus-gis/dataconnect';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListCapas
You can execute the `ListCapas` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listCapas(options?: ExecuteQueryOptions): QueryPromise<ListCapasData, undefined>;

interface ListCapasRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCapasData, undefined>;
}
export const listCapasRef: ListCapasRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listCapas(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListCapasData, undefined>;

interface ListCapasRef {
  ...
  (dc: DataConnect): QueryRef<ListCapasData, undefined>;
}
export const listCapasRef: ListCapasRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listCapasRef:
```typescript
const name = listCapasRef.operationName;
console.log(name);
```

### Variables
The `ListCapas` query has no variables.
### Return Type
Recall that executing the `ListCapas` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListCapasData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListCapasData {
  capas: ({
    id: string;
    nombre: string;
    tipo: string;
    color: string;
    icono?: string | null;
    datosGeo: string;
    visibilidad: string;
    rolesPermitidos?: string[] | null;
    grupoId?: string | null;
    subGrupoId?: string | null;
    creadoEn: TimestampString;
    actualizadoEn: TimestampString;
  } & Capa_Key)[];
}
```
### Using `ListCapas`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listCapas } from '@lanus-gis/dataconnect';


// Call the `listCapas()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listCapas();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listCapas(dataConnect);

console.log(data.capas);

// Or, you can use the `Promise` API.
listCapas().then((response) => {
  const data = response.data;
  console.log(data.capas);
});
```

### Using `ListCapas`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listCapasRef } from '@lanus-gis/dataconnect';


// Call the `listCapasRef()` function to get a reference to the query.
const ref = listCapasRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listCapasRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.capas);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.capas);
});
```

## ListGrupos
You can execute the `ListGrupos` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listGrupos(options?: ExecuteQueryOptions): QueryPromise<ListGruposData, undefined>;

interface ListGruposRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListGruposData, undefined>;
}
export const listGruposRef: ListGruposRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listGrupos(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListGruposData, undefined>;

interface ListGruposRef {
  ...
  (dc: DataConnect): QueryRef<ListGruposData, undefined>;
}
export const listGruposRef: ListGruposRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listGruposRef:
```typescript
const name = listGruposRef.operationName;
console.log(name);
```

### Variables
The `ListGrupos` query has no variables.
### Return Type
Recall that executing the `ListGrupos` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListGruposData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListGruposData {
  grupos: ({
    id: string;
    nombre: string;
    color: string;
    visibilidad: string;
    rolesPermitidos?: string[] | null;
  } & Grupo_Key)[];
}
```
### Using `ListGrupos`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listGrupos } from '@lanus-gis/dataconnect';


// Call the `listGrupos()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listGrupos();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listGrupos(dataConnect);

console.log(data.grupos);

// Or, you can use the `Promise` API.
listGrupos().then((response) => {
  const data = response.data;
  console.log(data.grupos);
});
```

### Using `ListGrupos`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listGruposRef } from '@lanus-gis/dataconnect';


// Call the `listGruposRef()` function to get a reference to the query.
const ref = listGruposRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listGruposRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.grupos);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.grupos);
});
```

## ListSubGrupos
You can execute the `ListSubGrupos` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listSubGrupos(options?: ExecuteQueryOptions): QueryPromise<ListSubGruposData, undefined>;

interface ListSubGruposRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSubGruposData, undefined>;
}
export const listSubGruposRef: ListSubGruposRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSubGrupos(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSubGruposData, undefined>;

interface ListSubGruposRef {
  ...
  (dc: DataConnect): QueryRef<ListSubGruposData, undefined>;
}
export const listSubGruposRef: ListSubGruposRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSubGruposRef:
```typescript
const name = listSubGruposRef.operationName;
console.log(name);
```

### Variables
The `ListSubGrupos` query has no variables.
### Return Type
Recall that executing the `ListSubGrupos` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSubGruposData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListSubGruposData {
  subGrupos: ({
    id: string;
    nombre: string;
    color: string;
    grupoId: string;
  } & SubGrupo_Key)[];
}
```
### Using `ListSubGrupos`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSubGrupos } from '@lanus-gis/dataconnect';


// Call the `listSubGrupos()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSubGrupos();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSubGrupos(dataConnect);

console.log(data.subGrupos);

// Or, you can use the `Promise` API.
listSubGrupos().then((response) => {
  const data = response.data;
  console.log(data.subGrupos);
});
```

### Using `ListSubGrupos`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSubGruposRef } from '@lanus-gis/dataconnect';


// Call the `listSubGruposRef()` function to get a reference to the query.
const ref = listSubGruposRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSubGruposRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.subGrupos);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.subGrupos);
});
```

## ListLineasTransporte
You can execute the `ListLineasTransporte` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listLineasTransporte(options?: ExecuteQueryOptions): QueryPromise<ListLineasTransporteData, undefined>;

interface ListLineasTransporteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListLineasTransporteData, undefined>;
}
export const listLineasTransporteRef: ListLineasTransporteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listLineasTransporte(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListLineasTransporteData, undefined>;

interface ListLineasTransporteRef {
  ...
  (dc: DataConnect): QueryRef<ListLineasTransporteData, undefined>;
}
export const listLineasTransporteRef: ListLineasTransporteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listLineasTransporteRef:
```typescript
const name = listLineasTransporteRef.operationName;
console.log(name);
```

### Variables
The `ListLineasTransporte` query has no variables.
### Return Type
Recall that executing the `ListLineasTransporte` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListLineasTransporteData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListLineasTransporteData {
  lineaTransportes: ({
    id: string;
    nombre: string;
    numero?: string | null;
    color: string;
    descripcion?: string | null;
    categoria: string;
    subcategoria?: string | null;
    sentido?: string | null;
    activo: boolean;
    datosGeo: string;
    creadoEn: TimestampString;
    actualizadoEn: TimestampString;
  } & LineaTransporte_Key)[];
}
```
### Using `ListLineasTransporte`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listLineasTransporte } from '@lanus-gis/dataconnect';


// Call the `listLineasTransporte()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listLineasTransporte();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listLineasTransporte(dataConnect);

console.log(data.lineaTransportes);

// Or, you can use the `Promise` API.
listLineasTransporte().then((response) => {
  const data = response.data;
  console.log(data.lineaTransportes);
});
```

### Using `ListLineasTransporte`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listLineasTransporteRef } from '@lanus-gis/dataconnect';


// Call the `listLineasTransporteRef()` function to get a reference to the query.
const ref = listLineasTransporteRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listLineasTransporteRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.lineaTransportes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.lineaTransportes);
});
```

## ListRutasTransporte
You can execute the `ListRutasTransporte` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listRutasTransporte(options?: ExecuteQueryOptions): QueryPromise<ListRutasTransporteData, undefined>;

interface ListRutasTransporteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListRutasTransporteData, undefined>;
}
export const listRutasTransporteRef: ListRutasTransporteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listRutasTransporte(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListRutasTransporteData, undefined>;

interface ListRutasTransporteRef {
  ...
  (dc: DataConnect): QueryRef<ListRutasTransporteData, undefined>;
}
export const listRutasTransporteRef: ListRutasTransporteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listRutasTransporteRef:
```typescript
const name = listRutasTransporteRef.operationName;
console.log(name);
```

### Variables
The `ListRutasTransporte` query has no variables.
### Return Type
Recall that executing the `ListRutasTransporte` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListRutasTransporteData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListRutasTransporteData {
  rutaTransportes: ({
    id: string;
    numeroSolicitud?: string | null;
    idSolicitudWeb?: string | null;
    nombreSolicitante: string;
    empresaSolicitante?: string | null;
    estado: string;
    tipoServicio: string;
    creadoEn: TimestampString;
  } & RutaTransporte_Key)[];
}
```
### Using `ListRutasTransporte`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listRutasTransporte } from '@lanus-gis/dataconnect';


// Call the `listRutasTransporte()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listRutasTransporte();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listRutasTransporte(dataConnect);

console.log(data.rutaTransportes);

// Or, you can use the `Promise` API.
listRutasTransporte().then((response) => {
  const data = response.data;
  console.log(data.rutaTransportes);
});
```

### Using `ListRutasTransporte`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listRutasTransporteRef } from '@lanus-gis/dataconnect';


// Call the `listRutasTransporteRef()` function to get a reference to the query.
const ref = listRutasTransporteRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listRutasTransporteRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.rutaTransportes);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.rutaTransportes);
});
```

## GetRutaTransporte
You can execute the `GetRutaTransporte` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getRutaTransporte(vars: GetRutaTransporteVariables, options?: ExecuteQueryOptions): QueryPromise<GetRutaTransporteData, GetRutaTransporteVariables>;

interface GetRutaTransporteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRutaTransporteVariables): QueryRef<GetRutaTransporteData, GetRutaTransporteVariables>;
}
export const getRutaTransporteRef: GetRutaTransporteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getRutaTransporte(dc: DataConnect, vars: GetRutaTransporteVariables, options?: ExecuteQueryOptions): QueryPromise<GetRutaTransporteData, GetRutaTransporteVariables>;

interface GetRutaTransporteRef {
  ...
  (dc: DataConnect, vars: GetRutaTransporteVariables): QueryRef<GetRutaTransporteData, GetRutaTransporteVariables>;
}
export const getRutaTransporteRef: GetRutaTransporteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getRutaTransporteRef:
```typescript
const name = getRutaTransporteRef.operationName;
console.log(name);
```

### Variables
The `GetRutaTransporte` query requires an argument of type `GetRutaTransporteVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetRutaTransporteVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetRutaTransporte` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetRutaTransporteData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetRutaTransporteData {
  rutaTransporte?: {
    id: string;
    numeroSolicitud?: string | null;
    idSolicitudWeb?: string | null;
    enlaceDocumento?: string | null;
    fechaCreacion?: string | null;
    nombreSolicitante: string;
    empresaSolicitante?: string | null;
    cuilCuit?: string | null;
    emailSolicitante?: string | null;
    telefonoSolicitante?: string | null;
    patente?: string | null;
    tipoVehiculo?: string | null;
    pesoToneladas?: number | null;
    cargaPeligrosa: boolean;
    tipoCarga?: string | null;
    largoVehiculo?: string | null;
    anchoVehiculo?: string | null;
    alturaVehiculo?: string | null;
    cantidadEjes?: number | null;
    aseguradora?: string | null;
    nroSeguro?: string | null;
    calles?: string | null;
    origenDireccion?: string | null;
    origenLocalidad?: string | null;
    origenPartido?: string | null;
    origenNombre?: string | null;
    destinoDireccion?: string | null;
    destinoLocalidad?: string | null;
    destinoPartido?: string | null;
    destinoNombre?: string | null;
    frecuencia?: string | null;
    horario?: string | null;
    observaciones?: string | null;
    vigenciaDesde?: string | null;
    vigenciaHasta?: string | null;
    estado: string;
    tipoServicio: string;
    creadoPorId?: string | null;
    creadoPorNombre?: string | null;
    editadoPorId?: string | null;
    editadoPorNombre?: string | null;
    activo: boolean;
    datosGeo: string;
    creadoEn: TimestampString;
  } & RutaTransporte_Key;
}
```
### Using `GetRutaTransporte`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getRutaTransporte, GetRutaTransporteVariables } from '@lanus-gis/dataconnect';

// The `GetRutaTransporte` query requires an argument of type `GetRutaTransporteVariables`:
const getRutaTransporteVars: GetRutaTransporteVariables = {
  id: ..., 
};

// Call the `getRutaTransporte()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getRutaTransporte(getRutaTransporteVars);
// Variables can be defined inline as well.
const { data } = await getRutaTransporte({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getRutaTransporte(dataConnect, getRutaTransporteVars);

console.log(data.rutaTransporte);

// Or, you can use the `Promise` API.
getRutaTransporte(getRutaTransporteVars).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte);
});
```

### Using `GetRutaTransporte`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getRutaTransporteRef, GetRutaTransporteVariables } from '@lanus-gis/dataconnect';

// The `GetRutaTransporte` query requires an argument of type `GetRutaTransporteVariables`:
const getRutaTransporteVars: GetRutaTransporteVariables = {
  id: ..., 
};

// Call the `getRutaTransporteRef()` function to get a reference to the query.
const ref = getRutaTransporteRef(getRutaTransporteVars);
// Variables can be defined inline as well.
const ref = getRutaTransporteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getRutaTransporteRef(dataConnect, getRutaTransporteVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.rutaTransporte);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte);
});
```

## ListReclamos
You can execute the `ListReclamos` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
listReclamos(options?: ExecuteQueryOptions): QueryPromise<ListReclamosData, undefined>;

interface ListReclamosRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListReclamosData, undefined>;
}
export const listReclamosRef: ListReclamosRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listReclamos(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListReclamosData, undefined>;

interface ListReclamosRef {
  ...
  (dc: DataConnect): QueryRef<ListReclamosData, undefined>;
}
export const listReclamosRef: ListReclamosRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listReclamosRef:
```typescript
const name = listReclamosRef.operationName;
console.log(name);
```

### Variables
The `ListReclamos` query has no variables.
### Return Type
Recall that executing the `ListReclamos` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListReclamosData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListReclamosData {
  reclamos: ({
    id: string;
    numero: string;
    titulo: string;
    descripcion?: string | null;
    estado: string;
    prioridad: string;
    lat: number;
    lng: number;
    direccion?: string | null;
    ciudadano?: string | null;
    dniCiudadano?: string | null;
    fecha?: string | null;
    motivoId: number;
    motivoNombre: string;
    canalEntrada?: string | null;
    creadoEn: TimestampString;
    actualizadoEn: TimestampString;
  } & Reclamo_Key)[];
}
```
### Using `ListReclamos`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listReclamos } from '@lanus-gis/dataconnect';


// Call the `listReclamos()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listReclamos();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listReclamos(dataConnect);

console.log(data.reclamos);

// Or, you can use the `Promise` API.
listReclamos().then((response) => {
  const data = response.data;
  console.log(data.reclamos);
});
```

### Using `ListReclamos`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listReclamosRef } from '@lanus-gis/dataconnect';


// Call the `listReclamosRef()` function to get a reference to the query.
const ref = listReclamosRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listReclamosRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.reclamos);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.reclamos);
});
```

## GetUsuario
You can execute the `GetUsuario` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getUsuario(vars: GetUsuarioVariables, options?: ExecuteQueryOptions): QueryPromise<GetUsuarioData, GetUsuarioVariables>;

interface GetUsuarioRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUsuarioVariables): QueryRef<GetUsuarioData, GetUsuarioVariables>;
}
export const getUsuarioRef: GetUsuarioRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUsuario(dc: DataConnect, vars: GetUsuarioVariables, options?: ExecuteQueryOptions): QueryPromise<GetUsuarioData, GetUsuarioVariables>;

interface GetUsuarioRef {
  ...
  (dc: DataConnect, vars: GetUsuarioVariables): QueryRef<GetUsuarioData, GetUsuarioVariables>;
}
export const getUsuarioRef: GetUsuarioRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUsuarioRef:
```typescript
const name = getUsuarioRef.operationName;
console.log(name);
```

### Variables
The `GetUsuario` query requires an argument of type `GetUsuarioVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUsuarioVariables {
  firebaseUid: string;
}
```
### Return Type
Recall that executing the `GetUsuario` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUsuarioData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUsuarioData {
  usuario?: {
    firebaseUid: string;
    email: string;
    nombre?: string | null;
    rol: string;
    creadoEn: TimestampString;
  } & Usuario_Key;
}
```
### Using `GetUsuario`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUsuario, GetUsuarioVariables } from '@lanus-gis/dataconnect';

// The `GetUsuario` query requires an argument of type `GetUsuarioVariables`:
const getUsuarioVars: GetUsuarioVariables = {
  firebaseUid: ..., 
};

// Call the `getUsuario()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUsuario(getUsuarioVars);
// Variables can be defined inline as well.
const { data } = await getUsuario({ firebaseUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUsuario(dataConnect, getUsuarioVars);

console.log(data.usuario);

// Or, you can use the `Promise` API.
getUsuario(getUsuarioVars).then((response) => {
  const data = response.data;
  console.log(data.usuario);
});
```

### Using `GetUsuario`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUsuarioRef, GetUsuarioVariables } from '@lanus-gis/dataconnect';

// The `GetUsuario` query requires an argument of type `GetUsuarioVariables`:
const getUsuarioVars: GetUsuarioVariables = {
  firebaseUid: ..., 
};

// Call the `getUsuarioRef()` function to get a reference to the query.
const ref = getUsuarioRef(getUsuarioVars);
// Variables can be defined inline as well.
const ref = getUsuarioRef({ firebaseUid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUsuarioRef(dataConnect, getUsuarioVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.usuario);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.usuario);
});
```

## GetRolPermisos
You can execute the `GetRolPermisos` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
getRolPermisos(vars: GetRolPermisosVariables, options?: ExecuteQueryOptions): QueryPromise<GetRolPermisosData, GetRolPermisosVariables>;

interface GetRolPermisosRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRolPermisosVariables): QueryRef<GetRolPermisosData, GetRolPermisosVariables>;
}
export const getRolPermisosRef: GetRolPermisosRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getRolPermisos(dc: DataConnect, vars: GetRolPermisosVariables, options?: ExecuteQueryOptions): QueryPromise<GetRolPermisosData, GetRolPermisosVariables>;

interface GetRolPermisosRef {
  ...
  (dc: DataConnect, vars: GetRolPermisosVariables): QueryRef<GetRolPermisosData, GetRolPermisosVariables>;
}
export const getRolPermisosRef: GetRolPermisosRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getRolPermisosRef:
```typescript
const name = getRolPermisosRef.operationName;
console.log(name);
```

### Variables
The `GetRolPermisos` query requires an argument of type `GetRolPermisosVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetRolPermisosVariables {
  rol: string;
}
```
### Return Type
Recall that executing the `GetRolPermisos` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetRolPermisosData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetRolPermisosData {
  rolPermisos?: {
    id: string;
    rol: string;
    accesoAdmin: boolean;
    verCapas: boolean;
    editarCapas: boolean;
    verLineas: boolean;
    editarLineas: boolean;
    verRutas: boolean;
    editarRutas: boolean;
    verReclamos: boolean;
    editarReclamos: boolean;
    gestionarGrupos: boolean;
    gestionarUsuarios: boolean;
  } & RolPermisos_Key;
}
```
### Using `GetRolPermisos`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getRolPermisos, GetRolPermisosVariables } from '@lanus-gis/dataconnect';

// The `GetRolPermisos` query requires an argument of type `GetRolPermisosVariables`:
const getRolPermisosVars: GetRolPermisosVariables = {
  rol: ..., 
};

// Call the `getRolPermisos()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getRolPermisos(getRolPermisosVars);
// Variables can be defined inline as well.
const { data } = await getRolPermisos({ rol: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getRolPermisos(dataConnect, getRolPermisosVars);

console.log(data.rolPermisos);

// Or, you can use the `Promise` API.
getRolPermisos(getRolPermisosVars).then((response) => {
  const data = response.data;
  console.log(data.rolPermisos);
});
```

### Using `GetRolPermisos`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getRolPermisosRef, GetRolPermisosVariables } from '@lanus-gis/dataconnect';

// The `GetRolPermisos` query requires an argument of type `GetRolPermisosVariables`:
const getRolPermisosVars: GetRolPermisosVariables = {
  rol: ..., 
};

// Call the `getRolPermisosRef()` function to get a reference to the query.
const ref = getRolPermisosRef(getRolPermisosVars);
// Variables can be defined inline as well.
const ref = getRolPermisosRef({ rol: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getRolPermisosRef(dataConnect, getRolPermisosVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.rolPermisos);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.rolPermisos);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## UpsertUsuario
You can execute the `UpsertUsuario` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
upsertUsuario(vars: UpsertUsuarioVariables): MutationPromise<UpsertUsuarioData, UpsertUsuarioVariables>;

interface UpsertUsuarioRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUsuarioVariables): MutationRef<UpsertUsuarioData, UpsertUsuarioVariables>;
}
export const upsertUsuarioRef: UpsertUsuarioRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertUsuario(dc: DataConnect, vars: UpsertUsuarioVariables): MutationPromise<UpsertUsuarioData, UpsertUsuarioVariables>;

interface UpsertUsuarioRef {
  ...
  (dc: DataConnect, vars: UpsertUsuarioVariables): MutationRef<UpsertUsuarioData, UpsertUsuarioVariables>;
}
export const upsertUsuarioRef: UpsertUsuarioRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertUsuarioRef:
```typescript
const name = upsertUsuarioRef.operationName;
console.log(name);
```

### Variables
The `UpsertUsuario` mutation requires an argument of type `UpsertUsuarioVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertUsuarioVariables {
  firebaseUid: string;
  email: string;
  nombre?: string | null;
  rol?: string | null;
}
```
### Return Type
Recall that executing the `UpsertUsuario` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertUsuarioData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertUsuarioData {
  usuario_upsert: Usuario_Key;
}
```
### Using `UpsertUsuario`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertUsuario, UpsertUsuarioVariables } from '@lanus-gis/dataconnect';

// The `UpsertUsuario` mutation requires an argument of type `UpsertUsuarioVariables`:
const upsertUsuarioVars: UpsertUsuarioVariables = {
  firebaseUid: ..., 
  email: ..., 
  nombre: ..., // optional
  rol: ..., // optional
};

// Call the `upsertUsuario()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertUsuario(upsertUsuarioVars);
// Variables can be defined inline as well.
const { data } = await upsertUsuario({ firebaseUid: ..., email: ..., nombre: ..., rol: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertUsuario(dataConnect, upsertUsuarioVars);

console.log(data.usuario_upsert);

// Or, you can use the `Promise` API.
upsertUsuario(upsertUsuarioVars).then((response) => {
  const data = response.data;
  console.log(data.usuario_upsert);
});
```

### Using `UpsertUsuario`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertUsuarioRef, UpsertUsuarioVariables } from '@lanus-gis/dataconnect';

// The `UpsertUsuario` mutation requires an argument of type `UpsertUsuarioVariables`:
const upsertUsuarioVars: UpsertUsuarioVariables = {
  firebaseUid: ..., 
  email: ..., 
  nombre: ..., // optional
  rol: ..., // optional
};

// Call the `upsertUsuarioRef()` function to get a reference to the mutation.
const ref = upsertUsuarioRef(upsertUsuarioVars);
// Variables can be defined inline as well.
const ref = upsertUsuarioRef({ firebaseUid: ..., email: ..., nombre: ..., rol: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertUsuarioRef(dataConnect, upsertUsuarioVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.usuario_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.usuario_upsert);
});
```

## CreateCapa
You can execute the `CreateCapa` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createCapa(vars: CreateCapaVariables): MutationPromise<CreateCapaData, CreateCapaVariables>;

interface CreateCapaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCapaVariables): MutationRef<CreateCapaData, CreateCapaVariables>;
}
export const createCapaRef: CreateCapaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createCapa(dc: DataConnect, vars: CreateCapaVariables): MutationPromise<CreateCapaData, CreateCapaVariables>;

interface CreateCapaRef {
  ...
  (dc: DataConnect, vars: CreateCapaVariables): MutationRef<CreateCapaData, CreateCapaVariables>;
}
export const createCapaRef: CreateCapaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createCapaRef:
```typescript
const name = createCapaRef.operationName;
console.log(name);
```

### Variables
The `CreateCapa` mutation requires an argument of type `CreateCapaVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateCapaVariables {
  nombre: string;
  tipo: string;
  color?: string | null;
  icono?: string | null;
  datosGeo: string;
  visibilidad?: string | null;
  rolesPermitidos?: string[] | null;
  grupoId?: string | null;
  subGrupoId?: string | null;
}
```
### Return Type
Recall that executing the `CreateCapa` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateCapaData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateCapaData {
  capa_insert: Capa_Key;
}
```
### Using `CreateCapa`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createCapa, CreateCapaVariables } from '@lanus-gis/dataconnect';

// The `CreateCapa` mutation requires an argument of type `CreateCapaVariables`:
const createCapaVars: CreateCapaVariables = {
  nombre: ..., 
  tipo: ..., 
  color: ..., // optional
  icono: ..., // optional
  datosGeo: ..., 
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
  grupoId: ..., // optional
  subGrupoId: ..., // optional
};

// Call the `createCapa()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createCapa(createCapaVars);
// Variables can be defined inline as well.
const { data } = await createCapa({ nombre: ..., tipo: ..., color: ..., icono: ..., datosGeo: ..., visibilidad: ..., rolesPermitidos: ..., grupoId: ..., subGrupoId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createCapa(dataConnect, createCapaVars);

console.log(data.capa_insert);

// Or, you can use the `Promise` API.
createCapa(createCapaVars).then((response) => {
  const data = response.data;
  console.log(data.capa_insert);
});
```

### Using `CreateCapa`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createCapaRef, CreateCapaVariables } from '@lanus-gis/dataconnect';

// The `CreateCapa` mutation requires an argument of type `CreateCapaVariables`:
const createCapaVars: CreateCapaVariables = {
  nombre: ..., 
  tipo: ..., 
  color: ..., // optional
  icono: ..., // optional
  datosGeo: ..., 
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
  grupoId: ..., // optional
  subGrupoId: ..., // optional
};

// Call the `createCapaRef()` function to get a reference to the mutation.
const ref = createCapaRef(createCapaVars);
// Variables can be defined inline as well.
const ref = createCapaRef({ nombre: ..., tipo: ..., color: ..., icono: ..., datosGeo: ..., visibilidad: ..., rolesPermitidos: ..., grupoId: ..., subGrupoId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createCapaRef(dataConnect, createCapaVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.capa_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.capa_insert);
});
```

## UpdateCapa
You can execute the `UpdateCapa` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateCapa(vars: UpdateCapaVariables): MutationPromise<UpdateCapaData, UpdateCapaVariables>;

interface UpdateCapaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCapaVariables): MutationRef<UpdateCapaData, UpdateCapaVariables>;
}
export const updateCapaRef: UpdateCapaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateCapa(dc: DataConnect, vars: UpdateCapaVariables): MutationPromise<UpdateCapaData, UpdateCapaVariables>;

interface UpdateCapaRef {
  ...
  (dc: DataConnect, vars: UpdateCapaVariables): MutationRef<UpdateCapaData, UpdateCapaVariables>;
}
export const updateCapaRef: UpdateCapaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateCapaRef:
```typescript
const name = updateCapaRef.operationName;
console.log(name);
```

### Variables
The `UpdateCapa` mutation requires an argument of type `UpdateCapaVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateCapaVariables {
  id: string;
  nombre?: string | null;
  tipo?: string | null;
  color?: string | null;
  icono?: string | null;
  datosGeo?: string | null;
  visibilidad?: string | null;
  rolesPermitidos?: string[] | null;
  grupoId?: string | null;
  subGrupoId?: string | null;
}
```
### Return Type
Recall that executing the `UpdateCapa` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateCapaData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateCapaData {
  capa_update?: Capa_Key | null;
}
```
### Using `UpdateCapa`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateCapa, UpdateCapaVariables } from '@lanus-gis/dataconnect';

// The `UpdateCapa` mutation requires an argument of type `UpdateCapaVariables`:
const updateCapaVars: UpdateCapaVariables = {
  id: ..., 
  nombre: ..., // optional
  tipo: ..., // optional
  color: ..., // optional
  icono: ..., // optional
  datosGeo: ..., // optional
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
  grupoId: ..., // optional
  subGrupoId: ..., // optional
};

// Call the `updateCapa()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateCapa(updateCapaVars);
// Variables can be defined inline as well.
const { data } = await updateCapa({ id: ..., nombre: ..., tipo: ..., color: ..., icono: ..., datosGeo: ..., visibilidad: ..., rolesPermitidos: ..., grupoId: ..., subGrupoId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateCapa(dataConnect, updateCapaVars);

console.log(data.capa_update);

// Or, you can use the `Promise` API.
updateCapa(updateCapaVars).then((response) => {
  const data = response.data;
  console.log(data.capa_update);
});
```

### Using `UpdateCapa`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateCapaRef, UpdateCapaVariables } from '@lanus-gis/dataconnect';

// The `UpdateCapa` mutation requires an argument of type `UpdateCapaVariables`:
const updateCapaVars: UpdateCapaVariables = {
  id: ..., 
  nombre: ..., // optional
  tipo: ..., // optional
  color: ..., // optional
  icono: ..., // optional
  datosGeo: ..., // optional
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
  grupoId: ..., // optional
  subGrupoId: ..., // optional
};

// Call the `updateCapaRef()` function to get a reference to the mutation.
const ref = updateCapaRef(updateCapaVars);
// Variables can be defined inline as well.
const ref = updateCapaRef({ id: ..., nombre: ..., tipo: ..., color: ..., icono: ..., datosGeo: ..., visibilidad: ..., rolesPermitidos: ..., grupoId: ..., subGrupoId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateCapaRef(dataConnect, updateCapaVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.capa_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.capa_update);
});
```

## DeleteCapa
You can execute the `DeleteCapa` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
deleteCapa(vars: DeleteCapaVariables): MutationPromise<DeleteCapaData, DeleteCapaVariables>;

interface DeleteCapaRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteCapaVariables): MutationRef<DeleteCapaData, DeleteCapaVariables>;
}
export const deleteCapaRef: DeleteCapaRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteCapa(dc: DataConnect, vars: DeleteCapaVariables): MutationPromise<DeleteCapaData, DeleteCapaVariables>;

interface DeleteCapaRef {
  ...
  (dc: DataConnect, vars: DeleteCapaVariables): MutationRef<DeleteCapaData, DeleteCapaVariables>;
}
export const deleteCapaRef: DeleteCapaRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteCapaRef:
```typescript
const name = deleteCapaRef.operationName;
console.log(name);
```

### Variables
The `DeleteCapa` mutation requires an argument of type `DeleteCapaVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteCapaVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteCapa` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteCapaData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteCapaData {
  capa_delete?: Capa_Key | null;
}
```
### Using `DeleteCapa`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteCapa, DeleteCapaVariables } from '@lanus-gis/dataconnect';

// The `DeleteCapa` mutation requires an argument of type `DeleteCapaVariables`:
const deleteCapaVars: DeleteCapaVariables = {
  id: ..., 
};

// Call the `deleteCapa()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteCapa(deleteCapaVars);
// Variables can be defined inline as well.
const { data } = await deleteCapa({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteCapa(dataConnect, deleteCapaVars);

console.log(data.capa_delete);

// Or, you can use the `Promise` API.
deleteCapa(deleteCapaVars).then((response) => {
  const data = response.data;
  console.log(data.capa_delete);
});
```

### Using `DeleteCapa`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteCapaRef, DeleteCapaVariables } from '@lanus-gis/dataconnect';

// The `DeleteCapa` mutation requires an argument of type `DeleteCapaVariables`:
const deleteCapaVars: DeleteCapaVariables = {
  id: ..., 
};

// Call the `deleteCapaRef()` function to get a reference to the mutation.
const ref = deleteCapaRef(deleteCapaVars);
// Variables can be defined inline as well.
const ref = deleteCapaRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteCapaRef(dataConnect, deleteCapaVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.capa_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.capa_delete);
});
```

## CreateGrupo
You can execute the `CreateGrupo` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createGrupo(vars: CreateGrupoVariables): MutationPromise<CreateGrupoData, CreateGrupoVariables>;

interface CreateGrupoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGrupoVariables): MutationRef<CreateGrupoData, CreateGrupoVariables>;
}
export const createGrupoRef: CreateGrupoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGrupo(dc: DataConnect, vars: CreateGrupoVariables): MutationPromise<CreateGrupoData, CreateGrupoVariables>;

interface CreateGrupoRef {
  ...
  (dc: DataConnect, vars: CreateGrupoVariables): MutationRef<CreateGrupoData, CreateGrupoVariables>;
}
export const createGrupoRef: CreateGrupoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGrupoRef:
```typescript
const name = createGrupoRef.operationName;
console.log(name);
```

### Variables
The `CreateGrupo` mutation requires an argument of type `CreateGrupoVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGrupoVariables {
  nombre: string;
  color?: string | null;
  visibilidad?: string | null;
  rolesPermitidos?: string[] | null;
}
```
### Return Type
Recall that executing the `CreateGrupo` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGrupoData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGrupoData {
  grupo_insert: Grupo_Key;
}
```
### Using `CreateGrupo`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGrupo, CreateGrupoVariables } from '@lanus-gis/dataconnect';

// The `CreateGrupo` mutation requires an argument of type `CreateGrupoVariables`:
const createGrupoVars: CreateGrupoVariables = {
  nombre: ..., 
  color: ..., // optional
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
};

// Call the `createGrupo()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGrupo(createGrupoVars);
// Variables can be defined inline as well.
const { data } = await createGrupo({ nombre: ..., color: ..., visibilidad: ..., rolesPermitidos: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGrupo(dataConnect, createGrupoVars);

console.log(data.grupo_insert);

// Or, you can use the `Promise` API.
createGrupo(createGrupoVars).then((response) => {
  const data = response.data;
  console.log(data.grupo_insert);
});
```

### Using `CreateGrupo`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGrupoRef, CreateGrupoVariables } from '@lanus-gis/dataconnect';

// The `CreateGrupo` mutation requires an argument of type `CreateGrupoVariables`:
const createGrupoVars: CreateGrupoVariables = {
  nombre: ..., 
  color: ..., // optional
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
};

// Call the `createGrupoRef()` function to get a reference to the mutation.
const ref = createGrupoRef(createGrupoVars);
// Variables can be defined inline as well.
const ref = createGrupoRef({ nombre: ..., color: ..., visibilidad: ..., rolesPermitidos: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGrupoRef(dataConnect, createGrupoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.grupo_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.grupo_insert);
});
```

## UpdateGrupo
You can execute the `UpdateGrupo` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateGrupo(vars: UpdateGrupoVariables): MutationPromise<UpdateGrupoData, UpdateGrupoVariables>;

interface UpdateGrupoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGrupoVariables): MutationRef<UpdateGrupoData, UpdateGrupoVariables>;
}
export const updateGrupoRef: UpdateGrupoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateGrupo(dc: DataConnect, vars: UpdateGrupoVariables): MutationPromise<UpdateGrupoData, UpdateGrupoVariables>;

interface UpdateGrupoRef {
  ...
  (dc: DataConnect, vars: UpdateGrupoVariables): MutationRef<UpdateGrupoData, UpdateGrupoVariables>;
}
export const updateGrupoRef: UpdateGrupoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateGrupoRef:
```typescript
const name = updateGrupoRef.operationName;
console.log(name);
```

### Variables
The `UpdateGrupo` mutation requires an argument of type `UpdateGrupoVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateGrupoVariables {
  id: string;
  nombre?: string | null;
  color?: string | null;
  visibilidad?: string | null;
  rolesPermitidos?: string[] | null;
}
```
### Return Type
Recall that executing the `UpdateGrupo` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateGrupoData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateGrupoData {
  grupo_update?: Grupo_Key | null;
}
```
### Using `UpdateGrupo`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateGrupo, UpdateGrupoVariables } from '@lanus-gis/dataconnect';

// The `UpdateGrupo` mutation requires an argument of type `UpdateGrupoVariables`:
const updateGrupoVars: UpdateGrupoVariables = {
  id: ..., 
  nombre: ..., // optional
  color: ..., // optional
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
};

// Call the `updateGrupo()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateGrupo(updateGrupoVars);
// Variables can be defined inline as well.
const { data } = await updateGrupo({ id: ..., nombre: ..., color: ..., visibilidad: ..., rolesPermitidos: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateGrupo(dataConnect, updateGrupoVars);

console.log(data.grupo_update);

// Or, you can use the `Promise` API.
updateGrupo(updateGrupoVars).then((response) => {
  const data = response.data;
  console.log(data.grupo_update);
});
```

### Using `UpdateGrupo`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateGrupoRef, UpdateGrupoVariables } from '@lanus-gis/dataconnect';

// The `UpdateGrupo` mutation requires an argument of type `UpdateGrupoVariables`:
const updateGrupoVars: UpdateGrupoVariables = {
  id: ..., 
  nombre: ..., // optional
  color: ..., // optional
  visibilidad: ..., // optional
  rolesPermitidos: ..., // optional
};

// Call the `updateGrupoRef()` function to get a reference to the mutation.
const ref = updateGrupoRef(updateGrupoVars);
// Variables can be defined inline as well.
const ref = updateGrupoRef({ id: ..., nombre: ..., color: ..., visibilidad: ..., rolesPermitidos: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateGrupoRef(dataConnect, updateGrupoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.grupo_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.grupo_update);
});
```

## DeleteGrupo
You can execute the `DeleteGrupo` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
deleteGrupo(vars: DeleteGrupoVariables): MutationPromise<DeleteGrupoData, DeleteGrupoVariables>;

interface DeleteGrupoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGrupoVariables): MutationRef<DeleteGrupoData, DeleteGrupoVariables>;
}
export const deleteGrupoRef: DeleteGrupoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteGrupo(dc: DataConnect, vars: DeleteGrupoVariables): MutationPromise<DeleteGrupoData, DeleteGrupoVariables>;

interface DeleteGrupoRef {
  ...
  (dc: DataConnect, vars: DeleteGrupoVariables): MutationRef<DeleteGrupoData, DeleteGrupoVariables>;
}
export const deleteGrupoRef: DeleteGrupoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteGrupoRef:
```typescript
const name = deleteGrupoRef.operationName;
console.log(name);
```

### Variables
The `DeleteGrupo` mutation requires an argument of type `DeleteGrupoVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteGrupoVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteGrupo` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteGrupoData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteGrupoData {
  grupo_delete?: Grupo_Key | null;
}
```
### Using `DeleteGrupo`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteGrupo, DeleteGrupoVariables } from '@lanus-gis/dataconnect';

// The `DeleteGrupo` mutation requires an argument of type `DeleteGrupoVariables`:
const deleteGrupoVars: DeleteGrupoVariables = {
  id: ..., 
};

// Call the `deleteGrupo()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteGrupo(deleteGrupoVars);
// Variables can be defined inline as well.
const { data } = await deleteGrupo({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteGrupo(dataConnect, deleteGrupoVars);

console.log(data.grupo_delete);

// Or, you can use the `Promise` API.
deleteGrupo(deleteGrupoVars).then((response) => {
  const data = response.data;
  console.log(data.grupo_delete);
});
```

### Using `DeleteGrupo`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteGrupoRef, DeleteGrupoVariables } from '@lanus-gis/dataconnect';

// The `DeleteGrupo` mutation requires an argument of type `DeleteGrupoVariables`:
const deleteGrupoVars: DeleteGrupoVariables = {
  id: ..., 
};

// Call the `deleteGrupoRef()` function to get a reference to the mutation.
const ref = deleteGrupoRef(deleteGrupoVars);
// Variables can be defined inline as well.
const ref = deleteGrupoRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteGrupoRef(dataConnect, deleteGrupoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.grupo_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.grupo_delete);
});
```

## CreateRutaTransporte
You can execute the `CreateRutaTransporte` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
createRutaTransporte(vars: CreateRutaTransporteVariables): MutationPromise<CreateRutaTransporteData, CreateRutaTransporteVariables>;

interface CreateRutaTransporteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateRutaTransporteVariables): MutationRef<CreateRutaTransporteData, CreateRutaTransporteVariables>;
}
export const createRutaTransporteRef: CreateRutaTransporteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createRutaTransporte(dc: DataConnect, vars: CreateRutaTransporteVariables): MutationPromise<CreateRutaTransporteData, CreateRutaTransporteVariables>;

interface CreateRutaTransporteRef {
  ...
  (dc: DataConnect, vars: CreateRutaTransporteVariables): MutationRef<CreateRutaTransporteData, CreateRutaTransporteVariables>;
}
export const createRutaTransporteRef: CreateRutaTransporteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createRutaTransporteRef:
```typescript
const name = createRutaTransporteRef.operationName;
console.log(name);
```

### Variables
The `CreateRutaTransporte` mutation requires an argument of type `CreateRutaTransporteVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateRutaTransporteVariables {
  numeroSolicitud?: string | null;
  idSolicitudWeb?: string | null;
  nombreSolicitante: string;
  datosGeo: string;
  estado?: string | null;
  tipoServicio?: string | null;
}
```
### Return Type
Recall that executing the `CreateRutaTransporte` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateRutaTransporteData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateRutaTransporteData {
  rutaTransporte_insert: RutaTransporte_Key;
}
```
### Using `CreateRutaTransporte`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createRutaTransporte, CreateRutaTransporteVariables } from '@lanus-gis/dataconnect';

// The `CreateRutaTransporte` mutation requires an argument of type `CreateRutaTransporteVariables`:
const createRutaTransporteVars: CreateRutaTransporteVariables = {
  numeroSolicitud: ..., // optional
  idSolicitudWeb: ..., // optional
  nombreSolicitante: ..., 
  datosGeo: ..., 
  estado: ..., // optional
  tipoServicio: ..., // optional
};

// Call the `createRutaTransporte()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createRutaTransporte(createRutaTransporteVars);
// Variables can be defined inline as well.
const { data } = await createRutaTransporte({ numeroSolicitud: ..., idSolicitudWeb: ..., nombreSolicitante: ..., datosGeo: ..., estado: ..., tipoServicio: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createRutaTransporte(dataConnect, createRutaTransporteVars);

console.log(data.rutaTransporte_insert);

// Or, you can use the `Promise` API.
createRutaTransporte(createRutaTransporteVars).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte_insert);
});
```

### Using `CreateRutaTransporte`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createRutaTransporteRef, CreateRutaTransporteVariables } from '@lanus-gis/dataconnect';

// The `CreateRutaTransporte` mutation requires an argument of type `CreateRutaTransporteVariables`:
const createRutaTransporteVars: CreateRutaTransporteVariables = {
  numeroSolicitud: ..., // optional
  idSolicitudWeb: ..., // optional
  nombreSolicitante: ..., 
  datosGeo: ..., 
  estado: ..., // optional
  tipoServicio: ..., // optional
};

// Call the `createRutaTransporteRef()` function to get a reference to the mutation.
const ref = createRutaTransporteRef(createRutaTransporteVars);
// Variables can be defined inline as well.
const ref = createRutaTransporteRef({ numeroSolicitud: ..., idSolicitudWeb: ..., nombreSolicitante: ..., datosGeo: ..., estado: ..., tipoServicio: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createRutaTransporteRef(dataConnect, createRutaTransporteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.rutaTransporte_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte_insert);
});
```

## UpdateRutaTransporteEstado
You can execute the `UpdateRutaTransporteEstado` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
updateRutaTransporteEstado(vars: UpdateRutaTransporteEstadoVariables): MutationPromise<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;

interface UpdateRutaTransporteEstadoRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateRutaTransporteEstadoVariables): MutationRef<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;
}
export const updateRutaTransporteEstadoRef: UpdateRutaTransporteEstadoRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateRutaTransporteEstado(dc: DataConnect, vars: UpdateRutaTransporteEstadoVariables): MutationPromise<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;

interface UpdateRutaTransporteEstadoRef {
  ...
  (dc: DataConnect, vars: UpdateRutaTransporteEstadoVariables): MutationRef<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;
}
export const updateRutaTransporteEstadoRef: UpdateRutaTransporteEstadoRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateRutaTransporteEstadoRef:
```typescript
const name = updateRutaTransporteEstadoRef.operationName;
console.log(name);
```

### Variables
The `UpdateRutaTransporteEstado` mutation requires an argument of type `UpdateRutaTransporteEstadoVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateRutaTransporteEstadoVariables {
  id: string;
  estado: string;
}
```
### Return Type
Recall that executing the `UpdateRutaTransporteEstado` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateRutaTransporteEstadoData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateRutaTransporteEstadoData {
  rutaTransporte_update?: RutaTransporte_Key | null;
}
```
### Using `UpdateRutaTransporteEstado`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateRutaTransporteEstado, UpdateRutaTransporteEstadoVariables } from '@lanus-gis/dataconnect';

// The `UpdateRutaTransporteEstado` mutation requires an argument of type `UpdateRutaTransporteEstadoVariables`:
const updateRutaTransporteEstadoVars: UpdateRutaTransporteEstadoVariables = {
  id: ..., 
  estado: ..., 
};

// Call the `updateRutaTransporteEstado()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateRutaTransporteEstado(updateRutaTransporteEstadoVars);
// Variables can be defined inline as well.
const { data } = await updateRutaTransporteEstado({ id: ..., estado: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateRutaTransporteEstado(dataConnect, updateRutaTransporteEstadoVars);

console.log(data.rutaTransporte_update);

// Or, you can use the `Promise` API.
updateRutaTransporteEstado(updateRutaTransporteEstadoVars).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte_update);
});
```

### Using `UpdateRutaTransporteEstado`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateRutaTransporteEstadoRef, UpdateRutaTransporteEstadoVariables } from '@lanus-gis/dataconnect';

// The `UpdateRutaTransporteEstado` mutation requires an argument of type `UpdateRutaTransporteEstadoVariables`:
const updateRutaTransporteEstadoVars: UpdateRutaTransporteEstadoVariables = {
  id: ..., 
  estado: ..., 
};

// Call the `updateRutaTransporteEstadoRef()` function to get a reference to the mutation.
const ref = updateRutaTransporteEstadoRef(updateRutaTransporteEstadoVars);
// Variables can be defined inline as well.
const ref = updateRutaTransporteEstadoRef({ id: ..., estado: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateRutaTransporteEstadoRef(dataConnect, updateRutaTransporteEstadoVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.rutaTransporte_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte_update);
});
```

## DeleteRutaTransporte
You can execute the `DeleteRutaTransporte` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect/index.d.ts](./index.d.ts):
```typescript
deleteRutaTransporte(vars: DeleteRutaTransporteVariables): MutationPromise<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;

interface DeleteRutaTransporteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteRutaTransporteVariables): MutationRef<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;
}
export const deleteRutaTransporteRef: DeleteRutaTransporteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteRutaTransporte(dc: DataConnect, vars: DeleteRutaTransporteVariables): MutationPromise<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;

interface DeleteRutaTransporteRef {
  ...
  (dc: DataConnect, vars: DeleteRutaTransporteVariables): MutationRef<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;
}
export const deleteRutaTransporteRef: DeleteRutaTransporteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteRutaTransporteRef:
```typescript
const name = deleteRutaTransporteRef.operationName;
console.log(name);
```

### Variables
The `DeleteRutaTransporte` mutation requires an argument of type `DeleteRutaTransporteVariables`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteRutaTransporteVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteRutaTransporte` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteRutaTransporteData`, which is defined in [dataconnect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteRutaTransporteData {
  rutaTransporte_delete?: RutaTransporte_Key | null;
}
```
### Using `DeleteRutaTransporte`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteRutaTransporte, DeleteRutaTransporteVariables } from '@lanus-gis/dataconnect';

// The `DeleteRutaTransporte` mutation requires an argument of type `DeleteRutaTransporteVariables`:
const deleteRutaTransporteVars: DeleteRutaTransporteVariables = {
  id: ..., 
};

// Call the `deleteRutaTransporte()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteRutaTransporte(deleteRutaTransporteVars);
// Variables can be defined inline as well.
const { data } = await deleteRutaTransporte({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteRutaTransporte(dataConnect, deleteRutaTransporteVars);

console.log(data.rutaTransporte_delete);

// Or, you can use the `Promise` API.
deleteRutaTransporte(deleteRutaTransporteVars).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte_delete);
});
```

### Using `DeleteRutaTransporte`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteRutaTransporteRef, DeleteRutaTransporteVariables } from '@lanus-gis/dataconnect';

// The `DeleteRutaTransporte` mutation requires an argument of type `DeleteRutaTransporteVariables`:
const deleteRutaTransporteVars: DeleteRutaTransporteVariables = {
  id: ..., 
};

// Call the `deleteRutaTransporteRef()` function to get a reference to the mutation.
const ref = deleteRutaTransporteRef(deleteRutaTransporteVars);
// Variables can be defined inline as well.
const ref = deleteRutaTransporteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteRutaTransporteRef(dataConnect, deleteRutaTransporteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.rutaTransporte_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.rutaTransporte_delete);
});
```

