# Auditoria Final De Vistas Y Analytics

## Fecha
- 2026-03-08

## 1) Mapa real de vistas/rutas (antes)
- Dashboard
  - HTML base: `public/dashboard.html`
  - Modulos: `public/js/modules/dashboard.module.js`, `public/js/modules/analytics.module.js`
  - Router: `public/js/core/router.js` (secciones internas en el mismo shell)
  - Endpoints:
    - `GET /api/v2/analytics/metrics` (cards/charts dashboard)
    - `GET /api/v2/analytics/metrics` (seccion Analisis interna)
- Analisis (interno)
  - No es pagina separada; es `<section id="analytics">` dentro de `dashboard.html`
  - Modulo: `analytics.module.js`
- Analisis Avanzado
  - HTML base: `public/analytics.html` (pagina separada)
  - Script inline propio (no `index.js` modular)
  - Endpoints:
    - `GET /api/v2/analytics/advanced`
    - `GET /api/v2/analytics/materialized`
    - `GET /api/v2/analytics/simulation`
  - Problema: estaba mostrando KPI principales con definiciones distintas y region inicial `nacional` (no total evento).

## 2) Causas de inconsistencia detectadas
- `Análisis` interno:
  - Label incorrecto: tarjeta "Total Registros" mostraba `avgRegsPerLeader` (promedio), no total.
  - Mezcla de semanticas (limpio/bruto) sin etiquetado.
- `Análisis Avanzado`:
  - Region por defecto era `nacional` (resto), por eso mostraba cifras muy bajas aunque el evento tuviera miles.
  - Cards principales se calculaban con combinacion de `advanced/materialized` no alineada al dashboard.
  - Filtro global de lideres cargaba `/api/v2/leaders` sin `eventId`.
- Backend advanced:
  - `status=confirmed/unconfirmed` filtraba por `puestoId` (asignado/no asignado), no por confirmacion real.

## 3) Correcciones aplicadas

### 3.1 Dashboard y Analisis interno (shell modular)
- `public/js/modules/analytics.module.js`
  - Ahora consume `DataService.getDashboardMetrics({ region, leaderId })` para usar la misma fuente que dashboard.
  - KPI internos alineados:
    - `Total Registros (Bruto)` <- `operationalTotals.totalRegistrations`
    - `Registros Válidos` <- `totals.totalRegistrations`
    - `Tasa Confirmación (Bruto)` <- `operationalTotals.confirmRate`
    - `Líderes del Evento` <- `operationalTotals.totalLeaders`
  - `top leaders` usa `leadersOperational` (fallback `leaders`).
  - Trazas:
    - `[VIEW TRACE] Analisis <- dashboard.html/modules/analytics.module.js`
    - `[KPI TRACE] Analisis.*`
- `public/dashboard.html`
  - Se corrigieron labels de cards en sección Analisis para reflejar definiciones reales.
- `public/js/core/router.js`
  - Traza de vista al navegar a Analisis.

### 3.2 Analisis Avanzado (pagina separada, alineada)
- `public/analytics.html`
  - Region por defecto: `all` (total evento), toggle: `all <-> bogota`.
  - Cards principales ahora usan `GET /api/v2/analytics/metrics` (misma base del dashboard):
    - Total Registros (Bruto)
    - Confirmados (Bruto)
    - Líderes del Evento
  - `advanced/materialized` quedan para desglose avanzado (charts/jerarquia), no para KPI base de control.
  - Filtro de lideres ahora carga `GET /api/v2/leaders?...&eventId=...`.
  - Trazas:
    - `[VIEW TRACE] Analisis Avanzado <- analytics.html`
    - `[KPI TRACE] analytics.html cards <- ...`

### 3.3 Backend advanced
- `src/backend/modules/analytics/advanced.service.js`
  - `status=confirmed/unconfirmed` ahora filtra por confirmacion real (`confirmed/workflowStatus`) y no por `puestoId`.
  - Agregado nodo `all` en respuesta advanced para total evento (ademas de `bogota` y `nacional`).

## 4) Fuente final de verdad por vista (despues)
- Dashboard (`dashboard.html`, seccion dashboard)
  - KPI base: `/api/v2/analytics/metrics`
  - Definicion base visible: bruto operativo (cards principales)
- Analisis interno (`dashboard.html`, seccion analytics)
  - KPI base: `/api/v2/analytics/metrics`
  - Misma semantica que dashboard (bruto + valido etiquetado)
