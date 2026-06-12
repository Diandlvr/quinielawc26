// =============================================================
// score.js — LÓGICA PURA de puntuación
// Compara una quiniela contra los resultados reales y calcula
// los puntos. Sin DOM: se usa tanto en el navegador (ui.js)
// como en el servidor (server.js, endpoint /api/puntuaciones).
// =============================================================

import { PARTIDOS_GRUPOS } from './data.js';
import { calcularTodo, rankingTerceros } from './standings.js';
import { resolverBracket } from './bracket.js';

// Tabla de puntos (ver ROADMAP.md).
export const PUNTOS = {
  exacto: 5,      // marcador exacto en fase de grupos
  resultado: 2,   // acertar solo G/E/P
  rondas: {
    r32: 2,            // por cada equipo correcto que avanza a octavos
    r16: 3,            // ... a cuartos
    cuartos: 5,        // ... a semifinales
    semis: 8,          // ... a la final
    final: 15,         // campeón correcto
    tercerPuesto: 5,   // tercer lugar correcto
  },
};

export const ETIQUETA_RONDA = {
  r32: 'Ronda de 32',
  r16: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  final: 'Campeón',
  tercerPuesto: 'Tercer puesto',
};

// Puntuación máxima teórica: (72×5) + (16×2) + (8×3) + (4×5) + (2×8) + 15 + 5
export const PUNTOS_MAXIMOS =
  PARTIDOS_GRUPOS.length * PUNTOS.exacto +
  16 * PUNTOS.rondas.r32 + 8 * PUNTOS.rondas.r16 + 4 * PUNTOS.rondas.cuartos +
  2 * PUNTOS.rondas.semis + PUNTOS.rondas.final + PUNTOS.rondas.tercerPuesto;

// ---------- Fase de grupos ----------

// Puntos de un partido de grupos. `predicho` y `real` son {local, visitante}.
// Devuelve 5 (exacto), 2 (resultado G/E/P) o 0.
export function puntosPartido(predicho, real) {
  if (!predicho || !real) return 0;
  if (predicho.local == null || predicho.visitante == null) return 0;
  if (real.local == null || real.visitante == null) return 0;
  if (predicho.local === real.local && predicho.visitante === real.visitante) return PUNTOS.exacto;
  if (Math.sign(predicho.local - predicho.visitante) === Math.sign(real.local - real.visitante)) {
    return PUNTOS.resultado;
  }
  return 0;
}

// ---------- Eliminatorias ----------

// Resuelve el bracket de una quiniela/resultado y devuelve, por ronda,
// el Set de ids de equipos ganadores (los que avanzan).
// Clona `eliminatorias` porque resolverBracket limpia ganadores obsoletos.
export function ganadoresPorRonda(marcadores = {}, eliminatorias = {}) {
  const tablas = calcularTodo(marcadores);
  const terceros = rankingTerceros(tablas);
  const copia = JSON.parse(JSON.stringify(eliminatorias));
  const resuelto = resolverBracket(tablas, terceros, copia);
  const porRonda = {};
  for (const ronda of Object.keys(PUNTOS.rondas)) {
    porRonda[ronda] = new Set(
      (resuelto[ronda] || []).map(p => p._ganador?.id).filter(Boolean)
    );
  }
  return porRonda;
}

// ---------- Puntuación total ----------

// Calcula la puntuación de una quiniela {marcadores, eliminatorias}
// contra los resultados reales {marcadores, eliminatorias}.
// Las eliminatorias se puntúan por "avance correcto": cada equipo que el
// jugador tiene avanzando en una ronda y que realmente avanzó, suma los
// puntos de esa ronda (sin importar el cruce exacto).
export function calcularPuntuacion(quiniela = {}, resultados = {}) {
  const detalleGrupos = { pts: 0, exactos: 0, resultados: 0, evaluados: 0 };

  for (const p of PARTIDOS_GRUPOS) {
    const real = resultados.marcadores?.[p.id];
    if (!real || real.local == null || real.visitante == null) continue;
    detalleGrupos.evaluados++;
    const pts = puntosPartido(quiniela.marcadores?.[p.id], real);
    detalleGrupos.pts += pts;
    if (pts === PUNTOS.exacto) detalleGrupos.exactos++;
    else if (pts === PUNTOS.resultado) detalleGrupos.resultados++;
  }

  const predicho = ganadoresPorRonda(quiniela.marcadores, quiniela.eliminatorias);
  const real = ganadoresPorRonda(resultados.marcadores, resultados.eliminatorias);

  const detalleBracket = { pts: 0, porRonda: {} };
  for (const [ronda, valor] of Object.entries(PUNTOS.rondas)) {
    let aciertos = 0;
    for (const id of predicho[ronda]) {
      if (real[ronda].has(id)) aciertos++;
    }
    const pts = aciertos * valor;
    detalleBracket.porRonda[ronda] = { aciertos, pts, posibles: real[ronda].size };
    detalleBracket.pts += pts;
  }

  const campeonId = [...predicho.final][0] || null;

  return {
    total: detalleGrupos.pts + detalleBracket.pts,
    grupos: detalleGrupos,
    bracket: detalleBracket,
    campeonId,
  };
}

// Leaderboard: recibe el mapa { nombre -> quiniela } y los resultados reales.
// Devuelve la lista ordenada por total (desempate: exactos, luego nombre).
export function calcularLeaderboard(quinielas = {}, resultados = {}) {
  const lista = Object.entries(quinielas).map(([nombre, q]) => ({
    nombre,
    actualizado: q.actualizado || null,
    ...calcularPuntuacion(q, resultados),
  }));
  lista.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.grupos.exactos !== a.grupos.exactos) return b.grupos.exactos - a.grupos.exactos;
    return a.nombre.localeCompare(b.nombre);
  });
  let posicion = 0, prevTotal = null, prevExactos = null;
  lista.forEach((fila, i) => {
    // Empates comparten posición (1, 1, 3...).
    if (fila.total !== prevTotal || fila.grupos.exactos !== prevExactos) {
      posicion = i + 1;
      prevTotal = fila.total;
      prevExactos = fila.grupos.exactos;
    }
    fila.posicion = posicion;
  });
  return lista;
}
