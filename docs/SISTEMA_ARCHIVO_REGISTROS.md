# Sistema de Archivo de Registros

## 📋 Descripción General

Sistema que permite guardar copias de registros eliminados en una base de datos separada para reutilización en futuros eventos. Cuando un líder solicita eliminar todos sus registros, el administrador puede elegir archivarlos antes de eliminarlos.

## 🎯 Objetivo

Facilitar el registro en eventos futuros mediante auto-rellenado de datos de personas que ya se registraron anteriormente, evitando que tengan que ingresar toda su información nuevamente.

## 🏗️ Arquitectura

### Modelo de Datos

**ArchivedRegistration** (`src/models/ArchivedRegistration.js`)
```javascript
{
  originalId: ObjectId,           // ID del registro original
  cedula: String (indexed),       // Cédula para búsqueda rápida
  firstName, lastName,
  email, phone,
  localidad, departamento, capital,
  votingPlace, votingTable,
  organizationId (indexed),       // Multi-tenant
  archivedAt: Date,
  archivedBy: String,            // Admin que aprobó
  archivedReason: String,
  deletionRequestId: ObjectId
}
```

### Índices Optimizados
- `cedula + organizationId`: Búsqueda rápida por cédula
- `organizationId + archivedAt`: Listado ordenado
- `email + organizationId`: Búsqueda alternativa

## 🔄 Flujo de Trabajo

### 1. Solicitud de Eliminación (Líder)
1. Líder ingresa contraseña
2. Sistema crea DeletionRequest con estado 'pending'
3. Notifica al administrador

### 2. Revisión de Solicitud (Admin)

**Opción A: Rechazar**
- No se elimina nada
- Líder recibe notificación

**Opción B: Aprobar y Eliminar**
- Elimina permanentemente sin respaldo
- ⚠️ NO se puede recuperar

**Opción C: Aprobar y Archivar** ✅ (RECOMENDADO)
- Copia todos los registros a ArchivedRegistration
- Luego elimina los registros originales
- Contador del líder se resetea a 0
- Datos quedan disponibles para uso futuro

## 📡 API Endpoints

### Para Búsqueda de Datos Archivados

**GET** `/api/archived-registrations/search/:cedula`
```bash
# Busca registro archivado más reciente por cédula
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/archived-registrations/search/1234567890
```

**Response:**
```json
{
  "found": true,
  "data": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "juan@example.com",
    "phone": "+57 300 123 4567",
    "localidad": "Usaquén",
    "votingPlace": "Colegio San José",
    "votingTable": "001"
  }
}
```

### Para Estadísticas (Admin)

