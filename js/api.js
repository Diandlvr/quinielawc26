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
