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
import {
  listarQuinielas, obtenerResultados, guardarResultados,
  verificarPin, obtenerPuntuaciones,
} from './api.js';
import { PUNTOS, ETIQUETA_RONDA, PUNTOS_MAXIMOS } from './score.js';

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

// Stepper genérico: `onCambio(valor)` recibe el nuevo valor crudo.
// Lo usan tanto la quiniela (escribe en el estado) como la vista Admin
// (escribe en el borrador de resultados reales).
function stepperGenerico(etiqueta, valor, onCambio, deshabilitado) {
  const cont = el('div', {
    class: 'stepper' + (deshabilitado ? ' stepper-disabled' : ''),
    role: 'group', 'aria-label': `Goles ${etiqueta}`,
  });
  const dec = el('button', {
    type: 'button', class: 'stepper-btn',
    'aria-label': `Restar gol`, disabled: deshabilitado || false,
    onclick: () => onCambio((valor ?? 0) - 1),
  }, '−');
  const input = el('input', {
    type: 'number', min: '0', max: '99', step: '1',
    inputmode: 'numeric', class: 'stepper-input',
    value: valor ?? '', placeholder: '–',
    'aria-label': `Marcador ${etiqueta}`, disabled: deshabilitado || false,
  });
  input.addEventListener('change', e => onCambio(e.target.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { e.preventDefault(); onCambio((valor ?? 0) + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onCambio((valor ?? 0) - 1); }
  });
  const inc = el('button', {
    type: 'button', class: 'stepper-btn',
    'aria-label': `Sumar gol`, disabled: deshabilitado || false,
    onclick: () => onCambio((valor ?? 0) + 1),
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

  // El banner solo aplica a vistas de predicción (en Resultados/Admin confunde).
  if (estado.modoSoloLectura && !['resultados', 'admin', 'quinielas'].includes(vista)) {
    cont.appendChild(el('div', { class: 'banner-solo-lectura', role: 'status' },
      el('span', {}, '👁 Viendo la quiniela de ', el('strong', {}, estado.propietarioVisible)),
      el('button', { class: 'btn btn-claro', onclick: volverAMiQuiniela }, '← Volver a la mía'),
    ));
  }

  if (vista === 'grupos') renderGrupos(cont);
  else if (vista === 'terceros') renderTerceros(cont);
  else if (vista === 'quinielas') renderQuinielas(cont);
  else if (vista === 'resultados') renderResultados(cont);
  else if (vista === 'admin') renderAdmin(cont);
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
  if (barEl) {
    const pct = gruposListo ? 100 : Math.round((hechos / total) * 100);
    barEl.style.width = `${pct}%`;
    barEl.parentElement?.setAttribute('aria-valuenow', String(pct));
  }

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
  { id: 'resultados', etiqueta: 'Resultados', icono: '🥇' },
  { id: 'admin',     etiqueta: 'Admin',     icono: '🔐' },
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

// `ctx` opcional permite reutilizar la tarjeta con otra fuente de datos
// (la vista Admin edita los resultados reales, no la quiniela del usuario).
function renderTarjetaGrupo(grupo, tabla, ctx = null) {
  const partidos = generarPartidosDeGrupo(grupo);
  const marcadores = ctx ? ctx.marcadores : estado.marcadores;
  const ro = ctx ? !!ctx.ro : estado.modoSoloLectura;
  const onMarcador = ctx ? ctx.onMarcador : setMarcador;
  const onLimpiar = ctx ? ctx.onLimpiar : limpiarMarcador;

  // Calcular estado de completado del grupo (0-6 partidos)
  const completados = partidos.filter(p => {
    const m = marcadores[p.id];
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
    const m = marcadores[p.id] || { local: null, visitante: null };
    const eqL = EQUIPOS_POR_ID[p.localId];
    const eqV = EQUIPOS_POR_ID[p.visitanteId];
    const completo = m.local != null && m.visitante != null;
    lista.appendChild(el('div', {
      class: 'partido' + (completo ? ' partido-listo' : ' partido-incompleto'),
    },
      el('div', { class: 'lado lado-local' },
        bandera(eqL), el('span', { class: 'nombre-eq' }, eqL.nombre)),
      stepperGenerico('local', m.local, v => onMarcador(p.id, 'local', v), ro),
      el('span', { class: 'vs' }, completo ? `${m.local} – ${m.visitante}` : 'vs'),
      stepperGenerico('visitante', m.visitante, v => onMarcador(p.id, 'visitante', v), ro),
      el('div', { class: 'lado lado-visit' },
        el('span', { class: 'nombre-eq' }, eqV.nombre), bandera(eqV)),
      ro ? null : el('button', {
        type: 'button', class: 'btn-borrar', title: 'Borrar marcador',
        'aria-label': `Borrar marcador ${eqL.nombre} vs ${eqV.nombre}`,
        onclick: () => onLimpiar(p.id),
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
    // El usuario pudo cambiar de vista mientras cargaba: no pisar el DOM.
    if (estado.vistaActual !== 'quinielas' || !wrap.isConnected) return;
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
    if (estado.vistaActual !== 'quinielas' || !wrap.isConnected) return;
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

// `onPick(matchId, equipoId, equipo)` opcional: por defecto escribe en la
// quiniela del usuario; la vista Admin pasa su propio callback.
function renderTarjetaEliminatoria(partido, onPick) {
  const { _home, _away, _ganador } = partido;
  const tarjeta = el('article', {
    class: 'tarjeta-elim' + (_ganador ? ' con-ganador' : ''),
    'aria-label': `Partido ${partido.id}`,
  });
  tarjeta.appendChild(el('div', { class: 'elim-id' }, partido.id));
  tarjeta.appendChild(filaEquipoElim(partido, _home, _ganador, onPick));
  tarjeta.appendChild(filaEquipoElim(partido, _away, _ganador, onPick));
  return tarjeta;
}

function filaEquipoElim(partido, equipo, ganador, onPick) {
  const esGanador = ganador && equipo && ganador.id === equipo.id;
  const ro = !onPick && estado.modoSoloLectura;
  const habilitado = !!equipo && !ro;

  const btn = el('button', {
    type: 'button',
    class: 'elim-equipo' + (esGanador ? ' equipo-ganador' : '') + (equipo ? '' : ' elim-pendiente'),
    disabled: !habilitado,
    'aria-label': equipo ? `Seleccionar ${equipo.nombre} como ganador` : 'Equipo aún por definir',
    'aria-pressed': esGanador ? 'true' : 'false',
    onclick: () => {
      if (!equipo || ro) return;
      if (onPick) { onPick(partido.id, equipo.id, equipo); return; }
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
// VISTA: RESULTADOS — leaderboard contra los resultados reales
// =============================================================

function medalla(pos) {
  return pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : null;
}

async function renderResultados(cont) {
  cont.appendChild(el('section', { class: 'panel-info' },
    el('h2', {}, '🥇 Leaderboard'),
    el('p', {}, 'Puntos de cada quiniela contra los ', el('strong', {}, 'resultados reales'),
      ' del torneo. Se actualiza conforme el admin captura los resultados.'),
  ));

  const wrap = el('div', { class: 'lb-wrap' });
  wrap.appendChild(el('p', { class: 'cargando' }, 'Calculando puntuaciones…'));
  cont.appendChild(wrap);

  try {
    const { puntuaciones, resultadosInfo } = await obtenerPuntuaciones();
    if (estado.vistaActual !== 'resultados' || !wrap.isConnected) return;
    wrap.innerHTML = '';

    const hayResultados = resultadosInfo.partidosCapturados > 0 || resultadosInfo.ganadoresCapturados > 0;
    const fechaInfo = resultadosInfo.actualizado
      ? new Date(resultadosInfo.actualizado).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
      : null;

    // Estado de captura de resultados oficiales
    wrap.appendChild(el('div', { class: `hint-card ${hayResultados ? 'hint-card-info' : 'hint-card-warn'}` },
      el('span', { class: 'hint-icono' }, hayResultados ? '📡' : '⏳'),
      el('div', {},
        hayResultados
          ? el('span', {},
              el('strong', {}, 'Resultados oficiales: '),
              `${resultadosInfo.partidosCapturados}/72 partidos de grupos · `,
              `${resultadosInfo.ganadoresCapturados} ganadores de eliminatorias`,
              fechaInfo ? ` · última captura: ${fechaInfo}` : '')
          : el('span', {},
              el('strong', {}, 'Aún no hay resultados oficiales. '),
              'Cuando el torneo avance, el admin capturará los marcadores reales en la tab Admin y aquí aparecerá el ranking.'),
      ),
    ));

    if (!puntuaciones.length) {
      wrap.appendChild(el('p', { class: 'vacio' }, 'Todavía no hay quinielas guardadas.'));
      return;
    }

    // Podio (solo cuando ya hay puntos en juego)
    if (hayResultados) {
      const top = puntuaciones.filter(p => p.posicion <= 3).slice(0, 3);
      const podio = el('div', { class: 'podio' });
      for (const p of top) {
        podio.appendChild(el('div', { class: `podio-card podio-${p.posicion}` + (p.nombre === estado.usuario ? ' podio-mio' : '') },
          el('span', { class: 'podio-medalla', 'aria-hidden': 'true' }, medalla(p.posicion)),
          el('span', { class: 'podio-nombre' }, p.nombre),
          el('span', { class: 'podio-pts' }, `${p.total} pts`),
        ));
      }
      wrap.appendChild(podio);
    }

    // Tabla de posiciones
    wrap.appendChild(el('table', { class: 'tabla-lb', 'aria-label': 'Tabla de posiciones de la quiniela' },
      el('thead', {}, el('tr', {},
        el('th', {}, '#'),
        el('th', { class: 'th-izq' }, 'Jugador'),
        el('th', {}, 'Campeón'),
        el('th', { title: 'Puntos de fase de grupos' }, 'Grupos'),
        el('th', { title: 'Puntos del bracket eliminatorio' }, 'Bracket'),
        el('th', {}, 'Total'),
      )),
      el('tbody', {}, puntuaciones.map(p => {
        const esMio = p.nombre === estado.usuario;
        const campeon = p.campeonId ? EQUIPOS_POR_ID[p.campeonId] : null;
        const desgloseBracket = Object.entries(p.bracket.porRonda)
          .filter(([, r]) => r.pts > 0)
          .map(([ronda, r]) => `${ETIQUETA_RONDA[ronda]}: ${r.aciertos} aciertos = ${r.pts} pts`)
          .join('\n');
        return el('tr', { class: esMio ? 'fila-mia' : '' },
          el('td', { class: 'lb-pos' }, (hayResultados && medalla(p.posicion)) || String(p.posicion)),
          el('td', { class: 'th-izq' },
            el('span', { class: 'lb-nombre' }, p.nombre),
            esMio ? el('span', { class: 'badge badge-ok' }, 'Tú') : null),
          el('td', {}, campeon
            ? el('span', { class: 'lb-campeon', title: campeon.nombre }, bandera(campeon))
            : el('span', { class: 'lb-sin-campeon', title: 'Bracket sin completar' }, '—')),
          el('td', { title: `${p.grupos.exactos} exactos (5 pts) · ${p.grupos.resultados} resultados (2 pts) de ${p.grupos.evaluados} evaluados` },
            String(p.grupos.pts)),
          el('td', { title: desgloseBracket || 'Sin aciertos de bracket todavía' }, String(p.bracket.pts)),
          el('td', { class: 'lb-total' }, String(p.total)),
        );
      })),
    ));

    // Reglas de puntuación (colapsable)
    wrap.appendChild(el('details', { class: 'lb-reglas' },
      el('summary', {}, '¿Cómo se calculan los puntos?'),
      el('div', { class: 'lb-reglas-cuerpo' },
        el('p', {}, el('strong', {}, 'Fase de grupos (por partido): '),
          `marcador exacto ${PUNTOS.exacto} pts · resultado correcto (gana/empata/pierde) ${PUNTOS.resultado} pts.`),
        el('p', {}, el('strong', {}, 'Eliminatorias (por equipo que avanza correctamente): '),
          Object.entries(PUNTOS.rondas).map(([r, v]) => `${ETIQUETA_RONDA[r]} ${v} pts`).join(' · ') + '.'),
        el('p', {}, `Puntuación máxima teórica: ${PUNTOS_MAXIMOS} pts. `,
          'En caso de empate gana quien tenga más marcadores exactos.'),
      ),
    ));
  } catch (e) {
    if (estado.vistaActual !== 'resultados' || !wrap.isConnected) return;
    wrap.innerHTML = '';
    wrap.appendChild(el('p', { class: 'error' }, `Error al cargar el leaderboard: ${e.message}`));
  }
}

// =============================================================
// VISTA: ADMIN — captura de resultados reales (PIN)
// =============================================================

const CLAVE_PIN = 'quiniela-mundial-2026:admin-pin';
let adminDraft = null;     // { marcadores, eliminatorias } — borrador local
let adminDirty = false;    // hay cambios sin guardar
let adminCargando = false; // evita fetches duplicados al re-renderizar

function marcadoresRealesVacios() {
  const m = {};
  for (const g of GRUPOS) {
    for (const p of generarPartidosDeGrupo(g)) m[p.id] = { local: null, visitante: null };
  }
  return m;
}

function renderAdmin(cont) {
  const pin = sessionStorage.getItem(CLAVE_PIN);
  if (!pin) { renderAdminPin(cont); return; }
  if (!adminDraft) { cargarBorradorAdmin(cont); return; }
  renderAdminEditor(cont, pin);
}

function renderAdminPin(cont) {
  const inp = el('input', {
    id: 'pin-input', class: 'login-input', type: 'password',
    inputmode: 'numeric', autocomplete: 'off',
    placeholder: '····', maxlength: '20', required: 'required',
  });
  const msg = el('p', { class: 'pin-error', role: 'alert', hidden: 'hidden' });
  const btn = el('button', { type: 'submit', class: 'btn btn-grande' }, 'Entrar al panel');

  cont.appendChild(el('section', { class: 'panel-pin' },
    el('div', { class: 'pin-icono', 'aria-hidden': 'true' }, '🔐'),
    el('h2', {}, 'Panel de administración'),
    el('p', { class: 'pin-sub' }, 'Aquí se capturan los ', el('strong', {}, 'resultados reales'),
      ' del torneo. Solo el organizador necesita entrar; el leaderboard es público en la tab Resultados.'),
    el('form', {
      class: 'login-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const pin = inp.value.trim();
        if (!pin) { inp.focus(); return; }
        btn.disabled = true; btn.textContent = 'Verificando…';
        try {
          const ok = await verificarPin(pin);
          if (ok) {
            sessionStorage.setItem(CLAVE_PIN, pin);
            toast('PIN correcto. Bienvenido, admin', 'ok');
            render();
          } else {
            msg.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
            msg.hidden = false;
            inp.value = ''; inp.focus();
            btn.disabled = false; btn.textContent = 'Entrar al panel';
          }
        } catch {
          msg.textContent = 'No se pudo verificar el PIN (¿servidor caído?).';
          msg.hidden = false;
          btn.disabled = false; btn.textContent = 'Entrar al panel';
        }
      },
    },
      el('label', { class: 'login-label', for: 'pin-input' }, 'PIN de admin'),
      inp, msg, btn,
    ),
  ));
  setTimeout(() => inp.focus(), 50);
}

function cargarBorradorAdmin(cont) {
  cont.appendChild(el('p', { class: 'cargando' }, 'Cargando resultados oficiales…'));
  if (adminCargando) return;
  adminCargando = true;
  obtenerResultados()
    .then(data => {
      adminDraft = {
        marcadores: { ...marcadoresRealesVacios(), ...(data?.marcadores || {}) },
        eliminatorias: data?.eliminatorias || {},
      };
      adminDirty = false;
      if (estado.vistaActual === 'admin') render();
    })
    .catch(e => {
      if (estado.vistaActual !== 'admin' || !cont.isConnected) return;
      cont.innerHTML = '';
      cont.appendChild(el('p', { class: 'error' }, `Error al cargar resultados: ${e.message}`));
    })
    .finally(() => { adminCargando = false; });
}

function setMarcadorAdmin(partidoId, lado, valor) {
  // '' o valores inválidos limpian la casilla (a diferencia de la quiniela,
  // aquí "sin dato" significa que el partido aún no se juega).
  let v = valor === '' || valor == null ? null : Number(valor);
  if (v != null && (!Number.isFinite(v) || v < 0)) v = 0;
  if (v != null) v = Math.min(Math.round(v), 99);
  adminDraft.marcadores[partidoId][lado] = v;
  adminDirty = true;
  render();
}

function limpiarMarcadorAdmin(partidoId) {
  adminDraft.marcadores[partidoId] = { local: null, visitante: null };
  adminDirty = true;
  render();
}

function setGanadorAdmin(matchId, equipoId, equipo) {
  const actual = adminDraft.eliminatorias[matchId]?.ganadorId;
  if (!adminDraft.eliminatorias[matchId]) adminDraft.eliminatorias[matchId] = { ganadorId: null };
  // Clic sobre el ganador actual lo deselecciona (corrección rápida).
  adminDraft.eliminatorias[matchId].ganadorId = actual === equipoId ? null : equipoId;
  adminDirty = true;
  if (actual !== equipoId) toast(`${equipo.nombre} avanza (resultado real) ✓`, 'ok');
  render();
}

async function guardarBorradorAdmin(pin) {
  try {
    await guardarResultados(adminDraft, pin);
    adminDirty = false;
    toast('Resultados oficiales guardados', 'ok');
    render();
  } catch (e) {
    if (e.status === 401) {
      sessionStorage.removeItem(CLAVE_PIN);
      toast('PIN rechazado por el servidor. Vuelve a ingresarlo.', 'error');
      render(); // el borrador se conserva: tras re-autenticar puede guardar
    } else {
      toast(`Error al guardar: ${e.message}`, 'error');
    }
  }
}

function renderAdminEditor(cont, pin) {
  cont.appendChild(el('div', { class: 'hint-card hint-card-warn' },
    el('span', { class: 'hint-icono' }, '⚠️'),
    el('div', {},
      el('strong', {}, 'Estás editando los resultados REALES del torneo. '),
      el('span', {}, 'Esto afecta la puntuación de todas las quinielas. Captura solo partidos ya jugados y pulsa '),
      el('strong', {}, 'Guardar'), el('span', {}, ' al terminar.'),
    ),
  ));

  // Barra de acciones del admin (sticky)
  const { hechos, total } = progresoGrupos(adminDraft.marcadores);
  cont.appendChild(el('div', { class: 'admin-barra' },
    el('span', { class: 'admin-estado' + (adminDirty ? ' admin-estado-dirty' : '') },
      adminDirty ? '● Cambios sin guardar' : '✓ Sin cambios pendientes'),
    el('span', { class: 'admin-progreso' }, `${hechos}/${total} partidos capturados`),
    el('div', { class: 'admin-acciones' },
      el('button', {
        class: 'btn', disabled: !adminDirty,
        onclick: () => guardarBorradorAdmin(pin),
      }, '💾 Guardar resultados'),
      el('button', {
        class: 'btn btn-claro',
        onclick: () => {
          if (!adminDirty || confirm('¿Descartar los cambios sin guardar y recargar lo último guardado?')) {
            adminDraft = null;
            adminDirty = false;
            render();
          }
        },
      }, 'Descartar'),
      el('button', {
        class: 'btn btn-claro',
        onclick: () => {
          if (adminDirty && !confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
          sessionStorage.removeItem(CLAVE_PIN);
          adminDraft = null;
          adminDirty = false;
          setVista('resultados');
        },
      }, 'Salir de admin'),
    ),
  ));

  const ctx = {
    marcadores: adminDraft.marcadores,
    onMarcador: setMarcadorAdmin,
    onLimpiar: limpiarMarcadorAdmin,
    ro: false,
  };

  // --- Fase de grupos (resultados reales) ---
  cont.appendChild(el('section', { class: 'panel-info' },
    el('h2', {}, '⚽ Fase de grupos — marcadores reales'),
    el('p', {}, 'Las tablas se calculan con los resultados capturados y definen el bracket real.'),
  ));
  const tablas = calcularTodo(adminDraft.marcadores);
  const grid = el('div', { class: 'grid-grupos' });
  for (const g of GRUPOS) grid.appendChild(renderTarjetaGrupo(g, tablas[g], ctx));
  cont.appendChild(grid);

  // --- Eliminatorias (ganadores reales) ---
  cont.appendChild(el('section', { class: 'panel-info' },
    el('h2', {}, '🏟 Eliminatorias — ganadores reales'),
    el('p', {}, 'Haz clic en el equipo que ganó cada cruce. Clic de nuevo sobre el ganador lo deselecciona. ',
      'Los cruces se desbloquean cuando los grupos involucrados están completos.'),
  ));

  const terceros = rankingTerceros(tablas);
  const resuelto = resolverBracket(tablas, terceros, adminDraft.eliminatorias);
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
    const col = el('div', { class: 'bracket-col', dataset: { ronda: r.key } });
    col.appendChild(el('h3', { class: 'bracket-col-titulo' }, r.titulo));
    for (const partido of resuelto[r.key]) {
      col.appendChild(renderTarjetaEliminatoria(partido, setGanadorAdmin));
    }
    tablero.appendChild(col);
  }
  wrapper.appendChild(tablero);
  cont.appendChild(wrapper);

  cont.appendChild(el('section', { class: 'panel-info' }, el('h3', {}, '🥉 Partido por el tercer puesto')));
  const cont3 = el('div', { class: 'bracket' });
  const col3 = el('div', { class: 'bracket-col' });
  col3.appendChild(renderTarjetaEliminatoria(resuelto.tercerPuesto[0], setGanadorAdmin));
  cont3.appendChild(col3);
  cont.appendChild(cont3);

  // Guardado siempre a la mano aunque se esté al fondo de la captura.
  if (adminDirty) {
    cont.appendChild(el('button', {
      class: 'btn admin-guardar-flotante',
      onclick: () => guardarBorradorAdmin(pin),
    }, '💾 Guardar resultados'));
  }
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

  // Evita perder resultados oficiales a medio capturar al cerrar la pestaña.
  window.addEventListener('beforeunload', (e) => {
    if (adminDirty) { e.preventDefault(); e.returnValue = ''; }
  });
}
