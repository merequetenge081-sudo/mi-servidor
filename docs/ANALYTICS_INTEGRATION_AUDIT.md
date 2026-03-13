# Auditoria De Integracion: Dashboard + Analytics + Skills

## Fecha
- 2026-03-08

## 1) Mapa real encontrado (antes)
- `dashboard.html` (modular) mostraba KPIs/cards/charts desde `DashboardModule`, pero ese modulo calculaba con `AppState.registrations` y `AppState.leaders` cargados desde:
  - `GET /api/registrations`
  - `GET /api/leaders`
- `analytics` (seccion interna del dashboard) consumia:
  - `GET /api/v2/analytics/metrics`
- `analytics.html` consumia:
  - `GET /api/v2/analytics/advanced`
  - `POST /api/v2/analytics/verify-global`
  - `GET /api/v2/analytics/simulation`
- Skills panel consumia correctamente:
  - `GET /api/v2/skills/health`
  - `GET /api/v2/skills/inconsistencies`
  - `GET /api/v2/skills/jobs`
  - `POST /api/v2/skills/run`

## 2) Problemas detectados
- Doble fuente de verdad:
  - Dashboard principal: datos crudos (`/api/*` legacy).
  - Modulo analisis: datos limpios (`/api/v2/analytics/metrics`).
- KPIs inconsistentes por filtros distintos:
  - Dashboard principal no aplicaba `applyCleanAnalyticsFilter`.
  - Analytics si aplicaba filtros limpios en backend.
- Metricas materializadas (`DailyMetric`, `CampaignMetric`, `LeaderMetric`, `TerritoryMetric`) existian pero no se exponian ni se usaban en vistas.
- Tras ejecutar skills, el panel de jobs/health cambiaba, pero las cards principales no siempre reflejaban ese cambio.

## 3) Correcciones aplicadas

### Backend
- `src/services/metrics.service.js`
  - `getDashboardMetrics()` ahora incluye:
    - `recentRecords` (registros recientes limpios).
    - `source` (trazabilidad de filtro/endpoint).
- `src/backend/modules/analytics/analytics.service.js`
  - Nuevo `getMaterializedMetrics(eventId)` para leer:
    - `CampaignMetric` (ultimo snapshot)
    - `DailyMetric` (ultimo snapshot)
    - top `LeaderMetric`
    - top `TerritoryMetric`
- `src/backend/modules/analytics/analytics.controller.js`
  - Nuevo endpoint handler: `getMaterialized`.
- `src/backend/modules/analytics/analytics.routes.js`
  - Nuevo endpoint:
    - `GET /api/v2/analytics/materialized`

### Frontend (dashboard modular)
- `public/js/modules/dashboard.module.js`
  - Refactor completo para eliminar calculos crudos en frontend.
  - Ahora consume exclusivamente `DataService.getDashboardMetrics()` (`/api/v2/analytics/metrics`) para:
    - Cards KPI
    - charts de confirmacion/top lideres
    - tabla de registros recientes (limpios)
  - Agrega trazas:
    - `console.debug('[KPI TRACE] ...')`
- `public/js/services/data.service.js`
  - Nuevo `getDashboardMetrics({ region, leaderId })`
  - Nuevo `getMaterializedAnalytics()`
  - `getStats()` ahora deriva de `getDashboardMetrics()` (fuente limpia).
- `public/js/services/bootstrap.service.js`
  - `updateDashboardStats()` ahora llama `DashboardModule.refresh()` (limpio backend).
  - Se elimina dependencia del flujo crudo para cards/charts principales.
- `public/js/core/router.js`
  - Navegar a `dashboard` ahora fuerza `DashboardModule.refresh()` en vez de cargar charts una sola vez desde estado local crudo.
- `public/js/modules/skills.module.js`
  - Tras ejecutar skill o refrescar panel, dispara `DashboardModule.refresh()` para reflejar cambios inmediatamente.

### Frontend (analytics)
- `public/js/modules/analytics.module.js`
  - Usa `DataService.apiCall` en lugar de `fetch` directo para `/api/v2/analytics/metrics`.
  - Agrega trazas KPI endpoint->vista.
- `public/analytics.html`
  - `fetchAnalyticsData()` ahora consume en paralelo:
    - `/api/v2/analytics/advanced`
    - `/api/v2/analytics/materialized`
  - Cards principales priorizan materializadas cuando existan; fallback a advanced.
  - Agrega traza de fuente en consola.

## 4) Fuente final de verdad por vista

### Dashboard (`dashboard.html`)
- Cards KPI + charts + recientes:
  - `GET /api/v2/analytics/metrics`
- Salud de datos:
  - `GET /api/v2/skills/health`
- Inconsistencias:
  - `GET /api/v2/skills/inconsistencies`
- Jobs:
  - `GET /api/v2/skills/jobs`, `GET /api/v2/skills/jobs/:jobId`

### Analisis interno (seccion analytics en dashboard)
- KPI y tablas:
  - `GET /api/v2/analytics/metrics`

### Analytics avanzado (`analytics.html`)
- Estructura analitica detallada:
  - `GET /api/v2/analytics/advanced`
- Snapshot materializado:
  - `GET /api/v2/analytics/materialized`
- Simulacion:
  - `GET /api/v2/analytics/simulation`

## 5) Trazabilidad y validacion operativa
- Se agregaron logs temporales en frontend:
  - `DashboardModule`: `[KPI TRACE] dashboard.cards <- /api/v2/analytics/metrics`
  - `AnalyticsModule`: `[KPI TRACE] analytics.module <- /api/v2/analytics/metrics`
  - `analytics.html`: `[KPI TRACE] analytics.html cards <- ...`
- Con esto se puede verificar en consola:
  - que endpoint alimenta cada KPI
  - con que filtro (`eventId`, `region`, `leaderId`)
  - timestamp de payload

