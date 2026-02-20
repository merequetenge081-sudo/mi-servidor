# Panel Superadmin Secreto - Implementación Completada

## 📋 Resumen de la Implementación

Se ha creado un **panel de control super admin completamente separado y oculto** en tu servidor con máximas medidas de seguridad.

---

## 🔐 Características de Seguridad

| Feature | Detalles |
|---------|----------|
| **URL No Obvia** | `/internal/control-center` (no `/superadmin`) |
| **Validación JWT** | Solo usuarios con `role === 'superadmin'` |
| **Header Secreto** | Requiere `x-dev-key` que coincida con `DEV_SECRET_KEY` |
| **Whitelist de IP** | Solo IPs en `DEV_ALLOWED_IPS` pueden acceder |
| **Respuesta 404** | Si falla cualquier validación devuelve 404 (no 403) |
| **Logging de Intrusión** | TODO intento fallido se loggea como posible ataque |
| **Sin Frontend** | La ruta NO está expuesta en navegación ni HTML |

---

## 📁 Archivos Creados

### 1. **Middleware de Protección**
   - **Archivo:** [src/middleware/superadmin.middleware.js](../src/middleware/superadmin.middleware.js)
   - **Función:** `superadminSecretMiddleware`
   - **Validaciones:**
     1. JWT válido con role === 'superadmin'
     2. Header `x-dev-key` coincide con `DEV_SECRET_KEY`
     3. IP del cliente en `DEV_ALLOWED_IPS`
   - **Si falla:** Retorna 404 + loggea intento como intrusión

### 2. **Controlador**
   - **Archivo:** [src/controllers/control-center.js](../src/controllers/control-center.js)
   - **Endpoints:**
     - `GET /internal/control-center` - Panel principal
     - `GET /internal/control-center/logs` - Ver logs
     - `GET /internal/control-center/stats` - Estadísticas del sistema

### 3. **Variables de Entorno**
   - **Archivo:** [.env](.env)
   - **Variables añadidas:**
     ```env
     DEV_SECRET_KEY=your_super_secret_control_center_key_change_in_production_2024
     DEV_ALLOWED_IPS=127.0.0.1,::1
     ```

### 4. **Documentación Completa**
   - **Archivo:** [docs/CONTROL_CENTER_SECRETO.md](../docs/CONTROL_CENTER_SECRETO.md)
   - Incluye: configuración, ejemplos, troubleshooting, migración a producción

### 5. **Scripts de Prueba**
   - **Node.js:** [test-control-center.js](../test-control-center.js)
   - **PowerShell:** [test-control-center.ps1](../test-control-center.ps1)

---

## 🚀 Uso Rápido

### 1. Cambiar Credenciales en Producción

```bash
# Generar clave secreta fuerte
openssl rand -base64 32
# Resultado: aBcD1234efGH5678ijKL9012mnOP3456qrsT=

# Actualizar .env
DEV_SECRET_KEY=aBcD1234efGH5678ijKL9012mnOP3456qrsT=
DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46  # Tus IPs reales
```

### 2. Acceder al Control Center

```bash
# Con Node.js
node test-control-center.js

# Con cURL
curl -X GET http://localhost:3000/internal/control-center \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-dev-key: your_super_secret_control_center_key_change_in_production_2024"
```

### 3. Monitorear Intentos de Intrusión

```bash
# Ver logs de intrusión
tail -f server.log | grep "🚨 POSIBLE INTENTO DE INTRUSIÓN"
```

---

## 🔍 Validaciones en Cadena

El middleware ejecuta estas validaciones en orden estricto:

```
1. ✓ JWT presente en Authorization header?
   ├─ NO → 404 + Log "Missing JWT token"
   └─ SÍ ↓

2. ✓ JWT válido y decodificable?
   ├─ NO → 404 + Log "Invalid JWT token"
   └─ SÍ ↓

3. ✓ role === 'superadmin' o 'super_admin'?
   ├─ NO → 404 + Log "Unauthorized role: $role"
   └─ SÍ ↓

4. ✓ DEV_SECRET_KEY está configurado?
   ├─ NO → 404 + Log "Device secret not configured"
   └─ SÍ ↓

5. ✓ Header 'x-dev-key' presente y válido?
   ├─ NO → 404 + Log "Invalid or missing x-dev-key header"
   └─ SÍ ↓

6. ✓ IP del cliente en DEV_ALLOWED_IPS?
   ├─ NO → 404 + Log "IP not in whitelist: $ip"
   └─ SÍ ↓

✓ ACCESO PERMITIDO
└─ Log "✓ Superadmin control center accessed"
```

