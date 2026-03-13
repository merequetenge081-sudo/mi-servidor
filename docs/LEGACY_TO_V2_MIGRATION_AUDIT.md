# LEGACY_TO_V2_MIGRATION_AUDIT

## Scope
Incremental migration of operational legacy data loading to paginated v2 endpoints, without rewriting the app.

## Phase 1 - Legacy Audit Map

### Current legacy consumers found

| File | Legacy endpoint | Purpose | Migration risk |
|---|---|---|---|
| `public/js/services/data.service.js` | `/api/registrations?limit=10000` | Full in-memory operational dataset | High (slow loads, stale client filters) |
| `public/js/services/data.service.js` | `/api/leaders` | Full leaders snapshot | Medium |
| `public/js/services/bootstrap.service.js` | Uses `getRegistrations()` + `getLeaders()` | Boot preload for modules | High for registrations |
| `public/js/modules/registrations.module.js` | Consumed `AppState.data.registrations` full array | Client-side filters + fake pagination by tabs | High |
| `public/js/modules/leaders.module.js` | Consumed `AppState.data.leaders` full array | Leaders table/search | Medium |
| `public/js/dashboard.js` (legacy path) | `/api/registrations?...limit=10000`, `/api/leaders` | Legacy monolith dashboard loader | Medium (legacy path, still technical debt) |

### Legacy operational issues detected

- Massive client payload for registrations (`limit=10000`).
- Client-side filtering/sorting over large arrays in registrations tab module.
- Fake pagination in frontend using array slicing.
- Mixed old/new response contracts (`data + pagination` vs implicit arrays).
- Legacy operational paths still present in `public/js/dashboard.js`.

## Phase 2 - v2 Operational Contract

### Implemented / upgraded

- `GET /api/v2/registrations`
  - Added support for:
    - `page`, `limit`, `sort`, `order`, `search`
    - `eventId`, `leaderId`, `workflowStatus`, `dataIntegrityStatus`
    - `hasFlags`, `hasPhone`, `confirmed`
    - state aliases (`confirmed`, `pending_call`, `duplicate`, `invalid`, etc.)
    - `localidad`, `territory`, `departamento`, `puestoId`
    - `regionScope` (`bogota`, `resto`, `all`)
  - Response now includes v2 shape:
    - `items`, `total`, `page`, `limit`, `totalPages`, `source`
  - Backward compatibility preserved:
    - also returns `data` + `pagination`.

- `GET /api/v2/leaders`
  - Added support for:
    - `page`, `limit`, `sort`, `order`, `search`, `active`
    - optional `includeMetrics=true` (light aggregate by leader)
  - Response now includes v2 shape:
    - `items`, `total`, `page`, `limit`, `totalPages`, `source`
  - Backward compatibility preserved:
    - also returns `data` + `pagination`.

## Phase 3 - Frontend Incremental Migration

### Registrations module migrated

- Before:
  - frontend fake pagination + full array filters.
  - depended on preloaded giant dataset.
- Now:
  - `public/js/modules/registrations.module.js` uses `DataService.getRegistrationsPaginated()`.
  - server-side pagination by tab using `regionScope=bogota/resto`.
  - filters sent to backend (`search`, `leaderId`, `confirmed`, `dataIntegrityStatus`, `hasPhone`).
  - current table source trace: `[V2 TRACE] registrations.table <- /api/v2/registrations`.

### Bootstrap preload migrated to v2 snapshots

- Before:
  - preload all registrations via legacy raw endpoint.
- Now:
  - leaders snapshot from `/api/v2/leaders` (page 1, limit 200).
  - registrations snapshot from `/api/v2/registrations` (page 1, limit 50).
  - no more `/api/registrations?limit=10000` in DataService path.

## Phase 4 - DataService Normalization

### Added v2 methods

- `getRegistrationsPaginated(params)`
- `getLeadersPaginated(params)`
- `getRegistrationById(id)`
- `getLeaderById(id)` now points to v2 endpoint.

### Legacy wrappers kept (deprecated)

- `getRegistrations()`
- `getLeaders()`

Both now emit:
- `[LEGACY TRACE] ... (deprecated)`
and use v2 under the hood.

## Phase 5 - State/Field Consistency

The migrated registrations view now works with backend modern states and filters:

- `workflowStatus`
- `dataIntegrityStatus`
- `validationErrors`/`deduplicationFlags` via `hasFlags`
- `confirmed` and workflow alias filters

## Phase 6 - Performance Notes

### Improvements applied

- Removed direct 10k legacy pull path from `DataService` registrations API.
- Registrations table now requests only page-sized datasets.
- Search/filter work moved from heavy client arrays to backend queries.

### Suggested indexes (not auto-created)

- Collection: `registrations`
  - `{ organizationId: 1, eventId: 1, createdAt: -1 }`
  - `{ organizationId: 1, leaderId: 1, createdAt: -1 }`
  - `{ organizationId: 1, workflowStatus: 1, createdAt: -1 }`
  - `{ organizationId: 1, dataIntegrityStatus: 1, createdAt: -1 }`
  - `{ organizationId: 1, departamento: 1, localidad: 1 }`

