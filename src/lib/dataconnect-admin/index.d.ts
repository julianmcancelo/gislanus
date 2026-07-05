import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

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
  cargaPeligrosa?: boolean | null;
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
  estado?: string | null;
  tipoServicio?: string | null;
  creadoPorId?: string | null;
  creadoPorNombre?: string | null;
  datosGeo: string;
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

export interface GetCapaData {
  capa?: {
    id: string;
    datosGeo: string;
    visibilidad: string;
    rolesPermitidos?: string[] | null;
  } & Capa_Key;
}

export interface GetCapaVariables {
  id: string;
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
    grupo?: {
      id: string;
      nombre: string;
      color: string;
      visibilidad: string;
      rolesPermitidos?: string[] | null;
    } & Grupo_Key;
    subGrupo?: {
      id: string;
      nombre: string;
      color: string;
    } & SubGrupo_Key;
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
    activo: boolean;
    tipoServicio: string;
    creadoPorId?: string | null;
    creadoPorNombre?: string | null;
    datosGeo: string;
    creadoEn: TimestampString;
    actualizadoEn: TimestampString;
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

/** Generated Node Admin SDK operation action function for the 'UpsertUsuario' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertUsuario(dc: DataConnect, vars: UpsertUsuarioVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertUsuarioData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertUsuario' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertUsuario(vars: UpsertUsuarioVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertUsuarioData>>;

/** Generated Node Admin SDK operation action function for the 'CreateCapa' Mutation. Allow users to execute without passing in DataConnect. */
export function createCapa(dc: DataConnect, vars: CreateCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCapaData>>;
/** Generated Node Admin SDK operation action function for the 'CreateCapa' Mutation. Allow users to pass in custom DataConnect instances. */
export function createCapa(vars: CreateCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCapaData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateCapa' Mutation. Allow users to execute without passing in DataConnect. */
export function updateCapa(dc: DataConnect, vars: UpdateCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCapaData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateCapa' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateCapa(vars: UpdateCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateCapaData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteCapa' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteCapa(dc: DataConnect, vars: DeleteCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCapaData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteCapa' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteCapa(vars: DeleteCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteCapaData>>;

/** Generated Node Admin SDK operation action function for the 'CreateGrupo' Mutation. Allow users to execute without passing in DataConnect. */
export function createGrupo(dc: DataConnect, vars: CreateGrupoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGrupoData>>;
/** Generated Node Admin SDK operation action function for the 'CreateGrupo' Mutation. Allow users to pass in custom DataConnect instances. */
export function createGrupo(vars: CreateGrupoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateGrupoData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateGrupo' Mutation. Allow users to execute without passing in DataConnect. */
export function updateGrupo(dc: DataConnect, vars: UpdateGrupoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateGrupoData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateGrupo' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateGrupo(vars: UpdateGrupoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateGrupoData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteGrupo' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteGrupo(dc: DataConnect, vars: DeleteGrupoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteGrupoData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteGrupo' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteGrupo(vars: DeleteGrupoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteGrupoData>>;

/** Generated Node Admin SDK operation action function for the 'CreateRutaTransporte' Mutation. Allow users to execute without passing in DataConnect. */
export function createRutaTransporte(dc: DataConnect, vars: CreateRutaTransporteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateRutaTransporteData>>;
/** Generated Node Admin SDK operation action function for the 'CreateRutaTransporte' Mutation. Allow users to pass in custom DataConnect instances. */
export function createRutaTransporte(vars: CreateRutaTransporteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateRutaTransporteData>>;

/** Generated Node Admin SDK operation action function for the 'UpdateRutaTransporteEstado' Mutation. Allow users to execute without passing in DataConnect. */
export function updateRutaTransporteEstado(dc: DataConnect, vars: UpdateRutaTransporteEstadoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateRutaTransporteEstadoData>>;
/** Generated Node Admin SDK operation action function for the 'UpdateRutaTransporteEstado' Mutation. Allow users to pass in custom DataConnect instances. */
export function updateRutaTransporteEstado(vars: UpdateRutaTransporteEstadoVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpdateRutaTransporteEstadoData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteRutaTransporte' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteRutaTransporte(dc: DataConnect, vars: DeleteRutaTransporteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteRutaTransporteData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteRutaTransporte' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteRutaTransporte(vars: DeleteRutaTransporteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteRutaTransporteData>>;

/** Generated Node Admin SDK operation action function for the 'ListCapas' Query. Allow users to execute without passing in DataConnect. */
export function listCapas(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListCapasData>>;
/** Generated Node Admin SDK operation action function for the 'ListCapas' Query. Allow users to pass in custom DataConnect instances. */
export function listCapas(options?: OperationOptions): Promise<ExecuteOperationResponse<ListCapasData>>;

/** Generated Node Admin SDK operation action function for the 'GetCapa' Query. Allow users to execute without passing in DataConnect. */
export function getCapa(dc: DataConnect, vars: GetCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCapaData>>;
/** Generated Node Admin SDK operation action function for the 'GetCapa' Query. Allow users to pass in custom DataConnect instances. */
export function getCapa(vars: GetCapaVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCapaData>>;

/** Generated Node Admin SDK operation action function for the 'ListGrupos' Query. Allow users to execute without passing in DataConnect. */
export function listGrupos(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGruposData>>;
/** Generated Node Admin SDK operation action function for the 'ListGrupos' Query. Allow users to pass in custom DataConnect instances. */
export function listGrupos(options?: OperationOptions): Promise<ExecuteOperationResponse<ListGruposData>>;

/** Generated Node Admin SDK operation action function for the 'ListSubGrupos' Query. Allow users to execute without passing in DataConnect. */
export function listSubGrupos(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListSubGruposData>>;
/** Generated Node Admin SDK operation action function for the 'ListSubGrupos' Query. Allow users to pass in custom DataConnect instances. */
export function listSubGrupos(options?: OperationOptions): Promise<ExecuteOperationResponse<ListSubGruposData>>;

/** Generated Node Admin SDK operation action function for the 'ListLineasTransporte' Query. Allow users to execute without passing in DataConnect. */
export function listLineasTransporte(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListLineasTransporteData>>;
/** Generated Node Admin SDK operation action function for the 'ListLineasTransporte' Query. Allow users to pass in custom DataConnect instances. */
export function listLineasTransporte(options?: OperationOptions): Promise<ExecuteOperationResponse<ListLineasTransporteData>>;

/** Generated Node Admin SDK operation action function for the 'ListRutasTransporte' Query. Allow users to execute without passing in DataConnect. */
export function listRutasTransporte(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListRutasTransporteData>>;
/** Generated Node Admin SDK operation action function for the 'ListRutasTransporte' Query. Allow users to pass in custom DataConnect instances. */
export function listRutasTransporte(options?: OperationOptions): Promise<ExecuteOperationResponse<ListRutasTransporteData>>;

/** Generated Node Admin SDK operation action function for the 'GetRutaTransporte' Query. Allow users to execute without passing in DataConnect. */
export function getRutaTransporte(dc: DataConnect, vars: GetRutaTransporteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRutaTransporteData>>;
/** Generated Node Admin SDK operation action function for the 'GetRutaTransporte' Query. Allow users to pass in custom DataConnect instances. */
export function getRutaTransporte(vars: GetRutaTransporteVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRutaTransporteData>>;

/** Generated Node Admin SDK operation action function for the 'ListReclamos' Query. Allow users to execute without passing in DataConnect. */
export function listReclamos(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListReclamosData>>;
/** Generated Node Admin SDK operation action function for the 'ListReclamos' Query. Allow users to pass in custom DataConnect instances. */
export function listReclamos(options?: OperationOptions): Promise<ExecuteOperationResponse<ListReclamosData>>;

/** Generated Node Admin SDK operation action function for the 'GetUsuario' Query. Allow users to execute without passing in DataConnect. */
export function getUsuario(dc: DataConnect, vars: GetUsuarioVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUsuarioData>>;
/** Generated Node Admin SDK operation action function for the 'GetUsuario' Query. Allow users to pass in custom DataConnect instances. */
export function getUsuario(vars: GetUsuarioVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUsuarioData>>;

/** Generated Node Admin SDK operation action function for the 'GetRolPermisos' Query. Allow users to execute without passing in DataConnect. */
export function getRolPermisos(dc: DataConnect, vars: GetRolPermisosVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRolPermisosData>>;
/** Generated Node Admin SDK operation action function for the 'GetRolPermisos' Query. Allow users to pass in custom DataConnect instances. */
export function getRolPermisos(vars: GetRolPermisosVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetRolPermisosData>>;