## 6) Pendientes (no bloqueantes)
- Persistir y exponer versionado de snapshot materializado por `organizationId + eventId` de forma explicita en todos los endpoints de analytics.
- Homologar caracteres/acentos en algunos textos legacy de UI.
- Reducir cargas masivas de `/api/registrations?limit=10000` para secciones operativas que no requieren dataset completo.

## 7) Auditoria puntual dashboard KPI (2026-03-08)

### 7.1 Fuente real por KPI (dashboard principal)
- Vista: `public/dashboard.html` (cards/charts)
- Render: `public/js/modules/dashboard.module.js` (activo)
- Fuente de datos: `DataService.getDashboardMetrics()` -> `GET /api/v2/analytics/metrics`
- Script legacy `public/js/dashboard.js`: no activo en `dashboard.html` (script comentado)

### 7.2 Mapa exacto card/grafico -> funcion -> endpoint
- KPI `Lideres Activos (Evento)`
  - Frontend: `DashboardModule.updateStats()`
  - DataService: `getDashboardMetrics({ region, leaderId })`
  - Endpoint: `GET /api/v2/analytics/metrics?eventId=...`
  - Campo usado: `data.operationalTotals.totalLeaders`
- KPI `Total Registros (Bruto)`
  - Frontend: `DashboardModule.updateStats()`
  - Endpoint: `GET /api/v2/analytics/metrics?eventId=...`
  - Campo usado: `data.operationalTotals.totalRegistrations`
- KPI `Confirmados (Bruto)`
  - Frontend: `DashboardModule.updateStats()`
  - Endpoint: `GET /api/v2/analytics/metrics?eventId=...`
  - Campo usado: `data.operationalTotals.confirmedCount`
- KPI `Tasa Confirmacion (Bruto)`
  - Frontend: `DashboardModule.updateStats()`
  - Endpoint: `GET /api/v2/analytics/metrics?eventId=...`
  - Campo usado: `data.operationalTotals.confirmRate`
  - Formula: `confirmedCount / totalRegistrations`
- Grafico `Estado de Asistencia`
  - Frontend: `DashboardModule.loadConfirmationChart()`
  - Endpoint: `GET /api/v2/analytics/metrics?eventId=...`
  - Campos: `operationalTotals.totalRegistrations`, `operationalTotals.confirmedCount`
- Grafico `Top 5 Lideres`
  - Frontend: `DashboardModule.loadTopLeadersChart()`
  - Endpoint: `GET /api/v2/analytics/metrics?eventId=...`
  - Campo: `data.leadersOperational` (fallback `data.leaders`)

### 7.3 Causa exacta encontrada
- `src/services/metrics.service.js` contaba `totalLeaders` global (`active: true`) sin acotar correctamente al evento.
- El dashboard consumia metricas limpias para totales (`totals`) y podia aparentar mismatch con expectativas operativas brutas del evento.

### 7.4 Correccion aplicada
- Backend `src/services/metrics.service.js`
  - Se separan agregados:
    - `totals` (limpio): usando `applyCleanAnalyticsFilter`
    - `operationalTotals` (bruto): sin filtro de limpieza (`includeInvalid: true`)
  - Se agrega `leadersOperational` (top lideres en base operativa).
  - `totalLeaders` ahora se acota por evento y se protege con fallback al conteo real de lideres con actividad en el evento.
  - `source.includesOperationalTotals = true`
- Frontend `public/js/modules/dashboard.module.js`
  - Cards/charts principales usan `operationalTotals`/`leadersOperational` (fallback a limpio para compatibilidad).
  - Se agregan trazas por KPI:
    - `[KPI TRACE] Leaders Active -> eventId=...`
    - `[KPI TRACE] Total Records -> eventId=...`
    - `[KPI TRACE] Confirmed -> eventId=...`
    - `[KPI TRACE] Confirm Rate -> eventId=...`
- Frontend `public/js/services/data.service.js`
  - Se agrega traza de request:
    - `[KPI TRACE] Dashboard request -> /api/v2/analytics/metrics?...`
  - Se agrega fallback de `eventId` desde storage/AppCommon cuando `AppState.user.eventId` no esta hidratado, para evitar requests globales por error.
- Vista `public/dashboard.html`
  - Labels aclarados para evitar mezcla silenciosa:
    - `Lideres Activos (Evento)`
    - `Total Registros (Bruto)`
    - `Confirmados (Bruto)`
    - `Tasa Confirmacion (Bruto)`

### 7.5 Antes vs despues (KPI)
- Antes:
  - `Lideres Activos`: podia mostrar conteo global del sistema.
  - `Total/Confirmados/Tasa`: semantica limpia no explicitada.
- Despues:
  - KPIs principales: operativos brutos y acotados al evento.
  - Semantica visible en UI y trazable por consola.
  - Filtro por `eventId` alineado para cards y graficos desde una sola respuesta.

## 8) Correccion puntual final (Router shell + Advanced breakdown)

### 8.1 Problema 1: modulos del shell no abrian al hacer click

#### Causa exacta encontrada
- Archivo: `public/js/core/events.js`
- El delegado global de clicks tenia errores de sintaxis (ternarios rotos), por ejemplo:
  - `const token = leader  (...) : ...`
  - `localStorage.setItem('darkMode', isDark  'enabled' : 'disabled')`
  - `menu.style.display = willShow  'block' : 'none'`
- Efecto:
  - `events.js` no cargaba.
  - nunca se registraba `document.addEventListener('click', ...)`.
  - los `<a data-section=\"...\">` del menu quedaban sin handler (navegacion muerta).

