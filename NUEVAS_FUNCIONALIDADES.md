# 🔐 Sistema de Seguridad y Auditoría

## Resumen de Implementación

Se implementó un sistema completo de **autenticación JWT**, **control de acceso basado en roles (RBAC)** y **auditoría detallada** de todas las operaciones administrativas.

---

## 🚀 Nuevas Características

### 1. Panel de Login Responsivo (`/login`)

**URL**: `http://localhost:3000/login`

- Interfaz moderna y amigable con dos opciones de login
- **Login Admin**: usuario + contraseña
- **Login Líder**: ID del líder + contraseña
- Almacena tokens JWT en `localStorage`
- Redirige automáticamente a `/app.html` si ya está autenticado
- Estilos modernos con gradientes y animaciones

### 2. Autenticación JWT

**Duración de sesión**: 12 horas

#### Endpoints:

- `POST /api/auth/admin-login`
  ```json
  {
    "username": "admin",
    "password": "tu_contraseña"
  }
  ```

- `POST /api/auth/leader-login`
  ```json
  {
    "leaderId": "698cd4eef96261a94c70a0ea",
    "password": "su_contraseña"
  }
  ```

Ambos devuelven:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Sistema de Auditoría Completo

Se registran **TODAS** las operaciones importantes:

#### Tipos de Acciones Auditadas:

| Acción | Descripción | Quién |
|--------|-------------|-------|
| **LOGIN** | Intentos de acceso (exitosos y fallidos) | Admin y Líder |
| **CREATE** | Creación de registros | Sistema |
| **UPDATE** | Edición de registros | Admin y Líder |
| **DELETE** | Eliminación de registros | Admin y Líder |
| **EXPORT** | Exportación de datos a Excel | Admin |

#### Información Grabada:

- **Usuario**: nombre/ID y rol
- **Acción**: tipo de operación
- **Recurso**: tipo y ID del recurso afectado
- **Cambios**: qué valores se modificaron (antes/después)
- **Timestamp**: fecha y hora exacta
- **IP**: dirección IP del cliente
- **Descripción**: contexto adicional

### 4. Panel de Auditoría (`/audit`)

**URL**: `http://localhost:3000/audit`

**Solo accesible para Administradores**

#### Características:

- 📊 **Estadísticas en tiempo real**
  - Cantidad de logins, creaciones, ediciones, eliminaciones
  - Actividad por usuario

- 🔍 **Filtros avanzados**
  - Por tipo de acción (LOGIN, CREATE, UPDATE, DELETE, EXPORT)
  - Por tipo de recurso (registration, leader, event, admin)
  - Búsqueda por usuario

- 📋 **Tabla detallada**
  - Vista paginada de 50 registros por página
  - Información completa de cada acción
  - Botón para ver detalles completos

- 📥 **Descarga en CSV**
  - Exportar el registro de auditoría completo
  - Formato compatible con Excel

- 🔒 **Detalles con modal**
  - Ver qué cambios exactos se realizaron
  - Comparación antes/después de valores

### 5. Control de Acceso por Rol (RBAC)

#### Admin
- ✅ Acceso total a todos los datos
- ✅ Ve todos los registros (sin restricciones)
- ✅ Puede editar/eliminar registros de cualquier líder
- ✅ Puede ver logs de auditoría
- ✅ Puede exportar datos

#### Líder
- ✅ Ve solo sus propios registros
- ✅ Puede editar solo sus registros
- ✅ Puede eliminar solo sus registros
- ❌ No puede ver auditoría
- ❌ No puede ver registros de otros líderes

---

## 📝 Endpoints de API

### Autenticación

```
POST /api/auth/admin-login        → Obtener token admin
POST /api/auth/leader-login       → Obtener token líder
```

### Auditoría (Solo Admin)

```
GET /api/audit-logs                  → Obtener registros de auditoría
  Parámetros:
    - action: LOGIN|CREATE|UPDATE|DELETE|EXPORT
    - resourceType: registration|leader|event|admin
    - userId: buscar por usuario
    - limit: cantidad por página (default 100)
    - skip: registros a saltar (para paginación)

GET /api/audit-stats                 → Estadísticas de auditoría
  Respuesta incluye:
    - actionStats: conteo por tipo de acción
    - userStats: actividad por usuario
```

### Registro/Edición (Protegidos)

```
GET /api/registrations              → Ver registros (filtrado por rol)
PUT /api/registrations/:id          → Editar registro (solo owner/admin)
DELETE /api/registrations/:id       → Eliminar registro (solo owner/admin)
GET /api/export/:type               → Exportar datos (solo autenticado)
```

