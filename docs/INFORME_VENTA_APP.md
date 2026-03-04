# Informe comercial y tecnico de la app

## 1) Resumen ejecutivo
Esta plataforma es un Sistema de Gestion de Eventos y Lideres basado en una API REST modular. Su valor principal es centralizar la operacion, dar visibilidad en tiempo real y asegurar trazabilidad completa de cada accion, con seguridad empresarial y capacidad de escalar.

En terminos simples: reduce errores operativos, acelera registros y deja evidencia auditada para cumplimiento y toma de decisiones.

## 2) Propuesta de valor (para negocio)
- Control total de eventos y operaciones en campo, con roles y permisos claros.
- Procesos mas rapidos y consistentes gracias a flujos estandarizados.
- Auditoria lista para compliance sin esfuerzo adicional.
- Migracion segura a nueva version de API sin interrupciones (v2 con fallback a v1).

## 3) Capacidades clave (tecnico pero claro)
- Gestion de eventos: alta, edicion, activacion y estadisticas.
- Gestion de lideres: perfiles, asignacion, especialidades y permisos.
- Registro de personas: validaciones, formularios publicos y confirmaciones.
- Auditoria integral: log de acciones con usuario, fecha y recurso.
- Notificaciones: email, WhatsApp y SMS para comunicaciones criticas.
- API v2 enterprise con compatibilidad v1 para cero downtime.

## 4) Arquitectura y componentes
- Arquitectura en N capas: routes -> controllers -> services -> models.
- MongoDB + Mongoose para datos flexibles y relaciones claras.
- Frontend web simple (formularios y dashboards) consumiendo la API.
- Cliente de API con fallback automatico: primero /api/v2 y, si no existe, /api.

## 5) Seguridad y control de acceso
- JWT con expiracion y verificacion centralizada.
- Roles definidos: Admin (control total) y Lider (acceso limitado).
- Protecciones activas: rate limiting, headers de seguridad, XSS y HPP protection.
- Logging central para rastrear actividad y detectar incidentes.

## 6) Operacion y despliegue
- Despliegue en Render + MongoDB Atlas con configuracion sencilla.
- Monitoreo de logs, CPU/Memoria y alertas por email.
- Rollback en 1 clic ante cualquier incidente.

## 7) Cobertura funcional (API v2)
- 40+ endpoints en 5 modulos principales: Auth, Leaders, Events, Puestos, Registrations.
- Endpoints publicos y protegidos, con politicas claras.
- Estandar enterprise: controller -> service -> repository.

## 8) Calidad y madurez tecnica
- 23 tests de migracion (23/23 passing).
- 0 cambios rompedores en fase 2.
- Documentacion amplia: arquitectura, despliegue, auditoria y guias de fases.

## 9) Diferenciadores de venta
- Trazabilidad total: cada operacion queda auditada.
- Migracion sin riesgo: fallback automatico v2 <-> v1.
- Seguridad lista para produccion sin sobrecostos.
- Escalable por diseno: modulos y capas bien definidos.

## 10) Roadmap
- Fase 3 lista: consolidacion de dashboards, expansion v2 y mejoras de analitica.
- Migracion de endpoints internos y paneles sin interrupciones.

## 11) Mensaje de cierre para presentacion
La plataforma entrega control, seguridad y visibilidad real sobre la operacion de eventos. Con una arquitectura moderna, seguridad empresarial y una estrategia de migracion sin cortes, esta lista para crecer con el negocio desde el dia uno.

---

# Informe tecnico de depuracion de datos y metricas

## Estado actual y trabajo de depuracion/refactor

### Fuentes actuales de metricas
- Backend (agregaciones/servicios): metrics.service.js, stats.service.js, analytics.repository.js, analytics.service.js, advanced.service.js.
- Backend (stats por entidad): event.repository.js, duplicates.service.js.
- Frontend (conteos previos en cliente): dashboard.js, analytics.module.js, data.service.js.

### Mapa de modelos y relaciones
- Registration -> Leader (leaderId), Event (eventId), Puestos (puestoId).
- Leader -> Event (eventId) y organizationId.
- Puestos -> localidad (obligatoria), organizationId.

### Hipotesis de conteos huerfanos/duplicados
- Fuentes de conteo mezcladas: frontend calculaba KPIs con /api/registrations y /api/leaders mientras analytics del backend usaba filtros distintos.
- Analytics v2 con filtros incompletos de multitenencia y diferencia de campos (status vs active).
- Cache de /stats puede divergir de lecturas directas.
- Duplicados por leaderId inconsistente (string vs _id) y cargas masivas.
- Huerfanos por eliminaciones/archivos o imports con eventId/leaderId/puestoId obsoletos.
- Puestos sin localidad o localidad inconsistente contaminan metricas geograficas.

## Plan de depuracion
1) Inventariar y congelar las fuentes de metricas; consolidar en un servicio unico.
2) Ejecutar auditoria para cuantificar duplicados, huerfanos e inconsistencias.
3) Ejecutar limpieza en dry-run; definir canonico y aplicar reglas consistentes.
4) Refactor del frontend para consumir solo el endpoint de metricas.
5) Agregar pruebas de integridad para evitar regresiones.

## Cambios implementados
- Fuente unica de verdad: metrics.service.js.
- Analytics repository y stats service consumen metrics.service.js.
- Exclusiones por integridad en advanced.service.js.
- Nuevo endpoint compartido de metricas del dashboard.
- Campo de integridad en Registration y Puestos para filtrar datos invalidos.
- Frontend refactorizado para consumir metricas del backend (sin conteos locales).

## Scripts de auditoria y limpieza
- Auditoria (solo reporte): data-audit.mjs.
- Limpieza (dry-run por defecto, --apply para ejecutar): data-cleanup.mjs.

## Pruebas agregadas
- Tests de integridad para metrics.service.js.

## Uso rapido
Audit:
- node scripts/data-audit.mjs --org <ORG_ID> --event <EVENT_ID>
- opcional: --out <path>

Cleanup:
- node scripts/data-cleanup.mjs --org <ORG_ID> --event <EVENT_ID>
- aplicar cambios: --apply
- opcional: --limit 200, --out <path>

## Reglas de limpieza
- Canonico: registro mas completo, luego mas reciente.
- Duplicados no canonicos se archivan en ArchivedRegistration (razon: duplicate_registration).
- Huerfanos: leader -> needs_review, event -> invalid, puesto -> needs_review (puestoId se limpia).
- Puestos sin localidad: se infiere por registros; si no, se marca invalid y se desactiva.

## Cambios en el comportamiento del frontend
- Dashboard y analitica usan el mismo endpoint: GET /api/v2/analytics/metrics.
- Se elimina el calculo de KPIs en cliente.

## Proximos pasos
1) Ejecutar data-audit.mjs y revisar el reporte JSON.
2) Ejecutar data-cleanup.mjs en dry-run, revisar logs y validar el plan.
3) Repetir con --apply y re-auditar.
4) Correr pruebas unitarias: npm run test:unit.
