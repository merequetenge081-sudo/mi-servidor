# 🔍 AUDITORÍA PRE-PRODUCCIÓN - NODE.JS + MONGODB

**Fecha**: 2026-02-17  
**Status**: ⚠️ **NO LISTO - CORREGIR ANTES DE DEPLOY**  
**Errores Críticos**: 3  
**Advertencias**: 4

---

## 🚨 ERRORES CRÍTICOS (BLOQUEO)

### ❌ 1. Server No Escucha en 0.0.0.0 para Render
**Archivo**: `server.js:24`  
**Problema**: `app.listen(PORT)` solo escucha localhost por defecto
```javascript
// ❌ ACTUAL (línea 24):
app.listen(PORT, () => {

// ✅ DEBE SER:
app.listen(PORT, "0.0.0.0", () => {
```
**Impacto**: CRÍTICO - Render requiere escuchar en 0.0.0.0, no localhost  
**Acción**: Cambiar inmediatamente

---

### ❌ 2. URLs Hardcodeadas de Frontend
**Archivo**: `public/assets/js/utils.js:1`  
**Problema**: API_URL hardcodeado a localhost
```javascript
// ❌ ACTUAL:
const API_URL = "http://localhost:5000/api";

// ✅ DEBE SER:
const API_URL = window.location.origin + "/api";
// O
const API_URL = process.env.REACT_APP_API_URL || window.location.origin + "/api";
```
**Impacto**: CRÍTICO - No funcionará en Render  
**Acción**: Cambiar a variable dinámica

---

### ❌ 3. URL Hardcodeada en auth.js
**Archivo**: `public/assets/js/auth.js:18`  
**Problema**: Mismo issue que anterior
```javascript
// ❌ ACTUAL:
const response = await fetch(`http://localhost:5000/api${endpoint}`, {

