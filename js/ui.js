// =============================================================
// ui.js — CAPA DE PRESENTACIÓN
// Renderiza el DOM a partir del estado y maneja eventos del usuario.
// =============================================================

import { GRUPOS, EQUIPOS_POR_ID, urlBandera, generarPartidosDeGrupo } from './data.js';
import {
  estado, setMarcador, setGanador, setVista,
  deshacer, reiniciar, exportarJSON, limpiarMarcador,
  setUsuario, cerrarSesion, cargarQuinielaDe, volverAMiQuiniela,
} from './state.js';
import {
  calcularTodo, rankingTerceros, progresoGrupos, fasGruposCompleta,
  grupoCompleto,
} from './standings.js';
import { resolverBracket } from './bracket.js';
import { listarQuinielas } from './api.js';

// --------- Helpers DOM ---------
const $ = sel => document.querySelector(sel);

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return n;
}

function bandera(eq, size = 'sm') {
  if (!eq) return el('span', { class: 'bandera bandera-placeholder' });
  return el('img', {
    src: urlBandera(eq.bandera),
    alt: `Bandera de ${eq.nombre}`,
    class: `bandera bandera-${size}`,
    loading: 'lazy',
    width: size === 'lg' ? 120 : 32,
  });
}

function stepper(partidoId, lado, valor, deshabilitado) {
  const cont = el('div', {
    class: 'stepper' + (deshabilitado ? ' stepper-disabled' : ''),
    role: 'group', 'aria-label': `Goles ${lado}`,
  });
  const dec = el('button', {
    type: 'button', class: 'stepper-btn',
    'aria-label': `Restar gol`, disabled: deshabilitado || false,
    onclick: () => setMarcador(partidoId, lado, (valor ?? 0) - 1),
  }, '−');
  const input = el('input', {
    type: 'number', min: '0', max: '99', step: '1',
    inputmode: 'numeric', class: 'stepper-input',
    value: valor ?? '', placeholder: '–',
    'aria-label': `Marcador ${lado}`, disabled: deshabilitado || false,
  });
  input.addEventListener('change', e => setMarcador(partidoId, lado, e.target.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setMarcador(partidoId, lado, (valor ?? 0) + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarcador(partidoId, lado, (valor ?? 0) - 1); }
  });
  const inc = el('button', {
    type: 'button', class: 'stepper-btn',
    'aria-label': `Sumar gol`, disabled: deshabilitado || false,
    onclick: () => setMarcador(partidoId, lado, (valor ?? 0) + 1),
  }, '+');
  cont.append(dec, input, inc);
  return cont;
}

// --------- Toast ---------
let toastTimer = null;
function toast(msg, tipo = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast toast-${tipo} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2500);
}

// --------- Helpers de estado de progreso ---------
function gruposCompletados() {
  return GRUPOS.filter(g => grupoCompleto(g, estado.marcadores));
}
function totalGanadoresElegidos() {
  return Object.values(estado.eliminatorias).filter(e => e?.ganadorId).length;
}

// =============================================================
// RENDER PRINCIPAL
// =============================================================

export function render() {
  if (!estado.usuario) {
    document.body.classList.add('sin-sesion');
    renderLogin();
    return;
  }
  document.body.classList.remove('sin-sesion');
  ocultarLogin();

  renderBarraSesion();
  renderFlujoPasos();
  renderTabs();

  const vista = estado.vistaActual;
  const cont = $('#vista');
  cont.innerHTML = '';
  cont.classList.add('fade-in');
  setTimeout(() => cont.classList.remove('fade-in'), 300);

  if (estado.modoSoloLectura) {
    cont.appendChild(el('div', { class: 'banner-solo-lectura', role: 'status' },
      el('span', {}, '👁 Viendo la quiniela de ', el('strong', {}, estado.propietarioVisible)),
      el('button', { class: 'btn btn-claro', onclick: volverAMiQuiniela }, '← Volver a la mía'),
    ));
  }

  if (vista === 'grupos') renderGrupos(cont);
  else if (vista === 'terceros') renderTerceros(cont);
  else if (vista === 'quinielas') renderQuinielas(cont);
  else if (vista === 'final') renderCampeon(cont);
  else renderRondaEliminatoria(cont, vista);
}

// =============================================================
// LOGIN
// =============================================================