#### Auditoria de navegacion (mapa real)
- Menu en `public/dashboard.html`:
  - `data-section=\"dashboard\"` -> modulo Dashboard
  - `data-section=\"leaders\"` -> modulo Lideres
  - `data-section=\"registrations\"` -> modulo Registros
  - `data-section=\"analytics\"` -> modulo Analisis interno
  - `data-section=\"export\"` -> modulo Exportar
  - `href=\"/analytics.html\"` -> pagina separada Analisis Avanzado
- Secciones shell montadas:
  - `#dashboard`, `#leaders`, `#registrations`, `#analytics`, `#export`, `#deletion-requests`
- Flujo de click:
  - `events.js` captura click en `[data-section]` y llama `Router.navigate(sectionId)`.
  - `router.js` activa seccion, actualiza titulo/nav y ejecuta `loadSectionData(sectionId)`.

#### Correccion aplicada
- `public/js/core/events.js`
  - Reparados errores de sintaxis en bloque de delegacion.
  - Se agrego traza de click:
    - `[ROUTER TRACE] clicked route=...`
- `public/js/core/router.js`
  - Se agrego soporte de hash real:
    - inicializa seccion desde `location.hash`
    - escucha `hashchange`
    - actualiza hash al navegar
  - Se agrego trazabilidad y fallback:
    - `[ROUTER TRACE] clicked route=...`
    - `[ROUTER TRACE] mounted module=...`
    - `[ROUTER TRACE] failed module=...`
  - Si un modulo falla al montar, se muestra banner visual en la seccion afectada.

### 8.2 Problema 2: analytics avanzado mostraba total correcto pero breakdown muy bajo

#### Causa exacta encontrada
- Archivo backend: `src/backend/modules/analytics/advanced.service.js`
- `getAdvancedAnalytics()` construia su universo con `applyCleanAnalyticsFilter(...)` (solo limpio/valido).
- En paralelo, las cards base de `analytics.html` se estaban mostrando con totales operativos (brutos) desde `/api/v2/analytics/metrics`.
- Resultado:
  - cards grandes (universo bruto) vs breakdowns pequenos (universo limpio estricto).

#### Query/agregacion final por fuente
- Cards base en `analytics.html`:
  - endpoint: `GET /api/v2/analytics/metrics`
  - params: `eventId`, `region`, `status`, `leaderId`
  - campos usados: `operationalTotals.*`
- Breakdowns (`top puestos`, `localidades`, `jerarquia`, `lideres`) en `analytics.html`:
  - endpoint: `GET /api/v2/analytics/advanced`
  - params: `eventId`, `status`, `leaderId`, `region` (front envía; backend devuelve all/bogota/nacional)
  - backend ahora usa universo bruto:
    - `rawMatchQuery = applyCleanAnalyticsFilter(..., { includeInvalid: true })`
    - filtros de `status` y `leaderId` aplicados sobre ese universo.
  - backend tambien calcula referencia limpia:
    - `cleanMatchQuery = applyCleanAnalyticsFilter(...)`
  - agrega en respuesta:
    - `summary.totalRaw`, `summary.totalClean`, `summary.hiddenByCleanFilter`
    - por region: `localityBreakdownTotal`, `excluded.{noLocality,noPollingPlace,inconsistent}`

#### Correccion aplicada
- `src/backend/modules/analytics/advanced.service.js`
  - breakdown ahora basado en universo bruto del evento (no se esconden registros por limpieza).
  - ya no se excluye `Sin Puesto Asignado` del top de puestos.
  - se agrega metrica de excluidos/analizable para explicar diferencias residuales.
  - traza backend:
    - `[ADV TRACE] advanced analytics computed ...`
- `public/analytics.html`
  - trazas temporales:
    - `[ADV TRACE] request eventId=... region=... status=...`
    - `[ADV TRACE] localityBreakdown total=...`
    - `[ADV TRACE] excluded records noLocality=... noPollingPlace=... inconsistent=...`

### 8.3 Before / After resumido
- Before:
  - shell: clicks sin efecto por fallo JS en delegado.
  - advanced: cards y breakdowns en universos distintos.
- After:
  - shell: navegacion modular activa con hash y trazas de montaje/error.
  - advanced: breakdowns coherentes con universo bruto del evento + explicacion de excluidos.

### 8.4 Archivos tocados en esta correccion puntual
- `public/js/core/events.js`
- `public/js/core/router.js`
- `src/backend/modules/analytics/advanced.service.js`
- `public/analytics.html`

## 9) Cierre de capa de breakdowns (dashboard + analytics avanzado)

### 9.1 Mapa exacto de bloques y contratos

