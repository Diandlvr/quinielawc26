// =============================================================
// standings.js — LÓGICA PURA de tablas y mejores terceros
// Sin DOM. Entran predicciones, salen tablas y rankings.
// =============================================================

import { GRUPOS, equiposDeGrupo, generarPartidosDeGrupo } from './data.js';

// Calcula la tabla de un grupo dado el objeto de marcadores.
// Devuelve un array de filas ordenadas: {equipo, pj, g, e, p, gf, gc, dg, pts, posicion}
export function calcularTablaGrupo(grupo, marcadores) {
  const equipos = equiposDeGrupo(grupo);
  const partidos = generarPartidosDeGrupo(grupo);

  // Inicializar filas en 0
  const filas = new Map();
  for (const eq of equipos) {
    filas.set(eq.id, {
      equipo: eq, pj: 0, g: 0, e: 0, p: 0,
      gf: 0, gc: 0, dg: 0, pts: 0,
    });
  }

  // Procesar cada partido con marcador completo
  for (const p of partidos) {
    const m = marcadores[p.id];
    if (!m || m.local == null || m.visitante == null) continue;
    const local = filas.get(p.localId);
    const visit = filas.get(p.visitanteId);
    local.pj++; visit.pj++;
    local.gf += m.local; local.gc += m.visitante;
    visit.gf += m.visitante; visit.gc += m.local;
    if (m.local > m.visitante) {
      local.g++; visit.p++;
      local.pts += 3;
    } else if (m.local < m.visitante) {
      visit.g++; local.p++;
      visit.pts += 3;
    } else {
      local.e++; visit.e++;
      local.pts += 1; visit.pts += 1;
    }
    local.dg = local.gf - local.gc;
    visit.dg = visit.gf - visit.gc;
  }

  // Ordenar con criterios de desempate: puntos -> dif goles -> goles a favor
  const arr = [...filas.values()];
  arr.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    // Orden estable por nombre cuando todo es idéntico (empate técnico).
    return a.equipo.nombre.localeCompare(b.equipo.nombre);
  });

  // Marcar empates técnicos: cuando dos filas tienen exactamente las mismas métricas.
  for (let i = 0; i < arr.length; i++) {
    arr[i].posicion = i + 1;
    arr[i].empateTecnico = false;
  }
  for (let i = 1; i < arr.length; i++) {
    const a = arr[i - 1], b = arr[i];
    if (a.pts === b.pts && a.dg === b.dg && a.gf === b.gf) {
      a.empateTecnico = true;
      b.empateTecnico = true;
    }
  }
  return arr;
}

// True si todos los partidos del grupo tienen marcador completo.
export function grupoCompleto(grupo, marcadores) {
  const partidos = generarPartidosDeGrupo(grupo);
  return partidos.every(p => {
    const m = marcadores[p.id];
    return m && m.local != null && m.visitante != null;
  });
}

// True si la fase de grupos completa está lista.
export function fasGruposCompleta(marcadores) {
  return GRUPOS.every(g => grupoCompleto(g, marcadores));
}

// Devuelve { gruposCalculados: {A:[...], B:[...]}, terceros:[...], todasLasTablas:[...]} ordenados.
export function calcularTodo(marcadores) {
  const tablas = {};
  for (const g of GRUPOS) tablas[g] = calcularTablaGrupo(g, marcadores);
  return tablas;
}

// Ranking de los 12 terceros con los mismos criterios. Los 8 primeros clasifican.
export function rankingTerceros(tablas) {
  const terceros = GRUPOS
    .map(g => tablas[g][2])      // 3ª posición
    .filter(Boolean)
    .map(f => ({ ...f, grupo: f.equipo.grupo }));

  terceros.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.equipo.nombre.localeCompare(b.equipo.nombre);
  });

  terceros.forEach((t, i) => {
    t.rankingTerceros = i + 1;
    t.clasifica = i < 8;
  });
  return terceros;
}

// Conteo de partidos completados / totales (para barra de progreso).
export function progresoGrupos(marcadores) {
  const total = Object.keys(marcadores).length;
  let hechos = 0;
  for (const id in marcadores) {
    const m = marcadores[id];
    if (m.local != null && m.visitante != null) hechos++;
  }
  return { hechos, total };
}
