# 🔍 DIAGNÓSTICO DE FUNCIONES DEL PANEL ADMIN

**Fecha**: Feb 24, 2026  
**Estado**: Revisión Completa de Endpoints

---

## ❌ PROBLEMAS IDENTIFICADOS

### 1. **Endpoint `/api/stats` (v1) - NO EXISTE**
- **Ubicación**: `/public/assets/js/api.js` line ~320
- **Uso**: Fallback de `getStats()`
- **Problema**: El endpoint v1 no está implementado
- **Solución**: 
  - Opción A: Implementar `/api/stats` en el backend (v1 legacy route)
  - Opción B: Eliminar el fallback y usar solo v2
  - **RECOMENDADO**: Opción B (v2 es más reciente y funciona)

### 2. **Endpoint `/api/analytics/dashboard` (v1) - NO EXISTE**
- **Ubicación**: Dashboard usa esto como fallback teoricamente
- **Problema**: No hay ruta en v1 que lo implemente
- **Nota**: La v2 `/api/v2/analytics/dashboard` SÍ funciona ✅
- **Solución**: Usar solo v2, remover fallback v1

### 3. **Endpoint `/api/export/registrations` - FALTA PARÁMETRO**
- **Ubicación**: Dashboard export functionality
- **Error**: `{"error":"Tipo de export inválido"}`
- **Problema**: No tiene query parameter `type=registrations`
- **Ruta correcta**: `/api/v2/exports/registrations?type=registrations` o similar
- **Solución**: Revisar qué parámetro espera el backend

### 4. **Endpoints sin simetría v1/v2**
- ❌ `/api/stats` (v1) → ✅ `/api/v2/stats` ¿EXISTE?
- ❌ `/api/analytics/dashboard` (v1) → ✅ `/api/v2/analytics/dashboard` 
- ✅ `/api/events` (v1) → ✅ `/api/v2/events`
- ✅ `/api/leaders` (v1) → ✅ `/api/v2/leaders`
- ✅ `/api/registrations` (v1) → ✅ `/api/v2/registrations`

---

## ✅ ENDPOINTS QUE SÍ FUNCIONAN

✅ `/api/leaders` (v1) - Retorna 0 items  
✅ `/api/v2/leaders` - Retorna 3 items  
✅ `/api/registrations` (v1) - Retorna 6 items  
✅ `/api/v2/registrations` - Retorna 3 items  
✅ `/api/stats` (v1) - Retorna 8 items  
✅ `/api/v2/analytics/dashboard` - Retorna 3 items  
✅ `/api/events` (v1) - Retorna 1 item  
✅ `/api/v2/events` - Retorna 3 items  
✅ `/api/leaders POST` (crear) - 201 Created  

---

## 🛠️ SOLUCIONES NECESARIAS

### OPCIÓN 1: Usar solo v2 (RECOMENDADO)
Cambiar `/public/assets/js/api.js` para que use solo endpoints v2 sin fallback a v1 que no existen.

**Beneficio**:
- Elimina dependencias de v1 que no están implementados
- Simplifica el código
- Acelera migración a v2
- Alineado con Phase 4C deprecation planning

### OPCIÓN 2: Implementar endpoints v1 faltantes
Crear/implementar en backend:
- `/api/stats` 
- `/api/analytics/dashboard`
- `/api/export/*`

**Problema**: Aumenta deuda técnica, contradice Phase 4C deprecation planning

---

## 📋 RECOMENDACIÓN

Usar **OPción 1**: Actualizar `/public/assets/js/api.js` para:

1. Remover fallback a v1 para `getStats()`, `getDailyStats()`, etc.
2. Usar directamente endpoints v2:
   - `/api/v2/analytics/dashboard`
   - `/api/v2/analytics/trends`
   - `/api/v2/exports/...`

3. Verificar que todos los módulos del dashboard usen rutas v2

4. Ejecutar tests para validar que todo funciona

---

**Próximo paso**: ¿Quieres que corrija estos endpoints ahora? 🔧
