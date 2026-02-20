# ✅ Control Center Secreto - Resumen de Implementación

**Fecha:** 20 de Febrero, 2026  
**Estado:** ✓ Completado y Listo para Usar

---

## 📦 Archivos Creados/Modificados

### 📄 Archivos Nuevos

1. **[src/middleware/superadmin.middleware.js](src/middleware/superadmin.middleware.js)** (109 líneas)
   - Middleware de protección con validaciones en cadena
   - Valida JWT, header x-dev-key e IP
   - Loggea intentos de intrusión

2. **[src/controllers/control-center.js](src/controllers/control-center.js)** (139 líneas)
   - Controlador con 3 endpoints
   - `getControlCenter()` - Panel principal
   - `getControlCenterLogs()` - Ver logs
   - `getControlCenterStats()` - Estadísticas de sistema

3. **[docs/CONTROL_CENTER_SECRETO.md](docs/CONTROL_CENTER_SECRETO.md)** (450+ líneas)
   - Documentación completa con ejemplos
   - Guía de ambiente, migración, troubleshooting

4. **[docs/CONTROL_CENTER_SETUP.md](docs/CONTROL_CENTER_SETUP.md)** (300+ líneas)
   - Resumen de implementación
   - Checklist de seguridad
   - FAQ

5. **[test-control-center.js](test-control-center.js)** (160 líneas)
   - Script Node.js para pruebas
   - Simula login + acceso a todos los endpoints

6. **[test-control-center.ps1](test-control-center.ps1)** (190 líneas)
   - Script PowerShell para pruebas
   - Versión con salida formateada para Windows

### ✏️ Archivos Modificados

1. **[src/app.js](src/app.js)**
   - ✓ Agregadas importaciones del middleware y controlador
   - ✓ Agregadas 3 rutas de control center (líneas 144-148)
   - ✓ Colocadas ANTES del organizationMiddleware (completamente separadas)

2. **[.env](.env)**
   - ✓ Agregada `DEV_SECRET_KEY` (clave secreta)
   - ✓ Agregada `DEV_ALLOWED_IPS` (whitelist de IPs)

---

## 🔐 Características Implementadas

### ✓ Protección Multi-Capa

| Capa | Validación | Fallo |
|------|-----------|-------|
| 1 | JWT válido + role='superadmin' | 404 + Log intrusión |
| 2 | Header x-dev-key correcto | 404 + Log intrusión |
| 3 | IP en whitelist DEV_ALLOWED_IPS | 404 + Log intrusión |

**Si CUALQUIERA falla:** Devuelve 404 (parece que la ruta no existe)

### ✓ Rutas Implementadas

```
GET /internal/control-center
  • Panel principal con info del sistema
  • Node version, memory, uptime, features

GET /internal/control-center/logs
  • Últimos logs del servidor
  • Parámetro: ?limit=100 (máx 1000)

GET /internal/control-center/stats
  • Estadísticas en tiempo real
  • Heap, CPU, PID, uptime
```

### ✓ Logging de Seguridad

Todos los intentos fallidos generan logs como:
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
{
  reason: "IP not in whitelist",
  userId: "UNKNOWN",
  clientIP: "203.0.113.100",
  userAgent: "...",
  timestamp: "2024-02-20T..."
}
```

Accesos exitosos generan:
```
✓ Superadmin control center accessed
{
  userId: "user_123",
  email: "admin@example.com",
  ip: "127.0.0.1"
}
```

---

## 🚀 Cómo Usar

### 1. Configurar Credenciales (Producción)

```bash
# Generar clave secreta
openssl rand -base64 32
# Resultado: aBcD1234efGH5678ijKL9012mnOP3456qrsT=

# Actualizar .env
DEV_SECRET_KEY=aBcD1234efGH5678ijKL9012mnOP3456qrsT=
DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46
```

### 2. Iniciar Servidor

```bash
npm start
# o
node server.js
```

### 3. Probar Control Center

```bash
# Opción 1: Node.js
node test-control-center.js

# Opción 2: PowerShell
.\test-control-center.ps1