function renderLogin() {
  let overlay = $('#login-overlay');
  if (!overlay) {
    overlay = el('div', { id: 'login-overlay', class: 'login-overlay', role: 'dialog',
      'aria-modal': 'true', 'aria-labelledby': 'login-title' });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '';

  const inp = el('input', {
    id: 'login-input', class: 'login-input', type: 'text',
    placeholder: 'Ej: Juan', maxlength: '40', autocomplete: 'nickname', required: 'required',
  });
  const btn = el('button', { type: 'submit', class: 'btn btn-grande' }, 'Comenzar →');

  const form = el('form', {
    class: 'login-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const val = inp.value.trim();
      if (!val) { inp.focus(); return; }
      btn.disabled = true;
      btn.textContent = 'Cargando…';
      try { await setUsuario(val); }
      catch { toast('Error iniciando sesión', 'error'); btn.disabled = false; btn.textContent = 'Comenzar →'; }
    },
  },
    el('label', { class: 'login-label', for: 'login-input' }, 'Tu nombre'),
    inp,
    btn,
  );

  overlay.appendChild(el('div', { class: 'login-card' },
    el('div', { class: 'login-icon', html: `
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#0b2353"/>
        <circle cx="32" cy="32" r="18" fill="#fff"/>
        <path d="M32 16l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="#ffd24c"/>
      </svg>` }),
    el('h1', { id: 'login-title', class: 'login-titulo' }, 'Quiniela Mundial 2026'),
    el('p', { class: 'login-sub' }, 'Escribe tu nombre para empezar (o continuar) tu quiniela.'),
    form,
    el('div', { class: 'login-pasos' },
      el('div', { class: 'login-paso' }, el('span', { class: 'paso-num' }, '1'), 'Escribe tu nombre'),
      el('div', { class: 'login-paso' }, el('span', { class: 'paso-num' }, '2'), 'Predice los 72 partidos'),
      el('div', { class: 'login-paso' }, el('span', { class: 'paso-num' }, '3'), 'Completa el bracket eliminatorio'),
      el('div', { class: 'login-paso' }, el('span', { class: 'paso-num' }, '4'), '¡Descubre tu campeón!'),
    ),
    el('p', { class: 'login-foot' }, 'Tu quiniela se guarda automáticamente. Puedes volver más tarde con el mismo nombre.'),
  ));

  overlay.classList.add('visible');
  setTimeout(() => inp.focus(), 50);
}

function ocultarLogin() {
  const o = $('#login-overlay');
  if (o) o.classList.remove('visible');
}

// =============================================================
// BARRA DE SESIÓN
// =============================================================

function renderBarraSesion() {
  const cont = $('#sesion');
  cont.innerHTML = '';
  const syncIcono = { ok: '✓', guardando: '⟳', error: '⚠' }[estado.estadoSync] || '';
  const syncTexto = { ok: 'Guardado', guardando: 'Guardando…', error: 'Error al guardar' }[estado.estadoSync] || '';
  cont.appendChild(el('span', {
    class: `sync sync-${estado.estadoSync}`, title: syncTexto, 'aria-label': syncTexto,
  }, syncIcono, ' ', el('span', { class: 'sync-texto' }, syncTexto)));
  cont.appendChild(el('span', { class: 'usuario-actual' },
    '👤 ', el('strong', {}, estado.usuario)));
  cont.appendChild(el('button', {
    class: 'btn btn-fantasma btn-pequeno',
    onclick: () => {
      if (confirm('¿Salir y cambiar de usuario? Tu quiniela queda guardada en el servidor.')) cerrarSesion();
    },
  }, 'Cambiar usuario'));
}

// =============================================================
// FLUJO DE PASOS (reemplaza la barra de progreso simple)
// =============================================================

