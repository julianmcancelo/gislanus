import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Capa_Key {
  id: string;
  __typename?: 'Capa_Key';
}

export interface CreateCapaData {
  capa_insert: Capa_Key;
}

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

export interface CreateGrupoData {
  grupo_insert: Grupo_Key;
}

export interface CreateGrupoVariables {
  nombre: string;
  color?: string | null;
  visibilidad?: string | null;
  rolesPermitidos?: string[] | null;
}

export interface CreateRutaTransporteData {
  rutaTransporte_insert: RutaTransporte_Key;
}

export interface CreateRutaTransporteVariables {
  numeroSolicitud?: string | null;
  idSolicitudWeb?: string | null;
  nombreSolicitante: string;
  datosGeo: string;
  estado?: string | null;
  tipoServicio?: string | null;
}

export interface DeleteCapaData {
  capa_delete?: Capa_Key | null;
}

export interface DeleteCapaVariables {
  id: string;
}

export interface DeleteGrupoData {
  grupo_delete?: Grupo_Key | null;
}

export interface DeleteGrupoVariables {
  id: string;
}

export interface DeleteRutaTransporteData {
  rutaTransporte_delete?: RutaTransporte_Key | null;
}

export interface DeleteRutaTransporteVariables {
  id: string;
}

export interface DispositivoBloqueado_Key {
  id: string;
  __typename?: 'DispositivoBloqueado_Key';
}

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

export interface GetRolPermisosVariables {
  rol: string;
}

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

export interface GetRutaTransporteVariables {
  id: string;
}

export interface GetUsuarioData {
  usuario?: {
    firebaseUid: string;
    email: string;
    nombre?: string | null;
    rol: string;
    creadoEn: TimestampString;
  } & Usuario_Key;
}

export interface GetUsuarioVariables {
  firebaseUid: string;
}

export interface Grupo_Key {
  id: string;
  __typename?: 'Grupo_Key';
}

export interface LineaTransporte_Key {
  id: string;
  __typename?: 'LineaTransporte_Key';
}

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

export interface ListGruposData {
  grupos: ({
    id: string;
    nombre: string;
    color: string;
    visibilidad: string;
    rolesPermitidos?: string[] | null;
  } & Grupo_Key)[];
}

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

export interface ListSubGruposData {
  subGrupos: ({
    id: string;
    nombre: string;
    color: string;
    grupoId: string;
  } & SubGrupo_Key)[];
}

export interface Reclamo_Key {
  id: string;
  __typename?: 'Reclamo_Key';
}

export interface RolPermisos_Key {
  rol: string;
  __typename?: 'RolPermisos_Key';
}

export interface RutaTransporte_Key {
  id: string;
  __typename?: 'RutaTransporte_Key';
}

export interface SesionQR_Key {
  id: string;
  __typename?: 'SesionQR_Key';
}

export interface SolicitudDispositivo_Key {
  id: string;
  __typename?: 'SolicitudDispositivo_Key';
}

export interface SubGrupo_Key {
  id: string;
  __typename?: 'SubGrupo_Key';
}

export interface UpdateCapaData {
  capa_update?: Capa_Key | null;
}

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

export interface UpdateGrupoData {
  grupo_update?: Grupo_Key | null;
}

export interface UpdateGrupoVariables {
  id: string;
  nombre?: string | null;
  color?: string | null;
  visibilidad?: string | null;
  rolesPermitidos?: string[] | null;
}

export interface UpdateRutaTransporteEstadoData {
  rutaTransporte_update?: RutaTransporte_Key | null;
}

export interface UpdateRutaTransporteEstadoVariables {
  id: string;
  estado: string;
}

export interface UpsertUsuarioData {
  usuario_upsert: Usuario_Key;
}

export interface UpsertUsuarioVariables {
  firebaseUid: string;
  email: string;
  nombre?: string | null;
  rol?: string | null;
}

export interface Usuario_Key {
  firebaseUid: string;
  __typename?: 'Usuario_Key';
}

interface UpsertUsuarioRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUsuarioVariables): MutationRef<UpsertUsuarioData, UpsertUsuarioVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUsuarioVariables): MutationRef<UpsertUsuarioData, UpsertUsuarioVariables>;
  operationName: string;
}
export const upsertUsuarioRef: UpsertUsuarioRef;

export function upsertUsuario(vars: UpsertUsuarioVariables): MutationPromise<UpsertUsuarioData, UpsertUsuarioVariables>;
export function upsertUsuario(dc: DataConnect, vars: UpsertUsuarioVariables): MutationPromise<UpsertUsuarioData, UpsertUsuarioVariables>;

