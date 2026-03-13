# Integración Frontend de Skills (Dashboard)

## Pantallas y componentes actualizados

- `public/dashboard.html`
  - En la sección `Dashboard` se agregó el panel **Automatizaciones (Skills)**.
  - Acciones disponibles:
    - Revalidar
    - Deduplicar
    - Preparar llamadas
    - Calcular scoring
    - Actualizar métricas
    - Productividad líderes
  - Tabla de jobs recientes con estado, skill, usuario, inicio, duración y resumen.
  - Modal de detalle por job (`skillsJobDetailModal`).

- `public/js/services/data.service.js`
  - Nuevos métodos:
    - `runSkillJob(skillName, payload)`
    - `getSkillJobs(limit)`
    - `getSkillJob(jobId)`

- `public/js/modules/skills.module.js`
  - Nuevo módulo de UI para skills.
  - Ejecuta jobs vía `POST /api/v2/skills/run`.
  - Consulta jobs vía `GET /api/v2/skills/jobs`.
  - Consulta detalle vía `GET /api/v2/skills/jobs/:jobId`.
  - Consulta salud de datos vía `GET /api/v2/skills/health`.
  - Consulta inconsistencias vía `GET /api/v2/skills/inconsistencies`.
  - Polling controlado para jobs en ejecución.
  - Previene doble ejecución accidental por skill.

- `public/js/utils/skills-ui.helpers.js`
  - Metadatos de skills (label/icon).
  - Helpers para duración y resumen por skill.

- `public/js/index.js`
  - Carga de `utils/skills-ui.helpers.js`.
  - Carga de `modules/skills.module.js`.

- `public/js/services/bootstrap.service.js`
  - Inicialización de `SkillsModule`.

- `public/js/core/router.js`
  - Refresco de jobs al volver a la sección `dashboard`.

## Flujo de uso desde UI

1. Entrar a `Dashboard`.
2. En panel **Automatizaciones (Skills)**, pulsar una acción.
3. La UI lanza el job y muestra feedback inmediato.
4. La tabla se refresca por polling y muestra estados:
   - `pending`
   - `running`
   - `completed`
   - `failed`
5. Pulsar `Ver` para abrir detalle y revisar:
   - resumen
   - resultados parciales
   - error (si aplica)

6. Revisar panel de salud:
   - válidos
   - inválidos
   - duplicados
   - con flags
   - pendientes de llamada
   - confirmados
   - mismatches
   - huérfanos

7. Revisar sección de inconsistencias para auditoría operativa.

## Permisos

- El panel se muestra solo para rol `admin`.
- La ejecución real queda en backend (`/api/v2/skills/*`), sin lógica de negocio en frontend.

## Robustez aplicada

- Bloqueo de doble click por skill durante ejecución.
- Estados de carga/error por acción.
- Polling no bloqueante y acotado.
- Resúmenes legibles por tipo de skill.
- Filtros de jobs por skill y estado.
- Orden por fecha reciente y contexto visual del job (`eventId`, `leaderId`, `limit`, etc.).
