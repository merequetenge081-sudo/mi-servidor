# Fase 4 - Event Delegation Fixes (Sesión Actual)

## Resumen de Cambios

Se han corregido múltiples problemas de scope y acceso a funciones que surgieron durante la migración a event delegation. El issue principal es que las funciones en módulos necesitaban acceso a `apiCall`, `loadDashboard`, y otras utilidades definidas en `dashboard.js`.

## Cambios Implementados

### 1. Fixed Send Email Button Handler (events.js)
**Problema**: El botón "Enviar Correo" en la tabla de líderes no funcionaba
**Causa**: El manejador en `events.js` no estaba pasando los datos de líder correctamente
**Solución**: Actualizar handler para pasar `data-leader-id`, `data-leader-name`, `data-leader-email`

```javascript
// ANTES:
if (sendEmailBtn) {
    if (typeof sendAccessEmail === 'function') {
        sendAccessEmail(...);
    }
}

// DESPUÉS:
if (sendEmailBtn) {
    if (typeof LeadersModule !== 'undefined' && LeadersModule.sendAccessEmail) {
        LeadersModule.sendAccessEmail(
            sendEmailBtn.dataset.leaderId, 
            sendEmailBtn.dataset.leaderName, 
            sendEmailBtn.dataset.leaderEmail
        );
    }
}
```

### 2. Fixed Delete Leader Button Handler (events.js)
**Problema**: El botón "Eliminar" en la tabla de líderes no abría el modal de confirmación
**Causa**: La variable `leaderToDeleteId` no estaba siendo establecida antes de llamar a `deleteLeader()`
**Solución**: Establecer `window.leaderToDeleteId` en `events.js` antes de llamar a la función del módulo

```javascript
// AGREGADO en events.js:
const deleteBtn = target.closest('.delete-leader-btn');
if (deleteBtn) {
    closeAllActionMenus();
    const leaderId = deleteBtn.dataset.leaderId;
    window.leaderToDeleteId = leaderId; // ← SET HERE
    if (typeof deleteLeader === 'function') deleteLeader(leaderId);
    return;
}
```

### 3. Initialized leaderToDeleteId in dashboard.js
**Problema**: Para que `handleConfirmDeleteLeader()` funcione, necesita acceso a la variable `leaderToDeleteId`
**Solución**: Declarar `let leaderToDeleteId = null;` al inicio de `dashboard.js`

```javascript
// AGREGADO en dashboard.js línea ~1117:
let leaderToDeleteId = null; // Set by events.js when delete button clicked
```

### 4. Exposed Global Functions from dashboard.js
**Problema**: Los módulos (`leaders.module.js`, etc.) usan `apiCall`, `loadDashboard`, `showAlert`, `showSuccessModal` pero estas no estaban disponibles globalmente
**Solución**: Exponer estas funciones en `window` para que sean accesibles desde módulos

```javascript
// AGREGADO en dashboard.js (después de definir las funciones):
window.apiCall = apiCall;
window.loadDashboard = loadDashboard;
window.showAlert = showAlert;
window.showSuccessModal = showSuccessModal;
```

### 5. Updated Module Functions to Use window.apiCall
**Problema**: `confirmSendAccessEmail()`, `handleConfirmResetPassword()`, `showCredentials()` usaban `apiCall` que no estaba disponible
**Solución**: Cambiar a `window.apiCall` para usar la versión global expuesta

```javascript
// ANTES (en leaders.module.js):
const res = await apiCall(`/api/leaders/${leaderId}/send-access`, {...});

// DESPUÉS:
const res = await window.apiCall(`/api/leaders/${leaderId}/send-access`, {...});
```

## Archivos Modificados

### 1. `public/js/core/events.js`
- **Línea ~252**: Mejoró handler de `.send-email-btn` para pasar datos de líder
- **Línea ~217**: Agregó asignación de `window.leaderToDeleteId` antes de llamar `deleteLeader()`

### 2. `public/js/dashboard.js`
- **Línea ~267**: Expuso `window.apiCall`
- **Línea ~1117**: Inicializó `let leaderToDeleteId = null;`
- **Línea ~1308-1317**: Expuso `window.loadDashboard`, `window.showAlert`, `window.showSuccessModal`

### 3. `public/js/modules/leaders.module.js`
- **Línea ~254**: Cambió `apiCall` a `window.apiCall` en `confirmSendAccessEmail()`
- **Línea ~375**: Cambió `apiCall` a `window.apiCall` en `handleConfirmResetPassword()`
- **Línea ~434**: Cambió `apiCall` a `window.apiCall` en `showCredentials()`
- **Línea ~560**: Cambió `apiCall` a `window.apiCall` en `handleSaveEditLeader()`
- Línea ~582: Cambió `loadDashboard()` a `window.loadDashboard()` cuando existe
- Línea ~399: Cambió `loadDashboard()` a `window.loadDashboard()` cuando existe

## Botones Afectados / Esperados Funcionales Ahora

✅ **Botón "Enviar Correo"** (en tabla de líderes)
- Abre modal para seleccionar qué correos enviar
- Envía correo de acceso al líder
- **Esperado**: Funcione completamente

✅ **Botón "Eliminar Líder"** (en menú de acciones)
- Abre modal de confirmación
- Confirmar elimina el líder de la base de datos
- **Esperado**: Funcione completamente

✅ **Botón "Generar Contraseña"** (en modal)
- Abre formulario para reset de credenciales
- Genera nueva contraseña
- **Esperado**: Funcione completamente

✅ **Botón "Copiar Credenciales"** (en modal)
- Copia credenciales al portapapeles
- **Esperado**: Funcione completamente

✅ **Botón "Guardar Cambios"** (en modal de editar líder)
- Actualiza información del líder
- **Esperado**: Funcione completamente

🔶 **Botón "Confirmar Registro"** (en tabla de registros)
- POST a `/api/registrations/{id}/confirm`
- **Estado**: Retorna 400 Bad Request - NECESITA DEBUGGING
- **Nota**: No relacionado directamente con estos cambios

## Testing Requerido

1. [ ] Click en botón "Enviar Correo" en tabla de líderes
2. [ ] Click en botón "Eliminar" y confirmar eliminación
3. [ ] Click en "Generar Contraseña" y completar formulario
4. [ ] Click en "Guardar Cambios" en modal de editar
5. [ ] Verificar logs en consola para ReferenceErrors

## Notas Técnicas

- Estos cambios mantienen backwards compatibility
- Las funciones globales ahora sirven como puente entre event delegation y módulos
- La variable `leaderToDeleteId` ahora establecida por `events.js` antes de llamar módulo

## Posible Issue Pendiente

El error POST 400 en confirmación de registros (toggleConfirm) parece ser un problema separado:
- El manejador en `events.js` se alcanza correctamente
- `RegistrationsModule.toggleConfirm()` se llama
- Pero la respuesta del servidor retorna 400
- **Hipótesis**: Problema en API endpoint o formato de datos