| Vista / Bloque | Frontend (archivo + funcion) | Endpoint | Parametros | JSON usado | Definicion final |
|---|---|---|---|---|---|
| Dashboard#Analisis - Total Registros | `public/js/modules/analytics.module.js` -> `updateStats()` | `GET /api/v2/analytics/metrics` | `eventId, region, leaderId` (via `DataService.getDashboardMetrics`) | `operationalTotals.totalRegistrations` | Total bruto del evento (operativo) |
| Dashboard#Analisis - Bogota | `analytics.module.js` -> `updateStats()` | `GET /api/v2/analytics/metrics` | igual | `operationalTotals.bogotaCount` | Registros del evento clasificados como Bogota |
| Dashboard#Analisis - Resto Pais | `analytics.module.js` -> `updateStats()` | `GET /api/v2/analytics/metrics` | igual | `operationalTotals.restoCount` | Registros del evento fuera de Bogota |
| Dashboard#Analisis - Desempeno por Lider | `analytics.module.js` -> `renderLeaderPerformanceChart()` | `GET /api/v2/analytics/metrics` | igual | `leadersOperational[]` | Distribucion operacional por lider |
| Dashboard#Analisis - Detalle por Lider | `analytics.module.js` -> `populateLeaderDetailTable()` | `GET /api/v2/analytics/metrics` | igual | `leadersOperational[]` | Tabla operacional paginada |
| Dashboard#Analisis - Top 10 Ubicaciones | `analytics.module.js` -> `loadCharts()` | `GET /api/v2/analytics/metrics` | igual | `localityOperational[]` | Top 10 (subconjunto), no total completo |
| analytics.html - Cards base | `public/analytics.html` -> `renderDashboard()` | `GET /api/v2/analytics/metrics` | `eventId,status,region,leaderId` | `operationalTotals.*` | Base comun de KPIs con Dashboard |
| analytics.html - Top 10 Puestos | `public/analytics.html` -> `renderPuestosChart()` | `GET /api/v2/analytics/advanced` | `eventId,status,leaderId` | `<region>.topPuestos[]` | Top 10 + bucket "Otros" para no perder cola larga |
| analytics.html - Distribucion Localidad | `public/analytics.html` -> `renderLocalidadesChart()` | `GET /api/v2/analytics/advanced` | `eventId,status,leaderId` | `<region>.topLocalidades[]` | Top 8 + "Otros" |
| analytics.html - Estructura Jerarquica | `public/analytics.html` -> `renderHierarchicalTable()` | `GET /api/v2/analytics/advanced` | `eventId,status,leaderId` | `<region>.jerarquia[]` | Desglose completo Localidad->Puesto->Mesa |
| analytics.html - Rendimiento Lideres | `public/analytics.html` -> `renderLeadersTable()` | `GET /api/v2/analytics/advanced` | `eventId,status,leaderId` | `<region>.topLideres[]` | Tabla real de lideres (ya no estado vacio) |

### 9.2 Causas exactas de desalineacion corregidas

- `analytics.html` recortaba top N sin explicitar resto (parecia universo pequeno):
  - `topPuestos.slice(0,10)` y `topLocalidades.slice(0,8)` sin bucket "Otros".
- Bloque "Rendimiento de Lideres" en `analytics.html` no renderizaba nada:
  - `renderLeadersTable()` retornaba inmediatamente.
- Backend avanzado truncaba puestos en servicio:
  - `advanced.service.js` limitaba internamente `topPuestos` con `.slice(0,15)`.

### 9.3 Correcciones aplicadas

- `public/analytics.html`
  - Se agrego panel "Cobertura del Breakdown":
    - `totalRegion`, `localityBreakdownTotal`, `noLocality`, `noPollingPlace`, `inconsistent`, `hiddenByCleanFilter`.
  - `renderPuestosChart()` ahora agrega "Otros" = total - top10.
  - `renderLocalidadesChart()` ahora agrega "Otros" = total - top8.
  - Implementado `renderLeadersTable(searchTerm)` usando `topLideres` real.
  - Se agregaron trazas `[ANALYTICS TRACE]` por bloque avanzado.
- `src/backend/modules/analytics/advanced.service.js`
  - Se removio truncamiento hardcoded de `topPuestos` (`slice(0,15)`).
- `public/dashboard.html`
  - Se limpio etiqueta duplicada "Top 10 Ubicaciones (Subconjunto)" y labels de Bogota/Resto para evitar lectura ambigua.

### 9.4 Validacion tecnica

- `node --check src/backend/modules/analytics/advanced.service.js` OK.
- `npm test -- --runInBand tests/unit/metrics.service.test.js` OK (2/2).

### 9.5 Diferencias residuales permitidas (y explicadas)

- Cards base (`metrics`) y breakdowns avanzados (`advanced`) pueden diferir en suma visual de un grafico top N.
- Esa diferencia ya no se oculta: se representa explicitamente en "Otros" y en panel de cobertura/excluidos.

## 10) Correccion quirurgica de breakdowns territoriales/ubicaciones

### 10.1 Hallazgo raiz

El desfase observado (cards base correctas, breakdowns pequenos/raros) tenia dos causas distintas:

1. **Runtime desactualizado**: `/api/v2/analytics/advanced` estaba respondiendo con contrato viejo en memoria (sin `all/summary/excluded`) hasta reiniciar proceso.
2. **Visualizacion top-N en frontend**: los charts mostraban solo subconjuntos sin explicitar `Otros`, por lo que el usuario percibia que el universo no cuadraba con el total.

### 10.2 Mapa bloque por bloque (fuente real)

| Bloque | Frontend | Endpoint | JSON key | Tipo de conteo |
|---|---|---|---|---|
| Dashboard#Analisis card Bogota | `public/js/modules/analytics.module.js::updateStats` | `/api/v2/analytics/metrics` | `operationalTotals.bogotaCount` | registros |
| Dashboard#Analisis card Resto | `analytics.module.js::updateStats` | `/api/v2/analytics/metrics` | `operationalTotals.restoCount` | registros |
| Dashboard#Analisis dona Top10 Ubicaciones | `analytics.module.js::loadCharts` | `/api/v2/analytics/metrics` | `localityOperational[]` | registros por ubicacion (top-N + Otros) |
| analytics.html Top10 Puestos | `public/analytics.html::renderPuestosChart` | `/api/v2/analytics/advanced` | `data.<region>.topPuestos[]` | registros por puesto |
| analytics.html Distribucion Localidad | `public/analytics.html::renderLocalidadesChart` | `/api/v2/analytics/advanced` | `data.<region>.topLocalidades[]` | registros por localidad |
| analytics.html Cobertura Breakdown | `public/analytics.html::renderDashboard` | `/api/v2/analytics/advanced` | `totalVotos`, `topLocalidades.length`, `excluded`, `summary.hiddenByCleanFilter` | registros + cobertura |
| analytics.html Estructura jerarquica | `public/analytics.html::renderHierarchicalTable` | `/api/v2/analytics/advanced` | `data.<region>.jerarquia[]` | registros (localidad->puesto->mesa) |

