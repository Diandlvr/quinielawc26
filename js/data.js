// =============================================================
// data.js — DATOS ESTÁTICOS de la Quiniela del Mundial 2026
// Fuente de verdad: 48 equipos divididos en 12 grupos (A..L).
// Cada equipo: { id, nombre, bandera (código ISO para flagcdn), grupo }
// =============================================================

export const GRUPOS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// Cada grupo tiene 4 equipos. El "id" se construye como `${grupo}-${codigo}`
// para identificar cada selección de forma única dentro del estado.
export const EQUIPOS = [
  // Grupo A
  { id: 'A-mx', nombre: 'México',            bandera: 'mx',     grupo: 'A' },
  { id: 'A-za', nombre: 'Sudáfrica',         bandera: 'za',     grupo: 'A' },
  { id: 'A-kr', nombre: 'Corea del Sur',     bandera: 'kr',     grupo: 'A' },
  { id: 'A-cz', nombre: 'Chequia',           bandera: 'cz',     grupo: 'A' },

  // Grupo B
  { id: 'B-ca', nombre: 'Canadá',            bandera: 'ca',     grupo: 'B' },
  { id: 'B-ba', nombre: 'Bosnia y Herzegovina', bandera: 'ba',  grupo: 'B' },
  { id: 'B-qa', nombre: 'Catar',             bandera: 'qa',     grupo: 'B' },
  { id: 'B-ch', nombre: 'Suiza',             bandera: 'ch',     grupo: 'B' },

  // Grupo C
  { id: 'C-br', nombre: 'Brasil',            bandera: 'br',     grupo: 'C' },
  { id: 'C-ma', nombre: 'Marruecos',         bandera: 'ma',     grupo: 'C' },
  { id: 'C-ht', nombre: 'Haití',             bandera: 'ht',     grupo: 'C' },
  { id: 'C-sct', nombre: 'Escocia',          bandera: 'gb-sct', grupo: 'C' },

  // Grupo D
  { id: 'D-us', nombre: 'Estados Unidos',    bandera: 'us',     grupo: 'D' },
  { id: 'D-py', nombre: 'Paraguay',          bandera: 'py',     grupo: 'D' },
  { id: 'D-au', nombre: 'Australia',         bandera: 'au',     grupo: 'D' },
  { id: 'D-tr', nombre: 'Turquía',           bandera: 'tr',     grupo: 'D' },

  // Grupo E
  { id: 'E-de', nombre: 'Alemania',          bandera: 'de',     grupo: 'E' },
  { id: 'E-cw', nombre: 'Curazao',           bandera: 'cw',     grupo: 'E' },
  { id: 'E-ci', nombre: 'Costa de Marfil',   bandera: 'ci',     grupo: 'E' },
  { id: 'E-ec', nombre: 'Ecuador',           bandera: 'ec',     grupo: 'E' },

  // Grupo F
  { id: 'F-nl', nombre: 'Países Bajos',      bandera: 'nl',     grupo: 'F' },
  { id: 'F-jp', nombre: 'Japón',             bandera: 'jp',     grupo: 'F' },
  { id: 'F-se', nombre: 'Suecia',            bandera: 'se',     grupo: 'F' },
  { id: 'F-tn', nombre: 'Túnez',             bandera: 'tn',     grupo: 'F' },

  // Grupo G
  { id: 'G-be', nombre: 'Bélgica',           bandera: 'be',     grupo: 'G' },
  { id: 'G-eg', nombre: 'Egipto',            bandera: 'eg',     grupo: 'G' },
  { id: 'G-ir', nombre: 'Irán',              bandera: 'ir',     grupo: 'G' },
  { id: 'G-nz', nombre: 'Nueva Zelanda',     bandera: 'nz',     grupo: 'G' },

  // Grupo H
  { id: 'H-es', nombre: 'España',            bandera: 'es',     grupo: 'H' },
  { id: 'H-cv', nombre: 'Cabo Verde',        bandera: 'cv',     grupo: 'H' },
  { id: 'H-sa', nombre: 'Arabia Saudí',      bandera: 'sa',     grupo: 'H' },
  { id: 'H-uy', nombre: 'Uruguay',           bandera: 'uy',     grupo: 'H' },

  // Grupo I
  { id: 'I-fr', nombre: 'Francia',           bandera: 'fr',     grupo: 'I' },
  { id: 'I-sn', nombre: 'Senegal',           bandera: 'sn',     grupo: 'I' },
  { id: 'I-iq', nombre: 'Irak',              bandera: 'iq',     grupo: 'I' },
  { id: 'I-no', nombre: 'Noruega',           bandera: 'no',     grupo: 'I' },

  // Grupo J
  { id: 'J-ar', nombre: 'Argentina',         bandera: 'ar',     grupo: 'J' },
  { id: 'J-dz', nombre: 'Argelia',           bandera: 'dz',     grupo: 'J' },
  { id: 'J-at', nombre: 'Austria',           bandera: 'at',     grupo: 'J' },
  { id: 'J-jo', nombre: 'Jordania',          bandera: 'jo',     grupo: 'J' },

  // Grupo K
  { id: 'K-pt', nombre: 'Portugal',          bandera: 'pt',     grupo: 'K' },
  { id: 'K-cd', nombre: 'RD Congo',          bandera: 'cd',     grupo: 'K' },
  { id: 'K-uz', nombre: 'Uzbekistán',        bandera: 'uz',     grupo: 'K' },
  { id: 'K-co', nombre: 'Colombia',          bandera: 'co',     grupo: 'K' },

  // Grupo L
  { id: 'L-eng', nombre: 'Inglaterra',       bandera: 'gb-eng', grupo: 'L' },
  { id: 'L-hr', nombre: 'Croacia',           bandera: 'hr',     grupo: 'L' },
  { id: 'L-gh', nombre: 'Ghana',             bandera: 'gh',     grupo: 'L' },
  { id: 'L-pa', nombre: 'Panamá',            bandera: 'pa',     grupo: 'L' },
];

// Helpers para acceder rápido a datos por id o grupo.
export const EQUIPOS_POR_ID = Object.fromEntries(EQUIPOS.map(e => [e.id, e]));

export function equiposDeGrupo(grupo) {
  return EQUIPOS.filter(e => e.grupo === grupo);
}

// URL pública de banderas (resolución w80). Compatible con códigos
// regionales gb-eng y gb-sct usados por Inglaterra y Escocia.
export function urlBandera(codigo) {
  return `https://flagcdn.com/w80/${codigo}.png`;
}

// Genera los 6 enfrentamientos round-robin de un grupo (i<j) en orden estable.
// Devuelve una lista de objetos { id, grupo, localId, visitanteId }.
export function generarPartidosDeGrupo(grupo) {
  const eq = equiposDeGrupo(grupo);
  const partidos = [];
  for (let i = 0; i < eq.length; i++) {
    for (let j = i + 1; j < eq.length; j++) {
      partidos.push({
        id: `G-${grupo}-${eq[i].bandera}-${eq[j].bandera}`,
        grupo,
        localId: eq[i].id,
        visitanteId: eq[j].id,
      });
    }
  }
  return partidos;
}

// Lista plana de los 72 partidos de la fase de grupos (12 grupos x 6 partidos).
export const PARTIDOS_GRUPOS = GRUPOS.flatMap(generarPartidosDeGrupo);
