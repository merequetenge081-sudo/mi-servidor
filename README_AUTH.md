# Autenticación — Instrucciones rápidas

Requisitos (poner en `.env` en la raíz):

- `MONGO_URL` — URL de conexión a MongoDB (obligatorio)
- `JWT_SECRET` — secreto para firmar tokens JWT (opcional, por defecto: `dev_secret_change_me`)

1) Crear o actualizar un admin

Usa el script incluido `create_admin.js` para crear un usuario admin o actualizar su contraseña:

```bash
# desde la raíz del proyecto
node create_admin.js <username> <password>
```

También puedes establecer `ADMIN_USER` y `ADMIN_PASS` en `.env` y ejecutar el script sin args.

2) Login (obtener token)

- Admin:

POST `/api/auth/admin-login`

Body JSON:

```json
{ "username": "admin", "password": "tu-password" }
```

Respuesta: `{ "token": "<JWT>" }` — incluir en headers `Authorization: Bearer <JWT>` en llamadas protegidas.

- Líder:

POST `/api/auth/leader-login`

Body JSON:

```json
{ "leaderId": "<ID del leader>", "password": "su-password" }
```

Nota: cuando crees un líder vía `POST /api/leaders`, puedes incluir la propiedad `password` en el body y el servidor guardará el `passwordHash` automáticamente.

3) Uso de tokens y permisos

- Endpoints protegidos (ejemplo):
  - `GET /api/registrations` — requiere autenticación. `admin` ve todo; `leader` ve solo sus registros.
  - `PUT /api/registrations/:id` y `DELETE /api/registrations/:id` — solo `admin` o `leader` propietario del registro.

4) Ejemplos curl

Obtener token admin:

```bash
curl -s -X POST http://localhost:3000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tu-pass"}'
```

Listar registros como admin (suponiendo TOKEN en variable):

```bash
curl -s http://localhost:3000/api/registrations \
  -H "Authorization: Bearer $TOKEN"
```

5) Notas de seguridad

- Cambia `JWT_SECRET` en producción.
- Protege `.env` y no subas credenciales a repositorios públicos.
