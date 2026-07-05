const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default',
  service: 'lanus-gis',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const upsertUsuarioRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUsuario', inputVars);
}
upsertUsuarioRef.operationName = 'UpsertUsuario';
exports.upsertUsuarioRef = upsertUsuarioRef;

exports.upsertUsuario = function upsertUsuario(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertUsuarioRef(dcInstance, inputVars));
}
;

const createCapaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCapa', inputVars);
}
createCapaRef.operationName = 'CreateCapa';
exports.createCapaRef = createCapaRef;

exports.createCapa = function createCapa(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createCapaRef(dcInstance, inputVars));
}
;

const updateCapaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateCapa', inputVars);
}
updateCapaRef.operationName = 'UpdateCapa';
exports.updateCapaRef = updateCapaRef;

exports.updateCapa = function updateCapa(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateCapaRef(dcInstance, inputVars));
}
;

const deleteCapaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteCapa', inputVars);
}
deleteCapaRef.operationName = 'DeleteCapa';
exports.deleteCapaRef = deleteCapaRef;

exports.deleteCapa = function deleteCapa(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteCapaRef(dcInstance, inputVars));
}
;

const createGrupoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateGrupo', inputVars);
}
createGrupoRef.operationName = 'CreateGrupo';
exports.createGrupoRef = createGrupoRef;

exports.createGrupo = function createGrupo(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createGrupoRef(dcInstance, inputVars));
}
;

const updateGrupoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateGrupo', inputVars);
}
updateGrupoRef.operationName = 'UpdateGrupo';
exports.updateGrupoRef = updateGrupoRef;

exports.updateGrupo = function updateGrupo(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateGrupoRef(dcInstance, inputVars));
}
;

const deleteGrupoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteGrupo', inputVars);
}
deleteGrupoRef.operationName = 'DeleteGrupo';
exports.deleteGrupoRef = deleteGrupoRef;

exports.deleteGrupo = function deleteGrupo(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteGrupoRef(dcInstance, inputVars));
}
;

const createRutaTransporteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateRutaTransporte', inputVars);
}
createRutaTransporteRef.operationName = 'CreateRutaTransporte';
exports.createRutaTransporteRef = createRutaTransporteRef;

exports.createRutaTransporte = function createRutaTransporte(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createRutaTransporteRef(dcInstance, inputVars));
}
;

const updateRutaTransporteEstadoRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateRutaTransporteEstado', inputVars);
}
updateRutaTransporteEstadoRef.operationName = 'UpdateRutaTransporteEstado';
exports.updateRutaTransporteEstadoRef = updateRutaTransporteEstadoRef;

exports.updateRutaTransporteEstado = function updateRutaTransporteEstado(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateRutaTransporteEstadoRef(dcInstance, inputVars));
}
;

const deleteRutaTransporteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'DeleteRutaTransporte', inputVars);
}
deleteRutaTransporteRef.operationName = 'DeleteRutaTransporte';
exports.deleteRutaTransporteRef = deleteRutaTransporteRef;

exports.deleteRutaTransporte = function deleteRutaTransporte(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(deleteRutaTransporteRef(dcInstance, inputVars));
}
;

const listCapasRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListCapas');
}
listCapasRef.operationName = 'ListCapas';
exports.listCapasRef = listCapasRef;

exports.listCapas = function listCapas(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listCapasRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getCapaRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCapa', inputVars);
}
getCapaRef.operationName = 'GetCapa';
exports.getCapaRef = getCapaRef;

exports.getCapa = function getCapa(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getCapaRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listGruposRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListGrupos');
}
listGruposRef.operationName = 'ListGrupos';
exports.listGruposRef = listGruposRef;

exports.listGrupos = function listGrupos(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listGruposRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listSubGruposRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSubGrupos');
}
listSubGruposRef.operationName = 'ListSubGrupos';
exports.listSubGruposRef = listSubGruposRef;

exports.listSubGrupos = function listSubGrupos(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listSubGruposRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listLineasTransporteRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListLineasTransporte');
}
listLineasTransporteRef.operationName = 'ListLineasTransporte';
exports.listLineasTransporteRef = listLineasTransporteRef;

exports.listLineasTransporte = function listLineasTransporte(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listLineasTransporteRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getLineaTransporteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetLineaTransporte', inputVars);
}
getLineaTransporteRef.operationName = 'GetLineaTransporte';
exports.getLineaTransporteRef = getLineaTransporteRef;

exports.getLineaTransporte = function getLineaTransporte(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getLineaTransporteRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listRutasTransporteRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListRutasTransporte');
}
listRutasTransporteRef.operationName = 'ListRutasTransporte';
exports.listRutasTransporteRef = listRutasTransporteRef;

exports.listRutasTransporte = function listRutasTransporte(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listRutasTransporteRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getRutaTransporteRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetRutaTransporte', inputVars);
}
getRutaTransporteRef.operationName = 'GetRutaTransporte';
exports.getRutaTransporteRef = getRutaTransporteRef;

exports.getRutaTransporte = function getRutaTransporte(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getRutaTransporteRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listReclamosRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListReclamos');
}
listReclamosRef.operationName = 'ListReclamos';
exports.listReclamosRef = listReclamosRef;

exports.listReclamos = function listReclamos(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listReclamosRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUsuarioRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUsuario', inputVars);
}
getUsuarioRef.operationName = 'GetUsuario';
exports.getUsuarioRef = getUsuarioRef;

exports.getUsuario = function getUsuario(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUsuarioRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getRolPermisosRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetRolPermisos', inputVars);
}
getRolPermisosRef.operationName = 'GetRolPermisos';
exports.getRolPermisosRef = getRolPermisosRef;

exports.getRolPermisos = function getRolPermisos(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getRolPermisosRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getUsuarioByEmailRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetUsuarioByEmail', inputVars);
}
getUsuarioByEmailRef.operationName = 'GetUsuarioByEmail';
exports.getUsuarioByEmailRef = getUsuarioByEmailRef;

exports.getUsuarioByEmail = function getUsuarioByEmail(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getUsuarioByEmailRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listUsuariosRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListUsuarios');
}
listUsuariosRef.operationName = 'ListUsuarios';
exports.listUsuariosRef = listUsuariosRef;

exports.listUsuarios = function listUsuarios(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listUsuariosRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