---

## 🛠️ Scripts Útiles

### Crear Admin

```bash
# Interactivo
node create_admin.js admin tu_contraseña

# O usando .env
ADMIN_USER=admin ADMIN_PASS=password node create_admin.js
```

### Crear Líder de Prueba

```bash
node create_leader.js "Nombre" "email@test.local" "3001234567" "password123"
```

---

## 📖 Ejemplos de Uso

### 1. Login como Admin

```bash
curl -X POST http://localhost:3000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123456"}'

# Respuesta:
# {"token":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

### 2. Obtener Audit Logs

```bash
TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

curl 'http://localhost:3000/api/audit-logs?action=LOGIN&limit=10' \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Editar Registro (Auditoría Automática)

```bash
curl -X PUT http://localhost:3000/api/registrations/123abc \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Juan","lastName":"Pérez"}'

# Se registra automáticamente en auditoría:
# - Quién editó (usuario y rol)
# - Qué cambios se hicieron (valores antes y después)
# - Cuándo se editó
# - Desde qué dirección IP
```

---

## 🔒 Seguridad

### En Producción:

1. **Cambiar JWT_SECRET**
   ```env
   JWT_SECRET=tu_secreto_muy_largo_y_aleatorio
   ```

2. **Usar HTTPS**
   - Todos los tokens JWT deben viajar por HTTPS

3. **Contraseñas Fuertes**
   - Admin: mínimo 12 caracteres
   - Líderes: mínimo 8 caracteres

4. **Rotar Credenciales**
   - Cambiar contraseña de admin regularmente
   - Revocar acceso de líderes inactivos

5. **Backup de Auditoría**
   - Exportar logs regularmente para archivo
   - Considerar logging a servicio externo

6. **Token Refresh (Opcional)**
   - Implementar refresh tokens para sesiones largas
   - Actualmente: tokens válidos por 12 horas

---

## 🐛 Troubleshooting

### "No autorizado" en `/api/registrations`
- Olvidaste incluir el token
- Token expirado (válido por 12 horas)
- Formato incorrecto: debe ser `Authorization: Bearer <TOKEN>`

### "Prohibited" (403) editando registro
- Eres líder intentando editar registro de otro líder
- Solo admin puede editar registros de otros

### "Token inválido"
- JWT_SECRET no coincide (si cambiaste en .env, reinicia servidor)
- Token corrupto o modificado

### Líder no puede loguearse
- El líder no tiene `passwordHash` configurado
- Necesita ser creado con `POST /api/leaders` + property `password`
- O usar `create_leader.js`

---

## 📊 Base de Datos

### Colección AuditLog

```javascript
{
  action: 'UPDATE|CREATE|DELETE|LOGIN|EXPORT',
  resourceType: 'registration|leader|event|admin',
  resourceId: ObjectId,
  userId: 'username|leaderId',
  userRole: 'admin|leader',
  userName: 'Nombre del Usuario',
  changes: {
    fieldName: {
      old: 'valor_anterior',
      new: 'valor_nuevo'
    }
  },
  timestamp: Date,
  ipAddress: '192.168.1.100',
  description: 'Descripción de la acción'
}
```

---

## ✅ Checklist de Implementación

- [x] Autenticación JWT con tokens de 12 horas
- [x] Login admin (usuario + contraseña)
- [x] Login líder (ID + contraseña)
- [x] Hasheo de contraseñas con bcryptjs
- [x] Middleware de autenticación
- [x] RBAC: admin ve todo, líder ve solo suyo
- [x] Auditoría de LOGIN (exitosos y fallidos)
- [x] Auditoría de CREATE
- [x] Auditoría de UPDATE con cambios detallados
- [x] Auditoría de DELETE
- [x] Auditoría de EXPORT
- [x] Panel de login HTML responsivo
- [x] Panel de auditoría con filtros
- [x] Estadísticas de auditoría
- [x] Exportación de logs a CSV
- [x] IP address grabada en logs
- [x] Protección de endpoints de exportación

---

## 🚀 Próximas Mejoras (Opcional)

- [ ] Refresh tokens (extender sesión sin re-login)
- [ ] Logout explícito (blacklist de tokens)
- [ ] 2FA (autenticación de dos factores)
- [ ] Notificaciones de acceso sospechoso
- [ ] Integración con servicio externo de logging
- [ ] Rate limiting en endpoints de login
- [ ] Cambio de contraseña para usuarios
- [ ] Recuperación de contraseña por email
- [ ] Confirmación de cuenta nueva

---

¡Tu sistema está completamente asegurado y auditado! 🎉
