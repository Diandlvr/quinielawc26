// =============================================================
// bracket.js — LÓGICA PURA del cuadro eliminatorio
// Define la estructura declarativa del bracket y resuelve cada
// "slot" (1A, 2C, 3º #1, ganador de M01...) al equipo concreto.
// =============================================================

// Estructura declarativa del cuadro. Cada partido tiene dos slots:
//   { tipo: 'pos',     valor: '1A'|'2C'... }   -> posición de un grupo
//   { tipo: 'tercero', indice: 0..7 }          -> ranking de mejores terceros
//   { tipo: 'ganador', match: 'M01' }          -> ganador de un partido previo
//   { tipo: 'perdedor', match: 'SF-1' }        -> perdedor (solo 3er puesto)
//
// El cuadro está pensado para que cada equipo aparezca exactamente una vez
// en la Ronda de 32 y para que cada ronda alimente a la siguiente.

export const BRACKET = {
  r32: [
    { id: 'M01', home: { tipo: 'pos', valor: '1A' }, away: { tipo: 'tercero', indice: 0 } },
    { id: 'M02', home: { tipo: 'pos', valor: '2C' }, away: { tipo: 'pos', valor: '2F' } },
    { id: 'M03', home: { tipo: 'pos', valor: '1D' }, away: { tipo: 'tercero', indice: 1 } },
    { id: 'M04', home: { tipo: 'pos', valor: '2B' }, away: { tipo: 'pos', valor: '2E' } },
    { id: 'M05', home: { tipo: 'pos', valor: '1E' }, away: { tipo: 'tercero', indice: 2 } },
    { id: 'M06', home: { tipo: 'pos', valor: '2A' }, away: { tipo: 'pos', valor: '1J' } },
    { id: 'M07', home: { tipo: 'pos', valor: '1H' }, away: { tipo: 'tercero', indice: 3 } },
    { id: 'M08', home: { tipo: 'pos', valor: '2G' }, away: { tipo: 'pos', valor: '2I' } },
    { id: 'M09', home: { tipo: 'pos', valor: '1F' }, away: { tipo: 'tercero', indice: 4 } },
    { id: 'M10', home: { tipo: 'pos', valor: '2H' }, away: { tipo: 'pos', valor: '2K' } },
    { id: 'M11', home: { tipo: 'pos', valor: '1C' }, away: { tipo: 'tercero', indice: 5 } },
    { id: 'M12', home: { tipo: 'pos', valor: '2D' }, away: { tipo: 'pos', valor: '2L' } },
    { id: 'M13', home: { tipo: 'pos', valor: '1B' }, away: { tipo: 'tercero', indice: 6 } },
    { id: 'M14', home: { tipo: 'pos', valor: '1I' }, away: { tipo: 'pos', valor: '1K' } },
    { id: 'M15', home: { tipo: 'pos', valor: '1G' }, away: { tipo: 'tercero', indice: 7 } },
    { id: 'M16', home: { tipo: 'pos', valor: '1L' }, away: { tipo: 'pos', valor: '2J' } },
  ],
  r16: [
    { id: 'O1', home: { tipo: 'ganador', match: 'M01' }, away: { tipo: 'ganador', match: 'M02' } },
    { id: 'O2', home: { tipo: 'ganador', match: 'M03' }, away: { tipo: 'ganador', match: 'M04' } },
    { id: 'O3', home: { tipo: 'ganador', match: 'M05' }, away: { tipo: 'ganador', match: 'M06' } },
    { id: 'O4', home: { tipo: 'ganador', match: 'M07' }, away: { tipo: 'ganador', match: 'M08' } },
    { id: 'O5', home: { tipo: 'ganador', match: 'M09' }, away: { tipo: 'ganador', match: 'M10' } },
    { id: 'O6', home: { tipo: 'ganador', match: 'M11' }, away: { tipo: 'ganador', match: 'M12' } },
    { id: 'O7', home: { tipo: 'ganador', match: 'M13' }, away: { tipo: 'ganador', match: 'M14' } },
    { id: 'O8', home: { tipo: 'ganador', match: 'M15' }, away: { tipo: 'ganador', match: 'M16' } },
  ],
  cuartos: [
    { id: 'Q1', home: { tipo: 'ganador', match: 'O1' }, away: { tipo: 'ganador', match: 'O2' } },
    { id: 'Q2', home: { tipo: 'ganador', match: 'O3' }, away: { tipo: 'ganador', match: 'O4' } },
    { id: 'Q3', home: { tipo: 'ganador', match: 'O5' }, away: { tipo: 'ganador', match: 'O6' } },
    { id: 'Q4', home: { tipo: 'ganador', match: 'O7' }, away: { tipo: 'ganador', match: 'O8' } },
  ],
  semis: [
    { id: 'S1', home: { tipo: 'ganador', match: 'Q1' }, away: { tipo: 'ganador', match: 'Q2' } },
    { id: 'S2', home: { tipo: 'ganador', match: 'Q3' }, away: { tipo: 'ganador', match: 'Q4' } },
  ],
  final: [
    { id: 'FINAL', home: { tipo: 'ganador', match: 'S1' }, away: { tipo: 'ganador', match: 'S2' } },
  ],
  tercerPuesto: [
    { id: 'TERCERO', home: { tipo: 'perdedor', match: 'S1' }, away: { tipo: 'perdedor', match: 'S2' } },
  ],
};