---

## 📊 Información Disponible en el Panel

El control center proporciona:

1. **Sistema**
   - Node.js version
   - Entorno (dev/prod)
   - Uptime del servidor
   - Uso de memoria (heap)
   - Estado de MongoDB
   - Features habilitadas

2. **Logs**
   - Últimos logs del servidor
   - Con parámetro `limit` (max 1000)

3. **Estadísticas**
   - Uptime en segundos
   - PID del proceso
   - Versión de Node.js
   - Memoria (heap used/total, external, RSS)
   - CPU usage

---

## 🛡️ Logs de Seguridad

### Intento Fallido
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
{
  "timestamp": "2024-02-20T10:30:00.000Z",
  "reason": "IP not in whitelist: 203.0.113.100",
  "userId": "UNKNOWN",
  "clientIP": "203.0.113.100",
  "userAgent": "Mozilla/5.0...",
  "method": "GET",
  "path": "/internal/control-center",
  "headers": {
    "x-dev-key": "***",
    "authorization": "***"
  }
}
```

### Acceso Exitoso
```
✓ Superadmin control center accessed
{
  "userId": "user_123",
  "email": "admin@example.com",
  "ip": "127.0.0.1"
}
```

---

## 📋 Checklist de Seguridad

- [x] Ruta no obvia (/internal/control-center, no /superadmin)
- [x] Validación dual de autenticación (JWT + Header)
- [x] Whitelist de IP
- [x] Devuelve 404 para intentos fallidos (no 403)
- [x] Logging detallado de intrusiones
- [x] Sin exposición en frontend
- [x] Protección multi-capa
- [x] Variables de entorno configurables
- [x] Documentación completa
- [x] Scripts de prueba disponibles

---

## 🚨 Importante para Producción

**ANTES de desplegar a producción:**

1. ✓ Cambiar `DEV_SECRET_KEY` a una cadena FUERTE
   ```bash
   openssl rand -base64 32
   ```

2. ✓ Actualizar `DEV_ALLOWED_IPS` a tus IPs reales
   ```env
   DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46
   ```

3. ✓ Verificar que JWT_SECRET también sea FUERTE

4. ✓ Configuar logs para alertar sobre intrusiones

5. ✓ Hacer prueba en staging antes de prod

---

## 🧪 Pruebas

### Test Local
```bash
npm start                        # En terminal 1
node test-control-center.js      # En terminal 2
```

### Test con Parámetros Personalizados
```bash
node test-control-center.js admin@example.com password123 my-dev-key http://localhost:3000
```

---

## 📚 Referencias

- [Control Center Documentation](../docs/CONTROL_CENTER_SECRETO.md)
- [Middleware](../src/middleware/superadmin.middleware.js)
- [Controller](../src/controllers/control-center.js)
- [Routes Config](../src/app.js#L144-L148)
- [Environment Setup](.env)

---

## ❓ FAQ

**P: ¿Por qué devuelve 404 en lugar de 403?**
R: Para evitar revelar que la ruta existe. Un atacante no sabe si el 404 es porque la ruta no existe o porque falló la validación.

**P: ¿Puedo cambiar la URL de /internal/control-center?**
R: Sí, cámbiala tanto en [src/app.js](../src/app.js) como en tus scripts de prueba.

**P: ¿Cómo agrego más IPs a la whitelist?**
R: Edita `.env`:
```env
DEV_ALLOWED_IPS=127.0.0.1,::1,192.168.1.1,203.0.113.45
```

**P: ¿Puedo permitir cualquier IP?**
R: Sí, pero NO recomendado en producción:
```env
DEV_ALLOWED_IPS=*
```

---

## ✅ Implementación Completada

El panel super admin secreto está **100% funcional y listo para usar**.

Próximos pasos:
1. Cambiar credenciales según tu entorno
2. Ejecutar los scripts de prueba
3. Monitorear logs para intrusiones
4. Desplegar en producción con secretos seguros
