// =============================================================
// main.js — Punto de entrada
// =============================================================

import { suscribir, estado, cargarQuinielaDe } from './state.js';
import { render, bindBarraAcciones } from './ui.js';

// Tema desde localStorage (si existía)
const temaGuardado = localStorage.getItem('quiniela-tema');
if (temaGuardado) document.documentElement.dataset.tema = temaGuardado;

// Re-render en cada cambio del estado
suscribir(render);

// Botones generales
bindBarraAcciones();

// Si ya había un usuario en localStorage, traemos su quiniela del servidor
// ANTES del primer render para evitar parpadeo.
(async () => {
  if (estado.usuario) {
    try { await cargarQuinielaDe(estado.usuario, false); }
    catch (e) { console.warn('No se pudo precargar la quiniela', e); }
  }
  render();
})();

// Navegación entre tabs con flechas izq/der
document.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  if (e.target.matches('input, button, [contenteditable]')) return;
  const tabs = [...document.querySelectorAll('#tabs .tab')];
  const idx = tabs.findIndex(t => t.classList.contains('tab-activa'));
  if (idx < 0) return;
  const nuevo = e.key === 'ArrowRight'
    ? Math.min(tabs.length - 1, idx + 1)
    : Math.max(0, idx - 1);
  tabs[nuevo].click();
});

window.__quiniela__ = { estado };
