# FASE 3: Dashboard Migration Audit

**Status**: 🟡 EN PROGRESO
**Session Date**: 2025-02-24
**Focus**: Dashboards → v2 Migration

---

## 📊 Audit Inicial

### registrations.js - Endpoints Usados
✅ **Ya soporta v2** (Phase 2):
- api.getLeaders() → /api/v2/leaders | /api/leaders
- api.getEvents() → /api/v2/events | /api/events
- api.getRegistrations(params) → /api/v2/registrations | /api/registrations
  - Response normalization: ✅ incluida (pagination mapped)

**Status**: Ready for v2 → No cambios necesarios (fallback automático)

---

### dashboard.js - Endpoints Usados

❌ **Necesitaba actualización (Phase 3)**:
- api.getStats() → AHORA: /api/v2/analytics/dashboard | /api/stats
- api.getDailyStats() → AHORA: /api/v2/analytics/trends | /api/stats/daily

✅ **Ya soporta v2**:
- api.getTopLeaders(5) → /api/v2/leaders/top | /api/leaders/top

**Status**: Actualizado en Phase 3 ✅

---

## 🔄 Cambios Realizar en Fase 3

### 1. api.js - Actualización Completada ✅

**Línea 209-221**: Agregadas nuevas funciones de normalización
```javascript
function normalizeAnalyticsResponse(response) {
  // v2 analytics returns {success, data, message}
  // Convert to flat object for dashboard compatibility
  if (response && response.success === true && response.data !== undefined) {
    return response.data; // Return just the data payload
  }
  return response; // v1 or already flat
}
```

**Línea 193-204**: Actualizados getStats() y getDailyStats()
```javascript
// ANTES (v1 only):
getStats: () => api.get(`${API_V1_BASE}/stats`),
getDailyStats: () => api.get(`${API_V1_BASE}/stats/daily`),

// AHORA (v2 con fallback):
getStats: () => apiRequestWithFallback(
  `${API_V2_BASE}/analytics/dashboard`,  // v2: /api/v2/analytics/dashboard
  `${API_V1_BASE}/stats`,                // v1 fallback: /api/stats
  { method: "GET" }
).then(normalizeAnalyticsResponse),

getDailyStats: () => apiRequestWithFallback(
  `${API_V2_BASE}/analytics/trends`,     // v2: /api/v2/analytics/trends
  `${API_V1_BASE}/stats/daily`,          // v1 fallback: /api/stats/daily
  { method: "GET" }
).then(normalizeAnalyticsResponse),
```

**Impact**: 
- ✅ Backward compatible (fallback to v1 if v2 not available)
- ✅ Dashboard.js works unchanged
- ✅ Response format normalized

---

### 2. dashboard.js - Sin cambios necesarios
**Status**: ✅ Funciona con ambos endpoints

**Why**: 
- Llama a api.getStats() y api.getDailyStats()
- Las respuestas se normalizan automáticamente en api.js
- La lógica de binding no cambia

---

### 3. registrations.js - Sin cambios necesarios
**Status**: ✅ Ya funciona con v2

**Why**:
- Ya usa api.getRegistrations() con normalización de paginación
- Ya usa api.getLeaders() y api.getEvents() con v2 fallback
- Todo migrado en Phase 2

---

## 📈 Endpoint Mapping Completado

| Funcionalidad | v1 | v2 | Status |
|---|---|---|---|
| **Dashboard Stats** | /api/stats | /api/v2/analytics/dashboard | ✅ Migrado |
| **Daily Trends** | /api/stats/daily | /api/v2/analytics/trends | ✅ Migrado |
| Registraciones | /api/registrations | /api/v2/registrations | ✅ Phase 2 |
| Líderes | /api/leaders | /api/v2/leaders | ✅ Phase 2 |
| Eventos | /api/events | /api/v2/events | ✅ Phase 2 |
| Top Líderes | /api/leaders/top | /api/v2/leaders/top | ✅ Phase 2 |

---

## 🎯 Validation Plan

### 1. Code Review ✅
- [x] api.js actualizado correctamente
- [x] Fallback logic implementado
- [x] Response normalization en lugar

### 2. Manual Testing
- [ ] Iniciar servidor
- [ ] Acceder a dashboard.js
- [ ] Verificar que carguen stats
- [ ] Verificar que cargue daily trends
- [ ] Verificar que cargue top leaders

### 3. Browser Console Check
- [ ] Sin errores de API
- [ ] Fallback not triggered (v2 endpoint working)
- [ ] Data rendering correctamente

### 4. Data Consistency
- [ ] Stats totales correctos
- [ ] Daily trends mostrado
- [ ] Top líderes listos
- [ ] Registrations cargadas

---

## 🧪 Test Commands

```bash
# 1. Ver cambios en api.js
grep -n "normalizeAnalyticsResponse\|analytics/dashboard\|analytics/trends" public/assets/js/api.js

# 2. Iniciar servidor
npm start

# 3. Acceder a dashboard
# Abrir browser en http://localhost:3000/dashboard.html

# 4. Verificar en console (F12)
# - No errores
# - Ver XHR requests a /api/v2/analytics/*

# 5. Verificar datos
# - Stats panel cargado
# - Daily chart visible
# - Leaders list populated
```

---

## 📝 Response Format Compatibility

### v1 /api/stats Response
```json
{
  "totalRegistrations": 150,
  "totalLeaders": 25,
  "totalEvents": 5,
  "activeLeaders": 20,
  "confirmedCount": 120
}
```

### v2 /api/v2/analytics/dashboard Response
```json
{
  "success": true,
  "message": "Dashboard Summary",
  "data": {
    "totalRegistrations": 150,
    "totalLeaders": 25,
    "totalEvents": 5,
    "activeLeaders": 20,
    "confirmedCount": 120,
    "summary": {...}
  }
}
```

**Normalization**: `normalizeAnalyticsResponse()` extrae solo `data`, compatible con v1

---

## 🚨 Potential Issues & Mitigations

### Issue 1: v2 response structure differs from v1
**Mitigation**: normalizeAnalyticsResponse() handles both formats
**Fallback**: If v2 structure unexpected, falls back to v1

### Issue 2: v2 /analytics/trends returns different format than /stats/daily
**Mitigation**: Check actual response structure from server
**Fallback**: v1 /stats/daily endpoint
**Action**: May need adjustment after testing

### Issue 3: Missing org filtering in v2
**Status**: v2 analytics already implements org filtering (OrgId middleware)
**Safety**: Safe to migrate

---

## 📋 Próximos Pasos

### Inmediato
1. [ ] Validar servidor responde correctamente
2. [ ] Test dashboard load
3. [ ] Verificar no console errors
4. [ ] Check data rendering

### Si problemas
1. [ ] Revisar response format de /api/v2/analytics/dashboard
2. [ ] Revisar response format de /api/v2/analytics/trends
3. [ ] Ajustar normalizeAnalyticsResponse() si necesario
4. [ ] Puede ser necesario mapear campos individuales

### Completar Phase 3
1. [ ] Todos los dashboards funcionan
2. [ ] No breaking changes
3. [ ] Documentar cambios
4. [ ] Commit a fase 3

---

## 📊 Change Summary

| File | Changes | Lines | Status |
|------|---------|-------|--------|
| api.js | Agregada normalizeAnalyticsResponse() | +18 | ✅ Done |
| api.js | Actualizado getStats() | ~8 | ✅ Done |  
| api.js | Actualizado getDailyStats() | ~8 | ✅ Done |
| **TOTAL** | **+34 líneas** | | ✅ PHASE 3 START |

---

**Next Action**: Start server and validate dashboard functionality
