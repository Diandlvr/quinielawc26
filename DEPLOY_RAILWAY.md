# Deploy en Railway — instrucciones para el agente

> **Audiencia:** este documento lo ejecuta un agente de IA (Claude) con acceso al
> **MCP de Railway** y a la terminal. Sigue los pasos en orden, verifica cada uno
> antes de continuar y reporta al usuario el resultado de cada paso.

## Contexto del proyecto (léelo antes de tocar nada)

- App: **Quiniela del Mundial 2026** — Node nativo **sin dependencias** (no hay
  `node_modules` ni paso de build). Se arranca con `npm start` (= `node server.js`).
- El servidor lee `process.env.PORT` (Railway lo inyecta solo) con fallback a 8000.
- Repo GitHub: `https://github.com/Diandlvr/quinielawc26` (branch `main`).
- **Persistencia en archivos**: `data/quinielas.json` y `data/resultados.json`.
  ⚠️ El filesystem de Railway es **efímero entre deploys** — sin un Volume, cada
  redeploy borra todas las quinielas. **El paso 4 (Volume) NO es opcional.**
- Variable de entorno **`ADMIN_PIN`**: protege la captura de resultados reales
  (`PUT /api/resultados`). Si no se define, el servidor usa `2026` por defecto —
  inaceptable en producción pública.

## Paso 0 — Precondiciones

1. Lista las herramientas del MCP de Railway disponibles. Si **no** hay MCP de
   Railway conectado, detente y dile al usuario que lo configure
   (o usa el fallback con CLI al final de este documento, pidiendo permiso antes).
2. Verifica que no haya cambios sin pushear:
   ```bash
   git status --short && git log origin/main..HEAD --oneline
   ```
   Si hay cambios locales o commits sin pushear, **commitea y pushea primero**
   (Railway despliega lo que está en GitHub, no lo local):
   ```bash
   git add -A
   git commit -m "Sistema de puntuación y ganador + deploy Railway"
   git push origin main
   ```

## Paso 1 — Crear el proyecto en Railway

Con el MCP de Railway:

1. Verifica si ya existe un proyecto para esta app (lista los proyectos; busca
   nombres tipo `quiniela`/`quinielawc26`). Si existe, **no dupliques**: úsalo y
   salta a verificar el paso 2.
2. Si no existe, crea un proyecto nuevo con un servicio desde el repo de GitHub
   `Diandlvr/quinielawc26`, branch `main`.
   - Railway detecta `package.json` y usa `npm start` automáticamente.
   - No hay paso de build ni instalación de dependencias; no configures
     comandos de build personalizados.

## Paso 2 — Variable de entorno ADMIN_PIN

1. **Pregunta al usuario qué PIN quiere** (o propón uno aleatorio de 6 dígitos y
   pídele confirmación). **No uses `2026`** ni lo inventes en silencio.
2. Configura en el servicio la variable `ADMIN_PIN` con ese valor.
3. No configures `PORT` — Railway la inyecta automáticamente.

## Paso 3 — Volume para persistencia (crítico)

1. Crea un **Volume** y móntalo en el servicio en la ruta **`/app/data`**
   (el working dir del build de Railway/Nixpacks es `/app`).
2. Nota esperada: el volume vacío "tapa" el `data/quinielas.json` del repo — es
   correcto; el servidor crea los archivos al primer guardado (maneja `ENOENT`).
   Las quinielas de prueba del repo no migran, y eso está bien.

## Paso 4 — Dominio público

1. Genera un dominio público para el servicio (Settings → Networking →
   Generate Domain, o la herramienta equivalente del MCP).
2. Anota la URL resultante para el paso de verificación.

## Paso 5 — Verificación (no declares éxito sin esto)

Espera a que el deploy termine (revisa el estado/logs del deployment con el MCP;
si falla, lee los logs y diagnostica antes de reintentar). Luego, con `curl`
contra la URL pública (sustituye `$URL`):

```bash
# 1. La app sirve el frontend
curl -s -o /dev/null -w "%{http_code}" $URL/            # esperado: 200

# 2. La API responde
curl -s $URL/api/quinielas                               # esperado: {"quinielas":[...]}

# 3. Resultados públicos
curl -s $URL/api/resultados                              # esperado: JSON con marcadores/eliminatorias

# 4. El PIN protege la escritura
curl -s -o /dev/null -w "%{http_code}" -X PUT $URL/api/resultados \
  -H "X-Admin-Pin: PIN_INCORRECTO" -H "Content-Type: application/json" -d '{}'
                                                         # esperado: 401

# 5. El PIN real funciona (usa el ADMIN_PIN configurado en el paso 2)
curl -s $URL/api/admin/verificar -H "X-Admin-Pin: <ADMIN_PIN>"   # esperado: {"ok":true}
```

**Prueba de persistencia** (recomendada): guarda una quiniela de prueba vía
`PUT $URL/api/quiniela/DeployTest` con un body JSON mínimo, fuerza un redeploy,
y verifica que `GET $URL/api/quiniela/DeployTest` siga devolviendo 200.
Después bórrala del archivo no es posible vía API — basta con avisar al usuario
de que existe ese usuario de prueba, o reescribirla vacía.

## Paso 6 — Reporte final al usuario

Entrega al usuario:
- URL pública de la app.
- Confirmación de: variable `ADMIN_PIN` configurada (sin revelar el valor en
  texto plano si el chat es compartido), Volume montado en `/app/data`,
  y resultados de los 5 curls de verificación.
- Recordatorio: la tab **Admin** de la app pide ese PIN para capturar los
  resultados reales; el leaderboard es público en la tab **Resultados**.

---

## Fallback sin MCP (Railway CLI)

Solo si el usuario lo aprueba y el MCP no está disponible:

```bash
npm i -g @railway/cli
railway login                 # interactivo: pide al usuario ejecutarlo con `! railway login`
railway init                  # crear/vincular proyecto
railway variables --set "ADMIN_PIN=<pin>"
railway volume add --mount-path /app/data
railway up                    # deploy desde el directorio local
railway domain                # generar dominio público
```

## Gotchas conocidas

- **No agregues** `Dockerfile`, `railway.json` ni `nixpacks.toml`: la detección
  automática de Nixpacks con `npm start` es suficiente y es el camino probado.
- Si el deploy falla con error de versión de Node: el `package.json` exige
  `node >= 18`; fija la variable `NIXPACKS_NODE_VERSION=22` en el servicio.
- El tier gratuito (~500 h/mes o plan trial) duerme/limita según el plan actual
  de Railway; si la app no responde al primer hit, reintenta a los ~10 s.
- Si el MCP no expone creación de Volumes, hazlo tú con la CLI o indícale al
  usuario hacerlo en el dashboard (Service → Volumes → Mount path `/app/data`)
  **antes** de dar el deploy por terminado: sin volume, los datos se pierden.
