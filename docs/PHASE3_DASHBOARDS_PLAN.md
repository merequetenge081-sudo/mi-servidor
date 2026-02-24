# FASE 3: Consolidación de Dashboards - PLAN

**Status**: 🔵 EN PROGRESO
**Priority**: HIGH (Dashboards internos)
**Timeline**: Esta sesión

---

## 🎯 Objetivo Principal

Migrar dashboards internos de admin (registrations.js, dashboard.js) a endpoints `/api/v2`, consolidando la capa de presentación y validando que v2 es completamente funcional en producción.

---

## 📋 Tareas Fase 3

### 1. Audit de Dashboards Actuales
- [ ] Analizar `public/assets/js/registrations.js`
- [ ] Analizar `public/assets/js/dashboard.js` 
- [ ] Identificar endpoints usados
- [ ] Revisar manipulación de datos

### 2. Actualizar registrations.js → v2
- [ ] Migrar endpoints a v2 con normalizaciones
- [ ] Actualizar manipulación de paginación
- [ ] Validar sorting y filtros funcionan
- [ ] Testing

### 3. Actualizar dashboard.js → v2
- [ ] Migrar endpoints de estadísticas
- [ ] Actualizar gráficos con datos v2
- [ ] Validar eventos y leaders loads
- [ ] Testing

### 4. Service Consolidation
- [ ] Unificar validaciones de auth
- [ ] Consolidar error handling
- [ ] Estandarizar pagination usage

### 5. Documentation
- [ ] Documentar cambios
- [ ] Crear tests si necesario
- [ ] Update architecture docs

---

## 🎨 Dashboards a Migrar

### registrations.js (Gestión de Registraciones)
**Endpoints Actuales**:
- GET /api/registrations (con paging)
- GET /api/registrations/:id
- PUT /api/registrations/:id (confirm/unconfirm)
- DELETE /api/registrations/:id

**v2 Equivalentes**:
- GET /api/v2/registrations
- GET /api/v2/registrations/:id
- PUT /api/v2/registrations/:id
- DELETE /api/v2/registrations/:id
- POST /api/v2/registrations/:id/confirm
- POST /api/v2/registrations/:id/unconfirm

**Changes Needed**:
- Response normalization (pagination fields)
- Data binding updates if v2 format differs

---

### dashboard.js (Main Admin Dashboard)
**Endpoints Actuales**:
- GET /api/events (active, listing)
- GET /api/leaders (top leaders, listing)
- GET /api/stats (dashboard stats)
- GET /api/stats/daily (trends)

**v2 Equivalentes**:
- GET /api/v2/events
- GET /api/v2/events/active/current
- GET /api/v2/leaders
- GET /api/v2/leaders/top
- GET /api/v2/analytics/summary (or /api/v2/stats)
- GET /api/v2/analytics/daily (or check available)

**Changes Needed**:
- Update data binding
- Response unwrapping (v2 format)
- Chart data mapping if format changed

---

## ⚙️ Checklist de Validación

Por cada dashboard:
- [ ] Endpoints identificados y mapeados
- [ ] Cambios de código implementados
- [ ] Data binding validado
- [ ] Fallback behavior verificado (si v2 falla)
- [ ] Visual testing completado
- [ ] No console errors

---

## 🚀 Comenzar

Espera instrucción para:
1. Auditar registrations.js
2. Auditar dashboard.js
3. Implementar cambios
4. Validar funcionamiento