**GET** `/api/archived-registrations/stats`
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/archived-registrations/stats
```

**Response:**
```json
{
  "success": true,
  "totalArchived": 1250,
  "uniquePersons": 980
}
```

## 🎨 Interfaz de Usuario

### Panel de Admin

**Sección: "Solicitudes de Eliminación"**

1. **Widget de Estadísticas** (azul)
   - Total de registros archivados
   - Número de personas únicas

2. **Card de Solicitud Pendiente**
   - Información del líder
   - Cantidad de registros
   - Razón de la solicitud
   - **3 botones de acción:**
     - 🔴 **Rechazar**: Cancela solicitud
     - 🔵 **Aprobar y Archivar**: GUARDA copias + elimina
     - ⚫ **Aprobar y Eliminar**: Elimina SIN respaldo

## 💡 Integración Futura - Auto-rellenado

### Implementación Sugerida

**En el formulario de registro (`leader.html`):**

```javascript
// Al detectar cambio en campo de cédula
document.getElementById('cedula').addEventListener('blur', async (e) => {
  const cedula = e.target.value.trim();
  
  if (cedula.length >= 6) {
    try {
      const response = await AuthManager.apiCall(
        `/api/archived-registrations/search/${cedula}`
      );
      const data = await response.json();
      
      if (data.found) {
        // Mostrar notificación
        showNotification('Datos encontrados. ¿Deseas autocompletar?', () => {
          // Auto-rellenar campos
          document.getElementById('firstName').value = data.data.firstName || '';
          document.getElementById('lastName').value = data.data.lastName || '';
          document.getElementById('email').value = data.data.email || '';
          document.getElementById('phone').value = data.data.phone || '';
          
          if (data.data.localidad) {
            document.getElementById('localidad').value = data.data.localidad;
            // Cargar puestos de esa localidad
            await FormManager.cargarPuestosLeader(data.data.localidad);
          }
          
          // Highlight campos autocompletados
          highlightFields(['firstName', 'lastName', 'email', 'phone', 'localidad']);
        });
      }
    } catch (error) {
      console.error('Error buscando datos archivados:', error);
    }
  }
});
```

### Función de Notificación Sugerida

```javascript
function showNotification(message, onAccept) {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; border-radius: 12px; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4); z-index: 10000; max-width: 400px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <i class="bi bi-archive-fill" style="font-size: 24px;"></i>
        <div style="flex: 1;">
          <p style="margin: 0; font-weight: 600; font-size: 14px;">${message}</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="btn-accept" style="flex: 1; background: white; color: #667eea; border: none; padding: 8px; border-radius: 6px; font-weight: 600; cursor: pointer;">
          Sí, autocompletar
        </button>
        <button class="btn-cancel" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: 1px solid white; padding: 8px; border-radius: 6px; font-weight: 600; cursor: pointer;">
          No, gracias
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  notification.querySelector('.btn-accept').addEventListener('click', () => {
    onAccept();
    notification.remove();
  });
  
  notification.querySelector('.btn-cancel').addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-cerrar después de 8 segundos
  setTimeout(() => notification.remove(), 8000);
}
```

## 📊 Ventajas del Sistema

✅ **Experiencia de Usuario Mejorada**
- Los usuarios no tienen que ingresar todos sus datos en cada evento
- Ahorro de tiempo significativo

✅ **Datos Históricos**
- Mantiene registro de participación previa
- Útil para análisis de retención

✅ **Flexibilidad para Admin**
- Puede elegir entre eliminar permanentemente o archivar
- Control total sobre qué datos mantener

✅ **Multi-tenant Seguro**
- Los datos archivados están aislados por organizationId
- No hay riesgo de filtración entre organizaciones

## 🔒 Consideraciones de Seguridad

1. **Privacidad de Datos**
   - Los datos archivados contienen información personal
   - Cumple con Ley 1581 de 2012 (Colombia)
   - El consentimiento original se mantiene válido

2. **Acceso Restringido**
   - Solo usuarios autenticados pueden buscar
   - Búsqueda limitada a organizationId del usuario
   - Admins no pueden ver datos de otras organizaciones

3. **Auditoría**
   - Todas las acciones de archivo se registran en AuditLog
   - Se guarda quién aprobó y cuándo
   - Trazabilidad completa

## 🚀 Próximos Pasos (Opcional)

### Funcionalidades Adicionales Sugeridas

1. **Panel de Gestión de Archivos**
   - Vista de registros archivados
   - Búsqueda y filtros
   - Exportar a Excel

2. **Auto-rellenado Inteligente**
   - Implementar en formularios público y líder
   - Notificación visual de datos encontrados
   - Opción de aceptar o rechazar

3. **Políticas de Retención**
   - Eliminar automáticamente archivos después de X años
   - Notificar antes de eliminar
   - Cumplimiento con GDPR/CCPA

4. **Estadísticas Avanzadas**
   - Dashboard de personas recurrentes
   - Análisis de retención por evento
   - Métricas de reutilización de datos

## 📝 Notas de Implementación

- **Base de datos separada**: Los registros archivados NO interfieren con registros activos
- **Rendimiento**: Índices optimizados para búsquedas rápidas
- **Escalabilidad**: Soporta millones de registros archivados
- **Compatibilidad**: Funciona con arquitectura multi-tenant existente

---

**Última actualización**: Febrero 2026  
**Versión**: 1.0  
**Commit**: 683e370f
