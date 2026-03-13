# MONGODB_INDEX_AUDIT

## Scope
Auditoría de consultas reales y optimización de índices para la migración legacy -> v2, basada en query-shapes del código backend activo.

## 1) Query Audit (Real Code Paths)

### Colecciones más consultadas
- `registrations` (principal en v2, analytics, exports, skills)
- `leaders` (CRUD/listado/export v2)
- `puestos` (lookups y validación territorial)
- `skilljobs` / `skillresults` (jobs panel + detalle)
- `deduplicationflags` (health/inconsistencies)
- `campaignmetrics`, `dailymetrics`, `leadermetrics`, `territorymetrics` (materialized analytics)
- `callattempts`, `verificationresults` (verification skill)

### Mapa de consultas críticas

| Colección | Archivo | Función | Tipo query | Filtros reales | Sort | Page/Limit | Índice ideal |
|---|---|---|---|---|---|---|---|
| `registrations` | `registration.controller.js` + `registration.repository.js` | `getRegistrations`/`findMany` | `find + countDocuments` | `organizationId`, `eventId`, `leaderId`, `workflowStatus`, `dataIntegrityStatus`, `confirmed`, `hasFlags`, `regionScope`, búsqueda regex | variable (default `createdAt:-1`) | `skip/limit` | `{ organizationId:1, eventId:1, createdAt:-1 }` + compuestos por filtros |
| `registrations` | `registration.controller.js` | `exportRegistrations` | `findMany` (page 1, limit alto) | mismos filtros v2 | variable | limit export | `{ organizationId:1, eventId:1, createdAt:-1 }`, `{ organizationId:1, eventId:1, leaderId:1, createdAt:-1 }` |
| `leaders` | `leader.controller.js` + `leader.repository.js` | `getLeaders`/`findMany` | `find + countDocuments` | `organizationId`, `eventId`, `active`, `search` (regex en `name/email/username`) | `name` (default) | `skip/limit` | `{ organizationId:1, eventId:1, name:1 }`, `{ organizationId:1, eventId:1, active:1, name:1 }` |
| `leaders` | `leader.controller.js` | `exportLeaders` | `find` | igual que listado | variable | `limit` export | mismos índices de listado |
| `registrations` + `puestos` | `metrics.service.js` | `getDashboardMetrics` | `aggregate + $lookup + $group` | `organizationId`, `eventId`, `leaderId`, filtro limpio (`workflowStatus/dataIntegrityStatus`), región | `createdAt:-1` (recent) | `limit 10` en recent | `{ organizationId:1, eventId:1, createdAt:-1 }`, `{ organizationId:1, eventId:1, workflowStatus:1, createdAt:-1 }`, `{ organizationId:1, eventId:1, dataIntegrityStatus:1, createdAt:-1 }` |
| `registrations` | `advanced.service.js` | `getAdvancedAnalytics` | `aggregate + $lookup` | `eventId`, `leaderId`, `status` por `puestoId` + filtro limpio | en memoria post-agg y agregados por count | sin paginación | `{ organizationId:1, eventId:1, puestoId:1 }`, `{ organizationId:1, eventId:1, leaderId:1 }` |
| `registrations` | `advanced.service.js` | `getSimulationData` | `countDocuments + aggregate` | `eventId` + filtro limpio + `createdAt >=` + top por `localidad`, `puestoId`, `mesa`, `leaderName` | `count desc` en agg | `limit 1` | `{ organizationId:1, eventId:1, createdAt:-1 }`, `{ organizationId:1, eventId:1, puestoId:1, mesa:1 }` |
| `campaignmetrics`/`dailymetrics`/`leadermetrics`/`territorymetrics` | `analytics.service.js` | `getMaterializedMetrics` | `findOne/find + sort + limit` | `eventId` | `date:-1, createdAt:-1` / `totalUploaded:-1` / `totalRecords:-1` | `limit 10` | índices por `eventId + sort` |
| `registrations` | `verification.skill.js` + `skill-job.service.js` | `prepareVerificationQueue`/batch skills | `find + sort + limit` | `organizationId`, `eventId`, `workflowStatus`, `dataIntegrityStatus` | `updatedAt` | limit (hasta 3000/2000) | `{ organizationId:1, eventId:1, updatedAt:-1 }`, más compuestos por estado |
| `deduplicationflags` | `skills.service.js` | `listInconsistencies` + health counts | `find + countDocuments` | `organizationId`, `eventId`, `status`, `flagType` | `createdAt:-1` | limit | `{ organizationId:1, eventId:1, status:1, flagType:1, createdAt:-1 }` |
| `skilljobs`/`skillresults` | `skill-job.service.js` | `listSkillJobs`/`getSkillJob` | `find + sort + limit` | `organizationId` / `jobId` | `createdAt:-1` | limit | `skilljobs: { organizationId:1, status:1, finishedAt:-1, skillName:1 }`; `skillresults: { jobId:1, createdAt:-1 }` |

