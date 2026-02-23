# 📧 Configuración de Emails en Render

## Estado Actual
- ✅ **Local**: Emails funcionales con Resend API
- ❌ **Render**: Modo MOCK (RESEND_API_KEY no configurada)

## Problema
El servidor está funcionando en modo MOCK de emails en Render porque:
1. `RESEND_API_KEY` no está establecida en environment variables
2. Sin la clave, todos los emails se registran como simulados

## Solución: Configurar Resend en Render

### Paso 1: Obtener API Key de Resend
1. Ir a https://resend.com
2. Crear cuenta o iniciar sesión
3. Ir a **Settings → API Keys**
4. Crear nueva API Key (o copiar existente)
5. Copiar la clave (formato: `re_...`)

### Paso 2: Configurar en Render Dashboard
1. Acceder a https://dashboard.render.com
2. Seleccionar el servicio/web service
3. Ir a **Environment** → **Environment Variables**
4. Agregar nueva variable:
   ```
   RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxxx
   ```
5. Hacer click en **Save Changes**
6. El servicio se reiniciará automáticamente

### Paso 3: Verificar Configuración
Realiza una acción que envíe email (ej: crear líder):
- Revisar logs en Render Dashboard
- Buscar "✅ Email enviado" en los logs
- O "📧 [MOCK]" si aún está en modo mock

## Alternativa: SMTP de Hostinger (Backup)
Si prefieres usar SMTP de Hostinger en lugar de Resend:

```javascript
// Configurar en .env
SMTP_HOST = mail.fulars.com
SMTP_PORT = 587
SMTP_USER = redsp@fulars.com
SMTP_PASS = xxxxxxxxxxxxx
EMAIL_FROM = redsp@fulars.com
```

Luego modificar `emailService.js` para usar nodemailer:
```javascript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
```

## Variables de Entorno Requeridas en Render

| Variable | Valor | Obligatorio |
|----------|-------|------------|
| `RESEND_API_KEY` | `re_...` | ✅ Sí (para enviar emails) |
| `EMAIL_FROM` | `redsp@fulars.com` | ✅ Sí |
| `BASE_URL` | `https://redsocialypolitica.fulars.com` | ✅ Sí |
| `MONGODB_URI` | URL Atlas | ✅ Sí |
| `NODE_ENV` | `production` | ✅ Sí |
| `JWT_SECRET` | Secret key | ✅ Sí |
| `FORCE_EMAIL_MOCK` | `false` | ⚠️ Si está `true`, fuerza mock |

## Prueba de Email

### Local (npm start)
```bash
npm run test-email
```

### En Producción (Render)
Crear un líder desde el panel administrativo y verificar que reciba el email de acceso con su enlace personalizado.

## Logs para Monitorear

### Modo funcionando (producción)
```
✅ Email enviado a redsp@fulars.com - Tu enlace personalizado de registro (ID: 123abc)
```

### Modo mock (fallback seguro)
```
📧 [MOCK] Email a redsp@fulars.com - Tu enlace personalizado
```

### Error
```
❌ Error Resend: Invalid API key
```

## Soporte

Si los emails no funcionan:
1. ✅ Verificar `RESEND_API_KEY` esté configurada en Render
2. ✅ Verificar que la clave no sea una clave de prueba (`placeholder_...`)
3. ✅ Revisar logs de Render: Dashboard → Web Service → Logs
4. ✅ Comprobar `FORCE_EMAIL_MOCK` no esté en `true`
5. ✅ Reiniciar el web service en Render después de cambiar variables

---
**Actualización**: Configuración automática en Render completada ✅