function renderFlujoPasos() {
  const { hechos, total } = progresoGrupos(estado.marcadores);
  const gruposListo = hechos === total;
  const bracketGanadores = totalGanadoresElegidos();
  // Hay 16+8+4+2+1+1 = 32 partidos eliminatorios pero solo contamos los "naturales" (no 3er puesto) = 31
  const finalListo = resolverBracketCampeon();

  const pasos = [
    {
      id: 'grupos',
      icono: '⚽',
      label: 'Grupos',
      detalle: gruposListo ? '72/72 ✓' : `${hechos}/72`,
      estado: gruposListo ? 'hecho' : (hechos > 0 ? 'activo' : 'pendiente'),
    },
    {
      id: 'r32',
      icono: '🏟',
      label: 'Bracket',
      detalle: gruposListo ? (bracketGanadores > 0 ? `${bracketGanadores} elegidos` : 'Por iniciar') : 'Bloqueado',
      estado: !gruposListo ? 'bloqueado' : (bracketGanadores > 0 ? (finalListo ? 'hecho' : 'activo') : 'pendiente'),
    },
    {
      id: 'final',
      icono: '🏆',
      label: 'Campeón',
      detalle: finalListo ? '¡Listo!' : (gruposListo ? 'Por definir' : 'Bloqueado'),
      estado: !gruposListo ? 'bloqueado' : (finalListo ? 'hecho' : 'pendiente'),
    },
  ];

  // Actualizar la barra delgada de progreso (línea de fondo del header)
  const barEl = $('#progreso-bar');
  if (barEl) barEl.style.width = gruposListo ? '100%' : `${(hechos / total) * 100}%`;

  // Renderizar los pasos en la nueva área
  let stepsEl = $('#flujo-pasos');
  if (!stepsEl) {
    stepsEl = el('div', { id: 'flujo-pasos', class: 'flujo-pasos' });
    const progresoEl = document.querySelector('.progreso');
    if (progresoEl) progresoEl.appendChild(stepsEl);
  }
  stepsEl.innerHTML = '';

  pasos.forEach((paso, i) => {
    const esActual = estado.vistaActual === paso.id ||
      (paso.id === 'r32' && ['r32','r16','cuartos','semis'].includes(estado.vistaActual)) ||
      (paso.id === 'final' && estado.vistaActual === 'final');

    const btn = el('button', {
      class: `flujo-paso flujo-paso-${paso.estado}` + (esActual ? ' flujo-paso-actual' : ''),
      onclick: () => paso.estado !== 'bloqueado' && setVista(paso.id),
      disabled: paso.estado === 'bloqueado',
      title: paso.estado === 'bloqueado' ? 'Completa los grupos primero' : `Ir a ${paso.label}`,
    },
      el('span', { class: 'flujo-icono' }, paso.icono),
      el('span', { class: 'flujo-label' }, paso.label),
      el('span', { class: 'flujo-detalle' }, paso.detalle),
    );
    stepsEl.appendChild(btn);

    if (i < pasos.length - 1) {
      stepsEl.appendChild(el('span', { class: 'flujo-sep', 'aria-hidden': 'true' }, '›'));
    }
  });
}

function resolverBracketCampeon() {
  try {
    if (!fasGruposCompleta(estado.marcadores)) return false;
    const tablas = calcularTodo(estado.marcadores);
    const terceros = rankingTerceros(tablas);
    const r = resolverBracket(tablas, terceros, estado.eliminatorias);
    return !!(r.final[0]?._ganador);
  } catch { return false; }
}

// =============================================================
// TABS — con estado visual claro
// =============================================================

const VISTAS = [
  { id: 'grupos',    etiqueta: 'Grupos',    icono: '⚽' },
  { id: 'terceros',  etiqueta: 'Terceros',  icono: '📊' },
  { id: 'r32',       etiqueta: 'Ronda 32',  icono: null },
  { id: 'r16',       etiqueta: 'Octavos',   icono: null },
  { id: 'cuartos',   etiqueta: 'Cuartos',   icono: null },
  { id: 'semis',     etiqueta: 'Semis',     icono: null },
  { id: 'final',     etiqueta: 'Final',     icono: '🏆' },
  { id: 'quinielas', etiqueta: 'Quinielas', icono: '👥' },
];

function tabInfoFn(vistaId) {
  const { hechos, total } = progresoGrupos(estado.marcadores);
  const gruposListo = hechos === total;
  const bracketViews = ['r32', 'r16', 'cuartos', 'semis', 'final'];

  if (vistaId === 'grupos') {
    if (hechos === total) return { clase: 'tab-done', badge: '✓', bloqueado: false };
    if (hechos > 0) return { clase: 'tab-progreso', badge: `${hechos}/${total}`, bloqueado: false };
    return { clase: '', badge: null, bloqueado: false };
  }
  if (vistaId === 'terceros') {
    if (!gruposListo) return { clase: 'tab-locked', badge: '🔒', bloqueado: false }; // permitir clic (se verá incompleto)
    return { clase: 'tab-done', badge: '✓', bloqueado: false };
  }
  if (bracketViews.includes(vistaId)) {
    if (!gruposListo) return { clase: 'tab-locked', badge: '🔒', bloqueado: true };
    const g = totalGanadoresElegidos();
    if (g > 0) return { clase: 'tab-progreso', badge: `${g}✓`, bloqueado: false };
    return { clase: '', badge: null, bloqueado: false };
  }
  return { clase: '', badge: null, bloqueado: false };
}