## 2) Bottlenecks Detected

- Paginación + sort frecuentes en `registrations` con filtros compuestos sin índice compuesto alineado al sort (`createdAt`/`updatedAt`).
- `leaders` listado v2 usa sort por `name` con filtros por `organizationId/eventId/active`; faltaba índice compuesto para esa forma.
- `getMaterializedMetrics` filtra por `eventId` y ordena por `date/createdAt` en tablas métricas donde los índices existentes eran principalmente `organizationId+eventId+date` (óptimos para upsert, no tanto para lectura solo por `eventId`).
- `deduplicationflags` usa `status + flagType + createdAt` para inconsistency view; índice existente no cubría `flagType`.
- `skillresults` detalle por `jobId` ordenado por `createdAt`; faltaba compuesto para evitar in-memory sort.
- Regex no anclado (`search` de leaders y registrations) no se optimiza bien con índices B-Tree clásicos; se mitiga acotando por filtros selectivos (`organizationId/eventId/...`).

## 3) Existing Indexes (Resumen)

- `Registration`: muchos índices simples/compuestos (`organizationId`, `eventId`, `leaderId`, `workflowStatus`, `dataIntegrityStatus`, `confirmed`, `createdAt`, etc.)
- `Leader`: `leaderId` unique, `token` unique, `organizationId+active`, `eventId`, `name` indirecto vía sort sin compuesto por org/event.
- `SkillJob`: `skillName+status+createdAt`, `organizationId+createdAt`
- `SkillResult`: `jobId`, y compuestos por `skillName/entity`
- `DeduplicationFlag`: `organizationId+eventId+status+createdAt`, `registrationId+flagType` unique
- Métricas: índices únicos por `organizationId+eventId+date[...]`

## 4) Proposed Indexes (Evidence-Based)

### Registrations
- `{ organizationId: 1, eventId: 1, createdAt: -1 }`
  - Mejora: `GET /api/v2/registrations`, export v2 y listados recientes.
  - Riesgo: bajo-moderado (write overhead).
- `{ organizationId: 1, eventId: 1, leaderId: 1, createdAt: -1 }`
  - Mejora: filtros por líder + sort.
  - Riesgo: moderado.
- `{ organizationId: 1, eventId: 1, workflowStatus: 1, createdAt: -1 }`
  - Mejora: estados (`pending_call`, `duplicate`, etc.) + sort.
  - Riesgo: moderado.
- `{ organizationId: 1, eventId: 1, dataIntegrityStatus: 1, createdAt: -1 }`
  - Mejora: filtros de integridad + sort.
  - Riesgo: moderado.
- `{ organizationId: 1, eventId: 1, confirmed: 1, createdAt: -1 }`
  - Mejora: confirmado/pendiente + sort.
  - Riesgo: moderado.
- `{ organizationId: 1, eventId: 1, updatedAt: -1 }`
  - Mejora: skills por lotes que ordenan por `updatedAt`.
  - Riesgo: bajo.
- `{ organizationId: 1, eventId: 1, phone: 1 }` `partialFilterExpression: { phone: { $exists: true, $nin: ["", null] } }`
  - Mejora: deduplicación por teléfono/evento.
  - Riesgo: bajo-moderado.

### Leaders
- `{ organizationId: 1, eventId: 1, name: 1 }`
  - Mejora: listado/export v2 con sort por nombre.
  - Riesgo: bajo.
- `{ organizationId: 1, eventId: 1, active: 1, name: 1 }`
  - Mejora: listado con filtro `active` + sort por nombre.
  - Riesgo: bajo.

### Skills / Inconsistencies
- `skilljobs`: `{ organizationId: 1, status: 1, finishedAt: -1, skillName: 1 }`
  - Mejora: health/jobs recientes por estado/skill.
  - Riesgo: bajo.
- `skillresults`: `{ jobId: 1, createdAt: -1 }`
  - Mejora: detalle de job ordenado.
  - Riesgo: bajo.
