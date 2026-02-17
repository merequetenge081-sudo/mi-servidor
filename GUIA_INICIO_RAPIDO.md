# 🚀 GUÍA DE INICIO RÁPIDO - Sistema de Registro

## ✅ Lo que se ha hecho

1. **✅ Interfaz de Login Modernizada**
   - Diseño más pulido y profesional
   - Animaciones suaves y transiciones
   - Modo Admin y Líder con credenciales claras
   - Iconos mejores (Font Awesome)

2. **✅ Rutas HTML Configuradas**
   - `/` → Login.html
   - `/app` → Dashboard Admin
   - `/leader` → Panel del Líder  
   - `/form` → Formulario Público
   - `/registration/:token` → Formulario con token del líder

3. **✅ Migración de Datos JSON → MongoDB**
   - Endpoint: `POST /api/migrate`
   - Migra automáticamente líderes y registros
   - Crea organización por defecto si no existe
   - Evita duplicados

4. **✅ Estructura Modular Completa**
   - Controladores, modelos, rutas organizadas
   - Middlewares de seguridad
   - Autenticación JWT
   - Auditoría de acciones

---

## 🔧 PASOS PARA PONER EN FUNCIONAMIENTO

### Paso 1: Asegurar que MongoDB está corriendo
```powershell
# Verificar estado de MongoDB
mongo --version

# Si MongoDB Atlas ya está configurado en .env, saltarse este paso
# Si necesita MongoDB local:
mongod
```

### Paso 2: Instalar dependencias (si no está hecho)
```powershell
cd c:\Users\Janus\Desktop\mi-servidor
npm install
```

### Paso 3: Matar cualquier proceso en el puerto 5000
```powershell
Get-Process | Where-Object {$_.Port -eq 5000} | Stop-Process -Force
# O si ese comando no funciona:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Paso 4: Iniciar el servidor
```powershell
npm start
```

Debería ver algo como:
```
✓ Servidor corriendo en puerto 5000
✓ Conectado a MongoDB
```

### Paso 5: Migrar datos de data.json a MongoDB
```powershell
# Abrir otra terminal PowerShell y ejecutar:
curl -X POST http://localhost:5000/api/migrate `
  -ContentType application/json `
  -Body @{clean=$true} | ConvertTo-Json
```

O usar Postman:
- **URL**: `POST http://localhost:5000/api/migrate`
- **Body (JSON)**: `{"clean": true}`

Debería responder:
```json
{
  "success": true,
  "message": "Migración completada exitosamente",
  "stats": {
    "leadersCreated": 4,
    "registrationsCreated": 1,
    "organizationId": "..."
  }
}
```

---

## 📧 ACCEDER AL SISTEMA

### Admin
- **URL**: http://localhost:5000/login
- **Usuario**: admin
- **Contraseña**: admin123
- **Acceso**: Panel completo, líderes, registros, estadísticas

### Líder
- **URL**: http://localhost:5000/login
- **ID**: (Use uno de los IDs que salieron en la migración)
- **Acceso**: Ver y editar sus propios registros

### Formulario Público
- **URL**: http://localhost:5000/form
- Los registros se enviaran sin token

---

## 🔗 ENDPOINTS PRINCIPALES

| Método | URL | Descripción |
|--------|-----|-------------|
| POST | `/api/auth/admin-login` | Login admin |
| POST | `/api/auth/leader-login-id` | Login líder |
| POST | `/api/migrate` | Migrar datos |
| GET | `/api/leaders` | Obtener líderes |
| GET | `/api/registrations` | Ver registros |
| POST | `/api/registrations` | Crear registro |
| PUT | `/api/registrations/:id` | Editar registro |
| GET | `/api/health` | Health check |

---

## 📝 NOTAS IMPORTANTES

1. **JWT_SECRET**: Ya está configurado en `.env` para desarrollo
2. **MONGO_URL**: Usa MongoDB Atlas (nube) - no necesita instalación local
3. **Base de datos**: `seguimiento-datos` en MongoDB Atlas
4. **Puerto**: 5000 (configurar en `.env` si necesita cambiar)
5. **Ambiente**: `NODE_ENV=development` (cambiar a `production` si es necesario)

---

## 🛠️ TROUBLESHOOTING

### Error: "address already in use 0.0.0.0:5000"
```powershell
# Encontrar proceso usando puerto 5000
Get-NetTCPConnection -LocalPort 5000

# Matar el proceso
taskkill /PID <PID> /F
```

### Error: "connect ECONNREFUSED MongoDB"
- Verificar que MONGO_URL en `.env` sea correcto
- Verificar credenciales de MongoDB Atlas
- Comprobar conexión a internet

### Error: "JWT_SECRET is required"
- Asegurar que `.env` tiene `JWT_SECRET=...`
- Debe tener mínimo 32 caracteres
- Reiniciar el servidor después de cambiar `.env`

---

## 📊 ESTRUCTURA DE DATOS

### Líder (migrado)
```json
{
  "_id": "ObjectId",
  "leaderId": "string",
  "name": "Jonnathan Peña",
  "email": "jonatanyhelen@hotmail.com",
  "phone": "+573203725182",
  "area": "Toluca",
  "token": "leader-xxx",
  "active": true,
  "registrations": 1,
  "organizationId": "ObjectId"
}
```

### Registro (migrado)
```json
{
  "_id": "ObjectId",
  "leaderId": "ObjectId",
  "firstName": "Jonnathan",
  "lastName": "Peña",
  "cedula": "1000953821",
  "email": "jonatanyhelen@hotmail.com",
  "phone": "+573203725182",
  "date": "2025-11-04",
  "confirmed": false,
  "organizationId": "ObjectId"
}
```

---

## ✨ PRÓXIMOS PASOS OPCIONALES

- [ ] Crear más líderes via admin panel
- [ ] Configurar WhatsApp Bot
- [ ] Agregar más eventos
- [ ] Personalizar emails
- [ ] Exportar reportes
- [ ] Configurar SMS con Twilio

---

## 📞 SOPORTE

Si tiene problemas:
1. Revisar la consola del servidor (localhost:5000)
2. Verificar archivos log en `logs/`
3. Revisar `.env` está correctamente configurado
4. Asegurar MongoDB está en línea

¡Sistema listo para usar! 🎉
