// =============================================================
// server.js — Servidor estático + API mínima (Node nativo, sin deps)
// Uso: `node server.js` o `npm start`
//
// Rutas API:
//   GET  /api/quinielas              -> lista de nombres + metadata
//   GET  /api/quiniela/:nombre       -> quiniela completa de un usuario
//   PUT  /api/quiniela/:nombre       -> guarda la quiniela de un usuario
//
// Persistencia: archivo data/quinielas.json
// =============================================================

import { createServer } from 'node:http';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUERTO = Number(process.env.PORT) || 8000;
const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)));
const RUTA_DATOS = join(RAIZ, 'data', 'quinielas.json');

// Tipos MIME para los archivos estáticos.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.map':  'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
};

// ---------- Persistencia JSON ----------
// Cola simple para serializar escrituras y evitar carreras
// (lectura-modificación-escritura sobre el mismo archivo).
let colaEscritura = Promise.resolve();

async function leerQuinielas() {
  try {
    const txt = await readFile(RUTA_DATOS, 'utf-8');
    return JSON.parse(txt);
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

async function escribirQuinielas(obj) {
  await mkdir(dirname(RUTA_DATOS), { recursive: true });
  await writeFile(RUTA_DATOS, JSON.stringify(obj, null, 2), 'utf-8');
}

function actualizarUsuario(nombre, payload) {
  // Se encadena en colaEscritura para garantizar atomicidad lógica.
  colaEscritura = colaEscritura.then(async () => {
    const datos = await leerQuinielas();
    datos[nombre] = {
      marcadores: payload.marcadores || {},
      eliminatorias: payload.eliminatorias || {},
      actualizado: new Date().toISOString(),
    };
    await escribirQuinielas(datos);
    return datos[nombre];
  });
  return colaEscritura;
}

// ---------- Helpers HTTP ----------
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function leerCuerpoJSON(req, limite = 200_000) {
  return new Promise((resolveBody, rejectBody) => {
    let total = 0;
    const trozos = [];
    req.on('data', t => {
      total += t.length;
      if (total > limite) {
        rejectBody(new Error('Cuerpo demasiado grande'));
        req.destroy();
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => {
      try {
        const txt = Buffer.concat(trozos).toString('utf-8');
        resolveBody(txt ? JSON.parse(txt) : {});
      } catch (e) {
        rejectBody(e);
      }
    });
    req.on('error', rejectBody);
  });
}

// Limpia y valida un nombre de usuario. Devuelve `null` si no es válido.
function normalizarNombre(crudo) {
  if (typeof crudo !== 'string') return null;
  const n = crudo.trim();
  if (n.length < 1 || n.length > 40) return null;
  // Bloquea caracteres de control y comillas para evitar inyecciones visuales.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f"<>]/.test(n)) return null;
  return n;
}

// ---------- Rutas API ----------
async function manejarAPI(req, res, ruta) {
  // GET /api/quinielas -> lista de nombres + metadata
  if (req.method === 'GET' && ruta === '/api/quinielas') {
    const datos = await leerQuinielas();
    const lista = Object.entries(datos).map(([nombre, q]) => ({
      nombre,
      actualizado: q.actualizado || null,
      partidosCompletados: contarPartidosCompletados(q.marcadores),
      ganadoresElegidos: Object.values(q.eliminatorias || {})
        .filter(e => e && e.ganadorId).length,
    }));
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return json(res, 200, { quinielas: lista });
  }

  // GET /api/quiniela/:nombre
  const matchGet = req.method === 'GET' && ruta.match(/^\/api\/quiniela\/(.+)$/);
  if (matchGet) {
    const nombre = normalizarNombre(decodeURIComponent(matchGet[1]));
    if (!nombre) return json(res, 400, { error: 'Nombre inválido' });
    const datos = await leerQuinielas();
    const q = datos[nombre];
    if (!q) return json(res, 404, { error: 'No existe', nombre });
    return json(res, 200, { nombre, ...q });
  }

  // PUT /api/quiniela/:nombre
  const matchPut = req.method === 'PUT' && ruta.match(/^\/api\/quiniela\/(.+)$/);
  if (matchPut) {
    const nombre = normalizarNombre(decodeURIComponent(matchPut[1]));
    if (!nombre) return json(res, 400, { error: 'Nombre inválido' });
    let payload;
    try { payload = await leerCuerpoJSON(req); }
    catch { return json(res, 400, { error: 'JSON inválido o demasiado grande' }); }
    const guardado = await actualizarUsuario(nombre, payload);
    return json(res, 200, { nombre, ...guardado });
  }

  return json(res, 404, { error: 'Ruta API no encontrada' });
}

function contarPartidosCompletados(marcadores = {}) {
  let n = 0;
  for (const id in marcadores) {
    const m = marcadores[id];
    if (m && m.local != null && m.visitante != null) n++;
  }
  return n;
}

// ---------- Archivos estáticos ----------
function resolverRuta(urlPath) {
  const limpio = decodeURIComponent(urlPath.split('?')[0]);
  const ruta = normalize(join(RAIZ, limpio));
  if (!ruta.startsWith(RAIZ + sep) && ruta !== RAIZ) return null;
  return ruta;
}

async function manejarEstatico(req, res) {
  let ruta = resolverRuta(req.url || '/');
  if (!ruta) { res.writeHead(403); res.end('Prohibido'); return; }

  try {
    const info = await stat(ruta);
    if (info.isDirectory()) ruta = join(ruta, 'index.html');
  } catch {
    if (req.url === '/' || req.url === '') ruta = join(RAIZ, 'index.html');
  }

  try {
    const datos = await readFile(ruta);
    const tipo = MIME[extname(ruta).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
    res.end(datos);
  } catch (e) {
    if (e.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — No encontrado: ' + req.url);
    } else {
      console.error('Error sirviendo', req.url, e);
      res.writeHead(500); res.end('Error interno');
    }
  }
}

// ---------- Dispatcher ----------
async function manejar(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) {
      return manejarAPI(req, res, url.pathname);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); res.end('Método no permitido'); return;
    }
    return manejarEstatico(req, res);
  } catch (e) {
    console.error('Error inesperado', e);
    res.writeHead(500); res.end('Error interno');
  }
}

createServer(manejar).listen(PUERTO, () => {
  console.log(`\n  ⚽ Quiniela del Mundial 2026`);
  console.log(`  Sirviendo desde: ${RAIZ}`);
  console.log(`  Datos en:        ${RUTA_DATOS}`);
  console.log(`  Abre tu navegador en: http://localhost:${PUERTO}\n`);
});
