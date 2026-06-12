# Quiniela del Mundial 2026 ⚽

Aplicación web de predicciones para el Mundial 2026 (formato de 48 equipos con 12 grupos y Ronda de 32). Hecha en **HTML + CSS + JavaScript vanilla** + un servidor mínimo en **Node nativo** (sin dependencias) que guarda las quinielas de varios usuarios en un archivo JSON.

## Cómo abrir el proyecto

Como usa módulos ES (`import` / `export`), los navegadores no la cargan directamente desde `file://`. Necesitas un servidor estático.

### Opción 1 — Node.js (recomendado, sin dependencias)

El proyecto incluye un servidor mínimo (`server.js`) hecho con módulos nativos de Node. No requiere `npm install`.

```bash
cd Quiniela
npm start
```

o directamente:

```bash
node server.js
```

Luego abre <http://localhost:8000>. Puedes cambiar el puerto con la variable `PORT`:

```bash
# Windows PowerShell
$env:PORT=3000; node server.js

# macOS / Linux
PORT=3000 node server.js
```

**Requisitos**: Node.js ≥ 18.

### Opción 2 — Python

```bash
cd Quiniela
python -m http.server 8000
```

### Opción 3 — VS Code

Extensión *Live Server* → botón "Go Live".

## Estructura de archivos

```
Quiniela/
├── index.html              # Shell HTML + contenedores de cada vista
├── server.js               # Servidor Node nativo: estático + API REST
├── package.json            # Script npm start
├── data/
│   └── quinielas.json      # (se crea al primer guardado) BD de quinielas por nombre
├── css/
│   └── styles.css          # Estilos, design tokens (variables CSS), responsive
├── js/
│   ├── data.js             # DATOS estáticos: 48 equipos y 12 grupos
│   ├── api.js              # Cliente fetch del backend
│   ├── state.js            # ESTADO + sincronización con servidor (debounced)
│   ├── standings.js        # LÓGICA pura: tablas y mejores terceros
│   ├── bracket.js          # LÓGICA pura: armado y cascada del cuadro eliminatorio
│   ├── ui.js               # RENDER del DOM y manejo de eventos
│   └── main.js             # Punto de entrada
└── README.md
```

## Multiusuario (sin login real)

Pensado para grupos pequeños (≈15 personas). No hay autenticación: el usuario solo escribe su nombre. Si dos personas usan el mismo nombre, comparten quiniela.

**Flujo**
1. Al abrir la app, pide tu nombre.
2. Cada cambio se guarda automáticamente en el servidor (`data/quinielas.json`), debounced a 600 ms.
3. En la pestaña **Quinielas** puedes ver la lista de todos los participantes y abrir cualquiera en modo solo-lectura para comparar.
4. Cuando estás viendo la de alguien más, aparece un banner amarillo y los controles quedan deshabilitados.
5. Botón **Cambiar usuario** en la cabecera para cerrar sesión y entrar con otro nombre.

