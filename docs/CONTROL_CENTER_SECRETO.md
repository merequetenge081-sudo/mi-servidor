# Control Center Secreto - Documentación

## Descripción General

El **Control Center Secreto** es un panel de control ultra-restringido para superadmins, completamente oculto en el frontend. Solo es accesible mediante:

1. **JWT válido** con `role === 'superadmin'`
2. **Header `x-dev-key`** coincidiendo con `DEV_SECRET_KEY`
3. **IP en whitelist** de `DEV_ALLOWED_IPS`

Si CUALQUIERA de estas validaciones falla, la ruta devuelve **404 (not found)** y loggea un intento de intrusión.

---

## Endpoints Disponibles

### 1. `GET /internal/control-center`
Panel principal de control con información del sistema.

**Headers requeridos:**
```
Authorization: Bearer <JWT_TOKEN>
x-dev-key: <DEV_SECRET_KEY>
```

**Respuesta exitosa (200):**
```json
{
  "status": "authorized",
  "accessedBy": {
    "userId": "user_id",
    "email": "admin@example.com",
    "role": "superadmin"
  },
  "accessIP": "127.0.0.1",
  "system": {
    "timestamp": "2024-02-20T10:30:00Z",
    "nodeVersion": "v18.0.0",
    "environment": "development",
    "uptime": 3600,
    "memoryUsage": {
      "heapUsed": "50MB",
      "heapTotal": "100MB",
      "external": "5MB"
    },
    "mongodb": {
      "url": "✓ Configured"
    },
    "features": {
      "jwt": "✓ Enabled",
      "devMode": "✓ Enabled",
      "emailService": "✓ Configured"
    }
  },
  "actions": [...]
}
```

### 2. `GET /internal/control-center/logs`
Obtener logs recientes del servidor.

**Query parameters (opcional):**
- `limit` (default: 100, max: 1000) - Número de logs a devolver

### 3. `GET /internal/control-center/stats`
Obtener estadísticas de sistema en tiempo real.

---

## Configuración

### Variables de Entorno Requeridas

En el archivo `.env`:

```env
# Clave secreta para acceder al control center
# IMPORTANTE: Cambiar a una cadena FUERTE en producción
DEV_SECRET_KEY=your_super_secret_control_center_key_change_in_production_2024

# IPs permitidas (separadas por comas)
# - "127.0.0.1" = localhost IPv4
# - "::1" = localhost IPv6
# - "*" = cualquier IP (NO recomendado en producción)
DEV_ALLOWED_IPS=127.0.0.1,::1
```

### Cambios por Entorno

**Desarrollo:**
```env
DEV_SECRET_KEY=dev_key_12345
DEV_ALLOWED_IPS=127.0.0.1,::1,192.168.1.1
```

**Producción:**
```env
DEV_SECRET_KEY=$(openssl rand -base64 32)  # Generar aleatoriamente
DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46  # Solo IPs específicas de tu equipo/VPN
```

---

## Seguridad

### Validaciones en Cadena

El middleware `superadminSecretMiddleware` realiza estas validaciones en orden:

1. ✓ JWT presente y válido
2. ✓ `decoded.role === 'superadmin'` o `'super_admin'`
3. ✓ Header `x-dev-key` presente y coincide con `DEV_SECRET_KEY`
4. ✓ IP del cliente en `DEV_ALLOWED_IPS`

Si ALGUNA falla:
- **Respuesta:** `404 Not Found` (simula que la ruta no existe)
- **Log:** Intento de intrusión registrado con detalles completos

### Información Registrada en Intentos Fallidos

Todos los intentos fallidos se loggean con:
- Timestamp exacto
- Razón de fallo (JWT inválido, rol incorrecto, IP rechazada, etc.)
- Usuario ID (si disponible)
- IP del cliente
- User-Agent
- Headers (enmascarados por seguridad: `***`)