// Devuelve el id de la próxima vista sugerida para guiar al usuario.
function proximaVistaSugerida() {
  const { hechos, total } = progresoGrupos(estado.marcadores);
  if (hechos < total) return 'grupos';
  const g = totalGanadoresElegidos();
  if (g === 0) return 'r32';
  if (!resolverBracketCampeon()) return 'final';
  return null;
}

function renderTabs() {
  const cont = $('#tabs');
  cont.innerHTML = '';
  const sugerida = proximaVistaSugerida();

  for (const v of VISTAS) {
    const activa = estado.vistaActual === v.id;
    const info = tabInfoFn(v.id);
    const esSiguiente = v.id === sugerida && !activa;

    const btn = el('button', {
      type: 'button',
      class: ['tab', info.clase, activa ? 'tab-activa' : '', esSiguiente ? 'tab-siguiente' : ''].filter(Boolean).join(' '),
      role: 'tab',
      'aria-selected': activa ? 'true' : 'false',
      disabled: info.bloqueado,
      title: info.bloqueado ? 'Completa todos los partidos de grupos primero' : '',
      onclick: () => !info.bloqueado && setVista(v.id),
    },
      v.etiqueta,
      info.badge ? el('span', { class: 'tab-badge' }, info.badge) : null,
      esSiguiente ? el('span', { class: 'tab-siguiente-dot', 'aria-label': 'Paso siguiente recomendado' }) : null,
    );
    cont.appendChild(btn);
  }
}

// =============================================================
// VISTA: GRUPOS
// =============================================================