- Analisis Avanzado (`analytics.html`)
  - KPI base de control: `/api/v2/analytics/metrics`
  - Detalle avanzado: `/api/v2/analytics/advanced` + `/api/v2/analytics/materialized`

## 5) KPI por vista (resumen)
- Total Registros Brutos:
  - `metrics.operationalTotals.totalRegistrations`
- Registros Válidos:
  - `metrics.totals.totalRegistrations`
- Confirmados:
  - `metrics.operationalTotals.confirmedCount`
- Tasa Confirmación:
  - `metrics.operationalTotals.confirmRate`
- Líderes del Evento:
  - `metrics.operationalTotals.totalLeaders`

## 6) Estado de arquitectura de vistas
- Se mantiene `analytics.html` como pagina separada (no se reescribio la app), pero ya no es isla inconsistente:
  - mismo contexto `eventId`
  - misma fuente base de KPI que dashboard
  - trazabilidad de endpoint por vista

## 7) Archivos tocados en esta fase
- `public/js/modules/analytics.module.js`
- `public/js/modules/dashboard.module.js`
- `public/js/core/router.js`
- `public/dashboard.html`
- `public/analytics.html`
- `src/backend/modules/analytics/advanced.service.js`

## 8) Cierre final (esta iteracion)
- Decision de arquitectura de vistas:
  - **Opcion B**: `analytics.html` permanece como pagina separada, pero completamente alineada con el shell principal.
  - Motivo: menor riesgo de regresion y mantiene migracion incremental sin reescribir el router principal.
- Correcciones finales aplicadas:
  - `public/analytics.html`
    - Region por defecto en avanzado: `all` (Total Evento).
    - Toggle: `all <-> bogota` y recarga de datos coherente.
    - KPI base unificado con dashboard: `GET /api/v2/analytics/metrics`.
    - Breakdown avanzado mantiene `GET /api/v2/analytics/advanced`.
    - Filtro de lideres ahora carga `/api/v2/leaders` con `eventId`.
    - Trazas agregadas:
      - `[VIEW TRACE] Analisis Avanzado <- analytics.html`
      - `[ADV TRACE] analytics.html request context`
      - `[KPI TRACE] AnalisisAvanzado.*`
  - `public/js/modules/deletion-requests.module.js`
    - Limpieza de mojibake residual en textos visibles (tildes, signos y emojis).
- Validacion tecnica:
  - Escaneo de mojibake en archivos criticos del frontend: sin coincidencias.
  - Verificacion sintactica: `node --check` OK en archivos JS tocados.
  - Servidor local: `GET http://localhost:3000/health` responde `200`.

## 9) QA Final Y Limpieza
- Checklist de validacion (cierre):
  - [x] Dashboard, Analisis interno y Analisis Avanzado usan contexto de evento.
  - [x] KPI base de control unificados en `GET /api/v2/analytics/metrics`.
  - [x] Breakdown avanzado permanece en `GET /api/v2/analytics/advanced`.
  - [x] Toggle avanzado `all/bogota` activo y enviando `region` correcto.
  - [x] Filtro de lideres en avanzado consulta `/api/v2/leaders` con `eventId`.
  - [x] Sin mojibake visible en archivos front criticos auditados.
- Limpieza aplicada:
  - No se eliminaron trazas de QA, pero quedaron **detras de flag**:
    - `window.APP_DEBUG_TRACES = true`
    - o `localStorage.setItem('debugTraces','1')`
  - Si el flag no esta activo, no se imprimen `[VIEW TRACE]`, `[KPI TRACE]`, `[ADV TRACE]`.
- Tests ejecutados:
  - `node --check` en modulos tocados (frontend y backend) OK.
  - `npm test -- --runInBand tests/unit/metrics.service.test.js` OK (2/2).
- Ajuste tecnico adicional de robustez:
  - `src/services/metrics.service.js`: se agrego fallback defensivo en `locality` y `recentRecords` para evitar fallo cuando `aggregate()` retorna no-array en contexto de test/mocks.

## 10) Pendientes Reales
- Permanecen trazas de migracion legacy/v2 (`[V2 TRACE]`) en modulos operativos fuera de este cierre de vistas/analytics. No afectan funcionalidad actual y se pueden limpiar en una pasada separada de deuda tecnica.