Ejemplo de log de intrusión:
```
🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER
{
  "timestamp": "2024-02-20T10:30:00Z",
  "reason": "IP not in whitelist: 203.0.113.100",
  "userId": "UNKNOWN",
  "clientIP": "203.0.113.100",
  "userAgent": "Mozilla/5.0...",
  "method": "GET",
  "path": "/internal/control-center"
}
```

---

## Ejemplo de Uso (cURL)

### 1. Obtener token JWT de superadmin

```bash
# Primero, login como superadmin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin_password"
  }'

# Respuesta incluye el JWT token
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   ...
# }
```

### 2. Acceder al Control Center con el token

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
DEV_KEY="your_super_secret_control_center_key_change_in_production_2024"

curl -X GET http://localhost:3000/internal/control-center \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-dev-key: $DEV_KEY"
```

### 3. Ejemplo en Node.js

```javascript
async function accessControlCenter(jwtToken, devKey) {
  const response = await fetch("http://localhost:3000/internal/control-center", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${jwtToken}`,
      "x-dev-key": devKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Error: ${response.status}`);
    return null;
  }

  return await response.json();
}

const result = await accessControlCenter(token, process.env.DEV_SECRET_KEY);
console.log(result);
```

---

## Monitoreo y Alertas

### Logs a Monitorear

1. **Intentos fallidos** - Buscar `"🚨 POSIBLE INTENTO DE INTRUSIÓN"`
2. **Accesos exitosos** - Buscar `"✓ Superadmin control center accessed"`
3. **Accesos a logs/stats** - Buscar `"Control center logs accessed"` o `"Control center stats accessed"`

### Configurar Alertas (Recomendado)

En producción, configurar alertas para:
- Cualquier intento fallido en `/internal/control-center`
- Múltiples intentos fallidos desde la misma IP en 1 hora
- Acceso exitoso fuera de horarios esperados

---

## Migración de Entorno

### De Desarrollo a Producción

1. **Generar nuevas credenciales:**
   ```bash
   # Clave secreta aleatoria (32 bytes en base64)
   openssl rand -base64 32
   
   # Resultado: algo como "aBcD1234efGH5678ijKL9012mnOP3456qrsT="
   ```

2. **Actualizar `.env` en producción:**
   ```env
   DEV_SECRET_KEY=aBcD1234efGH5678ijKL9012mnOP3456qrsT=
   DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46
   ```

3. **Verificar acceso:**
   ```bash
   curl -X GET https://api.example.com/internal/control-center \
     -H "Authorization: Bearer $TOKEN" \
     -H "x-dev-key: $DEV_SECRET_KEY"
   ```

---

## Troubleshooting

### Respuesta 404 pero deberías tener acceso

**Checklist:**
1. ¿JWT es válido? → Verifica que no haya expirado
2. ¿Role es 'superadmin'? → Verifica en el JWT decodificado
3. ¿Header x-dev-key presente? → Revisa capitalización exacta
4. ¿Valor de x-dev-key correcto? → Debe coincidir exactamente con `DEV_SECRET_KEY`
5. ¿Tu IP está en whitelist? → Revisa `DEV_ALLOWED_IPS`

**Para debug:**
```bash
# Decodificar JWT (sin validar)
echo $TOKEN | cut -d. -f2 | base64 -d | jq .

# Ver tu IP
curl https://api.ipify.org

# Ver logs detallados
tail -f server.log | grep "INTRUSIÓN\|control center"
```

### No veo logs de intrusión

Verifica que:
- El logger está configurado correctamente
- El nivel de log es "warn" o más permisivo
- El archivo de logs se está escribiendo en la ruta correcta

---

## Referencias

- Middleware: `/src/middleware/superadmin.middleware.js`
- Controlador: `/src/controllers/control-center.js`
- Config: `/src/app.js` (línea con importaciones y rutas)
- Env vars: `.env` (DEV_SECRET_KEY, DEV_ALLOWED_IPS)
