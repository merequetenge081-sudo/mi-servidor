# 🎉 IMPORTACIÓN DE PUESTOS SIN SSH (Para Render Free)

## ✅ Solución para usuarios sin acceso SSH en Render

Como **Render Free** no permite SSH, creé un **endpoint API protegido** que ejecuta la importación cuando lo llamas.

---

## 🔗 Endpoint

```
POST https://tu-app.onrender.com/api/admin/import-puestos
```

**Requerimientos:**
- ✅ Token JWT de admin en header `Authorization`
- ✅ Header: `Content-Type: application/json`

---

## 📝 Paso a Paso

### **Opción 1: Usar Postman (GUI)**

1. **Abrir Postman** (o instalar si no lo tienes)

2. **Crear nuevo request:**
   - Método: `POST`
   - URL: `https://tu-app.onrender.com/api/admin/import-puestos`

3. **Ir a pestaña "Headers"** y agregar:
   ```
   Authorization: Bearer <YOUR_ADMIN_TOKEN>
   Content-Type: application/json
   ```

4. **El body puede estar vacío** (usa datos de ejemplo internos)

5. **Click "Send"**

6. **Ver respuesta JSON con estadísticas**

---

### **Opción 2: Usar CURL en Terminal**

```bash
# Reemplaza TU_TOKEN_ADMIN con tu JWT de admin
curl -X POST https://tu-app.onrender.com/api/admin/import-puestos \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -H "Content-Type: application/json"
```

---

### **Opción 3: Desde JavaScript/Fetch**

```javascript
async function importarPuestos() {
  const token = "TU_TOKEN_ADMIN"; // Obtén tu token de login
  
  const response = await fetch(
    "https://tu-app.onrender.com/api/admin/import-puestos",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
  
  const data = await response.json();
  console.log(data);
}

importarPuestos();
```

---

## 🔐 ¿Dónde obtener el Token de Admin?

### **Método 1: Login en la aplicación**

1. Ir a `https://tu-app.onrender.com/login` (o tu ruta de admin login)
2. Ingresar credenciales de admin
3. Abrir DevTools (F12) → Application/Storage → LocalStorage
4. Buscar `authToken` o `admin_token`
5. Copiar el valor

### **Método 2: Request de login directo**

```bash
curl -X POST https://tu-app.onrender.com/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tu_usuario_admin",
    "password": "tu_contraseña"
  }'
```

Respuesta:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1..."
}
```

Usa ese valor en el header `Authorization: Bearer <token>`

---

## 📊 Respuesta Exitosa

```json
{
  "success": true,
  "message": "✅ Se importaron 22 puestos de votación exitosamente",
  "data": {
    "totalPuestos": 22,
    "totalMesas": 55,
    "estadisticas": [
      {
        "localidad": "Antonio Nariño",
        "puestos": 1,
        "mesas": 3
      },
      {
        "localidad": "Barrios Unidos",
        "puestos": 1,
        "mesas": 3
      },
      ...
      {
        "localidad": "Kennedy",
        "puestos": 3,
        "mesas": 12
      }
    ]
  }
}
```

---

## ❌ Respuesta con Error

```json
{
  "success": false,
  "message": "Error al importar puestos",
  "error": "Acceso denegado"
}
```

### Posibles errores:

| Error | Solución |
|---|---|
| `"message": "Acceso denegado"` | Token no es válido o no tienes rol admin |
| `"message": "Token requerido"` | Falta header `Authorization` |
| `"message": "No hay puestos válidos"` | Error interno en el servidor |

---

## ✨ Qué Ocurre

Cuando llamas el endpoint:

1. ✅ Valida tu token JWT
2. ✅ Verifica que seas admin
3. ✅ Limpia la colección actual de `Puestos`
4. ✅ Importa 22 puestos de todas las localidades
5. ✅ Calcula estadísticas
6. ✅ Retorna respuesta JSON

**Después:** Tu formulario estará completamente funcional con selectores dinámicos.

---

## 🧪 Test Online (Recomendado)

1. Ir a https://www.postman.com/downloads/ → descargar Postman (gratis)
2. Abrir Postman
3. Crear request según instrucciones de "Opción 1" arriba
4. ¡Listo!

---

## 📋 Checklist

- [ ] Tengo token JWT de admin
- [ ] Copio correctamente el token (sin espacios)
- [ ] Header Authorization: Bearer <token>
- [ ] Header Content-Type: application/json
- [ ] POST a `/api/admin/import-puestos`
- [ ] Espero respuesta JSON con 22 puestos

---

## 🚀 Resultado Final

Después de ejecutar el endpoint:

✅ Formulario carga localidades  
✅ Selectores de puestos funcionan  
✅ Puedes registrar votantes con puestos de votación oficiales  
✅ Sistema completamente funcional  

---

## 💡 Tips

- El endpoint se puede llamar múltiples veces (resetea cada vez)
- Todos los 22 puestos de ejemplo estarán disponibles
- Los selectores en `form.html` se cargarán automáticamente
- No requiere redeploy de la app

---

**¡Listo! 🎉 Sistema de Puestos de Votación activado en Render Free sin SSH**
