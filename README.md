# Sistema de Gestión de Eventos y Líderes

**Una plataforma profesional de API REST completa para la gestión integral de eventos, líderes, registros y auditoría**

---

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Características Principales](#características-principales)
- [Requisitos del Sistema](#requisitos-del-sistema)
- [Instalación](#instalación)
- [Variables de Entorno](#variables-de-entorno)
- [Arquitectura del Proyecto](#arquitectura-del-proyecto)
- [Endpoints Principales](#endpoints-principales)
- [Flujo de Autenticación](#flujo-de-autenticación)
- [Ejemplos de Requests](#ejemplos-de-requests)
- [Despliegue](#despliegue)
- [Licencia](#licencia)

---

## 🎯 Descripción General

Este proyecto es un **Sistema Profesional de Gestión de Eventos** construido con **Node.js y Express**, que proporciona una API REST completa y modular para:

✅ **Gestión de Líderes** - Crear, actualizar, eliminar y gestionar líderes de eventos  
✅ **Gestión de Eventos** - Administrar eventos, asignar líderes y gestionar registros  
✅ **Registro de Personas** - Sistema robusto de registro con validación  
✅ **Auditoría Integral** - Trazabilidad completa de todas las operaciones  
✅ **Autenticación JWT** - Sistema seguro de autenticación basado en roles  
✅ **API REST Modular** - Arquitectura profesional y escalable  

---

## ⭐ Características Principales

### Autenticación y Seguridad
- 🔐 Autenticación basada en **JWT (JSON Web Tokens)**
- 👥 Sistema de roles: **Admin** y **Líder**
- 🛡️ Middlewares de protección en todas las rutas sensibles
- 💾 Hashing seguro de contraseñas con **bcryptjs**

### Gestión de Datos
- **MongoDB** como base de datos principal
- Modelos CRUD completos para todas las entidades
- Relaciones correctamente configuradas entre documentos
- Validación de datos en controladores

### Auditoría y Trazabilidad
- 📊 Sistema de auditoría que registra todas las operaciones
- 🔍 Filtrado por usuario, acción y tipo de recurso
- 📈 Análisis completo del historial de cambios

### Notificaciones
- 📧 Sistema de notificaciones por email
- 💬 Integración con WhatsApp Web
- 📱 Envío de SMS
- Notificación automática al registrar usuarios

### API REST Modular
- Arquitectura de **N capas** (routes → controllers → models → services)
- Separación clara de responsabilidades
- Fácil de mantener y escalar

---

## 💻 Requisitos del Sistema

| Requisito | Versión |
|-----------|---------|
| **Node.js** | 18.x o superior |
| **npm** | 9.x o superior |
| **MongoDB** | 5.x o superior |
| **Git** | Última versión |

### Verificar Instalación

```bash
node --version
npm --version
mongod --version
```

---

## 🚀 Instalación

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/tuusuario/mi-servidor.git
cd mi-servidor
```

### Paso 2: Instalar Dependencias

```bash
npm install
```

### Paso 3: Configurar Variables de Entorno

```bash
cp .env.example .env
```

Luego editar `.env` con tus credenciales:

```env
MONGO_URL=mongodb://localhost:27017/mi-servidor
JWT_SECRET=tu-secreto-jwt-super-seguro-aqui
PORT=5000
```

### Paso 4: Iniciar Servidor

```bash
npm start
```

El servidor estará disponible en: **http://localhost:5000**

---

## 🔑 Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MONGO_URL` | Cadena de conexión a MongoDB | `mongodb://localhost:27017/mi-servidor` |
| `JWT_SECRET` | Clave secreta para firmar JWT | `mi-secreto-super-seguro-123` |
| `PORT` | Puerto de ejecución del servidor | `5000` |

### Crear archivo `.env.example`

```bash
# .env.example
MONGO_URL=mongodb://localhost:27017/mi-servidor
JWT_SECRET=tu-secreto-jwt-seguro
PORT=5000
```

---

## 🏗️ Arquitectura del Proyecto

```
proyecto/
│
├── src/
│   ├── config/              # Configuración de la aplicación
│   │   ├── db.js           # Conexión a MongoDB
│   │   └── env.js          # Variables de entorno
│   │
│   ├── controllers/         # Lógica de negocios
│   │   ├── auth.controller.js
│   │   ├── events.controller.js
│   │   ├── leaders.controller.js
│   │   ├── registrations.controller.js
│   │   └── audit.controller.js
│   │
│   ├── middleware/          # Middlewares de Express
│   │   ├── auth.middleware.js       # Verificar JWT
│   │   ├── role.middleware.js       # Validar roles
│   │   └── owner.middleware.js      # Autorización por propietario
│   │
│   ├── models/              # Esquemas de MongoDB
│   │   ├── Admin.js
│   │   ├── Leader.js
│   │   ├── Event.js
│   │   ├── Registration.js
│   │   └── AuditLog.js
│   │
│   ├── routes/              # Definición de rutas
│   │   ├── index.js         # Rutas principales
│   │   ├── auth.routes.js
│   │   ├── events.routes.js
│   │   ├── leaders.routes.js
│   │   ├── registrations.routes.js
│   │   └── audit.routes.js
│   │
│   ├── services/            # Servicios reutilizables
│   │   ├── audit.service.js       # Auditoría
│   │   └── notification.service.js # Notificaciones
│   │
│   └── app.js              # Configuración principal de Express
│
├── public/                  # Archivos estáticos
│   ├── login.html
│   ├── index.html
│   ├── app.html
│   ├── leader.html
│   ├── audit-logs.html
│   └── form.html
│
├── scripts/                 # Scripts de utilidad
│
├── server.js               # Punto de entrada
├── package.json            # Dependencias
├── .env                    # Variables de entorno
├── .gitignore
└── README.md

```

### Descripción de Capas

#### 🔹 `src/config/`
Configuración centralizada de la aplicación:
- **db.js**: Conexión a MongoDB con reintentos automáticos
- **env.js**: Validación de variables de entorno requeridas

#### 🔹 `src/controllers/`
Contiene toda la lógica de negocios:
- Validación de datos
- Procesamiento de solicitudes
- Respuestas formateadas
- Integración con servicios

#### 🔹 `src/middleware/`
Middlewares de protección:
- **auth.middleware.js**: Verifica JWT en todas las rutas protegidas
- **role.middleware.js**: Valida que el usuario tenga permisos suficientes
- **owner.middleware.js**: Autorización a nivel de recurso

#### 🔹 `src/models/`
Esquemas Mongoose de MongoDB:
- Definición de estructura de datos
- Índices y relaciones
- Métodos personalizados si aplica

#### 🔹 `src/routes/`
Definición de endpoints REST:
- Asignación de controladores
- Aplicación de middlewares
- Métodos HTTP (GET, POST, PUT, DELETE)

#### 🔹 `src/services/`
Lógica reutilizable independiente de rutas:
- **audit.service.js**: Registro de auditoría
- **notification.service.js**: Envío de notificaciones

---

## 🔌 Endpoints Principales

### Autenticación
```
POST   /api/auth/login                    # Login (admin o líder)
POST   /api/auth/admin/create             # Crear nuevo admin (admin only)
POST   /api/auth/leader/register          # Registrar nuevo líder (admin only)
```

### Eventos
```
GET    /api/events                        # Obtener todos los eventos
GET    /api/events/:id                    # Obtener evento por ID
POST   /api/events                        # Crear evento (admin only)
PUT    /api/events/:id                    # Actualizar evento (admin only)
DELETE /api/events/:id                    # Eliminar evento (admin only)
```

### Líderes
```
GET    /api/leaders                       # Obtener todos los líderes (admin only)
GET    /api/leaders/:id                   # Obtener líder por ID
POST   /api/leaders                       # Crear líder (admin only)
PUT    /api/leaders/:id                   # Actualizar líder (admin/owner)
DELETE /api/leaders/:id                   # Eliminar líder (admin only)
```

### Registros
```
GET    /api/registrations                 # Obtener todos (admin only)
GET    /api/registrations/:id             # Obtener por ID
GET    /api/registrations/leader/:leaderId # Registros del líder
POST   /api/registrations                 # Crear registro
PUT    /api/registrations/:id             # Actualizar (admin/owner)
DELETE /api/registrations/:id             # Eliminar (admin/owner)
```

### Auditoría
```
GET    /api/audit                         # Obtener logs de auditoría (admin only)
```

---

## 🔐 Flujo de Autenticación

### 1. Login y Obtener Token

El usuario se autentica con sus credenciales:

```
cliente → POST /api/auth/login → servidor
```

**El servidor devuelve un JWT** con los datos del usuario:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "65abc...",
    "role": "admin",
    "username": "admin_user",
    "name": "Administrador"
  }
}
```

### 2. Usar el Token

En cada solicitud protegida, enviar el token en el header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Validación en Servidor

El middleware `auth.middleware.js` verifica:
- ✅ Que el token esté presente
- ✅ Que sea válido y no haya expirado
- ✅ Que se decodifique correctamente

### Sistema de Roles

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso total a todas las operaciones |
| **Líder** | Acceso a sus propios datos y registros |

---

## 📨 Ejemplos de Requests

### Ejemplo 1: Login

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@example.com",
    "password": "contraseña",
    "role": "admin"
  }'
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "65abc123...",
    "role": "admin",
    "username": "admin@example.com",
    "name": "Administrador"
  }
}
```

---

### Ejemplo 2: Crear un Evento

**Request:**
```bash
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "name": "Elecciones 2024",
    "date": "2024-06-15",
    "description": "Evento electoral principal",
    "active": true
  }'
```

**Response (201):**
```json
{
  "message": "Evento creado exitosamente",
  "event": {
    "_id": "65abc456...",
    "name": "Elecciones 2024",
    "date": "2024-06-15T00:00:00.000Z",
    "description": "Evento electoral principal",
    "token": "event-1706123456",
    "active": true,
    "createdAt": "2024-01-25T10:30:00.000Z"
  }
}
```

---

### Ejemplo 3: Crear un Líder

**Request:**
```bash
curl -X POST http://localhost:5000/api/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+57 3001234567",
    "area": "Bogotá",
    "eventId": "65abc456...",
    "password": "segura123"
  }'
```

**Response (201):**
```json
{
  "message": "Líder creado exitosamente",
  "leader": {
    "_id": "65abc789...",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+57 3001234567",
    "area": "Bogotá",
    "token": "leader-1706123456-abc123def",
    "active": true,
    "registrations": 0,
    "createdAt": "2024-01-25T10:30:00.000Z"
  }
}
```

---

### Ejemplo 4: Registrar una Persona

**Request:**
```bash
curl -X POST http://localhost:5000/api/registrations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "leaderId": "65abc789...",
    "leaderName": "Juan Pérez",
    "eventId": "65abc456...",
    "firstName": "Carlos",
    "lastName": "González",
    "cedula": "12345678",
    "email": "carlos@example.com",
    "phone": "+57 3109876543",
    "localidad": "Puente Aranda",
    "registeredToVote": true,
    "votingPlace": "IE Central",
    "votingTable": "A-05"
  }'
```

**Response (201):**
```json
{
  "message": "Registro creado exitosamente",
  "registration": {
    "_id": "65abcdef0...",
    "leaderId": "65abc789...",
    "leaderName": "Juan Pérez",
    "eventId": "65abc456...",
    "firstName": "Carlos",
    "lastName": "González",
    "email": "carlos@example.com",
    "phone": "+57 3109876543",
    "cedula": "12345678",
    "localidad": "Puente Aranda",
    "registeredToVote": true,
    "votingPlace": "IE Central",
    "votingTable": "A-05",
    "confirmed": false,
    "createdAt": "2024-01-25T10:35:00.000Z"
  }
}
```

---

### Ejemplo 5: Obtener Logs de Auditoría

**Request:**
```bash
curl -X GET "http://localhost:5000/api/audit?action=CREATE&limit=10" \
  -H "Authorization: Bearer eyJhbGc..."
```

**Response (200):**
```json
{
  "logs": [
    {
      "_id": "65abc001...",
      "action": "CREATE",
      "resourceType": "Registration",
      "resourceId": "65abcdef0...",
      "userId": "65abc789...",
      "userRole": "admin",
      "userName": "admin@example.com",
      "description": "Nuevo registro creado para: Carlos González",
      "ipAddress": "192.168.1.100",
      "createdAt": "2024-01-25T10:35:00.000Z"
    }
  ],
  "total": 45,
  "limit": 10,
  "skip": 0
}
```

---

## 🚢 Despliegue

### Opción 1: Servidor VPS (Linux)

#### Instalación Inicial

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar MongoDB
sudo apt install -y mongodb

# Iniciar MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### Desplegar Aplicación

```bash
# Clonar repositorio
git clone https://github.com/tuusuario/mi-servidor.git
cd mi-servidor

# Instalar dependencias
npm install

# Crear archivo .env
nano .env
# Configurar variables

# Iniciar con PM2 (recomendado para producción)
npm install -g pm2
pm2 start server.js --name "mi-servidor"
pm2 save
```

---

### Opción 2: Docker

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MONGO_URL=mongodb://mongo:27017/mi-servidor
      - JWT_SECRET=tu-secreto-jwt-seguro
      - PORT=5000
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:5.0
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

#### Ejecutar

```bash
docker-compose up -d
```

---

### Opción 3: Railway (PaaS)

1. **Crear cuenta en [Railway.app](https://railway.app)**
2. **Conectar repositorio de GitHub**
3. **Configurar variables de entorno en Dashboard:**
   - `MONGO_URL`
   - `JWT_SECRET`
   - `PORT=5000`
4. **Railway desplegará automáticamente**

---

### Opción 4: Render (PaaS)

1. **Crear cuenta en [Render.com](https://render.com)**
2. **Crear nuevo Web Service**
3. **Conectar repositorio de GitHub**
4. **Configurar:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Variables de entorno
5. **Render desplegará automáticamente**

---

## 📝 Consideraciones de Producción

- ✅ Usar HTTPS en vez de HTTP
- ✅ Configurar CORS apropiadamente
- ✅ Implementar rate limiting
- ✅ Usar variables de entorno sensibles
- ✅ Mantener logs centralizados
- ✅ Configurar Backup automático de BD
- ✅ Monitoreo de uptime y errores

---

## 📄 Licencia

MIT License - Ver archivo `LICENSE` para detalles.

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

## 👥 Créditos

**Desarrollador:** [Tu Nombre]  
**Fecha:** Enero 2024  
**Versión:** 1.0.0

---

**Última actualización:** Enero 25, 2024

Para soporte o preguntas, contactar a: support@example.com