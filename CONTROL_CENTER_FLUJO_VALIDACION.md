# Control Center Secreto - Flujo de Validación

## 📊 Diagrama de Guardias de Seguridad

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      GET /internal/control-center
      Headers: Authorization, x-dev-key
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                          ↓
            🔒 GUARDIAN 1: JWT TOKEN
            (src/middleware/superadmin.middleware.js:18-29)
            ┌────────────────────────────────┐
            │ ¿Authorization header existe?  │
            └────────────────────────────────┘
                   ↓ NO             ↓ SÍ
            ┌──────────┐       ┌──────────┐
            │  404     │       │  Siguiente
            │  + Log   │       │  Guardian
            └──────────┘       └──────────┘
                                     ↓
            🔒 GUARDIAN 2: JWT VALIDATION
            (src/middleware/superadmin.middleware.js:31-36)
            ┌────────────────────────────────┐
            │ ¿JWT válido y decodificable?   │
            └────────────────────────────────┘
                   ↓ NO             ↓ SÍ
            ┌──────────┐       ┌──────────┐
            │  404     │       │  Siguiente
            │  + Log   │       │  Guardian
            └──────────┘       └──────────┘
                                     ↓
            🔒 GUARDIAN 3: ROLE CHECK
            (src/middleware/superadmin.middleware.js:38-42)
            ┌────────────────────────────────┐
            │ ¿role === 'superadmin'?        │
            │  (o 'super_admin')             │
            └────────────────────────────────┘
                   ↓ NO             ↓ SÍ
            ┌──────────┐       ┌──────────┐
            │  404     │       │  Siguiente
            │  + Log   │       │  Guardian
            └──────────┘       └──────────┘
                                     ↓
            🔒 GUARDIAN 4: DEV_SECRET_KEY CHECK
            (src/middleware/superadmin.middleware.js:44-50)
            ┌────────────────────────────────┐
            │ ¿x-dev-key header coincide     │
            │  con DEV_SECRET_KEY?           │
            └────────────────────────────────┘
                   ↓ NO             ↓ SÍ
            ┌──────────┐       ┌──────────┐
            │  404     │       │  Siguiente
            │  + Log   │       │  Guardian
            └──────────┘       └──────────┘
                                     ↓
            🔒 GUARDIAN 5: IP WHITELIST
            (src/middleware/superadmin.middleware.js:52-60)
            ┌────────────────────────────────┐
            │ ¿IP del cliente en             │
            │  DEV_ALLOWED_IPS?              │
            └────────────────────────────────┘
                   ↓ NO             ↓ SÍ
            ┌──────────┐       ┌──────────┐
            │  404     │       │  ✅ ACCESO
            │  + Log   │       │  PERMITIDO
            └──────────┘       └──────────┘
                                     ↓
            📊 CONTROLADOR EJECUTADO
            (src/controllers/control-center.js)
            ┌────────────────────────────────┐
            │ • getControlCenter()           │
            │ • getControlCenterLogs()       │
            │ • getControlCenterStats()      │
            └────────────────────────────────┘
                                     ↓
            ✓ Respuesta 200 + JSON
            ✓ Log de acceso exitoso

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔍 Detalle de Cada Guardián

### Guardian 1: JWT Token
```javascript
// Busca: Authorization: Bearer <token>
const token = req.headers.authorization?.split(" ")[1];

if (!token) {
  // 404 + Log "Missing JWT token"
  return res.status(404).json({ error: "Not found" });
}
```

**Qué falla:**
- ✗ Sin header Authorization
- ✗ Formato incorrecto (no Bearer)

---

### Guardian 2: JWT Validation
```javascript
try {
  decoded = jwt.verify(token, config.jwtSecret);
} catch (error) {
  // 404 + Log "Invalid JWT token"
  return res.status(404).json({ error: "Not found" });
}
```

**Qué falla:**
- ✗ Token expirado
- ✗ Firma incorrecta
- ✗ JWT_SECRET no coincide

---

### Guardian 3: Role Check
```javascript
if (!decoded.role || 
    (decoded.role !== "superadmin" && 
     decoded.role !== "super_admin")) {
  // 404 + Log "Unauthorized role: $role"
  return res.status(404).json({ error: "Not found" });
}
```

**Qué falla:**
- ✗ Role es "admin"
- ✗ Role es "user"
- ✗ Role está vacío/undefined
- ✗ Cualquier otro role que no sea superadmin

---

### Guardian 4: Dev Secret Key
```javascript
const devKey = req.headers["x-dev-key"];
const expectedKey = process.env.DEV_SECRET_KEY;

if (!expectedKey) {
  logger.warn("DEV_SECRET_KEY not configured...");
  return res.status(404).json({ error: "Not found" });
}

if (!devKey || devKey !== expectedKey) {
  // 404 + Log "Invalid or missing x-dev-key header"
  return res.status(404).json({ error: "Not found" });
}
```

**Qué falla:**
- ✗ Sin header x-dev-key
- ✗ Valor no coincide
- ✗ DEV_SECRET_KEY no está en .env

---

