# 🔗 LISTADO COMPLETO DE ENDPOINTS /api/v2

## 📊 RESUMEN
- **Total Endpoints**: 40+
- **Módulos**: 5 enterprise
- **Patrón**: Controller → Service → Repository
- **Auth**: JWT 24h con fallback en memoria
- **Namespace**: `/api/v2` (enterprise), `/api` (legacy)

---

## 🔐 AUTH (7 endpoints)

### Public
- `POST /api/v2/auth/admin-login`
  - Body: `{ username, password }`
  - Response: `{ token, admin: { email, username, ... } }`
  - Status: 200 OK | 401 Unauthorized | 400 Bad Request

- `POST /api/v2/auth/leader-login`
  - Body: `{ email, password }`
  - Response: `{ token, leader: { email, name, cedula, ... } }`
  - Status: 200 OK | 401 Unauthorized

- `POST /api/v2/auth/request-password-reset`
  - Body: `{ email, role? }`
  - Response: `{ message: "Reset email sent" }`
  - Status: 200 OK

- `POST /api/v2/auth/reset-password`
  - Body: `{ token, newPassword, role? }`
  - Response: `{ message: "Password updated" }`
  - Status: 200 OK | 400 Invalid Token

### Protected (require JWT)
- `POST /api/v2/auth/change-password`
  - Header: `Authorization: Bearer <token>`
  - Body: `{ oldPassword, newPassword }`
  - Status: 200 OK | 401 | 400

- `POST /api/v2/auth/verify-token`
  - Header: `Authorization: Bearer <token>`
  - Response: `{ userId, role, email }`
  - Status: 200 OK | 401 Unauthorized

- `POST /api/v2/auth/logout`
  - Header: `Authorization: Bearer <token>`
  - Response: `{ message: "Logout exitoso" }`
  - Status: 200 OK

---

## 👥 LEADERS (9 endpoints)

### Public
- `GET /api/v2/leaders`
  - Response: Array de líderes
  - Query: `filter?`, `page?`, `limit?`

- `GET /api/v2/leaders/:id`
  - Response: Single leader object

- `POST /api/v2/leaders/token/:token`
  - Body: Optional context
  - Response: JWT token + leader data

### Protected (require JWT + admin role)
- `POST /api/v2/leaders`
  - Body: Create leader data
  - Response: New leader object
  - Status: 201 Created

- `PUT /api/v2/leaders/:id`
  - Body: Update fields
  - Response: Updated leader
  - Status: 200 OK

- `PATCH /api/v2/leaders/:id/specialty`
  - Body: `{ specialty }`
  - Response: Updated leader
  - Status: 200 OK

- `PATCH /api/v2/leaders/:id/assign`
  - Body: `{ eventId }`
  - Response: Assignment info
  - Status: 200 OK

- `DELETE /api/v2/leaders/:id`
  - Response: `{ message: "Deleted" }`
  - Status: 204 No Content

- `GET /api/v2/leaders/by-specialty/:specialty`
  - Response: Array filtered by specialty
  - Status: 200 OK

---

## 🎯 EVENTS (8 endpoints)

### Public
- `GET /api/v2/events/active/current`
  - Response: Current active event object
  - Status: 200 OK | 404 Not Found

- `GET /api/v2/events`
  - Query: `status?`, `page?`, `limit?`
  - Response: Array of events
  - Status: 200 OK

- `GET /api/v2/events/:id`
  - Response: Event details + stats
  - Status: 200 OK

### Protected (admin only)
- `POST /api/v2/events`
  - Body: Create event data
  - Response: New event
  - Status: 201 Created

- `PUT /api/v2/events/:id`
  - Body: Update fields  
  - Response: Updated event
  - Status: 200 OK

- `PATCH /api/v2/events/:id/status`
  - Body: `{ status }`
  - Response: Updated
  - Status: 200 OK

- `DELETE /api/v2/events/:id`
  - Response: `{ message: "Deleted" }`
  - Status: 204 No Content

- `GET /api/v2/events/:id/stats`
  - Response: Real-time event statistics
  - Status: 200 OK

---

## 🗳️ PUESTOS (12 endpoints)

### Public
- `GET /api/v2/puestos/localidades`
  - Response: Array of unique localities
  - Status: 200 OK

- `GET /api/v2/puestos/localidad/:localidad`
  - Query: `limit?`
  - Response: Array of puestos in locality
  - Status: 200 OK

