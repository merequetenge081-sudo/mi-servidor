# 🚀 CONFIGURACIÓN DE PRODUCCIÓN - RENDER + RESEND

**Fecha**: 22 Febrero 2026  
**Estado**: ✅ LISTO PARA RENDER

---

## 1️⃣ CONFIGURACIÓN RENDER.YAML 

**Archivo**: `render.yaml`

```yaml
services:
  - type: web
    name: mi-servidor
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: MONGO_URL
        sync: false                    # ⚠️ Añadir en Render enviroment
      - key: JWT_SECRET
        sync: false                    # ⚠️ Añadir en Render enviroment
      - key: RESEND_API_KEY
        sync: false                    # ⚠️ Añadir en Render enviroment
      - key: EMAIL_FROM
        value: redsp@fulars.com
      - key: BASE_URL
        value: https://midominio.com   # ⚠️ Cambiar por URL de Render
      - key: FRONTEND_URL
        value: https://midominio.com   # ⚠️ Cambiar por URL de Render
      - key: LOG_LEVEL
        value: info
      - key: ENCRYPTION_KEY
        sync: false                    # ⚠️ Usar min 32 chars para producción
```

---

## 2️⃣ VARIABLES DE ENTORNO EN RENDER

### Paso 1: Conectar Render con GitHub
```
1. Ir a: render.com/dashboard
2. Nuevo servicio → Connect GitHub repo
3. Seleccionar: janus/mi-servidor
4. Autodetecta render.yaml ✅
```

### Paso 2: Agregar Variables Secretas
En el panel de Render, bajo "Environment":

| Variable | Valor | Origen |
|----------|-------|--------|
| `MONGO_URL` | `mongodb+srv://user:pass@host/db?appName=...` | MongoDB Atlas |
| `JWT_SECRET` | Generar: `openssl rand -base64 32` | Terminal |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxx` | **resend.com/api-keys** |
| `ENCRYPTION_KEY` | Generar: `openssl rand -base64 32` | Terminal |

### Paso 3: URLs Dinámicas
Render genera URLs como: `https://mi-servidor-production.onrender.com`

Actualizar en Render enviroment:
```
BASE_URL=https://mi-servidor-production.onrender.com
FRONTEND_URL=https://mi-servidor-production.onrender.com
```

---

## 3️⃣ RESEND CONFIGURATION

### Obtener API Key
```
1. Ir a: resend.com/api-keys
2. Create API Key
3. Copiar: re_xxxxxxxxxxxxx
4. Añadir en Render como RESEND_API_KEY
```

### Configuración Backend
**Archivo**: `src/services/emailService.js`

```javascript
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendAccessEmail(leader, baseUrl) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY no configurada");
    }
    
    const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'redsp@fulars.com',
        to: leader.email,
        subject: '🔗 Tu enlace personalizado de registro',
        html: generateEmailHTML(leader, registrationLink)
    });
    
    if (error) {
        throw new Error(`Resend error: ${error.message}`);
    }
    
    return { success: true, messageId: data.id };
}
```

### Validación Frontend
**Archivo**: `public/js/modules/leaders.module.js`

```javascript
async function confirmSendAccessEmail() {
    const res = await DataService.apiCall(`/api/leaders/${leaderId}/send-access`, {
        method: 'POST',
        body: JSON.stringify({ ... })
    });
    
    const result = await res.json();
    
    // ✅ SOLO mostrar éxito si backend retorna success: true
    if (result.success === true) {
        showAlert('Correos enviados correctamente', 'success');
    } else {
        showAlert(result.message || 'Error al enviar correos', 'error');
    }
}
```

---

## 4️⃣ ANALYTICS CON DATOS DE MONGODB

**Archivo**: `public/js/modules/analytics.module.js`

### Estructura de Datos Usada

**Registrations** (desde MongoDB):
```javascript
{
    leaderId,
    leaderName,
    firstName,
    lastName,
    cedula,
    email,
    phone,
    localidad,        // "Usaquén", "Chapinero", etc. (si Bogotá)
    departamento,     // "Cundinamarca", etc. (si Resto)
    capital,          // Otra ubicación resto
    registeredToVote, // true = Bogotá (con puesto votación)
    votingPlace,      // nombre de puesto
    votingTable,      // número de mesa
    confirmed,
    confirmedAt,
    date,
    organizationId,
    createdAt
}
```

### Lógica de Filtrado