function renderGrupos(cont) {
  const { hechos, total } = progresoGrupos(estado.marcadores);
  const gruposListo = hechos === total;
  const faltantes = total - hechos;

  // Hint contextual arriba
  if (!estado.modoSoloLectura) {
    if (hechos === 0) {
      cont.appendChild(el('div', { class: 'hint-card hint-card-info' },
        el('span', { class: 'hint-icono' }, '💡'),
        el('div', {},
          el('strong', {}, '¿Cómo funciona?'),
          el('span', {}, ' Ingresa el marcador de cada partido usando los botones + y −. La tabla se actualiza en tiempo real. Cuando termines los 72 partidos se desbloqueará el bracket.'),
        ),
      ));
    } else if (!gruposListo) {
      const gruposFalt = GRUPOS.filter(g => !grupoCompleto(g, estado.marcadores));
      cont.appendChild(el('div', { class: 'hint-card hint-card-warn' },
        el('span', { class: 'hint-icono' }, '⏳'),
        el('div', {},
          el('strong', {}, `${faltantes} partido${faltantes > 1 ? 's' : ''} sin resultado — `),
          el('span', {}, `Grupos pendientes: `),
          ...gruposFalt.map(g => el('button', {
            class: 'chip-grupo',
            onclick: () => {
              document.getElementById(`grupo-${g}-title`)?.closest('.tarjeta-grupo')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
          }, g)),
        ),
      ));
    } else {
      cont.appendChild(el('div', { class: 'hint-card hint-card-ok' },
        el('span', { class: 'hint-icono' }, '✅'),
        el('div', {},
          el('strong', {}, '¡Todos los grupos completados! '),
          el('span', {}, 'Ya puedes revisar los '),
          el('button', { class: 'enlace-inline', onclick: () => setVista('terceros') }, 'mejores terceros'),
          el('span', {}, ' y luego el '),
          el('button', { class: 'enlace-inline', onclick: () => setVista('r32') }, 'bracket eliminatorio →'),
        ),
      ));
    }
  }

  const tablas = calcularTodo(estado.marcadores);
  const grid = el('div', { class: 'grid-grupos' });
  for (const g of GRUPOS) grid.appendChild(renderTarjetaGrupo(g, tablas[g]));
  cont.appendChild(grid);
}

function renderTarjetaGrupo(grupo, tabla) {
  const partidos = generarPartidosDeGrupo(grupo);
  const ro = estado.modoSoloLectura;

  // Calcular estado de completado del grupo (0-6 partidos)
  const completados = partidos.filter(p => {
    const m = estado.marcadores[p.id];
    return m && m.local != null && m.visitante != null;
  }).length;
  const total6 = partidos.length;
  const claseEstado = completados === total6 ? 'grupo-completo'
    : completados > 0 ? 'grupo-parcial' : 'grupo-vacio';

  const tarjeta = el('section', {
    class: `tarjeta-grupo ${claseEstado}`,
    'aria-labelledby': `grupo-${grupo}-title`,
  });

  // Header con badge de progreso del grupo
  const pctGrupo = Math.round((completados / total6) * 100);
  tarjeta.appendChild(el('header', { class: 'grupo-header' },
    el('h2', { id: `grupo-${grupo}-title` }, `Grupo ${grupo}`),
    completados === total6
      ? el('span', { class: 'badge-grupo badge-grupo-ok', 'aria-label': 'Grupo completo' }, '✓ Listo')
      : el('span', {
          class: 'badge-grupo' + (completados > 0 ? ' badge-grupo-parcial' : ''),
          'aria-label': `${completados} de ${total6} partidos`,
        }, `${completados}/${total6} partidos`),
  ));

  // Mini barra de progreso del grupo
  if (completados < total6) {
    tarjeta.appendChild(el('div', { class: 'grupo-mini-barra' },
      el('div', { class: 'grupo-mini-progreso', style: `width:${pctGrupo}%` })));
  }

  // Tabla de posiciones
  tarjeta.appendChild(el('table', { class: 'tabla-grupo', 'aria-label': `Tabla del Grupo ${grupo}` },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'), el('th', {}, 'Equipo'),
      el('th', { title: 'Partidos jugados' }, 'PJ'),
      el('th', { title: 'Ganados' }, 'G'),
      el('th', { title: 'Empatados' }, 'E'),
      el('th', { title: 'Perdidos' }, 'P'),
      el('th', { title: 'Diferencia de goles' }, 'DG'),
      el('th', {}, 'Pts'),
    )),
    el('tbody', {}, tabla.map((fila, i) => {
      const clase = i === 0 || i === 1 ? 'clasifica' : (i === 2 ? 'tercero' : '');
      return el('tr', {
        class: clase + (fila.empateTecnico ? ' empate-tecnico' : ''),
        title: fila.empateTecnico ? 'Empate técnico: misma puntuación, DG y GF' : '',
      },
        el('td', {}, String(i + 1)),
        el('td', {}, bandera(fila.equipo), el('span', { class: 'nombre-eq' }, fila.equipo.nombre)),
        el('td', {}, String(fila.pj)),
        el('td', {}, String(fila.g)),
        el('td', {}, String(fila.e)),
        el('td', {}, String(fila.p)),
        el('td', {}, (fila.dg > 0 ? '+' : '') + fila.dg),
        el('td', { class: 'col-pts' }, String(fila.pts)),
      );
    })),
  ));

  // Lista de partidos con resaltado de incompletos
  const lista = el('div', { class: 'lista-partidos' });
  for (const p of partidos) {
    const m = estado.marcadores[p.id];
    const eqL = EQUIPOS_POR_ID[p.localId];
    const eqV = EQUIPOS_POR_ID[p.visitanteId];
    const completo = m.local != null && m.visitante != null;
    lista.appendChild(el('div', {
      class: 'partido' + (completo ? ' partido-listo' : ' partido-incompleto'),
    },
      el('div', { class: 'lado lado-local' },
        bandera(eqL), el('span', { class: 'nombre-eq' }, eqL.nombre)),
      stepper(p.id, 'local', m.local, ro),
      el('span', { class: 'vs' }, completo ? `${m.local} – ${m.visitante}` : 'vs'),
      stepper(p.id, 'visitante', m.visitante, ro),
      el('div', { class: 'lado lado-visit' },
        el('span', { class: 'nombre-eq' }, eqV.nombre), bandera(eqV)),
      ro ? null : el('button', {
        type: 'button', class: 'btn-borrar', title: 'Borrar marcador',
        'aria-label': `Borrar marcador ${eqL.nombre} vs ${eqV.nombre}`,
        onclick: () => limpiarMarcador(p.id),
      }, '×'),
    ));
  }
  tarjeta.appendChild(lista);
  return tarjeta;
}

// =============================================================
// VISTA: TERCEROS
// =============================================================