## Phase 7 - Migration Traces

Added traces:

- `[V2 TRACE] registrations.table <- /api/v2/registrations`
- `[V2 TRACE] leaders.table <- /api/v2/leaders`
- `[LEGACY TRACE] registrations.table <- DataService.getRegistrations() (deprecated)`
- `[LEGACY TRACE] leaders.table <- DataService.getLeaders() (deprecated)`

## Phase 8 - Before vs After

### Replaced operational legacy endpoints

- Replaced in active data service path:
  - `/api/registrations?limit=10000` -> `/api/v2/registrations` (paginated)
  - `/api/leaders` (raw list) -> `/api/v2/leaders` (paginated)

### Modules migrated now

- `registrations` table module (primary operational table)
- bootstrap operational preload path
- shared DataService contracts for paginated operations

## Phase 9 - Current Iteration (Dashboard + Leaders + Exports)

### Audit map applied in this phase

| File | Function | Previous source | Problem | v2 replacement |
|---|---|---|---|---|
| `public/js/dashboard.js` | `loadDashboard()` | `/api/leaders` + `/api/registrations?limit=10000` | Legacy massive raw load | `DataService.getLeadersPaginated()` + paged aggregation via `DataService.getRegistrationsPaginated()` |
| `public/js/modules/leaders.module.js` | `loadTable()`, `filterByName()` | `AppState.data.leaders` in-memory | Search/list tied to snapshot | `DataService.getLeadersPaginated()` server-side search/sort |
| `public/js/modules/leaders.module.js` | `handleConfirmDeleteLeader()`, `handleSaveEditLeader()` | Hard refresh/legacy refetch | Inconsistent refresh flow | Local `loadTable()` refresh from v2 |
| `public/js/modules/export.module.js` | All registration exports | `AppState.data.registrations` snapshot | Export could diverge from visible filters | Paged/filter-consistent fetch via `DataService.getRegistrationsPaginated()` |

### Changes implemented in this phase

- `dashboard.js`
  - Added v2 path in `fetchLeadersForDashboard()` and `fetchRegistrationsForDashboard()`.
  - Added traces:
    - `[V2 TRACE] dashboard.js <- /api/v2/leaders`
    - `[V2 TRACE] dashboard.js <- /api/v2/registrations`
    - `[LEGACY TRACE] dashboard.js <- ...` fallback when DataService v2 is unavailable.

- `leaders.module.js`
  - `loadTable()` now pulls paginated data from backend (`getLeadersPaginated`) with search/sort params.
  - `filterByName()` now triggers backend search (no heavy in-memory filtering).
  - Delete/edit flows now refresh table through `await loadTable()` instead of hard dashboard reload.
  - `populateExportLeader()` now resolves localidades from v2 via new DataService helper.

- `export.module.js`
  - Added paginated export loaders:
    - `fetchRegistrationsPaginatedForExport(extraFilters)`
    - `fetchLeadersForExport()`
  - Exports now align with active filters and backend pagination.
  - Removed hard dependency on `AppState.data.registrations` as source of truth.
  - Added traces:
    - `[V2 TRACE] exports.registrations <- /api/v2/registrations`
    - `[V2 TRACE] exports.leaders <- /api/v2/leaders`

- `data.service.js`
  - Added `getRegistrationLocalities()` to populate export locality selector from paginated v2 source.

### Pending legacy debt (after this phase)

- `public/js/dashboard.js` still preserves legacy fallback paths only for resilience:
  - `/api/leaders`
  - `/api/registrations?limit=10000`
  - These are now fallback-only behind `apiCallV2(...)`, not the primary path.
- `public/js/dashboard.js` still has non-CRUD operational endpoint `/api/registrations/fix-names` (outside paginated CRUD scope).

## Phase 10 - CRUD + Export v2 Completion

### Audit map applied

| File | Function | Previous endpoint | v2 replacement | Risk |
|---|---|---|---|---|
| `public/js/dashboard.js` | `toggleConfirm` | `/api/registrations/:id/confirm|unconfirm` | `DataService.toggleRegistrationConfirmation()` -> `/api/v2/registrations/:id/confirm|unconfirm` | Low |
| `public/js/dashboard.js` | edit/create/delete leader actions | `/api/leaders` + `/api/leaders/:id` | `apiCallV2` with primary `/api/v2/leaders` routes | Low |
| `public/js/modules/leaders.module.js` | `handleSaveLeader`, `handleSaveEditLeader`, `handleConfirmDeleteLeader` | `/api/leaders` CRUD | `createLeaderV2`, `updateLeaderV2`, `deleteLeaderV2` | Low |
| `public/js/modules/export.module.js` | registrations export data load | frontend multi-page `/api/v2/registrations` loop | backend export endpoint `/api/v2/registrations/export` | Medium |
| `public/js/modules/export.module.js` | leaders export data load | `/api/v2/leaders` list page | backend export endpoint `/api/v2/leaders/export` | Low |

### Backend additions for dedicated export

