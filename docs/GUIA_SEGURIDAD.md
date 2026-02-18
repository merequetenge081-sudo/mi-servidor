# 🔐 Guía de Seguridad y Autenticación

## Resumen de cambios

Tu sistema ahora tiene **autenticación JWT** con dos roles:

- **Admin**: acceso total a todo (líderes, registros, estadísticas)
- **Líder**: acceso restringido solo a sus propios registros

---

## 1️⃣ Crear Admin

Ejecuta una sola vez:

```bash
node create_admin.js admin mi_password_seguro
```

O usa variables de entorno en `.env`:

```env
ADMIN_USER=mi_admin
ADMIN_PASS=mi_password_seguro
```

Luego:

```bash
node create_admin.js
```

---

## 2️⃣ Login

### Admin
```bash
POST /api/auth/admin-login
Content-Type: application/json

{
  "username": "admin",
  "password": "mi_password_seguro"
}
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Líder
```bash
POST /api/auth/leader-login
Content-Type: application/json

{
  "leaderId": "<ID_DEL_LEADER>",
  "password": "su_contraseña"
}
```

---

## 3️⃣ Usar el Token

Incluye el token en el header `Authorization`:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/registrations
```

---

## 4️⃣ Controlar Quién Ve Qué

### Cuando creas un líder (POST /api/leaders)

Puedes incluir una contraseña:

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "3001234567",
  "area": "Bogotá",
  "password": "su_contraseña_segura"
}
```

El sistema **hashea la contraseña automáticamente** y la guarda en `passwordHash`.

### Permisos por endpoint

| Endpoint | Admin | Líder | Descripción |
|----------|-------|-------|-------------|
| `GET /api/registrations` | ✅ Ve todo | ✅ Solo suyos | Ver registros |
| `PUT /api/registrations/:id` | ✅ Edita todo | ✅ Solo suyos | Editar registro |
| `DELETE /api/registrations/:id` | ✅ Elimina todo | ✅ Solo suyos | Eliminar registro |
| `GET /api/leaders` | ✅ | ❌ | Listar líderes |
| `POST /api/leaders` | ✅ | ❌ | Crear líder |
| `GET /api/stats` | ✅ | ❌ | Ver estadísticas |

---

## 5️⃣ Ejemplo Completo (curl)

### Paso 1: Crear admin
```bash
node create_admin.js admin pass123
```

### Paso 2: Login y obtener token
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pass123"}' \
  | jq -r '.token')

echo $TOKEN
```

### Paso 3: Usar token para ver registros
```bash
curl -s http://localhost:3000/api/registrations \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 6️⃣ Seguridad en Producción

- **Cambia `JWT_SECRET`** en `.env` a algo aleatorio y fuerte
- **Usa HTTPS** (no HTTP)
- **Protege tu `.env`** — no lo subas a Git
- **Rota credenciales** regularmente
- **Usa contraseñas fuertes** para admin

---

## ⚠️ Troubleshooting

### "Token inválido"
- Verifica que el token no haya expirado (válido por 12 horas)
- Comprueba el formato: `Authorization: Bearer <TOKEN>`

### "No autorizado"
- No incluiste token o está malformado
- Está fuera de `Authorization` header

### "Prohibido" (403)
- Eres líder intentando acceder registros de otro
- O intentaste editar/borrar recurso que no es tuyo

### Líder no puede loguearse
- Verifica que el líder tiene `passwordHash` (creado con contraseña)
- Intenta recrear el líder con `POST /api/leaders` + property `password`

---

## 📖 API Reference

### Auth Endpoints

#### `POST /api/auth/admin-login`
```json
Request:  { "username": "string", "password": "string" }
Response: { "token": "string" }
Error:    { "error": "Credenciales inválidas" }
```

#### `POST /api/auth/leader-login`
```json
Request:  { "leaderId": "ObjectId|string", "password": "string" }
Response: { "token": "string" }
Error:    { "error": "Credenciales inválidas" }
```

---

¡Tu sistema está ahora **asegurado** con autenticación JWT! 🎉