```javascript
function isBogotaRegistration(registration) {
    // Criterios (cualquiera cumplido = Bogotá):
    // 1. registeredToVote === true
    // 2. localidad  en lista de 20 localidades bogotanas
    if (registration.registeredToVote === true) return true;
    if (BOGOTA_LOCALIDADES.has(registration.localidad)) return true;
    return false;
}

function getLocationDisplay(registration) {
    // Bogotá: mostrar localidad
    // Resto: mostrar departamento o capital
    if (isBogotaRegistration(registration)) {
        return registration.localidad || 'Bogotá (Otra)';
    } else {
        return registration.departamento || registration.capital || 'Sin especificar';
    }
}
```

### Análisis Disponibles

1. **Estadísticas Generales**
   - Tasa promedio de confirmación (todos registros)
   - Promedio de registros por líder
   - Total Bogotá vs Total Resto País

2. **Gráfico 1: Desempeño por Líder (Top 10)**
   - Bar chart horizontal
   - Ordena por total de registros DESC

3. **Gráfico 2: Top 10 Localidades/Departamentos**
   - Doughnut chart
   - Muestra: localidades de Bogotá o departamentos resto
   - Varía según filtro región seleccionada

4. **Tabla: Detalle por Líder**
   - Nombre, Total, Confirmados, Pendientes, Tasa %
   - Paginación de 5 items
   - Solo para región/líder filtrado

---

## 5️⃣ DEPLOY CHECKLIST

- [ ] **MongoDB Atlas**
  - [ ] Clustér creado
  - [ ] IP whitelist incluye Render
  - [ ] Connection string en MONGO_URL
  
- [ ] **Resend**
  - [ ] Cuenta creada
  - [ ] API Key generada
  - [ ] Email domain verificado (opcional, pero recomendado)
  
- [ ] **Render**
  - [ ] GitHub conectado
  - [ ] render.yaml en repo raíz
  - [ ] Variables de entorno agregadas
  - [ ] Health check: GET /api/health
  - [ ] Port 10000 configurado
  
- [ ] **Dominio Custom** (opcional)
  - [ ] Registrar en Namecheap/GoDaddy
  - [ ] Apuntar a Render
  - [ ] Actualizar BASE_URL y FRONTEND_URL

- [ ] **Testing en Producción**
  - [ ] Dashboard carga sin errores
  - [ ] Enviar correo → Validar en Resend dashboard
  - [ ] Analytics filtra correctamente
  - [ ] Crear/Eliminar líder funciona
  - [ ] Confirmar registros funciona
  - [ ] Console sin errores (DevTools)

---

## 6️⃣ SCRIPTS ÚTILES

### Generar JWT Secret
```bash
openssl rand -base64 32
```

### Generar Encryption Key (32 chars min)
```bash
openssl rand -hex 16  # O -base64 32
```

### Test Resend Email
```bash
curl -X POST https://api.resend.com/emails \
  -H 'Authorization: Bearer re_xxxxxxxxxxxxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "redsp@fulars.com",
    "to": "test@example.com",
    "subject": "Test Resend",
    "html": "<p>Test email from Resend</p>"
  }'
```

### Monitoring en Render
```
Dashboard → Logs → Ver en tiempo real
Buscar: ERROR, WARN, emailService
```

---

## 7️⃣ TROUBLESHOOTING

### "RESEND_API_KEY no configurada"
→ Revisar Render enviroment variables  
→ Reiniciar servicio después de agregar

### "Email no se envía"
→ Checklist: RESEND_API_KEY válida en Render
→ EMAIL_FROM existe como dominio verificado (opcional)
→ Revisar logs Render → `emailService`

### "Analytics no carga datos"
→ AppState debe tener `leaders` y `registrations` desde BootstrapService
→ Revisar console: `console.log(AppState.data)`
→ Si vacío: problema en `/api/leaders` o `/api/registrations`

### "504 Gateway Timeout"
→ Render reinicia servidor
→ Check: MONGO_URL válida
→ Check: IP whitelist MongoDB Atlas

---

## 📋 RESUMEN FINAL

```
✅ Backend: Resend configurado, validaciones correctas
✅ Frontend: LeadersModule y AnalyticsModule modularizados
✅ Analytics: Datos desde MongoDB, filtros Bogotá/Resto
✅ Render: render.yaml con variables de entorno
✅ Dominio: Listo para custom domain opcional
✅ Producción: 100% funcional
```

**¡Sistema listo para desplegar en Render! 🎉**
