# 📧 Configuración de BASE_URL para Correos

## Objetivo
Los correos que se envían a los líderes (QR, bienvenida, credenciales, contraseñas) ahora incluyen el enlace correcto a la página del formulario de registro.

## Cambios Realizados ✅

### 1. **emailService.js** - Métodos actualizados:
   - ✅ `sendAccessEmail(leader, baseUrl)` - Ya tenía baseUrl
   - ✅ `sendWelcomeEmail(leader, baseUrl)` - Ya tenía baseUrl  
   - ✅ `sendCredentialsEmail(leader, baseUrl)` - **ACTUALIZADO** para recibir baseUrl
   - ✅ `sendQRCodeEmail(leader, baseUrl)` - Ya tenía baseUrl
   - ✅ `sendTemporaryPasswordEmail(leader, tempPassword, baseUrl)` - **ACTUALIZADO** para recibir baseUrl

### 2. **leaders.controller.js** - Línea 560:
   ```javascript
   // ANTES:
   emailResults.credentials = await emailService.sendCredentialsEmail(leader);
   
   // DESPUÉS:
   emailResults.credentials = await emailService.sendCredentialsEmail(leader, baseUrl);
   ```

### 3. **auth.js** - Dos métodos actualizados:
   - `adminResetPassword()` - Línea 240
   - `requestPasswordReset()` - Línea 384

## Configuración Requerida

### Opción 1: Producción (Render)
1. Edita `.env`:
   ```env
   BASE_URL=https://midominio.com
   ```
   Reemplaza `https://midominio.com` con tu URL real:
   - Ejemplo: `https://mi-servidor-production.onrender.com`
   - Ejemplo: `https://redsociaypolitica.fulars.com`

2. Edita `render.yaml`:
   ```yaml
   - key: BASE_URL
     value: https://midominio.com
   ```
   Reemplaza con la misma URL que en `.env`

### Opción 2: Desarrollo Local
```env
BASE_URL=http://localhost:3000
```

### Opción 3: Automático (Fallback)
Si `BASE_URL` no está configurado, el sistema usará automáticamente:
- `FRONTEND_URL` si está disponible
- O construirá la URL a partir del request: `${req.protocol}://${req.get('host')}`
- O fallback a: `https://redsociaypolitica.fulars.com`

## Dónde Se Usan Los Enlaces

### 1. **QR Code Email** 📱
   - **Endpoint**: `/api/leaders/:id/send-access` con `sendQRCodeEmail: true`
   - **Enlace en correo**: `${BASE_URL}/form.html?token=${leader.token}`
   - **Método**: `emailService.sendQRCodeEmail(leader, baseUrl)`

### 2. **Welcome Email** 👋
   - **Endpoint**: `/api/leaders/:id/send-access` con `sendWelcomeEmail: true`
   - **Enlace en correo**: `${BASE_URL}/` (página de inicio)
   - **Método**: `emailService.sendWelcomeEmail(leader, baseUrl)`

### 3. **Credentials Email** 🔑
   - **Endpoint**: `/api/leaders/:id/send-access` con `sendCredentialsEmail: true`
   - **Enlace en correo**: `${BASE_URL}/` (página de inicio)
   - **Método**: `emailService.sendCredentialsEmail(leader, baseUrl)` [ACTUALIZADO]

### 4. **Temporary Password Email** 🔐
   - **Endpoint**: `/api/auth/admin-reset-password` o `/api/auth/request-password-reset`
   - **Enlace en correo**: `${BASE_URL}/` (página de inicio)
   - **Método**: `emailService.sendTemporaryPasswordEmail(leader, tempPassword, baseUrl)` [ACTUALIZADO]

## Verificación ✅

Para verificar que los enlaces se envían correctamente:

1. **Abre el navegador**
2. **Ve a la sección Líderes** en el dashboard
3. **Selecciona un líder** y haz clic en "..." (tres puntos)
4. **Elige una opción de envío**:
   - "Enviar QR"
   - "Enviar Credenciales"
   - "Enviar Contraseña Temporal"
5. **Revisa el correo** y verifica que contiene:
   - ✅ Botón "Ir al Formulario" con enlace a `/form.html?token=...`
   - ✅ URL copiable con el enlace base correcta
   - ✅ Código QR con el enlace correcto

## Ejemplo de Enlace Esperado

Si `BASE_URL=https://redsociaypolitica.fulars.com`, el enlace del QR debería ser:

```
https://redsociaypolitica.fulars.com/form.html?token=abc123def456...
```

## Notas 📝

- Los correos están en modo **MOCK** si `RESEND_API_KEY` no está configurada correctamente
- Los enlaces **no dependen** de si RESEND está activo o en mock - se generan igual
- El sistema ahora es **consistente**: todos los métodos de email reciben `baseUrl` como parámetro
- **Fallback automático**: Si no hay `BASE_URL`, usa la URL del request