// Lista plana de todos los partidos eliminatorios (para iterar).
export function todosLosPartidosEliminatorios() {
  return [
    ...BRACKET.r32,
    ...BRACKET.r16,
    ...BRACKET.cuartos,
    ...BRACKET.semis,
    ...BRACKET.final,
    ...BRACKET.tercerPuesto,
  ];
}

// Resuelve un slot a un equipo concreto (o null si aún no está definido).
// `tablas` viene de standings.calcularTodo y `terceros` de standings.rankingTerceros.
function resolverSlot(slot, tablas, terceros, eliminatorias, partidosIndex) {
  if (!slot) return null;
  if (slot.tipo === 'pos') {
    // Ej: '1A' -> primer puesto del grupo A
    const posicion = parseInt(slot.valor[0], 10);    // 1, 2 o 3
    const grupo = slot.valor.slice(1);                 // 'A'..'L'
    const tabla = tablas[grupo];
    if (!tabla) return null;
    const fila = tabla[posicion - 1];
    if (!fila) return null;
    // Solo válido si todos los partidos del grupo están jugados:
    // si el PJ de algún equipo es < 3 (cada uno juega 3), la tabla no es definitiva.
    if (tabla.some(f => f.pj < 3)) return null;
    return fila.equipo;
  }
  if (slot.tipo === 'tercero') {
    // indice 0..7 sobre el ranking de terceros (solo si clasifica)
    const t = terceros[slot.indice];
    if (!t || !t.clasifica) return null;
    return t.equipo;
  }
  if (slot.tipo === 'ganador' || slot.tipo === 'perdedor') {
    const previo = partidosIndex[slot.match];
    if (!previo) return null;
    const winId = eliminatorias[slot.match]?.ganadorId;
    if (!winId) return null;
    // Necesitamos también los dos equipos del partido previo para sacar el perdedor.
    const homeEq = previo._home;
    const awayEq = previo._away;
    if (!homeEq || !awayEq) return null;
    if (slot.tipo === 'ganador') {
      return winId === homeEq.id ? homeEq : (winId === awayEq.id ? awayEq : null);
    } else {
      // perdedor
      return winId === homeEq.id ? awayEq : (winId === awayEq.id ? homeEq : null);
    }
  }
  return null;
}

// Resuelve el bracket completo respetando el orden de rondas.
// Devuelve la misma estructura pero con _home, _away, _ganador resueltos.
// Limpia ganadores "colgados" en `eliminatorias` que ya no son válidos.
export function resolverBracket(tablas, terceros, eliminatorias) {
  const orden = ['r32', 'r16', 'cuartos', 'semis', 'final', 'tercerPuesto'];
  const partidosIndex = {};
  const resultado = {};

  for (const ronda of orden) {
    resultado[ronda] = BRACKET[ronda].map(partido => {
      const home = resolverSlot(partido.home, tablas, terceros, eliminatorias, partidosIndex);
      const away = resolverSlot(partido.away, tablas, terceros, eliminatorias, partidosIndex);
      // Si hay un ganador guardado pero no coincide con ninguno de los dos
      // equipos actuales, lo limpiamos (cascada).
      const winId = eliminatorias[partido.id]?.ganadorId || null;
      let ganador = null;
      if (winId) {
        if (home && winId === home.id) ganador = home;
        else if (away && winId === away.id) ganador = away;
        else {
          // limpiar dato obsoleto
          if (eliminatorias[partido.id]) eliminatorias[partido.id].ganadorId = null;
        }
      }
      const resuelto = { id: partido.id, _home: home, _away: away, _ganador: ganador, ronda };
      partidosIndex[partido.id] = resuelto;
      return resuelto;
    });
  }
  return resultado;
}

// Conteo de partidos eliminatorios resueltos (ganador elegido) vs total.
export function progresoBracket(bracketResuelto) {
  let hechos = 0, total = 0;
  for (const ronda of Object.values(bracketResuelto)) {
    for (const p of ronda) {
      total++;
      if (p._ganador) hechos++;
    }
  }
  return { hechos, total };
}
