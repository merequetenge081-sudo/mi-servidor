# 🚀 QUICK START - Sistema Funcional

## ✅ Estado Actual

**EL SISTEMA ESTÁ COMPLETAMENTE FUNCIONAL**

- ✅ Server corriendo en puerto 5000
- ✅ Login admin funcionando
- ✅ Login líder funcionando  
- ✅ Autenticación con fallback en memoria
- ✅ Sin depender de MongoDB

---

## 🔐 Credenciales de Prueba

### Admin
```
Usuario: admin
Contraseña: admin123
```

### Líderes
```
Email: lider@example.com
Contraseña: leader123

Email: lider2@example.com
Contraseña: leader123
```

---

## 🎯 Cómo Acceder

### 1. Iniciar Servidor
```bash
npm start
```

### 2. Abrir en Navegador
```
http://localhost:5000
```

### 3. Ingresar Credenciales
- **Usuario**: admin
- **Contraseña**: admin123

### 4. Hacer Click en "Ingresar"

---

## 🧪 Via Terminal (curl/PowerShell)

### Obtener Token Admin
```powershell
$headers = @{"Content-Type"="application/json"}
$body = '{"username":"admin","password":"admin123"}'
$response = Invoke-WebRequest -Uri http://localhost:5000/api/auth/admin-login `
  -Method POST -Headers $headers -Body $body -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
Write-Host "Token: $($json.token)"
```

### Obtener Token Líder
```powershell
$headers = @{"Content-Type"="application/json"}
$body = '{"email":"lider@example.com","password":"leader123"}'
$response = Invoke-WebRequest -Uri http://localhost:5000/api/auth/leader-login `
  -Method POST -Headers $headers -Body $body -UseBasicParsing
$json = $response.Content | ConvertFrom-Json
Write-Host "Token: $($json.token)"
```

### Ver Credenciales de Prueba
```powershell
Invoke-WebRequest http://localhost:5000/api/test-credentials -UseBasicParsing | 
  Select-Object -ExpandProperty Content
```

---

## 📊 Endpoints Disponibles

| Método | URL | Descripción | Autenticación |
|--------|-----|----|---|
| GET | `/` | Login Page | No |
| GET | `/form` | Formulario Público | No |
| GET | `/api/health` | Health Check | No |
| GET | `/api/test-credentials` | Ver credenciales de prueba | No |
| POST | `/api/auth/admin-login` | Login Admin | No |
| POST | `/api/auth/leader-login` | Login Líder | No |
| POST | `/api/migrate` | Migrar data.json a MongoDB | No |

---

## 🔍 Cómo Saber si Funciona

### ✅ Si ves esto es que FUNCIONA:

1. **Servidor corriendo**
   ```
   ✓ Servidor corriendo en puerto 5000 (development)
   ```

2. **Login exitoso**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "source": "memory"
   }
   ```

3. **Página de login carga**
   - Formulario con Usuario y Contraseña
   - Botón "Ingresar"

---

## ⚠️ Notas Importantes

1. **MongoDB No Requerido**
   - Sistema funciona completamente sin MongoDB
   - Fallback automático a memoria
   - Logs indican si es "memory" o "mongodb"

2. **Credenciales Seguras**
   - Las contraseñas están hasheadas con bcryptjs
   - JWT tiene 12 horas de expiración
   - JWT_SECRET configurado (32+ caracteres)

3. **Solo Desarrollo**
   - `/api/test-credentials` solo disponible si NODE_ENV=development
   - Fallback en memoria solo para desarrollo

---

## 📝 Logs para Debugging

Si ves en los logs:
```
✅ Admin login exitoso [memory]
```
→ Login correcto usando datos en memoria

Si ves:
```
✅ Admin login exitoso [mongodb]
```
→ Login correcto usando MongoDB

Si ves:
```
MongoDB no disponible para auth, usando fallback en memoria
```
→ Normal - MongoDB no conectó, usando fallback automático

---

## 🔄 Migra a MongoDB Cuando Esté Listo

Cuando tengas credenciales de MongoDB:

1. **Actualizar .env**
   ```
   MONGO_URL=mongodb+srv://user:pass@host/db
   ```

2. **Ejecutar migración**
   ```bash
   curl -X POST http://localhost:5000/api/migrate
   ```

3. **Crear admins en MongoDB**
   ```bash
   node create_admin.js
   ```

4. **Reiniciar servidor**
   ```
   npm start
   ```

El sistema seguirá funcionando, pero ahora con MongoDB como base de datos principal.

---

## ❌ Si NO funciona

### Problema: "Cannot POST /api/auth/admin-login"
**Solución**: Asegúrate que el servidor está corriendo:
```bash
npm start
```

### Problema: "Credenciales inválidas"
**Solución**: Revisa que estés usando LAS CREDENCIALES EXACTAS (es case-sensitive):
- Usuario: `admin` (minúscula)
- Contraseña: `admin123` (sin espacios)

### Problema: "Puerto 5000 está en uso"
**Solución**: Mata los procesos node:
```powershell
Get-Process node | Stop-Process -Force
```

### Problema: "Timeout al hacer login"
**Solución**: Es normal si MongoDB está siendo consultado pero falla. El sistema debería responder en 20 segundos (usa el fallback en memoria).

---

## 📞 Información del Sistema

- **Puerto**: 5000
- **Node Version**: 18+ (requiere ES modules)
- **Dependencias Clave**: Express, Mongoose, JWT, bcrypt
- **Base de Datos**: MongoDB Atlas (opcional, fallback en memoria)
- **Entorno Desarrollo**: NODE_ENV=development

---

**¡Sistema listo para usar! 🎉**