**API REST** (interna, expuesta por `server.js`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/api/quinielas` | Lista de nombres + metadata (% completado, fecha) |
| `GET`  | `/api/quiniela/:nombre` | Quiniela completa de un usuario |
| `PUT`  | `/api/quiniela/:nombre` | Guarda la quiniela del usuario (body JSON) |

**Limitaciones conscientes**
- Sin autenticación: cualquiera con acceso al servidor puede editar la quiniela de cualquier nombre. OK para una red local entre amigos.
- Sin protección de concurrencia fuerte: el servidor serializa escrituras vía promesa-cola interna, pero no detecta conflictos de versión. Para 15 usuarios no concurrentes es suficiente.
- Para más usuarios o uso público: cambia el archivo JSON por SQLite y agrega un token simple.

## ¿Dónde editar qué?

| Quiero cambiar… | Archivo |
|---|---|
| Equipos, grupos, banderas | `js/data.js` |
| Reglas de desempate o cálculo de tablas | `js/standings.js` |
| Estructura del bracket (qué slot juega contra cuál) | `js/bracket.js` |
| Look & feel (colores, tipografías, espaciados) | `css/styles.css` → bloque `:root` |
| Texto, etiquetas, navegación | `js/ui.js` |

## Arquitectura

- **Separación de responsabilidades**: datos / lógica / presentación viven en archivos distintos.
- **Estado único**: un solo objeto en `state.js` es la fuente de verdad. La UI se re-renderiza desde ese estado vía un patrón observer simple.
- **Lógica pura**: `standings.js` y `bracket.js` no tocan el DOM y se pueden testear con cualquier framework de testing.
- **Persistencia automática**: cada cambio se guarda en `localStorage` con la clave `quiniela-mundial-2026:v1`.

## Funcionalidades

- ✅ 12 grupos con 6 partidos cada uno (72 partidos de fase de grupos).
- ✅ Tabla en vivo con criterios de desempate (Pts → DG → GF) y aviso de empate técnico.
- ✅ Resaltado de clasificados (1°/2° en verde, 3° en amarillo).
- ✅ Ranking de los 12 terceros, con los 8 mejores que avanzan a la Ronda de 32.
- ✅ Bracket interactivo: Ronda de 32 → Octavos → Cuartos → Semis → Final + partido por el 3° puesto.
- ✅ Cascada automática: si cambias un resultado previo, las rondas siguientes se recalculan.
- ✅ Pantalla de **CAMPEÓN** con confeti y bandera grande.
- ✅ Multiusuario con nombre (sin login real).
- ✅ Persistencia automática en el servidor (debounced).
- ✅ Pestaña **Quinielas** para comparar las predicciones de otros usuarios.
- ✅ Indicador de sincronización (Guardado / Guardando / Error).
- ✅ Exportar predicciones a JSON.
- ✅ **Deshacer** el último cambio (hasta 30 pasos).
- ✅ **Reiniciar** con confirmación.
- ✅ Modo claro / oscuro.

## Heurísticas HCI aplicadas (Nielsen)

- **Visibilidad del estado**: barra de progreso de partidos completados y nombre de la fase actual.
- **Coincidencia con el mundo real**: lenguaje deportivo (Pts, DG, GF, "clasifica").
- **Control y libertad del usuario**: botones de Deshacer y Reiniciar (con confirmación).
- **Consistencia**: misma tarjeta de partido y mismos steppers en todas las fases.
- **Prevención de errores**: no se puede entrar al bracket si faltan marcadores; valores numéricos clampeados a 0..99.
- **Reconocer mejor que recordar**: navegación por pestañas siempre visible, IDs de partido en cada tarjeta.
- **Eficiencia**: steppers +/- + input numérico + flechas del teclado (↑/↓ para sumar/restar, ←/→ para navegar entre tabs).
- **Diseño minimalista**: cada vista muestra solo lo necesario.
- **Feedback**: animaciones suaves al ganador, toasts breves al actuar.

## Accesibilidad (a11y)

- Contraste AA en texto principal.
- Navegación completa por teclado: `Tab` para enfocar, `Enter`/`Espacio` para activar, `↑`/`↓` en steppers, `←`/`→` para cambiar de pestaña.
- Foco visible (`outline` amarillo).
- `aria-label` en steppers, banderas y botones de bracket.
- `alt` descriptivo en cada bandera.
- `role="progressbar"`, `role="tablist"`, `aria-live` para mensajes.
- Respeta `prefers-reduced-motion` (desactiva confeti y reduce transiciones).
- Skip-link "Saltar al contenido".

## Datos

Las banderas se cargan desde [flagcdn.com](https://flagcdn.com) usando códigos ISO (con `gb-eng` para Inglaterra y `gb-sct` para Escocia). Si flagcdn no está disponible, las banderas no se mostrarán pero la app funciona normalmente.

## Licencia

Proyecto educativo / personal. Úsalo libremente.
