# 📸 GUÍA VISUAL - VERIFICAR QUE TODO FUNCIONA

## 1️⃣ El servidor está corriendo correctamente

**En la terminal, deberías ver:**

```
📱 SMS desactivado (credenciales de Twilio no configuradas)
🚀 Servidor corriendo en el puerto 3000
✅ Conectado a MongoDB Atlas
```

✅ Si ves esto, el servidor está bien. Continúa al paso 2.

---

## 2️⃣ Abre http://localhost:3000

Verás la **página de inicio** con 2 botones:
- ✅ "Crear Evento"
- ✅ "Ver Eventos"

---

## 3️⃣ Abre la consola del navegador (F12 > Console)

Deberías ver algo como:

```
🔄 Iniciando migración automática de datos...
✅ Migración completada: 4 líderes, 1 registros
✅ Líder cargado: Jonnathan Peña
✅ Registro cargado: Jonnathan Peña
```

✅ Si ves esto, la migración fue exitosa. Si no, revisa los errores debajo.

---

## 4️⃣ Ve al Dashboard

Haz clic en "Ver Eventos" → Selecciona un evento → Verás el Dashboard

**En las tarjetas superiores deberías ver:**
- ✅ "Líderes Activos: 4" (o similar)
- ✅ "Personas Registradas: 1" (o similar)

---

## 5️⃣ Ve a "Gestión de Líderes"

Deberías ver una tabla con:

| # | Nombre | Token | Registros | Acciones |
|---|--------|-------|-----------|----------|
| 1 | Jonnathan Peña | leader1... | 1 | [QR] [Enviar] [✏️] [🗑️] |

✅ Si ves esto, los datos fueron migrados correctamente.

---

## 6️⃣ Crea un nuevo líder

**Pasos:**

1. Haz clic en botón azul **"Nuevo Líder"**
2. Se abre un modal con un formulario
3. Completa los campos:
   - Nombre Completo: `Prueba Líder`
   - Email: `prueba@example.com`
   - Teléfono: `+573001234567`
   - Área: `Zona Sur`
   - Marcar "Líder Activo"

4. Haz clic en **"Guardar Líder"**

**Resultado esperado:**
- ✅ El modal se cierra automáticamente
- ✅ Aparece un mensaje verde "Líder guardado con éxito"
- ✅ La tabla se actualiza y muestra el nuevo líder
- ✅ Verás "Prueba Líder" en la tabla inmediatamente

❌ Si el modal no se cierra o no aparece el líder:
- Abre F12 > Console y busca errores rojo
- Intenta de nuevo después de recargar (F5)

---

## 7️⃣ Crea un nuevo registro

**Pasos:**

1. Ve al **Dashboard**
2. Haz clic en botón verde **"Nuevo Registro"**
3. Se abre un modal con un formulario
4. Completa los campos:
   - Nombre: `Juan`
   - Apellido: `Pérez`
   - Cédula: `1234567890`
   - Email: `juan@example.com`
   - Teléfono: `+573002345678`
   - Líder: Selecciona `Jonnathan Peña`

5. Haz clic en **"Guardar Registro"**

**Resultado esperado:**
- ✅ El modal se cierra automáticamente
- ✅ Aparece un mensaje verde "Registro guardado correctamente"
- ✅ Las tarjetas se actualizan (verás +1 en "Personas Registradas")
- ✅ La tabla de registros se actualiza

❌ Si algo no funciona:
- Abre F12 > Network y verifica que el POST fue exitoso (código 200)
- Si ves código 400 o 500, hay un error del servidor

---

## 8️⃣ Ve a "Registros"

Deberías ver una tabla con los registros:

| Fecha | Nombre | Líder | Confirmado | Acción |
|-------|--------|-------|-----------|--------|
| 11/11/2025 | Juan Pérez | Jonnathan Peña | No confirmado | [✉️] [✅] [✏️] [🗑️] |

✅ Si ves el nuevo registro, está funcionando perfectamente.

---

## 9️⃣ Ve a "Análisis de Datos"

Deberías ver:
- ✅ Tarjetas con estadísticas
- ✅ Tabla de desempeño de líderes
- ✅ Tabla de registros detallada
- ✅ Filtros para búsqueda

---

## 📊 RESUMEN DE VERIFICACIÓN

Marca los items que funcionen:

- [ ] Servidor en puerto 3000
- [ ] MongoDB conectado
- [ ] Migración automática exitosa
- [ ] Dashboard muestra datos migrados
- [ ] Se ve tabla de líderes migrados
- [ ] Puedo crear nuevo líder
- [ ] Nuevo líder aparece inmediatamente
- [ ] Se ve tabla de registros migrados
- [ ] Puedo crear nuevo registro
- [ ] Nuevo registro aparece inmediatamente
- [ ] Análisis de datos muestra estadísticas

✅ Si todas están marcadas: **¡TODO FUNCIONA PERFECTAMENTE!** 🎉

---

## 🔧 TROUBLESHOOTING VISUAL

### Síntoma: "No veo los datos migrados en el Dashboard"

**Solución:**
1. Abre F12 > Console
2. Verifica que dice "✅ Migración completada"
3. Si no lo dice:
   - Recarga la página (F5)
   - O ejecuta manualmente: `node migrate-data.js` en la terminal
   - Luego recarga el navegador

### Síntoma: "El modal no se cierra después de crear líder"

**Solución:**
1. Abre F12 > Console
2. Verifica que no hay errores en rojo
3. Si hay errores, toma captura y comparte
4. Recarga la página (F5)

### Síntoma: "No aparece el nuevo líder en la tabla"

**Solución:**
1. Abre F12 > Network
2. Haz clic en "Nuevo Líder" y completa el formulario
3. Observa la petición POST `/api/leaders`
4. Si ves código 200 pero no aparece:
   - Recarga la página (F5)
5. Si ves código 400 o 500:
   - Hay error del servidor
   - Comparte el mensaje de error

### Síntoma: "MongoDB connection error"

**Solución:**
1. Verifica que tu `.env` tiene una URL de MongoDB correcta
2. Verifica que MongoDB Atlas está en línea
3. Verifica que tu IP está en la whitelist de MongoDB Atlas
4. Reinicia el servidor: `npm start`

---

## 🎓 PREGUNTAS FRECUENTES

**P: ¿Por qué tardó tanto en cargar?**
A: La migración se ejecuta automáticamente. Toma 2-3 segundos. Abre la consola para ver el progreso.

**P: ¿Se perderán mis datos si recargo la página?**
A: No. Todo está guardado en MongoDB. Se recupera automáticamente.

**P: ¿Puedo usar la migración manual en lugar de la automática?**
A: Sí. Ejecuta `node migrate-data.js` en la terminal.

**P: ¿Qué pasa si ejecuto la migración dos veces?**
A: No hay problema. Tiene validaciones para evitar duplicados.

**P: ¿Cómo exporto los datos?**
A: Ve a "Exportar Datos" → Elige "Exportar Líderes" o "Exportar Registros" → Se descarga un archivo Excel

---

¡Listo! Ahora deberías tener todo funcionando correctamente. 🚀

