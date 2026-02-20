# 🚀 SETUP LOCAL SIN CONFLICTOS

## ✅ Configuración Actual
- **Puerto**: 3000
- **Node**: Requiere 18.0.0+
- **BD**: MongoDB Atlas (ya conectada)
- **Email**: Resend API (ya configurado)

---

## 📋 PASO 1: Verificar Puerto Disponible (IMPORTANTE)

### Windows (PowerShell):
```powershell
netstat -ano | findstr :3000
```
- Si aparece algo → **puerto en uso**, cambiar en `.env`
- Si no aparece → **puerto libre**, continuar

### Si está ocupado, cambia en `.env`:
```dotenv
# Opciones seguras (menos probables que estén en uso):
PORT=3001  # O 3002, 3003, 3004... (elige el primero disponible)
```

---

## 🛠 PASO 2: Instalar Dependencias

```powershell
npm install
```

**Tiempo estimado**: 2-3 minutos

---

## 🔑 PASO 3: Variables de Entorno (YA CONFIGURADAS)

Tu `.env` tiene todo listo:
- ✅ MongoDB Atlas conectada
- ✅ JWT Secret configurado  
- ✅ Resend API configurada
- ✅ Puerto 3000 (o el que cambies)

**No necesitas cambiar nada más a menos que haya conflicto de puerto**

---

## 🎯 PASO 4: Ejecutar Localmente

### Opción A: Ejecución Normal
```powershell
npm start
```

### Opción B: Modo Desarrollo (con reinicio automático)
```powershell
npm run dev
```

### ✅ Si ves esto, funcionó:
```
✓ Servidor corriendo en puerto 3000 (development)
```

---

## 🌐 ACCESO

- **Home**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **API**: http://localhost:3000/api

---

## 🔍 Solución de Problemas

### Error: "Puerto 3000 en uso"
```powershell
# Busca qué proceso usa puerto 3000:
netstat -ano | findstr :3000

# Resultado será algo como: 12345 (el PID)
# Mata el proceso:
taskkill /PID 12345 /F

# O cambia PORT en .env a 3001, 3002, etc.
```

### Error: "MONGO_URL inválida"  
- ✅ Ya está configurada con credenciales válidas
- Si falla: Verifica conexión a Internet

### Error: "Module not found"
```powershell
# Limpia e reinstala:
rm -r node_modules
npm install
```

---

## 📊 Verificar Salud del Servidor

```powershell
# En otra PowerShell:
curl http://localhost:3000/health

# Respuesta esperada:
# {"status":"OK","database":"Conectado",...}
```

---

## 🎓 Consejos para Otros Proyectos

| Proyecto | Puerto Recomendado |
|----------|-------------------|
| Este servidor | 3000 (o cambiar en .env) |
| Frontend React | 3001 |
| Backend 2 | 3002 |
| API 3 | 3003 |
| Socket.io | 3004 |

**Nunca uses los mismos puertos = Sin conflictos**

---

## 📝 Resumen Rápido

```powershell
# 1. Verificar puerto libre
netstat -ano | findstr :3000

# 2. Instalar (si no hecho)
npm install

# 3. Ejecutar
npm start

# 4. Abrir en navegador
# http://localhost:3000
```

✅ **Listo para desarrollo local sin conflictos**
