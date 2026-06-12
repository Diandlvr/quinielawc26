// =============================================================
// state.js — Estado central de la quiniela
// Persistencia: backend Node (server.js) por nombre de usuario.
// Solo se guarda en localStorage el nombre del usuario actual.
// =============================================================

import { PARTIDOS_GRUPOS } from './data.js';
import { obtenerQuiniela, guardarQuiniela } from './api.js';

const CLAVE_USUARIO = 'quiniela-mundial-2026:usuario';

// Estructura del estado:
// {
//   usuario: string|null,             -> nombre del propietario de la quiniela actual
//   modoSoloLectura: boolean,         -> true al ver la quiniela de OTRA persona
//   marcadores, eliminatorias,        -> datos de la quiniela cargada
//   vistaActual: string,
//   historial: [snapshots],
//   estadoSync: 'ok'|'guardando'|'error',
// }

function marcadoresVacios() {
  const m = {};
  for (const p of PARTIDOS_GRUPOS) m[p.id] = { local: null, visitante: null };
  return m;
}

function estadoInicial() {
  return {
    usuario: localStorage.getItem(CLAVE_USUARIO) || null,
    modoSoloLectura: false,
    propietarioVisible: null, // nombre cuya quiniela se está mostrando
    marcadores: marcadoresVacios(),
    eliminatorias: {},
    vistaActual: 'grupos',
    historial: [],
    estadoSync: 'ok',
  };
}

export const estado = estadoInicial();

// ---------- Observer ----------
const suscriptores = new Set();
export function suscribir(fn) { suscriptores.add(fn); return () => suscriptores.delete(fn); }
export function notificar() {
  for (const fn of suscriptores) fn(estado);
  programarGuardado();
}

// ---------- Snapshot para deshacer ----------
function snapshot() {
  estado.historial.push(JSON.stringify({
    marcadores: estado.marcadores,
    eliminatorias: estado.eliminatorias,
  }));
  if (estado.historial.length > 30) estado.historial.shift();
}

// ---------- Mutaciones ----------
export function setMarcador(partidoId, lado, valor) {
  if (estado.modoSoloLectura) return;
  let v = Number(valor);
  if (!Number.isFinite(v) || v < 0) v = 0;
  v = Math.min(v, 99);
  const actual = estado.marcadores[partidoId];
  if (!actual || actual[lado] === v) return;
  snapshot();
  actual[lado] = v;
  notificar();
}

export function limpiarMarcador(partidoId) {
  if (estado.modoSoloLectura) return;
  snapshot();
  estado.marcadores[partidoId] = { local: null, visitante: null };
  notificar();
}

export function setGanador(matchId, ganadorId) {
  if (estado.modoSoloLectura) return;
  snapshot();
  if (!estado.eliminatorias[matchId]) estado.eliminatorias[matchId] = { ganadorId: null };
  estado.eliminatorias[matchId].ganadorId = ganadorId;
  notificar();
}

export function setVista(vista) {
  estado.vistaActual = vista;
  notificar();
}

export function deshacer() {
  if (estado.modoSoloLectura) return false;
  const ultimo = estado.historial.pop();
  if (!ultimo) return false;
  const snap = JSON.parse(ultimo);
  estado.marcadores = snap.marcadores;
  estado.eliminatorias = snap.eliminatorias;
  notificar();
  return true;
}

export function reiniciar() {
  if (estado.modoSoloLectura) return;
  estado.marcadores = marcadoresVacios();
  estado.eliminatorias = {};
  estado.historial = [];
  notificar();
}

// ---------- Sesión ----------

// Inicia o cambia el usuario actual. Carga su quiniela desde el servidor;
// si no existe en el server, arranca vacía (se creará al primer guardado).
export async function setUsuario(nombreCrudo) {
  const nombre = (nombreCrudo || '').trim();
  if (!nombre) return;
  estado.usuario = nombre;
  estado.modoSoloLectura = false;
  estado.propietarioVisible = nombre;
  localStorage.setItem(CLAVE_USUARIO, nombre);
  await cargarQuinielaDe(nombre, false);
}

export function cerrarSesion() {
  estado.usuario = null;
  estado.modoSoloLectura = false;
  estado.propietarioVisible = null;
  estado.marcadores = marcadoresVacios();
  estado.eliminatorias = {};
  estado.historial = [];
  localStorage.removeItem(CLAVE_USUARIO);
  notificar();
}

// Carga la quiniela de un usuario desde el servidor.
// `soloLectura=true` cuando se ve la quiniela de OTRA persona.
export async function cargarQuinielaDe(nombre, soloLectura) {
  estado.estadoSync = 'guardando';
  notificar();
  try {
    const data = await obtenerQuiniela(nombre);
    const base = marcadoresVacios();
    estado.marcadores = { ...base, ...(data?.marcadores || {}) };
    estado.eliminatorias = data?.eliminatorias || {};
    estado.historial = [];
    estado.modoSoloLectura = !!soloLectura;
    estado.propietarioVisible = nombre;
    estado.estadoSync = 'ok';
  } catch (e) {
    console.error('No se pudo cargar la quiniela', e);
    estado.estadoSync = 'error';
  }
  notificar();
}

// Volver a la quiniela propia tras haber visto otra.
export async function volverAMiQuiniela() {
  if (!estado.usuario) return;
  await cargarQuinielaDe(estado.usuario, false);
}

// ---------- Guardado en servidor (debounced) ----------
let timerGuardado = null;
let enVuelo = null; // promesa de petición en curso (para serializar)

function programarGuardado() {
  if (estado.modoSoloLectura) return;
  if (!estado.usuario) return;
  clearTimeout(timerGuardado);
  timerGuardado = setTimeout(guardarEnServidor, 600);
}

async function guardarEnServidor() {
  if (!estado.usuario || estado.modoSoloLectura) return;
  // Si hay una petición en vuelo, esperamos a que termine para evitar
  // mandar versiones obsoletas en paralelo.
  if (enVuelo) await enVuelo.catch(() => {});
  estado.estadoSync = 'guardando';
  notificarSoloEstado();
  const payload = {
    marcadores: estado.marcadores,
    eliminatorias: estado.eliminatorias,
  };
  enVuelo = guardarQuiniela(estado.usuario, payload)
    .then(() => { estado.estadoSync = 'ok'; })
    .catch(e => { console.warn('Error al guardar', e); estado.estadoSync = 'error'; })
    .finally(() => {
      enVuelo = null;
      notificarSoloEstado();
    });
}

// Notifica suscriptores SIN re-disparar guardado (para feedback de sync).
function notificarSoloEstado() {
  for (const fn of suscriptores) fn(estado);
}

// ---------- Exportar JSON ----------
export function exportarJSON() {
  return JSON.stringify({
    version: 2,
    usuario: estado.propietarioVisible,
    fecha: new Date().toISOString(),
    marcadores: estado.marcadores,
    eliminatorias: estado.eliminatorias,
  }, null, 2);
}