function renderTerceros(cont) {
  const { hechos, total } = progresoGrupos(estado.marcadores);
  const gruposListo = hechos === total;

  if (!gruposListo) {
    cont.appendChild(el('div', { class: 'hint-card hint-card-warn' },
      el('span', { class: 'hint-icono' }, '⚠️'),
      el('div', {},
        el('strong', {}, 'Datos parciales: '),
        el('span', {}, `solo ${hechos} de ${total} partidos completados. La tabla de terceros no es definitiva.`),
      ),
    ));
  }

  const tablas = calcularTodo(estado.marcadores);
  const terceros = rankingTerceros(tablas);

  cont.appendChild(el('section', { class: 'panel-info' },
    el('h2', {}, '📊 Ranking de Terceros'),
    el('p', {}, 'Los ', el('strong', {}, '8 mejores terceros'), ' (resaltados en verde) clasifican a la Ronda de 32. ',
      'Se ordenan por puntos, diferencia de goles y goles a favor.'),
  ));

  cont.appendChild(el('table', { class: 'tabla-terceros' },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'), el('th', {}, 'Grupo'), el('th', {}, 'Equipo'),
      el('th', {}, 'PJ'), el('th', {}, 'Pts'), el('th', {}, 'DG'), el('th', {}, 'GF'), el('th', {}, 'Estado'),
    )),
    el('tbody', {}, terceros.map((t, i) => el('tr', { class: t.clasifica ? 'clasifica' : 'eliminado' },
      el('td', {}, String(i + 1)),
      el('td', {}, t.grupo),
      el('td', {}, bandera(t.equipo), el('span', { class: 'nombre-eq' }, t.equipo.nombre)),
      el('td', {}, String(t.pj)),
      el('td', {}, String(t.pts)),
      el('td', {}, (t.dg > 0 ? '+' : '') + t.dg),
      el('td', {}, String(t.gf)),
      el('td', {}, t.clasifica
        ? el('span', { class: 'badge badge-ok' }, '✓ Clasifica')
        : el('span', { class: 'badge badge-out' }, '✗ Eliminado')),
    ))),
  ));

  if (gruposListo) {
    cont.appendChild(el('div', { class: 'hint-card hint-card-ok' },
      el('span', { class: 'hint-icono' }, '🏟'),
      el('div', {},
        el('strong', {}, 'Los 8 clasificados ya tienen su slot en el bracket. '),
        el('button', { class: 'enlace-inline', onclick: () => setVista('r32') }, 'Comenzar la Ronda de 32 →'),
      ),
    ));
  }
}

// =============================================================
// VISTA: QUINIELAS
// =============================================================

async function renderQuinielas(cont) {
  cont.appendChild(el('section', { class: 'panel-info' },
    el('h2', {}, '👥 Quinielas guardadas'),
    el('p', {}, 'Todas las predicciones del servidor. Haz clic en una para verla en modo solo-lectura.')));

  const wrap = el('div', { class: 'quinielas-lista' });
  wrap.appendChild(el('p', { class: 'cargando' }, 'Cargando…'));
  cont.appendChild(wrap);

  try {
    const { quinielas } = await listarQuinielas();
    wrap.innerHTML = '';
    if (!quinielas.length) {
      wrap.appendChild(el('p', { class: 'vacio' }, 'Aún no hay otras quinielas guardadas.'));
      return;
    }
    for (const q of quinielas) {
      const esMio = q.nombre === estado.usuario;
      const pct = Math.round((q.partidosCompletados / 72) * 100);
      const fecha = q.actualizado ? new Date(q.actualizado).toLocaleString('es-MX', {
        dateStyle: 'short', timeStyle: 'short',
      }) : '—';

      wrap.appendChild(el('article', { class: 'tarjeta-quiniela' + (esMio ? ' tarjeta-mia' : '') },
        el('header', { class: 'tq-header' },
          el('h3', {}, '👤 ', q.nombre, esMio ? el('span', { class: 'badge badge-ok' }, 'Tú') : null),
          el('span', { class: 'tq-fecha' }, `Editada: ${fecha}`),
        ),
        el('div', { class: 'tq-progreso' },
          el('div', { class: 'tq-progreso-track' },
            el('div', { class: 'tq-progreso-bar', style: `width:${pct}%` })),
          el('span', { class: 'tq-progreso-texto' },
            `${q.partidosCompletados}/72 grupos · ${q.ganadoresElegidos} ganadores elegidos`),
        ),
        el('div', { class: 'tq-acciones' },
          esMio
            ? el('button', { class: 'btn btn-claro', onclick: async () => { await volverAMiQuiniela(); setVista('grupos'); } }, 'Editar mi quiniela')
            : el('button', { class: 'btn btn-claro', onclick: async () => { await cargarQuinielaDe(q.nombre, true); setVista('grupos'); toast(`Viendo quiniela de ${q.nombre}`, 'info'); } }, 'Ver predicciones'),
        ),
      ));
    }
  } catch (e) {
    wrap.innerHTML = '';
    wrap.appendChild(el('p', { class: 'error' }, `Error al cargar: ${e.message}`));
  }
}

// =============================================================
// VISTAS: BRACKET ELIMINATORIO
// =============================================================