- `POST /api/v2/registrations/export`
  - Implemented in:
    - `src/backend/modules/registrations/registration.controller.js` (`exportRegistrations`)
    - `src/backend/modules/registrations/registration.routes.js`
  - Uses same filter contract as `/api/v2/registrations` via shared `buildRegistrationFilter(...)`.

- `POST /api/v2/leaders/export`
  - Implemented in:
    - `src/backend/modules/leaders/leader.controller.js` (`exportLeaders`)
    - `src/backend/modules/leaders/leader.routes.js`
  - Supports `search`, `active`, `eventId`, `sort`, `limit`, `includeMetrics`.

### DataService normalization in this phase

- Added/used v2 operational methods:
  - `createLeaderV2(...)`
  - `updateLeaderV2(...)`
  - `deleteLeaderV2(...)`
  - `sendLeaderAccessEmail(...)`
  - `getLeaderCredentials(...)`
  - `toggleRegistrationConfirmation(...)`
  - `exportRegistrationsV2(filters)`
  - `exportLeadersV2(filters)`

### Result

- Leaders CRUD in `leaders.module.js` no longer depends on `/api/leaders` as primary source.
- Dashboard CRUD actions now hit v2 endpoints as primary path.
- Registrations confirm/unconfirm action now uses `DataService.toggleRegistrationConfirmation()` in the registrations paginated module.
- Exportations no longer depend on frontend snapshots or long paginated loops as the primary strategy.
- Export filters are now sent to backend in a single v2 export contract.

## Phase 11 - Closure and Final Verification

### Fallback audit map (remaining)

| File | Function | Legacy fallback | Legacy route | Activation condition | Removal risk |
|---|---|---|---|---|---|
| `public/js/dashboard.js` | `fetchLeadersForDashboard()` | yes | `/api/leaders` | `window.DataService` unavailable | Low (file is currently not mounted in `dashboard.html`) |
| `public/js/dashboard.js` | `fetchRegistrationsForDashboard()` | yes | `/api/registrations?limit=10000` | `window.DataService` unavailable | Low (file is currently not mounted in `dashboard.html`) |
| `public/js/dashboard.js` | `apiCallV2(...)` callers | yes | `/api/leaders/*`, `/api/registrations/*` | `window.DataService.apiCall` unavailable | Low (legacy monolith path disabled) |

Notes:
- `public/dashboard.html` currently comments out `dashboard.js`:
  - `<!-- <script src="/js/dashboard.js"></script> -->`
- Active UI path is the modular loader (`/js/index.js`), where `DataService` is loaded before modules.

### Functional flow verification (v2 final path)

| Flow | DataService method | Endpoint final | UI refresh |
|---|---|---|---|
| Crear líder | `createLeaderV2(body)` | `POST /api/v2/leaders` | `await loadTable()` |
| Editar líder | `updateLeaderV2(id, body)` | `PUT /api/v2/leaders/:id` | `await loadTable()` |
| Eliminar líder | `deleteLeaderV2(id)` | `DELETE /api/v2/leaders/:id` | `await loadTable()` |
| Enviar accesos | `sendLeaderAccessEmail(id, payload)` | `POST /api/v2/leaders/:id/send-access` | feedback modal + cierre |
| Consultar credenciales | `getLeaderCredentials(id)` | `GET /api/v2/leaders/:id/credentials` | modal render |
| Confirmar registro | `toggleRegistrationConfirmation(id, false)` | `POST /api/v2/registrations/:id/confirm` | `await load()` |
| Desconfirmar registro | `toggleRegistrationConfirmation(id, true)` | `POST /api/v2/registrations/:id/unconfirm` | `await load()` |
| Exportar registros con filtros | `exportRegistrationsV2(filters)` | `POST /api/v2/registrations/export` | download Excel |
| Exportar líderes con filtros | `exportLeadersV2(filters)` | `POST /api/v2/leaders/export` | download Excel |

### Safe cleanup applied in active modular path

- Removed legacy fallbacks from:
  - `public/js/modules/leaders.module.js`
  - `public/js/modules/registrations.module.js`
  - `public/js/modules/export.module.js`
- Kept only `dashboard.js` fallback contingencies (legacy monolith file not mounted).
- Removed temporary trace noise from active modules and deprecated DataService warnings.
- Verified no active module now depends on:
  - `/api/leaders` legacy CRUD
  - direct `/api/registrations/:id/confirm|unconfirm` fallback
  - snapshot-based export fallback (`AppState.data.*`)

### Final migration checklist

- [x] Leaders CRUD operational path is v2.
- [x] Registrations confirm/unconfirm operational path is v2.
- [x] Exports for registrations and leaders use dedicated v2 backend endpoints.
- [x] Active modules use DataService as central API layer.
- [x] Legacy fallbacks removed from active modular UI path.
- [x] `node --check` passed for all touched frontend/backend files.
- [x] Relevant existing tests executed and passing.

### Contingencies still alive

- `public/js/dashboard.js` keeps legacy fallback logic as dormant contingency.
- Current risk is low because that file is not loaded by `public/dashboard.html`.