- `deduplicationflags`: `{ organizationId: 1, eventId: 1, status: 1, flagType: 1, createdAt: -1 }`
  - Mejora: tabla de inconsistencias y counts por tipo.
  - Riesgo: bajo.

### Materialized metrics
- `campaignmetrics`: `{ eventId: 1, date: -1, createdAt: -1 }`
- `dailymetrics`: `{ eventId: 1, date: -1, createdAt: -1 }`
- `leadermetrics`: `{ eventId: 1, date: -1, totalUploaded: -1 }`
- `territorymetrics`: `{ eventId: 1, date: -1, totalRecords: -1 }`
  - Mejora: `/api/v2/analytics/materialized` (lectura por `eventId` + sort).
  - Riesgo: bajo (colecciones de métricas suelen ser pequeñas).

## 5) Controlled Implementation

Se implementó estrategia explícita (sin autoIndex implícito):

- Script de plan/apply:
  - `scripts/migration/apply-performance-indexes.mjs`
  - `npm run db:indexes:dry-run` (default)
  - `npm run db:indexes:apply` (crea índices faltantes)
- Script de verificación con `explain`:
  - `scripts/migration/explain-v2-query-shapes.mjs`
  - `npm run db:indexes:explain`
  - Requiere `EXPLAIN_ORG_ID` y `EXPLAIN_EVENT_ID`.

Notas:
- El script evita duplicados (compara `key` + opciones relevantes).
- No elimina índices existentes.
- Si colección no existe, la omite sin fallar todo el proceso.

### Ejecución real (Atlas)

- `npm run db:indexes:dry-run`
  - `planned: 16`, `plan_create: 16`, `already_present: 0`
- `npm run db:indexes:apply` (1ra corrida)
  - `created: 15`, `failed: 1`
  - fallo en índice parcial de `phone` por usar `$nin` en `partialFilterExpression` (no soportado).
- Se corrigió el índice parcial a:
  - `partialFilterExpression: { phone: { $exists: true, $type: "string" } }`
- `npm run db:indexes:apply` (2da corrida)
  - `created: 1`, `already_present: 15`, `failed: 0`
  - estado final: **16/16 índices planificados disponibles**.

## 6) Validation Plan

1. Ejecutar dry-run:
   - `npm run db:indexes:dry-run`
2. Revisar salida JSON (`plan_create`, `already_present`, `skip_collection_missing`).
3. Aplicar:
   - `npm run db:indexes:apply`
4. Medir plan de ejecución:
   - `EXPLAIN_ORG_ID=... EXPLAIN_EVENT_ID=... npm run db:indexes:explain`
5. Confirmar reducción de `COLLSCAN` y menor `totalDocsExamined` en:
   - registrations list/export
   - leaders list
   - skills jobs/detail
   - inconsistencies
   - materialized metrics

### Explain real post-index

Comando ejecutado: `npm run db:indexes:explain` (con `MONGO_URL`).

Resultados clave:
- `registrations_list_event_created` -> index `idx_reg_org_event_created_desc`, `docsExamined=20`, `keysExamined=20`.
- `registrations_list_event_workflow_created` -> index `idx_reg_org_event_workflow_created_desc`.
- `leaders_list_event_active_name` -> index `idx_leader_org_event_active_name`.
- `skills_jobs_recent_completed` -> index `idx_skilljob_org_status_finished_skill`.
- `inconsistencies_open_by_type` -> index `idx_dedup_org_event_status_type_created`.
- `materialized_campaign_latest` -> index `idx_campaignmetric_event_date_created`.

No se observaron `COLLSCAN` en los query-shapes verificados.

## 7) Omitted / Deferred

- No se propuso indexar regex no anclado de `search` como solución directa (B-Tree no ayuda mucho).
- No se eliminaron índices existentes por falta de evidencia de uso en runtime profiler.
- No se aplicaron índices automáticamente al boot del servidor para evitar cambios no controlados.

## 8) Files Impacted

- `scripts/migration/apply-performance-indexes.mjs`
  - Plan controlado + creación segura de índices por evidencia.
- `scripts/migration/explain-v2-query-shapes.mjs`
  - Verificación manual de uso de índices en query-shapes críticos.
- `package.json`
  - Nuevos comandos `db:indexes:*`.
- `docs/MONGODB_INDEX_AUDIT.md`
  - Auditoría de queries + evidencia de ejecución real + resultados de explain.