// ✅ DEBE SER:
const baseUrl = window.location.origin;
const response = await fetch(`${baseUrl}/api${endpoint}`, {
```
**Impacto**: CRÍTICO - Login fallará en Render  
**Acción**: Cambiar inmediatamente

---

## ⚠️ ADVERTENCIAS (FIX ANTES DE DEPLOY)

### ⚠️ 1. Múltiples Definiciones de JWT_SECRET
**Archivos**: 
- `src/controllers/auth.js:7`
- `src/middleware/auth.middleware.js:3`
- `src/config/env.js:5`

**Problema**: JWT_SECRET con fallback inseguro "dev_secret_change_me" en 3 lugares
```javascript
// ❌ ACTUAL (auth.js):
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// ✅ CONSTERNACIÓN:
// Usar centralizado desde src/config/env.js
```
**Impacto**: Alto - En producción puede usar fallback si env var falla  
**Acción**: Usar solo 1 fuente (src/config/env.js)

---

### ⚠️ 2. console.log en Producción
**Archivos**:
- `src/config/db.js:15` - console.log("✓ Conectado a MongoDB")
- `src/services/notification.service.js:4,14,24` - 3 console.log()

**Impacto**: Medio - Spam en logs de Render  
**Acción**: Cambiar a logger.info()

---

### ⚠️ 3. Archivos Legacy No Usados
**Archivos**:
- `src/utils/db.js` - No importado en ningún lado
- `src/utils/userDb.js` - No importado en ningún lado
- `src/config/db-hybrid.js` - No usado (fallback antiguo)

**Impacto**: Bajo - Ruido en codebase  
**Acción**: Eliminar si no son respaldo

---

### ⚠️ 4. Form HTML - Fetch sin Authorization
**Archivo**: `public/form.html:55-80`  
**Problema**: Fetch a /api/leaders sin Authorization
```javascript
// ❌ ACTUAL:
const res = await fetch('/api/leaders');

// NOTA: Según routes, /api/leaders requiere authMiddleware
```
**Impacto**: Bajo - Endpoint es restringido, fallará con 401  
**Acción**: O agregar token o crear endpoint público

---

## ✅ VERIFICACIONES PASADAS

### ✅ 1. CONFIGURACIÓN DE ENTORNO
- ✅ `mongoose.connect(MONGO_URL)` - Toma de process.env.MONGO_URL
- ✅ JWT usa `process.env.JWT_SECRET` con validación en producción
- ✅ No hay credenciales hardcodeadas en código (excepto fallbacks de dev)
- ✅ `dotenv` cargado en server.js
- ✅ Validación en src/config/env.js en producción

**Resultado**: PASÓ (con advertencia sobre múltiples JWT_SECRET)

---

### ✅ 2. RENDER COMPATIBILIDAD
- ✅ package.json tiene `"type": "module"`
- ✅ package.json tiene `"main": "server.js"`
- ✅ package.json tiene `"scripts": { "start": "node server.js" }`
- ✅ package.json tiene `"engines": { "node": ">=18.0.0" }`
- ✅ PORT viene de process.env.PORT || 5000
- ❌ **FALTA**: app.listen(PORT, "0.0.0.0") → Cambiar

**Resultado**: **FALLÓ** (escucha en localhost)

---

### ✅ 3. SEGURIDAD BACKEND
- ✅ helmet() - Activo
- ✅ express.json() - Activo
- ✅ rateLimit() - 200 req/15min activo
- ✅ xss() - Activo
- ✅ hpp() - Activo
- ✅ compression() - Activo
- ✅ Global error handler - Activo
- ✅ authMiddleware - Implementado
- ✅ roleMiddleware - Implementado

**Resultado**: PASÓ

---

### ✅ 4. MODELOS
- ✅ leaderId es String (Leader.js:2)
- ✅ eventId es String (Registration.js:5)
- ✅ No se cambiaron tipos de datos
- ✅ Índices agregados correctamente (6 en Registration, 5 en Leader)
- ✅ Schemas sin cambios respecto a BD existente

**Resultado**: PASÓ

---

### ✅ 5. CONTROLADORES
- ✅ createLeader - Existe
- ✅ getLeaders - Existe
- ✅ getLeader - Existe
- ✅ createRegistration - Existe
- ✅ getRegistrations - Existe
- ✅ confirmRegistration - Existe (línea 191)
- ✅ unconfirmRegistration - Existe (línea 219)
- ✅ getStats - Existe
- ✅ getDailyStats - Existe
- ✅ exportData - Existe
- ✅ getDuplicates - Existe
- ✅ adminLogin - JWT payload: {userId, role, username}
- ✅ leaderLogin - JWT payload: {userId, leaderId, role, name}
- ✅ Respuestas JSON sin cambios

**Resultado**: PASÓ - Todos endpoints antiguos existen, mismo formato

---

### ✅ 6. SERVICIOS
- ✅ AuditService.log() - Non-blocking (try-catch)
- ✅ ValidationService - Validaciones correctas
- ✅ NotificationService - Non-blocking (catch en controllers)

**Resultado**: PASÓ

---

### ✅ 7. FRONTEND
- ✅ Authorization header presente en audit-logs.html
- ✅ Authorization header presente en leader.html
- ✅ Token validado antes de cargas protegidas
- ✅ Service Worker registrado correctamente
- ✅ Service Worker no interfiere con API (no cachea /api)
- ✅ Meta tags agregados (viewport, description, theme-color)

**Resultado**: PASÓ (excepto URLs hardcodeadas)

---

## 🔍 ANÁLISIS DETALLADO POR COMPONENTE

### 🔐 Autenticación
```
Login Flow: ✅ Funciona
JWT: ✅ Valida en auth.middleware.js
Token Storage: ✅ localStorage
Refresh: ⚠️ No hay refresh token (ok para 12h expiry)
```

### 📦 Modelos
```
Admin.js: ✅ Correcto (2 índices naturales)
Leader.js: ✅ Correcto (5 índices optimizados)
Registration.js: ✅ Correcto (6 índices optimizados)
Event.js: ✅ Correcto
AuditLog.js: ✅ Correcto
```

### 📡 API Routes
```
/api/auth/* - ✅ Correctas
/api/leaders - ✅ Protegida
/api/registrations - ✅ Protegida
/api/events - ✅ Protegida
/api/stats - ✅ Protegida
/api/export - ✅ Protegida (admin)
/api/duplicates - ✅ Protegida (admin)
/api/audit-logs - ✅ Protegida (admin)
/health - ✅ Pública, rate-limit excluida
```

### 🌐 Frontend
```
login.html: ✅ Estructura ok, pero hardcoded URL
index.html: ⚠️ Antigua versión, usar dashboard.html
form.html: ⚠️ Sin auth header en fetch /api/leaders
leader.html: ✅ Headers correctos
audit-logs.html: ✅ Headers correctos
dashboard.html: ✅ Estructura ok
```

---

## 📋 PLAN DE CORRECCIÓN

### ANTES DE DEPLOY (ORDEN):

1. **CRÍTICO #1**: Cambiar server.js línea 24
   ```bash
   app.listen(PORT, "0.0.0.0") 
   ```
   Tiempo: 1 minuto

2. **CRÍTICO #2**: Cambiar public/assets/js/utils.js línea 1
   ```bash
   const API_URL = window.location.origin + "/api";
   ```
   Tiempo: 1 minuto

3. **CRÍTICO #3**: Cambiar public/assets/js/auth.js línea 18
   ```bash
   const baseUrl = window.location.origin;
   fetch(`${baseUrl}/api${endpoint}`)
   ```
   Tiempo: 2 minutos

4. **ADVERTENCIA #1**: Cambiar src/config/db.js línea 15
   ```bash
   logger.info("✓ Conectado a MongoDB");
   ```
   Tiempo: 1 minuto

5. **ADVERTENCIA #2**: Cambiar src/services/notification.service.js líneas 4, 14, 24
   ```bash
   Reemplazar console.log por logger (importar primero)
   ```
   Tiempo: 5 minutos

6. **ADVERTENCIA #3**: Centralizar JWT_SECRET
   - Importar config.jwtSecret en auth.js y auth.middleware.js
   - Remover fallbacks locales
   Tiempo: 5 minutos

7. **ADVERTENCIA #4**: Opcional - Eliminar archivos legacy
   ```bash
   rm src/utils/db.js src/utils/userDb.js
   ```
   Tiempo: 1 minuto

**TIEMPO TOTAL**: ~15-20 minutos

---

## 🎯 RESUMEN FINAL

### ESTADO ACTUAL
| Área | Status | Detalles |
|------|--------|---------|
| **Entorno** | ⚠️ REVISAR | JWT_SECRET múltiple, URLs hardcodeadas |
| **Render** | ❌ FALLAR | No escucha en 0.0.0.0 |
| **Seguridad** | ✅ PASÓ | Helmet, rate-limit, auth todo ok |
| **BD** | ✅ PASÓ | Modelos, índices, schemas ok |
| **API** | ✅ PASÓ | Todos endpoints existen, mismo formato |
| **Frontend** | ⚠️ REVISAR | URLs hardcodeadas, form.html sin auth |

### CONCLUSIÓN

#### 🚫 **NO LISTO PARA PRODUCCIÓN**

**Razón**: 3 errores críticos impiden funcionamiento en Render
- Server no escucha en 0.0.0.0
- Frontend usa http://localhost:5000 (no funcionará en prod)
- JWT_SECRET con múltiples fallbacks inseguros

**Tiempo de Corrección**: 20 minutos  
**Dificultad**: Muy fácil (cambios simples)

#### ✅ Después de correcciones:
**LISTO PARA PRODUCCIÓN** ✓

---

## 📝 NOTAS FINALES

### Lo que está bien
- ✅ Arquitectura modular correcta
- ✅ Seguridad implementada (Helmet, rate-limit, XSS, HPP)
- ✅ BD y índices optimizados
- ✅ Logging centralizado con Winston
- ✅ Error handling global
- ✅ Validación JWT stricta en producción
- ✅ Middleware de autorización

### Cambios mínimos necesarios
- 📝 3 cambios en configuración (URLs, listen)
- 📝 2 cambios en logging (console → logger)
- 📝 1 centralización (JWT_SECRET)

### Riesgos post-deploy
- 🟢 BAJO - Todas las APIs funcionan sin cambios
- 🟢 BAJO - DB completamente compatible
- 🟢 BAJO - Auth no cambia,logout = fallback a /login.html

---

**Aprobado para correcciones.**  
**Reuditoría después de cambios: 5 minutos**