### 10.3 JSON audit real (runtime actual)

`GET /api/v2/analytics/metrics?eventId=6912d782bbd0c0ef09b4650c&region=all`
- `operationalTotals.totalRegistrations = 2893`
- `operationalTotals.bogotaCount = 2793`
- `operationalTotals.restoCount = 100`
- `localityOperational[]` = top ubicaciones por conteo de registros (top 10)

`GET /api/v2/analytics/advanced?eventId=6912d782bbd0c0ef09b4650c&status=all&region=all`
- claves: `all`, `bogota`, `nacional`, `summary`, `source`, `timestamp`
- `all.totalVotos = 2893`
- `all.localityBreakdownTotal = 2893`
- `all.topPuestos[]` = conteo real por puesto
- `all.topLocalidades[]` = conteo real por localidad
- `all.excluded = { noLocality, noPollingPlace, inconsistent }`
- `summary = { totalRaw, totalClean, hiddenByCleanFilter }`

### 10.4 Correcciones aplicadas

1. `public/js/modules/analytics.module.js`
- Dona de `Top 10 Ubicaciones` ahora agrega bucket `Otros = totalRegistrations - sum(top10)`.
- Se agregaron trazas:
  - `[BREAKDOWN TRACE] block=DashboardAnalytics.Top10Ubicaciones ...`
  - `[BREAKDOWN TRACE] bogota/resto/total ...`

2. `public/analytics.html`
- Cobertura renombrada y corregida:
  - `Total Registros Analizados` -> `data.totalVotos`
  - `Localidades con Datos` -> `data.topLocalidades.length` (antes se mostraba suma de registros)
- Se agregaron trazas por bloque y tipo de conteo:
  - `[BREAKDOWN TRACE] block=Advanced.TopPuestos ...`
  - `[BREAKDOWN TRACE] block=Advanced.TopLocalidades ...`
  - `[BREAKDOWN TRACE] block=Advanced.Cobertura ...`

3. `src/backend/modules/analytics/advanced.service.js`
- Se agrego traza backend consolidada:
  - `[BREAKDOWN TRACE] advanced.breakdown` con `localityTotal`, `pollingPlaceTotal`, `excluded`, `bogota`, `resto`, `total`.

### 10.5 Validacion matematica esperada

- Dashboard cards: `bogota + resto = total` (2793 + 100 = 2893).
- Dashboard dona: `sum(top10 ubicaciones) + Otros = total`.
- Advanced breakdown:
  - `all.totalVotos` = universo analizado.
  - `topLocalidades` y `topPuestos` son conteos de **registros** (no lideres ni buckets unicos).
  - excluidos se muestran explicitamente (`noLocality`, `noPollingPlace`, `inconsistent`, `hiddenByCleanFilter`).

### 10.6 Nota operativa

Durante esta fase, al reiniciar localmente aparecio `querySrv ETIMEOUT` hacia MongoDB Atlas en este entorno de ejecucion. El ajuste de codigo quedo aplicado; para validar en UI en vivo se requiere que el proceso arranque con conectividad a Atlas.

## 11) Normalizacion territorial y filtros (correccion quirurgica)

### 11.1 Causa exacta

Se detectaron dos causas principales:

1. **Normalizacion territorial duplicada y no uniforme**
- `metrics.service.js` y `advanced.service.js` usaban logicas distintas para clasificar Bogota/Resto y para resolver localidad.
- En `advanced.service.js` habia comparaciones directas sensibles a variantes de string (tildes, mojibake, abreviaciones), lo que podia mandar registros al bucket incorrecto o vaciar filtros regionales.

2. **Bucket `Otros` generado por frontend (top-N)**
- `dashboard.html#analytics` (`analytics.module.js`) y `analytics.html` inyectaban `Otros` como `total - topN`.
- Ese bucket no era una categoria territorial real del catalogo; era un residuo de truncamiento visual.

### 11.2 Campo fuente real y catalogo

- Fuente territorial primaria en registros:
  - `puesto.localidad` (via `lookup` por `puestoId`) y/o `localidad`
- Fallback territorial usado:
  - `departamento` / `puesto.departamento` / `capital` / `puesto.ciudad`
- Catalogo canonico Bogota utilizado ahora (cerrado):
  - Usaquen, Chapinero, Santa Fe, San Cristobal, Usme, Tunjuelito, Bosa, Kennedy, Fontibon, Engativa, Suba, Barrios Unidos, Teusaquillo, Los Martires, Antonio Narino, Puente Aranda, La Candelaria, Rafael Uribe Uribe, Ciudad Bolivar, Sumapaz.

### 11.3 Funcion de normalizacion unificada

Se creo `src/shared/territoryNormalization.js` con:
- `normalizeTerritoryText(value)`
- `canonicalizeBogotaLocality(value)`
- `isBogotaTerritory(fields)`
- `getBogotaLocalidadesNormalized()`

Esta capa resuelve:
- tildes/mayusculas
- variantes mojibake frecuentes
- diferencias de formato
- clave canonica unica por localidad Bogota

### 11.4 Integracion aplicada

1. **Backend metrics (dashboard interno)**
- `src/services/metrics.service.js`
  - migro a helpers compartidos de normalizacion territorial.
  - se mantiene agregacion por conteo real de registros.

2. **Backend advanced (analytics.html)**
- `src/backend/modules/analytics/advanced.service.js`
  - clasificacion Bogota/Resto ahora usa `isBogotaTerritory(...)` unificado.
  - localidad del breakdown ahora se canoniza con `canonicalTerritoryLabel(...)`.
  - evita perdida por strings no normalizados.
- `src/backend/modules/analytics/analytics.controller.js`
  - pasa `region` al servicio para trazabilidad de contexto.