function renderRondaEliminatoria(cont, vista) {
  if (!fasGruposCompleta(estado.marcadores)) {
    cont.appendChild(panelBloqueo());
    return;
  }

  // Hint para el bracket
  if (!estado.modoSoloLectura) {
    cont.appendChild(el('div', { class: 'hint-card hint-card-info' },
      el('span', { class: 'hint-icono' }, '👆'),
      el('span', {}, 'Haz clic en un equipo para marcarlo como ', el('strong', {}, 'ganador'), '. ',
        'Avanza automáticamente a la siguiente ronda. Si cambias de opinión, haz clic otra vez.'),
    ));
  }

  const tablas = calcularTodo(estado.marcadores);
  const terceros = rankingTerceros(tablas);
  const resuelto = resolverBracket(tablas, terceros, estado.eliminatorias);

  const wrapper = el('div', { class: 'bracket-wrapper' });
  const tablero = el('div', { class: 'bracket' });
  const rondas = [
    { key: 'r32',     titulo: 'Ronda de 32' },
    { key: 'r16',     titulo: 'Octavos de Final' },
    { key: 'cuartos', titulo: 'Cuartos de Final' },
    { key: 'semis',   titulo: 'Semifinales' },
    { key: 'final',   titulo: 'Final' },
  ];

  for (const r of rondas) {
    const activa = vistaABracketKey(vista) === r.key;
    const col = el('div', { class: 'bracket-col' + (activa ? ' col-activa' : ''), dataset: { ronda: r.key } });
    col.appendChild(el('h3', { class: 'bracket-col-titulo' }, r.titulo));
    for (const partido of resuelto[r.key]) col.appendChild(renderTarjetaEliminatoria(partido));
    tablero.appendChild(col);
  }
  wrapper.appendChild(tablero);
  cont.appendChild(wrapper);

  if (vista === 'final' || vista === 'semis') {
    const tercero = resuelto.tercerPuesto[0];
    cont.appendChild(el('section', { class: 'panel-info' }, el('h3', {}, '🥉 Partido por el tercer puesto')));
    const cont3 = el('div', { class: 'bracket' });
    const col3 = el('div', { class: 'bracket-col' });
    col3.appendChild(renderTarjetaEliminatoria(tercero));
    cont3.appendChild(col3);
    cont.appendChild(cont3);
  }
}

function vistaABracketKey(v) {
  return ({ r32: 'r32', r16: 'r16', cuartos: 'cuartos', semis: 'semis', final: 'final' })[v];
}

