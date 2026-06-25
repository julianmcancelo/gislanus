import { ref, push, set, remove, onValue, onChildAdded, off, serverTimestamp } from 'firebase/database';
import { rtdb } from './firebase';

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificacionSolicitud = {
  tipo: 'nueva_solicitud';
  solicitudId: string;
  numeroSolicitud: string;
  nombreSolicitante: string;
  timestamp: object;
};

export function emitirNuevaSolicitud(data: Omit<NotificacionSolicitud, 'tipo' | 'timestamp'>) {
  const r = ref(rtdb, 'notifications/solicitudes');
  return push(r, { ...data, tipo: 'nueva_solicitud', timestamp: serverTimestamp() });
}

export function escucharNotificaciones(
  callback: (notif: NotificacionSolicitud & { key: string }) => void
) {
  const r = ref(rtdb, 'notifications/solicitudes');
  // onChildAdded fires for each new child; first batch (existing) is skipped via firstLoad
  let firstLoad = true;
  let count = 0;
  const unsub = onChildAdded(r, (child: any) => {
    // Count initial children then ignore them; only react to truly new ones
    if (firstLoad) { count++; return; }
    callback({ key: child.key, ...child.val() });
  });
  // After a tick, mark initial load done
  setTimeout(() => { firstLoad = false; }, 500);
  return () => off(r, 'child_added', unsub as any);
}

// ─── Map invalidation ─────────────────────────────────────────────────────────

export function emitirCambioMapa(tipo: 'capas' | 'lineas' | 'rutas') {
  const r = ref(rtdb, `map_invalidate/${tipo}`);
  return set(r, { timestamp: serverTimestamp() });
}

export function escucharCambioMapa(
  tipo: 'capas' | 'lineas' | 'rutas',
  callback: () => void
) {
  const r = ref(rtdb, `map_invalidate/${tipo}`);
  const handler = onValue(r, (snap) => {
    if (snap.exists()) callback();
  });
  return () => off(r, 'value', handler);
}

// ─── Live tracking ────────────────────────────────────────────────────────────

export type TrackingEntry = {
  nombre: string;
  vehiculoId: string;
  lat: number;
  lng: number;
  velocidad?: number;
  timestamp: object;
  activo: boolean;
};

export function publicarPosicion(vehiculoId: string, data: Omit<TrackingEntry, 'timestamp'>) {
  const r = ref(rtdb, `tracking/${vehiculoId}`);
  return set(r, { ...data, timestamp: serverTimestamp() });
}

export function detenerTracking(vehiculoId: string) {
  const r = ref(rtdb, `tracking/${vehiculoId}/activo`);
  return set(r, false);
}

// ─── Collaborative presence ───────────────────────────────────────────────────
// Structure: /presence/{sessionId} → { uid, email, nombre, recurso, color, timestamp }
// recurso: 'linea:{id}' | 'capas' | 'dashboard' | etc.

export type PresenceEntry = {
  uid: string;
  email: string;
  nombre: string;
  recurso: string;  // what the user is currently editing
  color: string;
  timestamp: object;
};

const PRESENCE_COLORS = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316'];
let _presenceColor = '';

export function getPresenceColor(uid: string) {
  if (!_presenceColor) {
    // deterministic color from uid
    const idx = uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PRESENCE_COLORS.length;
    _presenceColor = PRESENCE_COLORS[idx];
  }
  return _presenceColor;
}

export function publicarPresencia(sessionId: string, data: Omit<PresenceEntry, 'timestamp'>) {
  const r = ref(rtdb, `presence/${sessionId}`);
  return set(r, { ...data, timestamp: serverTimestamp() });
}

export function eliminarPresencia(sessionId: string) {
  return remove(ref(rtdb, `presence/${sessionId}`));
}

export function escucharPresencia(
  callback: (entries: (PresenceEntry & { sessionId: string })[]) => void
) {
  const r = ref(rtdb, 'presence');
  const handler = onValue(r, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const entries: any[] = [];
    snap.forEach((child: any) => { entries.push({ sessionId: child.key, ...child.val() }); });
    callback(entries);
  });
  return () => off(r, 'value', handler);
}

// ─── Collaborative linea edits (live waypoints broadcast) ─────────────────────
// Structure: /collab/linea/{lineaId}/waypoints → [[lat,lng], ...]

export function publicarWaypoints(lineaId: string, waypoints: [number, number][]) {
  const r = ref(rtdb, `collab/linea/${lineaId}/waypoints`);
  return set(r, waypoints);
}

export function escucharWaypoints(
  lineaId: string,
  callback: (waypoints: [number, number][]) => void
) {
  const r = ref(rtdb, `collab/linea/${lineaId}/waypoints`);
  const handler = onValue(r, (snap) => {
    callback(snap.exists() ? snap.val() : []);
  });
  return () => off(r, 'value', handler);
}

export function limpiarWaypoints(lineaId: string) {
  return remove(ref(rtdb, `collab/linea/${lineaId}`));
}

export function escucharTracking(
  callback: (entries: (TrackingEntry & { vehiculoId: string })[]) => void
) {
  const r = ref(rtdb, 'tracking');
  const handler = onValue(r, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const entries: any[] = [];
    snap.forEach((child: any) => {
      const val = child.val();
      if (val.activo) entries.push({ vehiculoId: child.key, ...val });
    });
    callback(entries);
  });
  return () => off(r, 'value', handler);
}