3. **Frontend charts**
- `public/js/modules/analytics.module.js` (dashboard analytics)
- `public/analytics.html` (advanced)
  - se retiro el bucket visual `Otros`.
  - si hay registros fuera de match se reportan en categorias tecnicas (`excluded`) y trazas, no como "Otros".

### 11.5 Filtros Bogota/Resto

Se unifico criterio territorial para evitar que filtros queden en 0 por mismatch de strings:
- `scope=all|bogota|resto` ahora se apoya en normalizacion canonica comun.
- mismo criterio de clasificacion en calculo y visualizacion.

### 11.6 Trazas agregadas

- `[TERRITORY TRACE] raw/normalized ...`
- `[TERRITORY TRACE] scope=bogota/resto/all count=...`
- `[TERRITORY TRACE] unmatchedLocalities=...`
- `[TERRITORY TRACE] bucketOtrosCount=0`
- `[BREAKDOWN TRACE] ...` por bloque de chart/cobertura.

### 11.7 Before / After

- Before:
  - `Otros` aparecia como residuo de top-N, no como categoria real.
  - filtros regionales dependian de logicas no uniformes.
- After:
  - sin bucket `Otros` en charts territoriales.
  - normalizacion territorial centralizada y reutilizada.
  - filtros y breakdowns basados en la misma definicion territorial.

## 12) Verificacion tecnica post-normalizacion (2026-03-08)

### 12.1 Catalogo territorial y reglas

Archivo auditado: `src/shared/territoryNormalization.js`

- Localidades canonicas Bogota definidas: **20**
- Valores canonicos:
  - Usaquen, Chapinero, Santa Fe, San Cristobal, Usme, Tunjuelito, Bosa, Kennedy, Fontibon, Engativa, Suba, Barrios Unidos, Teusaquillo, Los Martires, Antonio Narino, Puente Aranda, La Candelaria, Rafael Uribe Uribe, Ciudad Bolivar, Sumapaz.
- Reglas de normalizacion:
  - corrige mojibake comun (`Ã¡`, `Ã©`, `Ã­`, `Ã³`, `Ãº`, `Ã±`, etc.),
  - remueve diacriticos,
  - convierte a mayusculas,
  - limpia simbolos no alfanumericos.
- Clasificacion Bogota/Resto:
  - primero intenta match canonico de localidad,
  - luego fallback por `departamento/capital` (incluye `BOGOT*` o `CUNDINAMARCA`).

### 12.2 Verificacion de endpoints avanzados (ejecucion real)

Se consulto:
- `GET /api/v2/analytics/advanced?region=all`
- `GET /api/v2/analytics/advanced?region=bogota`
- `GET /api/v2/analytics/advanced?region=resto`

Resultados observados (evento activo en entorno local):

- `totalRaw`: **2895**
- `bogota.totalVotos`: **2794**
- `nacional.totalVotos`: **101**
- Validacion matematica: **2794 + 101 = 2895** (OK)
- `all.excluded`: `noLocality=2`, `noPollingPlace=11`, `inconsistent=0`
- `bogota.excluded`: `noLocality=0`, `noPollingPlace=9`
- `resto.excluded`: `noLocality=2`, `noPollingPlace=2`

### 12.3 Verificacion de bucket "Otros"

- En respuesta JSON de `/api/v2/analytics/advanced` no hay menciones de `"Otros"` (0 ocurrencias).
- En frontend (`public/analytics.html`, `public/js/modules/analytics.module.js`) se removio inyeccion de bucket visual `Otros`.
- Trazas activas:
  - `[TERRITORY TRACE] bucketOtrosCount=0`

### 12.4 Verificacion de catalogo en bucket Bogota

Cruce de `data.bogota.topLocalidades` contra catalogo canonico:

- Localidades detectadas en bucket Bogota: **20**
- Matcheadas al catalogo: **19**
- Fuera de catalogo en bucket Bogota: **1** (`Cundinamarca`)

Interpretacion:
- No hay bucket `Otros`, pero aun existe **1 etiqueta no canonica** en bucket Bogota que debe mapearse explicitamente (por regla de negocio) para cerrar 100% el catalogo cerrado.

### 12.5 Verificacion de tipo de conteo en breakdowns

En `advanced.service.js`, los breakdowns usan **conteo de registros**:

- `bucket.topLocalidades[loc]++`
- `bucket.topPuestos[puestoName].count++`
- `bucket.meta.totalRecords += 1`

No se usa `distinct` para estos bloques en `getAdvancedAnalytics`, por lo que el conteo es por registro real.

### 12.6 Nota de auditoria de datos crudos (limitacion de entorno)

Se intento auditoria directa por conexion Atlas para extraer `rawValue -> normalizedValue -> canonicalValue` desde coleccion `Registration`, pero en este entorno CLI hubo timeout DNS SRV (`querySrv ETIMEOUT`).

Por ello, la validacion de esta fase se completo con:
- evidencia del endpoint backend en ejecucion real,
- validacion matematica de buckets,
- cruce de `topLocalidades` contra catalogo canonico.

## 13) Ajuste minimo: Cundinamarca fuera de Bogota (2026-03-08)

### 13.1 Hallazgo puntual

- En `advanced` seguia apareciendo `Cundinamarca` dentro del bucket `bogota.topLocalidades`.
- Objetivo: Bogota solo con localidades canonicas y `Cundinamarca` clasificada en `Resto del Pais`.

### 13.2 Cambio aplicado (quirurgico)

Archivo:
- `src/shared/territoryNormalization.js`
  - `isBogotaTerritory(...)`:
    - se elimino la regla que trataba `CUNDINAMARCA` como Bogota,
    - se agrego exclusion explicita por `localidad/capital/departamento` cuando contiene `CUNDINAMARCA` y no hay match canonico.

