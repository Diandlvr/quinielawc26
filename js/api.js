// =============================================================
// api.js — Cliente del backend
// Envoltorios fetch para los endpoints del servidor.
// =============================================================

async function pedir(url, opciones = {}) {
  const res = await fetch(url, opciones);
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { /* texto */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function listarQuinielas() {
  return pedir('/api/quinielas');
}

export async function obtenerQuiniela(nombre) {
  try {
    return await pedir(`/api/quiniela/${encodeURIComponent(nombre)}`);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export function guardarQuiniela(nombre, payload) {
  return pedir(`/api/quiniela/${encodeURIComponent(nombre)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---------- Resultados reales y puntuación ----------

export function obtenerResultados() {
  return pedir('/api/resultados');
}

export function guardarResultados(payload, pin) {
  return pedir('/api/resultados', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin },
    body: JSON.stringify(payload),
  });
}

export async function verificarPin(pin) {
  try {
    await pedir('/api/admin/verificar', { headers: { 'X-Admin-Pin': pin } });
    return true;
  } catch (e) {
    if (e.status === 401) return false;
    throw e;
  }
}

export function obtenerPuntuaciones() {
  return pedir('/api/puntuaciones');
}
