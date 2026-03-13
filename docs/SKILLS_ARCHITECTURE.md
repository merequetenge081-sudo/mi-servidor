# Arquitectura Modular de Skills (Electoral/Política)

## Objetivo
Separar lógica de negocio principal (`modules`) de procesos especializados (`skills`), asegurando integridad de datos y analytics limpios.

## Estructura Propuesta

```text
src/
  backend/
    modules/                # entidades/rutas/servicios transaccionales
      registrations/
      leaders/
      events/
      analytics/
      duplicates/
      ...
    skills/                 # procesos inteligentes por responsabilidad
      core/
        skill.contracts.js
      validation/
        validation.skill.js
      deduplication/
        deduplication.skill.js
      index.js
  models/
    Registration.js
    DeduplicationFlag.js
    SkillJob.js
    SkillResult.js
  shared/
    analyticsFilter.js
```

## Responsabilidades

- `modules`: CRUD, endpoints, reglas transaccionales, autorización.
- `skills`: evaluación y enriquecimiento de calidad de datos.
- `analytics`: solo consume datos limpios por `shared/analyticsFilter.js`.
- `audit`: registro de acciones críticas (ya existente).

## Skills Implementadas (fase actual)

## 1) Validation Skill
Archivo: `src/backend/skills/validation/validation.skill.js`

Valida:
- campos requeridos
- formato de teléfono (10-15 dígitos)
- consistencia básica de voto (`puestoId`/`mesa` si `registeredToVote=true`)
- consistencia localidad vs puesto

Salida:
- `valid`, `invalid`, `needsReview`
- `errors`, `warnings`
- `dataIntegrityStatus` (`valid|needs_review|invalid`)
- `workflowStatus` (`validated|flagged|invalid`)

## 2) Deduplication Skill
Archivo: `src/backend/skills/deduplication/deduplication.skill.js`

Detecta:
- `exact_duplicate` (cédula+evento)
- `probable_duplicate` (mismo nombre, cédula distinta)
- `repeated_phone`
- `orphan_record` (líder inexistente)
- `puesto_localidad_mismatch`

Persiste flags en:
- `models/DeduplicationFlag.js`

## 3) Verification Skill
Archivo: `src/backend/skills/verification/verification.skill.js`

Funciones:
- prepara cola de verificación (`pending_call`) priorizada por score
- registra intentos (`call_attempts`)
- registra resultado de verificación (`verification_results`)
- actualiza estado de workflow (`called|confirmed|rejected|no_answer|wrong_number|retry`)

## 4) Scoring Skill
Archivo: `src/backend/skills/scoring/scoring.skill.js`

Calcula:
- `score` (0-100)
- `priority` (`high|medium|low`)
- razones aplicadas por regla

Reglas base configurables:
- confiabilidad líder
- validación previa
- penalización por duplicados
- territorio estratégico
- contacto reciente

## 5) Productivity Skill
Archivo: `src/backend/skills/productivity/productivity.skill.js`

Recalcula métricas por líder:
- total subidos
- total válidos
- total duplicados
- total confirmados
- tasa de efectividad

Persistencia:
- `models/LeaderMetric.js`

## 6) Analytics Skill (materialización limpia)
Archivo: `src/backend/skills/analytics/analytics.skill.js`

Recalcula métricas limpias y resumidas:
- `DailyMetric`
- `CampaignMetric`
- `TerritoryMetric`

Usa el filtro único de datos limpios (`shared/analyticsFilter.js`).

## 7) DatabaseOptimization Skill
Archivo: `src/backend/skills/databaseOptimization.skill.js`

Propósito:
- analizar salud/rendimiento de MongoDB sin modificar datos ni crear índices automáticamente.

Análisis implementados:
- estadísticas por colección (`count`, `size`, `avgObjSize`)
- top documentos más grandes con `$bsonSize`
- duplicados críticos en `registrations` por `phone + eventId`
- comparación de índices existentes vs recomendados
- detección de campos raros/sospechosos con `$objectToArray`

Colecciones objetivo:
- `registrations`
- `call_attempts`
- `verification_results`
- `leaders`
- `events`
- `campaigns`
- `metrics`

Comportamiento robusto:
- si una colección no existe, se registra warning y continúa.
- cada colección se analiza de forma aislada para evitar fallo global.

Estructura de salida (`resultSummary`):
- `collectionsAnalyzed`
- `duplicateGroups`
- `largeDocuments`
- `indexesMissing`
- `suspiciousFields[]`
- `recommendations[]`
- `warnings[]`
- `byCollection` (detalle técnico por colección)

## Integración Actual

- `registrations/createRegistration` ahora ejecuta:
  1. `runValidationSkill`
  2. `runDeduplicationSkill`
  3. guarda `dataIntegrityStatus`, `workflowStatus`, `validationErrors`, `deduplicationFlags`
  4. persiste flags en `DeduplicationFlag`

- `duplicates` agrega endpoint:
  - `POST /api/v2/duplicates/scan`
  - corre deduplicación sobre lote existente y actualiza flags/estado de integridad.

- módulo de jobs de skills:
  - `GET /api/v2/skills/catalog`
  - `GET /api/v2/skills/jobs`
  - `GET /api/v2/skills/jobs/:jobId`
  - `POST /api/v2/skills/run`
  - servicio: `src/backend/skills/jobs/skill-job.service.js`

- analytics limpio:
  - nueva fuente única de filtro en `src/shared/analyticsFilter.js`
  - aplicada en `metrics.service.js`, `analytics.repository.js`, `advanced.service.js`

## Modelo de Datos (fase actual)

## Nuevos modelos de control
- `SkillJob`
- `SkillResult`
- `DeduplicationFlag`
- `CallAttempt`
- `VerificationResult`
- `DailyMetric`
- `LeaderMetric`
- `TerritoryMetric`
- `CampaignMetric`

## Registration (extendido)
- `workflowStatus`
- `validationErrors[]`
- `deduplicationFlags[]`

## Migración/Backfill

Script:
- `scripts/migration/backfill-registration-workflow.mjs`

Uso:
```bash
node scripts/migration/backfill-registration-workflow.mjs
```

## Pendiente (siguientes fases)

- worker asíncrono/cola real (BullMQ o similar) para `SkillJob` pesados
- endpoints operativos específicos para registrar outcomes de llamadas en tiempo real
- pruebas de integración end-to-end de jobs + rutas `/api/v2/skills`

## 8) UiTextQuality Skill
Archivo: `src/backend/skills/uiTextQuality.skill.js`

Proposito:
- analizar calidad de textos visibles de la UI sin modificar archivos.

Analisis implementados:
- deteccion de mojibake (UTF-8 mal interpretado)
- deteccion de errores ortograficos frecuentes del dominio
- inconsistencias de UX writing (email/correo, ingresar/iniciar sesion, labels en mayusculas sostenidas)
- deteccion de strings repetidas/hardcodeadas para centralizacion

Alcance de escaneo:
- archivos `.html` y `.js` dentro de `public/`
- omite archivos minificados grandes para evitar ruido

Comportamiento robusto:
- si un archivo no existe o falla lectura, agrega warning y continua
- no falla el job completo por errores puntuales

Estructura de salida (`resultSummary`):
- `filesAnalyzed`
- `mojibakeIssues`
- `spellingIssues`
- `consistencyIssues`
- `repeatedStrings`
- `topProblems[]` con `file`, `line`, `text`, `issueType`, `suggestedFix`
- `recommendations[]`
- `warnings[]`