Archivo:
- `src/backend/modules/analytics/advanced.service.js`
  - en `getAdvancedAnalytics(...)`, antes de asignar bucket regional:
    - si la localidad normalizada del registro contiene `CUNDINAMARCA`, se fuerza `region='nacional'`.

### 13.3 Verificacion posterior (advanced)

Resultado observado en `GET /api/v2/analytics/advanced?region=all` despues del ajuste:

- `totalRaw`: **2895**
- `bogotaCount`: **2753**
- `restoCount`: **142**
- chequeo matematico: **2753 + 142 = 2895** (OK)
- `bogota.topLocalidades`:
  - `hasCundinamarcaInBogota = false`
  - `nonCanonicalInBogota = []` (100% canonico en los labels presentes)
- `unmatchedLocalities` (`excluded.noLocality`): **2**
- `bucketOtrosCount`: **0**

### 13.4 Nota de consistencia

- Este ajuste cambia la clasificacion territorial (mueve registros de Bogota a Resto cuando el dato territorial es `Cundinamarca`).
- El total global no cambia; solo cambia la distribucion Bogota/Resto segun la regla corregida.

## 14) Correccion de flujo real: Exportar + Sin Puesto (2026-03-08)

### 14.1 Causa de que "no pegara"

- El flujo activo de UI para exportar era:
  - `public/dashboard.html` (botones Exportar)
  - `public/js/core/events.js` (delegacion click)
  - `public/js/modules/export.module.js`
  - `public/js/services/data.service.js`
- La correccion anterior de resumen por lider no estaba conectada al endpoint real de rutas porque faltaba exponer:
  - `POST /api/v2/registrations/export/leader-summary` en `registration.routes.js`
- Resultado: la UI seguia usando conteo in-memory sobre registros crudos exportados.

### 14.2 Flujo real final de Exportar (definitivo)

- Botones activos:
  - `exportLeadersMainBtn`
  - `exportLeaderStatsBtn`
- Trazado real agregado:
  - `[EXPORT REAL TRACE] button -> function -> endpoint`
- Fuente final:
  - `ExportsModule.fetchLeaderSummaryForExport()`
  - `DataService.exportLeaderSummaryV2()`
  - backend `registration.controller.exportLeaderSummary`
- Agrupacion final:
  - clave estable `leaderId` (canonica)
  - `displayName` solo para visualizacion
  - `rawNames` expuesto para auditoria de variantes

### 14.3 Flujo real final de "Sin Puesto Asignado"

- Vista real actualizada:
  - `public/analytics.html`
  - bloque visual: `Registros Sin Puesto Asignado`
- Fuente:
  - `GET /api/v2/analytics/advanced`
  - campo: `data.<region>.missingPollingPlace`
- Contrato actualizado:
  - `missingPollingPlace.count`
  - `missingPollingPlace.leaders[]` con `leaderId`, `leaderName`, `count`
- Trazas activas:
  - `[MISSING POLLING TRACE] leaderId=... count=...`
  - `[MISSING POLLING TRACE] block rendered with count=...`

### 14.4 Marcado y aviso a lideres (operativo)

- Accion UI agregada en analytics avanzado:
  - boton `Marcar y Notificar`
  - endpoint real: `POST /api/v2/skills/run`
  - payload: `skillName=missingPollingPlaceReview`, `payload.eventId`, `payload.limit`
- Skill reutilizada:
  - `src/backend/skills/review/missingPollingPlace.skill.js`
  - marca: `missingPollingPlace=true`, `requiresReview=true`, `necesitaRevision=true`, `requiereRevisionPuesto=true`
  - genera avisos por lider (`leaderNotices`) y trazas `[REVIEW TRACE]`

## 15) Auditoria matematica de export por lider (2026-03-08)

### 15.1 Hallazgo de recorte potencial

- El resumen de export por lider estaba leyendo filtros de la seccion `Registros` (`searchInput`, `leaderFilter`, `unifiedFilter`).
- Eso podia recortar el universo de export sin que el usuario lo viera como filtro de export.
- Se corrigio para que `Exportar Lideres` y `Exportar Stats` usen por defecto solo `eventId` (universo bruto del evento), salvo filtros explicitos enviados a ese endpoint.

### 15.2 Flujo real auditado

- Frontend:
  - `public/js/modules/export.module.js` -> `fetchLeaderSummaryForExport()`
  - `public/js/services/data.service.js` -> `exportLeaderSummaryV2()`
- Endpoint:
  - `POST /api/v2/registrations/export/leader-summary`
- Backend:
  - `src/backend/modules/registrations/registration.controller.js` -> `exportLeaderSummary()`
  - base de consulta: `buildRegistrationFilter(input)` + `service.getRegistrations(...)`

### 15.3 Validacion real (evento 6912d782bbd0c0ef09b4650c)

Comparacion A/B/C para 3 lideres:

- `Adonay Palacios` (`leaderId=690f9a3cee9dedbe5de6b97f`)
  - `totalDashboard=717`
  - `totalRawDb=717`
  - `totalExport=717`
  - `difference=0`
- `Cristian García` (`leaderId=690f99beee9dedbe5de6b94f`)
  - `totalDashboard=135`
  - `totalRawDb=135`
  - `totalExport=135`
  - `difference=0`
- `Nidia Méndez` (`leaderId=690f9a49ee9dedbe5de6b985`)
  - `totalDashboard=387`
  - `totalRawDb=387`
  - `totalExport=387`
  - `difference=0`

Conclusión:
- En el estado corregido, **no hay recorte** en export para esos lideres dentro del evento auditado.
- Si se observa una diferencia (ej. expectativa >1400), corresponde a un universo distinto (otro evento/otro criterio), no a split por nombre ni a error de agrupacion.

### 15.4 Trazas agregadas para detectar recortes

