# 📌 QUICK START - Control Center Secreto

## 1️⃣ Verificar Configuración (2 minutos)

```bash
# Abrir .env y verificar:
DEV_SECRET_KEY=your_super_secret_control_center_key_change_in_production_2024
DEV_ALLOWED_IPS=127.0.0.1,::1
```

## 2️⃣ Iniciar Servidor (30 segundos)

```bash
npm start
# o
node server.js
```

## 3️⃣ Ejecutar Prueba (30 segundos)

```bash
node test-control-center.js
```

✓ Deberías ver:
- ✓ Login exitoso
- ✓ Acceso exitoso al Control Center
- ✓ Logs obtenidos
- ✓ Estadísticas obtenidas

---

## 4️⃣ Acceder Manualmente

```bash
# 1. Obtener token (desde login)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Hacer request
curl -X GET http://localhost:3000/internal/control-center \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-dev-key: your_super_secret_control_center_key_change_in_production_2024"

# 3. Respuesta 200 OK con JSON
{
  "status": "authorized",
  "accessedBy": {...},
  "system": {...}
}
```

---

## 5️⃣ Para Producción

```bash
# Generar clave fuerte
openssl rand -base64 32

# Resultado: aBcD1234efGH5678ijKL9012mnOP3456qrsT=

# Actualizar en .env:
DEV_SECRET_KEY=aBcD1234efGH5678ijKL9012mnOP3456qrsT=
DEV_ALLOWED_IPS=203.0.113.45,203.0.113.46
```

---

## 📄 URLs Disponibles

```
GET /internal/control-center
  → Panel con info del sistema

GET /internal/control-center/logs?limit=100
  → Últimos 100 logs

GET /internal/control-center/stats
  → Estadísticas en tiempo real
```

---

## 🔍 Verificar Logs

```bash
# Ver todos los accesos y intentos fallidos
tail -f server.log | grep -E "control center|INTRUSIÓN"

# Solo intrusiones
tail -f server.log | grep "🚨 POSIBLE INTENTO"

# Solo accesos exitosos
tail -f server.log | grep "✓ Superadmin"
```

---

## 📝 Archivos Importantes

- **Middleware:**        `src/middleware/superadmin.middleware.js`
- **Controlador:**       `src/controllers/control-center.js`
- **Rutas:**             `src/app.js` (líneas 144-148)
- **Config:**            `.env`
- **Test:**              `node test-control-center.js`
- **Docs:**              `docs/CONTROL_CENTER_SECRETO.md`

---

## ✅ Checklist

- [ ] .env actualizado con DEV_SECRET_KEY
- [ ] .env actualizado con DEV_ALLOWED_IPS
- [ ] Servidor iniciado (`npm start`)
- [ ] Test ejecutado exitosamente (`node test-control-center.js`)
- [ ] Logs verificados (`tail -f server.log`)
- [ ] IP whitelist configurada para producción
- [ ] Clave secreta actualizada para producción

---

¿Problemas? → Ver `docs/CONTROL_CENTER_SECRETO.md`
