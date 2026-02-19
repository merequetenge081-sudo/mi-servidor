# 📧 Servicio de Email - Enlace Personalizado y QR

## 🎯 Descripción

Sistema para enviar al líder su enlace personalizado de registro junto con un código QR, permitiendo que los acudir directamente al formulario de registro sin necesidad de copiar enlaces.

## 🚀 Características

✅ **QR Dinámico**: Generación en tiempo real del código QR desde el enlace personalizado
✅ **Template Profesional**: Email con diseño SaaS moderno y responsivo
✅ **Modo MOCK**: Desarrollo seguro sin credenciales válidas (muestra en consola)
✅ **Auditoría**: Registro de todos los envíos de email
✅ **Soporte Email**: Tanto Nodemailer (SMTP) como servicios como Resend
✅ **Multi-tenant**: Compatible con la arquitectura de organizaciones

## 📋 Flujo

```
Admin → POST /api/leaders/:id/send-access
    ↓
Buscar líder en BD
    ↓
Generar URL: https://dominio.com/form.html?token=TOKEN
    ↓
Generar QR desde URL
    ↓
Ensamblar HTML del email
    ↓
Enviar (o simular en MOCK)
    ↓
Registrar en auditoría
    ↓
Responder con { success: true }
```

## 🔧 Configuración

### Variables de Entorno (.env)

```dotenv
# SMTP Configuration (Hostinger)
SMTP_HOST=smtp.hostinger.com              # Host SMTP (default: smtp.hostinger.com)
SMTP_PORT=465                              # Puerto SMTP (default: 465)
EMAIL_USER=tu_email@tudominio.com          # Usuario del correo
EMAIL_PASS=tu_contraseña_segura            # Contraseña del correo
NODE_ENV=development                       # Desarrollo usa MOCK, production envía real

# URLs
BASE_URL=https://midominio.com             # Dominio donde está alojado (REQUERIDO)
FRONTEND_URL=https://midominio.com         # URL del frontend
```

### Configuración por Ambiente

**Desarrollo (NODE_ENV=development)**
- ✅ Modo MOCK activo automáticamente
- Los emails se muestran en la consola del servidor
- No necesita credenciales válidas

**Producción (NODE_ENV=production)**
- ✅ Envío real de emails via SMTP
- Requiere EMAIL_USER y EMAIL_PASS válidos
- Requiere BASE_URL configurado
- Puerto 465 usa SSL automáticamente

### Para Hostinger

Si usas hosting de Hostinger:

1. **Configuración SMTP**:
   - Host: `smtp.hostinger.com`
   - Puerto: `465` (SSL) o `587` (TLS)
   - Autenticación: Tu email y contraseña del cPanel

2. **Variables en .env**:
   ```dotenv
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   EMAIL_USER=tu-email@tudominio.com
   EMAIL_PASS=tu-contraseña-cpanel
   ```

3. **Verificar dominio**: Asegúrate que el email tenga el dominio configurado en tu hosting

## 📡 API Endpoint

### POST /api/leaders/:id/send-access

Envía un email al líder con su enlace personalizado y QR.

**Autenticación**: Bearer Token (Admin)

**Parámetros**:
- `:id` - ID del líder en MongoDB

**Respuesta (200 OK)**:
```json
{
  "success": true,
  "message": "Email enviado correctamente a email@example.com",
  "messageId": "optional-message-id",
  "mock": false
}
```

**En Desarrollo (MOCK)**:
```json
{
  "success": true,
  "message": "Email enviado correctamente a email@example.com",
  "mock": true
}
```

**Errores**:
```json
{
  "error": "Líder no encontrado"
}
```

## 📧 HTML del Email

El email incluye:

- **Header Profesional**: Gradiente morado con "¡Bienvenido!"
- **Saludo Personalizado**: "Hola {nombre},"
- **CTA Button**: Botón directo al formulario
- **QR Code**: Incrustado como imagen Base64
- **Backup Link**: URL explicita para copiar
- **Tips**: Consejos sobre uso del sistema
- **Footer**: Contacto de soporte