- Frontend:
  - `[EXPORT COUNT TRACE] leaderSummary base filters`
  - `[EXPORT COUNT TRACE] filters=...`
- Backend:
  - `[EXPORT COUNT TRACE] filters=...`
  - `[EXPORT COUNT TRACE] leaderId=... totalRaw=... totalExport=... difference=...`

### 15.5 Contrato de respuesta reforzado

- `source.filter` ahora expone:
  - `eventId`, `regionScope`, `workflowStatus`, `dataIntegrityStatus`, `leaderId`
  - `confirmed`, `hasPhone`, `hasFlags`, `search`
- Objetivo: auditar inmediatamente cualquier recorte por filtro aplicado.

## 16) Universos de conteo para export de líderes (2026-03-08)

### 16.1 Definiciones implementadas

| Universo | Query base | Filtros | Uso |
|---|---|---|---|
| `event` | `Registration` por `organizationId + eventId` | solo `eventId` (y `leaderId` si se manda) | total del evento actual |
| `global` | `Registration` por `organizationId` | sin `eventId` (y `leaderId` si se manda) | total histórico/global del líder |
| `filtered` | `Registration` por `organizationId + filtros UI` | `search`, `unified/status`, `region`, etc. | total según filtros activos |

### 16.2 Dónde se elige en UI

- `dashboard.html` sección Export:
  - selector `#exportLeaderUniverse`
  - opciones: `Evento Actual`, `Histórico/Global`, `Filtrado (según filtros activos)`

### 16.3 Caso Adonay / Cristian / Nidia (validación real)

Evento auditado: `6912d782bbd0c0ef09b4650c`

- Adonay (`690f9a3cee9dedbe5de6b97f`)
  - `totalEvento=717`
  - `totalHistorico=717`
  - `totalFiltrado=717` (con filtro `search=Adonay`)
- Cristian (`690f99beee9dedbe5de6b94f`)
  - `totalEvento=135`
  - `totalHistorico=135`
  - `totalFiltrado=0` (filtro `search=Adonay`)
- Nidia (`690f9a49ee9dedbe5de6b985`)
  - `totalEvento=387`
  - `totalHistorico=387`
  - `totalFiltrado=0` (filtro `search=Adonay`)

Conclusión del hallazgo:
- En la organización auditada, los `+1400` para Adonay **no aparecen en el universo `leaderId` actual**.
- Hay otro registro de líder con nombre similar (`Adonay Palacios Palacios`) en otro evento, pero con `registrations=0` y sin impacto en conteo por `leaderId`.
- Por diseño actual (fuente de verdad = `leaderId`), no se mezclan personas por nombre libre.
## 2026-03-08 - Correccion inconsistencia `/api/leaders` vs export (produccion/local)

### Causa exacta
- La UI legacy de produccion usa `GET /api/leaders?eventId=...` (no el flujo v2).
- En `src/controllers/leaders.core.controller.js` el endpoint legacy calculaba `registrations` sumando:
  - conteo por `leader.leaderId`
  - conteo por `leader._id`
- Cuando `leaderId === _id` (caso comun), el mismo bucket se sumaba 2 veces.
- Resultado observado:
  - Adonay: `717 * 2 = 1434`
  - Cristian: `135 * 2 = 270`
  - Nidia: `387 * 2 = 774`

### Correccion aplicada
- Archivo: `src/controllers/leaders.core.controller.js`
- Cambio: deduplicacion de claves de conteo (`leaderId` y `_id`) usando `Set` antes de sumar.
- Se agregaron trazas:
  - `[LEADER COUNT TRACE] leaderId=... registrationsField=... registrationsFromCollection=... keys=... eventId=...`

### Validacion post-fix (localhost)
- Flujo legacy real:
  - `GET /api/leaders?eventId=6912d782bbd0c0ef09b4650c`
  - `GET /api/registrations?eventId=6912d782bbd0c0ef09b4650c&limit=10000`
  - `POST /api/v2/registrations/export/leader-summary` (`universe=event`)

| Lider | leaderId | tabla `/api/leaders` | coleccion `/api/registrations` | export `leader-summary` |
|---|---|---:|---:|---:|
| Adonay Palacios | `690f9a3cee9dedbe5de6b97f` | 717 | 717 | 717 |
| Cristian Garcia | `690f99beee9dedbe5de6b94f` | 135 | 135 | 135 |
| Nidia Mendez | `690f9a49ee9dedbe5de6b985` | 387 | 387 | 387 |

### Nota de entorno (clave)
- En algunos arranques locales, Atlas falla por timeout SRV y la app cae a fallback:
  - `mongodb://127.0.0.1:27017/seguimiento-datos`
- Esto puede cambiar los datos visibles respecto a produccion aunque `dbName` sea el mismo.

## 2026-03-08 - Validacion de datos reales: catalogo insuficiente

### Hallazgo
- La validacion de mesas podia marcar `puesto_invalido` aunque el catalogo oficial estuviera incompleto (`puestos=1`, `mesas=0`).
- Eso generaba falsos negativos.

### Correccion
- `src/services/real-data-validation.service.js`:
  - guard de suficiencia de catalogo (`MIN_OFFICIAL_MESAS`, `MIN_OFFICIAL_PUESTOS`).
  - si no cumple umbral: `catalogInsufficient=true` y warning explicito.
  - `runMassMesaValidation` no escribe resultados definitivos cuando el catalogo es insuficiente (`skipped=true`).
- `public/js/modules/real-data-validation.module.js`:
  - bloquea boton de validacion masiva si `catalogInsufficient`.
  - muestra mensajes legibles de estado real (sin `[object Object]`).
- `src/services/registraduria-sync.service.js`:
  - agrega `trace` de crawling y `sourceUrl` para auditoria de origen.