interface CreateCapaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCapaVariables): MutationRef<CreateCapaData, CreateCapaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCapaVariables): MutationRef<CreateCapaData, CreateCapaVariables>;
  operationName: string;
}
export const createCapaRef: CreateCapaRef;

export function createCapa(vars: CreateCapaVariables): MutationPromise<CreateCapaData, CreateCapaVariables>;
export function createCapa(dc: DataConnect, vars: CreateCapaVariables): MutationPromise<CreateCapaData, CreateCapaVariables>;

interface UpdateCapaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateCapaVariables): MutationRef<UpdateCapaData, UpdateCapaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateCapaVariables): MutationRef<UpdateCapaData, UpdateCapaVariables>;
  operationName: string;
}
export const updateCapaRef: UpdateCapaRef;

export function updateCapa(vars: UpdateCapaVariables): MutationPromise<UpdateCapaData, UpdateCapaVariables>;
export function updateCapa(dc: DataConnect, vars: UpdateCapaVariables): MutationPromise<UpdateCapaData, UpdateCapaVariables>;

interface DeleteCapaRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteCapaVariables): MutationRef<DeleteCapaData, DeleteCapaVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteCapaVariables): MutationRef<DeleteCapaData, DeleteCapaVariables>;
  operationName: string;
}
export const deleteCapaRef: DeleteCapaRef;

export function deleteCapa(vars: DeleteCapaVariables): MutationPromise<DeleteCapaData, DeleteCapaVariables>;
export function deleteCapa(dc: DataConnect, vars: DeleteCapaVariables): MutationPromise<DeleteCapaData, DeleteCapaVariables>;

interface CreateGrupoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGrupoVariables): MutationRef<CreateGrupoData, CreateGrupoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateGrupoVariables): MutationRef<CreateGrupoData, CreateGrupoVariables>;
  operationName: string;
}
export const createGrupoRef: CreateGrupoRef;

export function createGrupo(vars: CreateGrupoVariables): MutationPromise<CreateGrupoData, CreateGrupoVariables>;
export function createGrupo(dc: DataConnect, vars: CreateGrupoVariables): MutationPromise<CreateGrupoData, CreateGrupoVariables>;

interface UpdateGrupoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGrupoVariables): MutationRef<UpdateGrupoData, UpdateGrupoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateGrupoVariables): MutationRef<UpdateGrupoData, UpdateGrupoVariables>;
  operationName: string;
}
export const updateGrupoRef: UpdateGrupoRef;

export function updateGrupo(vars: UpdateGrupoVariables): MutationPromise<UpdateGrupoData, UpdateGrupoVariables>;
export function updateGrupo(dc: DataConnect, vars: UpdateGrupoVariables): MutationPromise<UpdateGrupoData, UpdateGrupoVariables>;

interface DeleteGrupoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGrupoVariables): MutationRef<DeleteGrupoData, DeleteGrupoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteGrupoVariables): MutationRef<DeleteGrupoData, DeleteGrupoVariables>;
  operationName: string;
}
export const deleteGrupoRef: DeleteGrupoRef;

export function deleteGrupo(vars: DeleteGrupoVariables): MutationPromise<DeleteGrupoData, DeleteGrupoVariables>;
export function deleteGrupo(dc: DataConnect, vars: DeleteGrupoVariables): MutationPromise<DeleteGrupoData, DeleteGrupoVariables>;

interface CreateRutaTransporteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateRutaTransporteVariables): MutationRef<CreateRutaTransporteData, CreateRutaTransporteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateRutaTransporteVariables): MutationRef<CreateRutaTransporteData, CreateRutaTransporteVariables>;
  operationName: string;
}
export const createRutaTransporteRef: CreateRutaTransporteRef;

export function createRutaTransporte(vars: CreateRutaTransporteVariables): MutationPromise<CreateRutaTransporteData, CreateRutaTransporteVariables>;
export function createRutaTransporte(dc: DataConnect, vars: CreateRutaTransporteVariables): MutationPromise<CreateRutaTransporteData, CreateRutaTransporteVariables>;

interface UpdateRutaTransporteEstadoRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateRutaTransporteEstadoVariables): MutationRef<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateRutaTransporteEstadoVariables): MutationRef<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;
  operationName: string;
}
export const updateRutaTransporteEstadoRef: UpdateRutaTransporteEstadoRef;

export function updateRutaTransporteEstado(vars: UpdateRutaTransporteEstadoVariables): MutationPromise<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;
export function updateRutaTransporteEstado(dc: DataConnect, vars: UpdateRutaTransporteEstadoVariables): MutationPromise<UpdateRutaTransporteEstadoData, UpdateRutaTransporteEstadoVariables>;

