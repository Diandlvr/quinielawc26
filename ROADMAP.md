# Roadmap — Quiniela del Mundial 2026

Pendientes para implementar más adelante.

---

## 1. Deploy

### Opción recomendada: Railway

- Ejecuta el proceso Node tal como está — **cero cambios de código**.
- El archivo `data/quinielas.json` persiste entre requests.
- Tier gratuito: ~500 h/mes (más que suficiente para el torneo).
- Deploy directo desde GitHub con un botón.

**Pasos:**
1. Subir el proyecto a un repositorio GitHub.
2. Crear cuenta en [railway.app](https://railway.app).
3. "New Project → Deploy from GitHub repo" → seleccionar el repo.
4. Railway detecta `package.json` y ejecuta `npm start` automáticamente.
5. En "Settings → Networking" asignar un dominio público.
6. Configurar la variable de entorno `PORT` si es necesario (Railway lo inyecta solo).

### Alternativa: Vercel

Requiere dos cambios de código:
- Convertir `server.js` a funciones serverless (`api/` folder de Vercel).
- Cambiar almacenamiento de archivo JSON → **Vercel KV** (Redis gratuito, ~30 K ops/mes).

### Descartado: GitHub Pages

Solo sirve estáticos, no puede correr Node. Requeriría eliminar el backend y volver a `localStorage`.

| | Railway | Vercel | GitHub Pages |
|---|---|---|---|
| Node persistente | ✅ | ❌ (serverless) | ❌ |
| Cambios de código | 0 | Storage → Vercel KV | Quitar backend |
| Tier gratis | 500 h/mes | Muy generoso | Ilimitado |
| Deploy desde GitHub | ✅ | ✅ | ✅ |
| **Recomendado** | ⭐ | Si ya usas Vercel | No |

---

## 2. Sistema de puntuación y ganador — ✅ IMPLEMENTADO

> **Estado: implementado** (junio 2026). Archivos: `js/score.js` (lógica pura),
> endpoints `GET/PUT /api/resultados`, `GET /api/admin/verificar` y
> `GET /api/puntuaciones` en `server.js`, tabs **Resultados** (leaderboard con
> podio) y **Admin** (captura de resultados reales con PIN) en `ui.js`.
> El PIN se define con la variable de entorno `ADMIN_PIN` (por defecto `2026`).
> Las eliminatorias se puntúan por **avance correcto**: cada equipo que el
> jugador tiene avanzando en una ronda y que realmente avanzó suma los puntos
> de esa ronda, sin importar el cruce exacto.

Cuando acabe el torneo (o conforme avanza), alguien ingresa los **resultados reales** y el sistema calcula automáticamente la puntuación de cada quiniela y muestra un leaderboard.

### Tabla de puntos propuesta

**Fase de grupos — por partido:**

| Predicción | Puntos |
|---|---|
| Marcador exacto (ej. 2-1 real = 2-1 predicho) | 5 pts |
| Resultado correcto (G / E / P) | 2 pts |
| Incorrecto | 0 pts |

**Eliminatorias — por avance correcto en cada ronda:**

| Ronda | Puntos |
|---|---|
| Ronda de 32 | 2 pts |
| Octavos de Final | 3 pts |
| Cuartos de Final | 5 pts |
| Semifinales | 8 pts |
| Tercer puesto | 5 pts |
| Final / Campeón | 15 pts |

Puntuación máxima teórica: **472 pts**
`(72 × 5) + (16 × 2) + (8 × 3) + (4 × 5) + (2 × 8) + 15 + 5`

### Arquitectura a implementar

**Archivos nuevos:**

```
data/
  quinielas.json        → ya existe
  resultados.json       → resultados reales (nuevo)

js/
  score.js              → lógica PURA de cálculo de puntos (sin DOM)

Nuevas rutas API en server.js:
  GET  /api/resultados        → trae los resultados reales
  PUT  /api/resultados        → guarda (requiere PIN de admin en header)
  GET  /api/puntuaciones      → calcula y devuelve scores de todos los usuarios
```

**Nuevas vistas en ui.js:**

- Tab **"Resultados"** → leaderboard con ranking, puntos y desglose por fase.
- Tab **"Admin"** → formulario para ingresar los resultados reales partido a partido (idéntico al de grupos pero con los marcadores reales). Solo visible / funcional si se tiene el PIN.

**Autenticación mínima (PIN de admin):**

- Variable de entorno `ADMIN_PIN` en el servidor (ej. `ADMIN_PIN=1234`).
- El frontend pide el PIN una vez y lo guarda en `sessionStorage`.
- Cada `PUT /api/resultados` lleva el header `X-Admin-Pin: <pin>`.
- El servidor rechaza con 401 si el PIN no coincide.
- Sin login, sin JWT, sin sesiones — suficiente para un grupo de amigos.

**`js/score.js` — lógica pura (esquema):**

```js
// Puntos de un partido de grupos
function puntosPartido(predicho, real) {
  if (predicho.local === real.local && predicho.visitante === real.visitante) return 5;
  if (Math.sign(predicho.local - predicho.visitante) === Math.sign(real.local - real.visitante)) return 2;
  return 0;
}

// Puntos por avance correcto en eliminatorias
const PUNTOS_RONDA = { M: 2, O: 3, Q: 5, S: 8, FINAL: 15, TERCERO: 5 };

function puntosEliminatorias(elimPredichas, elimReales) { ... }

// Puntuación total de una quiniela vs resultados reales
export function calcularPuntuacion(quiniela, resultados) { ... }
```

### Flujo de uso

1. El torneo avanza; el **admin** ingresa los resultados reales en la tab "Admin".
2. Cualquier usuario puede ver la tab **"Resultados"** con el leaderboard actualizado.
3. El leaderboard muestra: posición, nombre, puntos totales, puntos de grupos, puntos de bracket.
4. Al terminar el torneo, el #1 es el ganador de la quiniela.
