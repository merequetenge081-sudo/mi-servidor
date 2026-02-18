# 📋 Instrucciones para Migrar Datos y Resolver Problemas

## 🚀 Opción 1: Migración Automática (Recomendada)

La migración ocurre automáticamente cuando entras al panel de admin:

1. **Inicia el servidor:**
   ```powershell
   npm start
   ```

2. **Abre tu navegador en:**
   ```
   http://localhost:3000
   ```

3. **La migración se ejecutará automáticamente** al cargar la página (visible en la consola del navegador)

4. **Si no ves cambios después de 2-3 segundos, recarga la página**

---

## 🚀 Opción 2: Migración Manual (Alternativa)

Si la opción 1 no funciona:

1. **Abre una nueva terminal en la carpeta del proyecto:**
   ```powershell
   cd "c:\Users\Janus\Desktop\mi-servidor"
   ```

2. **Ejecuta el script de migración:**
   ```powershell
   node migrate-data.js
   ```

3. **Deberías ver:**
   ```
   ✅ Conectado a MongoDB Atlas
   🔄 Iniciando migración...
   📌 Procesando 4 líderes...
     ✅ Líder migrado: Jonnathan Peña
   📌 Procesando 1 registros...
     ✅ Registro migrado: Jonnathan Peña
   ✅ MIGRACIÓN COMPLETADA
   ```

4. **Abre tu navegador** y recarga la página

---

## ✅ Verificar que los datos aparezcan

Después de migrar, deberías ver:

### En el Dashboard:
- ✅ "Líderes Activos" mostrará la cantidad de líderes
- ✅ "Personas Registradas" mostrará la cantidad de registros
- ✅ Aparecerá actividad reciente en la tabla

### En Gestión de Líderes:
- ✅ Verás la tabla con todos los líderes
- ✅ Cada líder tendrá botones para: Ver QR, Enviar QR, Editar, Eliminar

### En Registros:
- ✅ Verás la tabla con todos los registros
- ✅ Aparecerá: Fecha, Nombre, Líder, Estado de Confirmación

---

## 🆕 Para crear un nuevo líder

1. **Ve a "Gestión de Líderes"** en el menú izquierdo
2. **Haz clic en "Nuevo Líder"** (botón azul)
3. **Completa el formulario:**
   - Nombre Completo ✅
   - Email ✅
   - Teléfono ✅
   - Área/Zona (opcional)
   - Marcar "Líder Activo" si está activo

4. **Haz clic en "Guardar Líder"**
   - ✅ El modal se cierra automáticamente
   - ✅ La tabla se actualiza automáticamente
   - ✅ Aparece un mensaje de éxito

---

## 🆕 Para registrar una persona en un evento nuevo

1. **Primero, ve a la página de inicio** y crea un evento nuevo
   - Dale un nombre
   - Selecciona una fecha
   - Guarda

2. **Una vez seleccionado el evento**, ve al Dashboard
3. **Haz clic en "Nuevo Registro"** (botón verde)
4. **Completa el formulario:**
   - Nombre ✅
   - Apellido ✅
   - Cédula ✅
   - Email ✅
   - Teléfono ✅
   - Selecciona un Líder ✅

5. **Haz clic en "Guardar Registro"**
   - ✅ El modal se cierra automáticamente
   - ✅ La tabla se actualiza automáticamente
   - ✅ El registro se asocia al evento actual
   - ✅ Aparece un mensaje de éxito

---

## 📊 Ver Análisis de Datos

1. **Ve a "Análisis de Datos"** en el menú
2. **Verás:**
   - Tarjetas con: Total de Líderes, Total de Registros, Confirmados, Última Actividad
   - Tabla de desempeño de líderes (clica en un líder para ver sus registros)
   - Filtros para búsqueda por nombre, líder o estado de confirmación

---

## 🆘 Si algo no funciona

**En la consola del navegador (F12 > Console), deberías ver:**

```
✅ Migración completada: X líderes, Y registros
✅ Líder guardado: {nombre del líder}
✅ Registro guardado: {nombre de la persona}
```

**Si ves errores:**

1. Verifica que MongoDB esté funcionando
2. Comprueba que el archivo `.env` tiene tu URL de MongoDB correcta
3. Reinicia el servidor: `npm start`
4. Limpia el localStorage: F12 > Application > Storage > Local Storage > Clear All
5. Recarga la página

---

## 📝 Cambios realizados:

✅ **Backend (server.js):**
- ✅ Mejorado endpoint POST `/api/leaders` con validación
- ✅ Agregado endpoint POST `/api/migrate` para migrar datos de `data.json`
- ✅ Asegurado que líderes se creen con `eventId` correcto
- ✅ Asegurado que registros se creen con `eventId` correcto

✅ **Frontend (app.html):**
- ✅ Mejorada función `saveLeader()` para cerrar modal correctamente y recargar datos
- ✅ Mejorada función `saveAdminRegistration()` para guardar todos los campos y recargar datos
- ✅ Agregada migración automática al cargar la página
- ✅ Mejorado feedback visual con notificaciones

✅ **Scripts nuevos:**
- ✅ Creado `migrate-data.js` para migración manual desde terminal

---

¡Ahora tus datos deberían aparecer correctamente! 🎉