function panelBloqueo() {
  const gruposIncompletos = GRUPOS.filter(g => !grupoCompleto(g, estado.marcadores));
  const { hechos, total } = progresoGrupos(estado.marcadores);
  const faltantes = total - hechos;

  return el('section', { class: 'panel-bloqueo', role: 'alert' },
    el('div', { class: 'bloqueo-icono', 'aria-hidden': 'true' }, '🔒'),
    el('h2', {}, 'Bracket no disponible'),
    el('p', {}, `Faltan `, el('strong', {}, `${faltantes} partido${faltantes > 1 ? 's' : ''}`),
      ` por completar en la fase de grupos.`),
    el('div', { class: 'bloqueo-grupos' },
      el('p', { class: 'bloqueo-label' }, `${gruposIncompletos.length} grupo${gruposIncompletos.length > 1 ? 's' : ''} pendiente${gruposIncompletos.length > 1 ? 's' : ''}:`),
      el('div', { class: 'bloqueo-chips' },
        ...gruposIncompletos.map(g => {
          const completadosG = generarPartidosDeGrupo(g).filter(p => {
            const m = estado.marcadores[p.id];
            return m && m.local != null && m.visitante != null;
          }).length;
          return el('button', {
            class: 'chip-grupo-bloqueo',
            onclick: () => {
              setVista('grupos');
              setTimeout(() => {
                document.getElementById(`grupo-${g}-title`)
                  ?.closest('.tarjeta-grupo')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 150);
            },
          }, `Grupo ${g}`, el('span', { class: 'chip-cuenta' }, `${completadosG}/6`));
        }),
      ),
    ),
    el('button', { class: 'btn', onclick: () => setVista('grupos') }, '→ Ir a completar grupos'),
  );
}

function renderTarjetaEliminatoria(partido) {
  const { _home, _away, _ganador } = partido;
  const tarjeta = el('article', {
    class: 'tarjeta-elim' + (_ganador ? ' con-ganador' : ''),
    'aria-label': `Partido ${partido.id}`,
  });
  tarjeta.appendChild(el('div', { class: 'elim-id' }, partido.id));
  tarjeta.appendChild(filaEquipoElim(partido, _home, _ganador));
  tarjeta.appendChild(filaEquipoElim(partido, _away, _ganador));
  return tarjeta;
}

function filaEquipoElim(partido, equipo, ganador) {
  const esGanador = ganador && equipo && ganador.id === equipo.id;
  const ro = estado.modoSoloLectura;
  const habilitado = !!equipo && !ro;

  const btn = el('button', {
    type: 'button',
    class: 'elim-equipo' + (esGanador ? ' equipo-ganador' : '') + (equipo ? '' : ' elim-pendiente'),
    disabled: !habilitado,
    'aria-label': equipo ? `Seleccionar ${equipo.nombre} como ganador` : 'Equipo aún por definir',
    onclick: () => {
      if (!equipo || ro) return;
      setGanador(partido.id, equipo.id);
      toast(`${equipo.nombre} avanza ✓`, 'ok');
    },
  });
  if (equipo) {
    btn.appendChild(bandera(equipo));
    btn.appendChild(el('span', { class: 'nombre-eq' }, equipo.nombre));
  } else {
    btn.appendChild(el('span', { class: 'nombre-eq elim-placeholder' }, 'Por definir…'));
  }
  if (esGanador) btn.appendChild(el('span', { class: 'check' }, '✓'));
  return btn;
}

// =============================================================
// VISTA: CAMPEÓN
// =============================================================

function renderCampeon(cont) {
  renderRondaEliminatoria(cont, 'final');
  if (!fasGruposCompleta(estado.marcadores)) return;
  const tablas = calcularTodo(estado.marcadores);
  const terceros = rankingTerceros(tablas);
  const resuelto = resolverBracket(tablas, terceros, estado.eliminatorias);
  const campeon = resuelto.final[0]?._ganador;
  if (!campeon) return;

  cont.prepend(el('section', { class: 'campeon-panel', role: 'status', 'aria-live': 'polite' },
    el('div', { class: 'confeti', 'aria-hidden': 'true' },
      ...Array.from({ length: 60 }, () => el('span', { class: 'confeti-pieza' }))),
    el('div', { class: 'trofeo', 'aria-hidden': 'true', html: trofeoSVG() }),
    el('h2', { class: 'campeon-titulo' }, '¡CAMPEÓN DEL MUNDO!'),
    el('div', { class: 'campeon-bandera' }, bandera(campeon, 'lg')),
    el('p', { class: 'campeon-nombre' }, campeon.nombre),
  ));
}

function trofeoSVG() {
  return `<svg viewBox="0 0 64 64" width="80" height="80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M16 8h32v10a16 16 0 0 1-32 0V8z" fill="#FFD24C"/>
    <path d="M48 12h6a4 4 0 0 1 0 8c-2 4-6 6-8 6V12z" fill="#FFC02E"/>
    <path d="M16 12h-6a4 4 0 0 0 0 8c2 4 6 6 8 6V12z" fill="#FFC02E"/>
    <rect x="26" y="34" width="12" height="10" fill="#FFB400"/>
    <rect x="20" y="44" width="24" height="6" rx="2" fill="#E08F00"/>
    <rect x="16" y="50" width="32" height="6" rx="2" fill="#C46F00"/>
  </svg>`;
}

// =============================================================
// BARRA DE ACCIONES
// =============================================================

export function bindBarraAcciones() {
  $('#btn-deshacer').addEventListener('click', () => {
    if (estado.modoSoloLectura) { toast('No puedes editar la quiniela de otra persona', 'info'); return; }
    if (!deshacer()) toast('Nada para deshacer', 'info');
    else toast('Acción deshecha', 'ok');
  });
  $('#btn-reiniciar').addEventListener('click', () => {
    if (estado.modoSoloLectura) { toast('No puedes editar la quiniela de otra persona', 'info'); return; }
    if (confirm('¿Seguro que quieres reiniciar TODOS los pronósticos? Esta acción no se puede deshacer.')) {
      reiniciar();
      toast('Quiniela reiniciada', 'ok');
    }
  });
  $('#btn-exportar').addEventListener('click', () => {
    const blob = new Blob([exportarJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiniela-${estado.propietarioVisible || 'export'}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Exportado en JSON', 'ok');
  });
  $('#btn-tema').addEventListener('click', () => {
    const actual = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.dataset.tema = actual;
    localStorage.setItem('quiniela-tema', actual);
    toast(`Modo ${actual}`, 'info');
  });
}