**Características HTML**:
- Responsive (móvil/desktop)
- Colores consistentes con marca (gradiente #667eea → #764ba2)
- Tipografía profesional
- Sombras y espaciado SaaS-estilo

## 🧪 Testear Localmente

```bash
# 1. Iniciar servidor
npm start

# 2. En otra terminal, ejecutar test
node test-send-access-email.js
```

**Output esperado**:
```
✓ Autenticado correctamente
✓ Encontrados 44 líderes
✓ Email enviado correctamente!
  📝 Nota: Modo MOCK (desarrollo)
```

## 🔒 Seguridad

- ✅ Autenticación JWT obligatoria
- ✅ Solo admins pueden enviar emails
- ✅ Token del líder generado automáticamente
- ✅ URL con token único + 32 caracteres hexadecimales
- ✅ Auditoría de todos los envíos
- ✅ Validación de email antes de enviar
- ✅ Rate limiting en endpoints API

## 📊 Auditoría

Cada envío se registra en `audit_logs`:

```javascript
{
  action: "SEND_ACCESS_EMAIL",
  actor: "USER_ID",
  target: "Leader",
  targetId: "LEADER_ID",
  details: {
    leaderEmail: "email@example.com",
    leaderName: "Nombre Líder",
    mock: true/false
  },
  timestamp: "2026-02-19T10:00:00Z"
}
```

## 🎨 Customización

### Cambiar Email de Remitente

En `src/services/emailService.js`:
```javascript
from: 'soporte@tudominio.com'  // Cambiar aquí
```

### Cambiar Template HTML

Modificar la función `generateEmailHTML()` en `emailService.js`

### Cambiar Colores

Buscar `#667eea` y `#764ba2` en el HTML y reemplazar

## 🚀 Producción

### Configuración

1. **Usar credenciales reales**:
   ```dotenv
   NODE_ENV=production
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   EMAIL_USER=tu-email@tudominio.com
   EMAIL_PASS=tu-contraseña
   BASE_URL=https://tudominio.com
   ```

2. **Probar antes**:
   ```bash
   # Cambiar NODE_ENV a production e intentar
   NODE_ENV=production node test-send-access-email.js
   ```

3. **Verificar SMTP**:
   - Hostinger: Puerto 465 (SSL) o 587 (TLS)
   - Verifica que el dominio esté configurado
   - Prueba las credenciales en un cliente de email primero

### Monitoreo

- Revisar `audit_logs` para confirmación de envíos
- Alertar si fallan múltiples emails
- Notificar si las credenciales expiran

## 🐛 Troubleshooting

| Problema | Solución |
|----------|----------|
| "Route not found" | Reiniciar servidor después agregar ruta |
| "EMAIL_USER no definido" | Agregar EMAIL_USER a .env |
| "EMAIL_PASS no definido" | Agregar EMAIL_PASS a .env |
| "BASE_URL no configurado" | Agregar BASE_URL a .env |
| Email no se envía (prod) | Verificar NODE_ENV=production |
| "Invalid login" (SMTP) | Verificar credenciales en cPanel |
| "Connection timeout" | Verificar SMTP_HOST y SMTP_PORT |
| QR cortado | Aumentar width del QR en emailService.js |
| No aparece en auditoría | Base de datos desconectada (non-blocking) |

## 📚 Referencias

- [Nodemailer Docs](https://nodemailer.com/)
- [QRCode.js Docs](https://davidshimjs.github.io/qrcodejs/)
- [Email Templates Best Practices](https://stripo.email/blog/email-templates/)
- [Hostinger SMTP Configuration](https://support.hostinger.com/en/articles/1583229-how-to-use-smtp)

## 🔄 Próximas Mejoras

- [ ] Plantillas de email customizables por organización
- [ ] Reintento automático si falla
- [ ] Historial de envíos por líder
- [ ] Webhooks para integrar Sendgrid/Mailgun
- [ ] Generación de QR en cliente (sin servidor)
- [ ] Desuscripción de emails
- [ ] Preview de email en admin panel

---

**Versión**: 1.0.0
**Última actualización**: 2026-02-19
**Autor**: Sistema Automático