- `GET /api/v2/puestos/:id`
  - Response: Single puesto detail
  - Status: 200 OK

- `GET /api/v2/puestos/localidad/:localidad/mesas`
  - Response: Unique mesas in locality
  - Status: 200 OK

- `GET /api/v2/puestos/locality/:localidad/by-mesa`
  - Response: Grouped by mesa
  - Status: 200 OK

### Protected (admin only)
- `POST /api/v2/puestos`
  - Body: Single puesto
  - Response: Created puesto
  - Status: 201 Created

- `POST /api/v2/puestos/bulk`
  - Body: Array of puestos
  - Response: `{ created: n, errors: [...] }`
  - Status: 200 OK

- `PUT /api/v2/puestos/:id`
  - Body: Update fields
  - Response: Updated puesto
  - Status: 200 OK

- `DELETE /api/v2/puestos/:id`
  - Response: `{ message: "Deleted" }`
  - Status: 204 No Content

- `POST /api/v2/puestos/import`
  - Body: CSV file or array
  - Response: Import results
  - Status: 200 OK

- `GET /api/v2/puestos/:localidad/stats`
  - Response: Stats for locality
  - Status: 200 OK

- `GET /api/v2/puestos/:localidad/:mesa/detail`
  - Response: Mesa detail + puestos
  - Status: 200 OK

---

## 📝 REGISTRATIONS (9 endpoints)

### Public
- `POST /api/v2/registrations`
  - Body: `{ cedula, nombre, apellido, puesto_id }`
  - Response: Registration object
  - Status: 201 Created | 409 Conflict

- `GET /api/v2/registrations/event/:eventId`
  - Query: `leader_id?`, `puesto_id?`
  - Response: Array of registrations
  - Status: 200 OK

- `GET /api/v2/registrations/:id`
  - Response: Single registration
  - Status: 200 OK

### Protected (leader with token or JWT)
- `PUT /api/v2/registrations/:id`
  - Body: Update allowed fields
  - Response: Updated registration
  - Status: 200 OK

- `POST /api/v2/registrations/by-cedula`
  - Body: `{ cedula, eventId }`
  - Response: Registration data or 404
  - Status: 200 OK | 404 Not Found

- `POST /api/v2/registrations/by-leader`
  - Body: Leader query
  - Response: Array of leader's registrations
  - Status: 200 OK

### Protected (admin only)
- `DELETE /api/v2/registrations/:id`
  - Response: `{ message: "Deleted" }`
  - Status: 204 No Content

- `POST /api/v2/registrations/bulk`
  - Body: Array of registrations
  - Response: `{ created: n, errors: [...] }`
  - Status: 200 OK

- `GET /api/v2/registrations/stats/summary`
  - Response: Aggregated stats
  - Status: 200 OK

---

## 🏥 HEALTH & UTILITY

- `GET /health`
  - Response: `{ status: "ok", timestamp }`
  - Status: 200 OK

- `GET /api/health`
  - Response: `{ status: "ok" }`
  - Status: 200 OK

---

## 🔒 AUTENTICACIÓN

### Token JWT
- Parámetro: `Authorization: Bearer <token>`
- Vigencia: 24 horas
- Datos: `{ userId, role, email, organizationId }`

### Roles
- `admin` - Acceso completo a CRUD
- `leader` - Acceso limitado a sus registraciones
- `public` - GET endpoints sin auth

### Fallback Auth
Si MongoDB no disponible:
- Admin: `admin` / `admin123`
- Leader: `lider@example.com` / `leader123`

---

## 📊 ESTADÍSTICAS

| Módulo | Count | Private | Public |
|--------|-------|---------|--------|
| Auth | 7 | 3 | 4 |
| Leaders | 9 | 6 | 3 |
| Events | 8 | 5 | 3 |
| Puestos | 12 | 7 | 5 |
| Registrations | 9 | 3 | 6 |
| **Total** | **45** | **24** | **21** |

---

## 🚀 PATRONES DE RESPUESTA

### Success (2xx)
```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": {
    // response data
  }
}
```

### Error (4xx/5xx)
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "timestamp": "2026-02-23T10:30:00Z"
  }
}
```

---

Generated: 2026-02-23  
Server: /api/v2 enterprise namespace  
Pattern: 3-tier Controller→Service→Repository  