### Guardian 5: IP Whitelist
```javascript
const clientIP = req.ip || req.connection.remoteAddress || "UNKNOWN";
const allowedIPs = process.env.DEV_ALLOWED_IPS
  ? process.env.DEV_ALLOWED_IPS.split(",").map(ip => ip.trim())
  : ["127.0.0.1", "::1"];

const isIPAllowed = allowedIPs.includes(clientIP) || 
                    allowedIPs.includes("*");

if (!isIPAllowed) {
  // 404 + Log "IP not in whitelist: $clientIP"
  return res.status(404).json({ error: "Not found" });
}
```

**Qué falla:**
- ✗ IP no está en DEV_ALLOWED_IPS
- ✗ IP está vacía (detectada como UNKNOWN)

**Bypass permitido:**
- ✓ DEV_ALLOWED_IPS contiene "*" (cualquier IP)

---

## 📝 Ejemplos de Logs

### ✅ Acceso Exitoso
```
✓ Superadmin control center accessed
{
  userId: "user_123",
  email: "admin@example.com",
  ip: "127.0.0.1"
}
```

### ❌ Intento Fallido
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
{
  timestamp: "2024-02-20T10:30:45.123Z",
  reason: "IP not in whitelist: 203.0.113.100",
  userId: "user_123",
  clientIP: "203.0.113.100",
  userAgent: "Mozilla/5.0...",
  method: "GET",
  path: "/internal/control-center",
  headers: {
    "x-dev-key": "***",           // Enmascarado
    "authorization": "***",        // Enmascarado
    "user-agent": "Mozilla/5.0..."
  }
}
```

---

## 🎯 Tabla de Escenarios

| Escenario | Token | x-dev-key | IP OK | Resultado |
|-----------|-------|-----------|-------|-----------|
| Acceso válido | ✓ | ✓ | ✓ | 200 OK |
| Token expirado | ✗ | ✓ | ✓ | 404 |
| Role incorrecto | ✓ (admin) | ✓ | ✓ | 404 |
| Key incorrecto | ✓ | ✗ | ✓ | 404 |
| IP bloqueada | ✓ | ✓ | ✗ | 404 |
| Sin token | ✗ | ✓ | ✓ | 404 |
| Sin x-dev-key | ✓ | ✗ | ✓ | 404 |
| Múltiples fallos | ✗ | ✗ | ✗ | 404 |

---

## 🔐 Orden Crítico de Validaciones

**El orden importa** porque:

1. **JWT primero** → No expone roles sin token válido
2. **Role después** → Solo usuarios "superadmin" llegan aquí
3. **Dev key tercero** → Validación adicional independiente
4. **IP última** → Última línea de defensa

Si se hiciera diferente:
- ✗ Validar IP primero = Revela que IP es factor
- ✗ Validar Key primero = Permite brute force de key

---

## 🛡️ Por Qué 404 y No 403?

**403 Forbidden** revelaría:
```
403 → "La ruta existe pero no tienes acceso"
      → El atacante sabe que la ruta existe
```

**404 Not Found** oculta:
```
404 → "La ruta no existe O no tienes acceso"
      → El atacante no sabe si es seguridad o que no existe
```

---

## 📊 Flujo de Datos en Petición Exitosa

```
Cliente
   ↓ GET /internal/control-center
   │ Headers:
   │   - Authorization: Bearer <JWT>
   │   - x-dev-key: <MY_SECRET>
   │
   ↓
app.js (línea 144)
   ↓
superadminSecretMiddleware
   ├─ Guardian 1: JWT token ✓
   ├─ Guardian 2: JWT valid ✓
   ├─ Guardian 3: Role check ✓
   ├─ Guardian 4: Dev key check ✓
   ├─ Guardian 5: IP whitelist ✓
   └─ req.user + req.clientIP establecidos
   ↓
controlCenterController.getControlCenter()
   ├─ Recompilar systemInfo
   ├─ Loggear acceso exitoso
   └─ Responder con JSON
   ↓
Cliente recibe 200 OK + JSON
```

---

## ⚠️ Intentos Fallidos - Ejemplos

### Intento 1: Sin Token
```bash
curl http://localhost:3000/internal/control-center
```

**Log:**
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
reason: "Missing JWT token"
userId: "UNKNOWN"
```

### Intento 2: Token pero Role Incorrecto
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/internal/control-center
```

**Si ADMIN_TOKEN tiene role="admin":**
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
reason: "Unauthorized role: admin"
userId: "admin_user_123"
```

### Intento 3: Headers Pero IP Bloqueada
```bash
curl -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "x-dev-key: MY_KEY" \
  http://localhost:3000/internal/control-center
```

**Si tu IP no está en DEV_ALLOWED_IPS:**
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
reason: "IP not in whitelist: 203.0.113.100"
userId: "superadmin_user_123"
clientIP: "203.0.113.100"
```

---

## 🎓 Conclusión

El flujo de validación es:

1. **Independiente** - Cada guardián valida algo diferente
2. **Ordenado** - El orden maximiza seguridad
3. **Transparente** - Todos los fallos se loggean
4. **Oculto** - 404 en lugar de 403 oculta detalles
5. **Completo** - 5 capas de protección

**Resultado:** Un atacante necesita:
- ✓ JWT válido de superadmin
- ✓ DEV_SECRET_KEY correcto
- ✓ IP en whitelist

Mientras que tú tienes:
- ✓ Visibilidad total de intentos
- ✓ Seguridad en capas
- ✓ Sin exposición pública
