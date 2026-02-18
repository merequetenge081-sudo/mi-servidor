# 🚀 Deployment en Render

## Pasos para Render

### 1. Conectar repositorio Git
- Push tu código a GitHub
- En Render.com, click en "New +" → "Web Service"
- Conecta tu repositorio GitHub
- Selecciona la rama main

### 2. Configuración en Render
- **Name**: mi-servidor
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Region**: Elegir cercano a tu audiencia

### 3. Variables de Entorno
En Render Dashboard, agregar:

```
NODE_ENV=production
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/mi-servidor
JWT_SECRET=tu-clave-super-secreta-minimo-32-caracteres
LOG_LEVEL=info
API_URL=https://tu-dominio.onrender.com
```

⚠️ **CRÍTICO**: 
- JWT_SECRET debe tener mínimo 32 caracteres
- Usar caracteres especiales, números y letras
- Cambiar para cada entorno

### 4. Database (MongoDB Atlas)
1. Crear cuenta en mongodb.com
2. Crear cluster (Free tier disponible)
3. Obtener connection string
4. Agregar IP 0.0.0.0/0 en Network Access (Render usa IPs dinámicas)
5. Copiar connection string a MONGO_URL

### 5. Verificar Deploy
```bash
# Después del deploy:
curl https://tu-dominio.onrender.com/health
# Debe devolver: {"status":"ok","timestamp":"..."}
```

### 6. Logs
- En Render Dashboard → Logs
- Ver errors y warnings en tiempo real

## Seguridad

✅ Checklist pre-producción:
- [x] JWT_SECRET configurado (32+ caracteres)
- [x] MONGO_URL apunta a MongoDB Atlas
- [x] NODE_ENV=production
- [x] Helmet habilitado (CORS headers)
- [x] Rate limiting activo (200 req/15min)
- [x] Compression activo
- [x] Logging en winston
- [x] Error handling global
- [x] XSS protection
- [x] HPP protection

## Monitoreo

- Logs disponibles en Render Dashboard
- Alertas personalizables por email
- Metrics CPU y Memory
- Build logs automáticos

## Rollback

Si necesitas volver a versión anterior:
- Render mantiene historial de builds
- Click en versión anterior en "Deployments"
- Redeploy en 1 click