# Opción 3: cURL
curl -X GET http://localhost:3000/internal/control-center \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-dev-key: your_super_secret_key"
```

---

## 📊 Información Disponible

El panel proporciona:

1. **Sistema**
   - Node version, environment, uptime
   - Memory usage (heap), MongoDB status
   - Features: JWT, dev mode, email service

2. **Logs** (endpoint /logs)
   - Últimos registros del servidor
   - Configurable con parámetro limit

3. **Stats** (endpoint /stats)
   - CPU usage, memory breakdown
   - PID, uptime en segundos

---

## 🛡️ Seguridad: Checklist

- [x] URL no obvia (/internal/control-center)
- [x] No /superadmin ni nombres obvios
- [x] JWT + role validation
- [x] Header x-dev-key validation
- [x] IP whitelist validation
- [x] Devuelve 404 (no 403) en fallos
- [x] Logging de intrusiones
- [x] Sin exposición en frontend
- [x] Protección multi-capa

---

## 📝 Notas Importantes

### Para Desarrollo

```env
DEV_SECRET_KEY=test_key_12345
DEV_ALLOWED_IPS=127.0.0.1,::1
```

### Para Producción

```env
DEV_SECRET_KEY=$(openssl rand -base64 32)  # Clave aleatoria
DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46  # IPs reales solamente
```

**NUNCA:**
- ✗ Usar DEV_SECRET_KEY débil en producción
- ✗ Permitir cualquier IP (DEV_ALLOWED_IPS=*)
- ✗ Exponer credenciales en logs
- ✗ Cambiar ruta a /superadmin (demasiado obvia)

---

## 🧪 Testing

### Test Local Completo

```bash
# Terminal 1: Iniciar servidor
npm start

# Terminal 2: Ejecutar pruebas
node test-control-center.js

# Terminal 3: Monitorear logs
tail -f server.log | grep "INTRUSIÓN\|control center"
```

### Simular Intentos Fallidos

```bash
# Sin token
curl http://localhost:3000/internal/control-center
# → 404 + Log "Missing JWT token"

# Token inválido
curl -H "Authorization: Bearer invalid" \
  http://localhost:3000/internal/control-center
# → 404 + Log "Invalid JWT token"

# Sin x-dev-key
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/internal/control-center
# → 404 + Log "Invalid or missing x-dev-key header"

# x-dev-key incorrecto
curl -H "Authorization: Bearer $TOKEN" \
  -H "x-dev-key: wrong_key" \
  http://localhost:3000/internal/control-center
# → 404 + Log "Invalid or missing x-dev-key header"

# IP no en whitelist
curl -H "Authorization: Bearer $TOKEN" \
  -H "x-dev-key: correct_key" \
  http://localhost:3000/internal/control-center
# (desde IP 203.0.113.100 si la whitelist es 127.0.0.1)
# → 404 + Log "IP not in whitelist"
```

---

## 📚 Referencias Rápidas

| Ítem | Ubicación |
|------|-----------|
| Middleware | [src/middleware/superadmin.middleware.js](src/middleware/superadmin.middleware.js) |
| Controlador | [src/controllers/control-center.js](src/controllers/control-center.js) |
| Rutas | [src/app.js](src/app.js#L144-L148) |
| Docs Completa | [docs/CONTROL_CENTER_SECRETO.md](docs/CONTROL_CENTER_SECRETO.md) |
| Env Vars | [.env](.env) |

---

## ✨ Ventajas

✓ **Completamente oculto** - Sin exposición en frontend  
✓ **URL no obvia** - /internal/control-center (no /superadmin)  
✓ **Protección multi-capa** - JWT + Header + IP  
✓ **Respuesta 404** - No revela existencia de la ruta  
✓ **Logging detallado** - Todos los intentos registrados  
✓ **Documentado** - Guías completas con ejemplos  
✓ **Fácil de probar** - Scripts incluidos  
✓ **Configurable** - Variables de entorno flexibles  

---

## 🚀 Próximos Pasos

1. ✓ Generar DEV_SECRET_KEY fuerte
2. ✓ Configurar DEV_ALLOWED_IPS reales
3. ✓ Ejecutar test-control-center.js para verificar
4. ✓ Monitorear logs de intrusión en producción
5. ✓ Configurar alertas para intentos fallidos (opcional)

---

## ❓ ¿Preguntas?

Ver [docs/CONTROL_CENTER_SECRETO.md](docs/CONTROL_CENTER_SECRETO.md) para:
- Ejemplos de uso completos
- Solución de problemas
- Guía de migración a producción
- FAQ detallado

---

**✅ Implementación Completada Exitosamente**

El panel super admin secreto está 100% funcional y listo para desplegar.