interface DeleteRutaTransporteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteRutaTransporteVariables): MutationRef<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteRutaTransporteVariables): MutationRef<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;
  operationName: string;
}
export const deleteRutaTransporteRef: DeleteRutaTransporteRef;

export function deleteRutaTransporte(vars: DeleteRutaTransporteVariables): MutationPromise<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;
export function deleteRutaTransporte(dc: DataConnect, vars: DeleteRutaTransporteVariables): MutationPromise<DeleteRutaTransporteData, DeleteRutaTransporteVariables>;

interface ListCapasRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCapasData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListCapasData, undefined>;
  operationName: string;
}
export const listCapasRef: ListCapasRef;

export function listCapas(options?: ExecuteQueryOptions): QueryPromise<ListCapasData, undefined>;
export function listCapas(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListCapasData, undefined>;

interface ListGruposRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListGruposData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListGruposData, undefined>;
  operationName: string;
}
export const listGruposRef: ListGruposRef;

export function listGrupos(options?: ExecuteQueryOptions): QueryPromise<ListGruposData, undefined>;
export function listGrupos(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListGruposData, undefined>;

interface ListSubGruposRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSubGruposData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSubGruposData, undefined>;
  operationName: string;
}
export const listSubGruposRef: ListSubGruposRef;

export function listSubGrupos(options?: ExecuteQueryOptions): QueryPromise<ListSubGruposData, undefined>;
export function listSubGrupos(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListSubGruposData, undefined>;

interface ListLineasTransporteRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListLineasTransporteData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListLineasTransporteData, undefined>;
  operationName: string;
}
export const listLineasTransporteRef: ListLineasTransporteRef;

export function listLineasTransporte(options?: ExecuteQueryOptions): QueryPromise<ListLineasTransporteData, undefined>;
export function listLineasTransporte(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListLineasTransporteData, undefined>;

interface ListRutasTransporteRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListRutasTransporteData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListRutasTransporteData, undefined>;
  operationName: string;
}
export const listRutasTransporteRef: ListRutasTransporteRef;

export function listRutasTransporte(options?: ExecuteQueryOptions): QueryPromise<ListRutasTransporteData, undefined>;
export function listRutasTransporte(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListRutasTransporteData, undefined>;

interface GetRutaTransporteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRutaTransporteVariables): QueryRef<GetRutaTransporteData, GetRutaTransporteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetRutaTransporteVariables): QueryRef<GetRutaTransporteData, GetRutaTransporteVariables>;
  operationName: string;
}
export const getRutaTransporteRef: GetRutaTransporteRef;

export function getRutaTransporte(vars: GetRutaTransporteVariables, options?: ExecuteQueryOptions): QueryPromise<GetRutaTransporteData, GetRutaTransporteVariables>;
export function getRutaTransporte(dc: DataConnect, vars: GetRutaTransporteVariables, options?: ExecuteQueryOptions): QueryPromise<GetRutaTransporteData, GetRutaTransporteVariables>;

interface ListReclamosRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListReclamosData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListReclamosData, undefined>;
  operationName: string;
}
export const listReclamosRef: ListReclamosRef;

export function listReclamos(options?: ExecuteQueryOptions): QueryPromise<ListReclamosData, undefined>;
export function listReclamos(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListReclamosData, undefined>;

interface GetUsuarioRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUsuarioVariables): QueryRef<GetUsuarioData, GetUsuarioVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUsuarioVariables): QueryRef<GetUsuarioData, GetUsuarioVariables>;
  operationName: string;
}
export const getUsuarioRef: GetUsuarioRef;

export function getUsuario(vars: GetUsuarioVariables, options?: ExecuteQueryOptions): QueryPromise<GetUsuarioData, GetUsuarioVariables>;
export function getUsuario(dc: DataConnect, vars: GetUsuarioVariables, options?: ExecuteQueryOptions): QueryPromise<GetUsuarioData, GetUsuarioVariables>;

interface GetRolPermisosRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRolPermisosVariables): QueryRef<GetRolPermisosData, GetRolPermisosVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetRolPermisosVariables): QueryRef<GetRolPermisosData, GetRolPermisosVariables>;
  operationName: string;
}
export const getRolPermisosRef: GetRolPermisosRef;

export function getRolPermisos(vars: GetRolPermisosVariables, options?: ExecuteQueryOptions): QueryPromise<GetRolPermisosData, GetRolPermisosVariables>;
export function getRolPermisos(dc: DataConnect, vars: GetRolPermisosVariables, options?: ExecuteQueryOptions): QueryPromise<GetRolPermisosData, GetRolPermisosVariables>;

