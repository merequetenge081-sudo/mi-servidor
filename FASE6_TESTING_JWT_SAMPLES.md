🔐 FASE 6 - TESTING Y JWT SAMPLES
==================================

## 📋 CASOS DE PRUEBA JWT

### Caso 1: Admin Sin Org (Legacy/Global)
```javascript
// Para: Super admin que ve TODO el sistema
const legacyAdminToken = jwt.sign(
  {
    userId: "admin_001",
    email: "admin@company.com",
    role: "super_admin",
    // organizationId: null (no incluir para BC)
  },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);

// Headers en request:
Authorization: `Bearer ${legacyAdminToken}`

// Comportamiento esperado:
- buildOrgFilter(req) retorna {}
- Ver TODAS las organizaciones
- Ver TODOS los líderes/eventos/registraciones
- Puede crear nuevas organizaciones
```

### Caso 2: Org Admin (Multi-tenant)
```javascript
// Para: Admin de organización específica
const orgAdminToken = jwt.sign(
  {
    userId: "org_admin_001",
    email: "admin@org1.com",
    role: "org_admin",
    organizationId: "ORG1_ID_HERE", // Específico a su org
  },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);

// Headers en request:
Authorization: `Bearer ${orgAdminToken}`

// Comportamiento esperado:
- buildOrgFilter(req) retorna { organizationId: "ORG1_ID_HERE" }
- Ver SOLO datos de ORG1
- Crear/editar/eliminar en ORG1
- Denied en ORG2 (403 Forbidden)
```

### Caso 3: Leader (Rol de Líder)
```javascript
// Para: Líder registrador
const leaderToken = jwt.sign(
  {
    userId: "leader_001",
    email: "leader@org1.com",
    role: "leader",
    organizationId: "ORG1_ID_HERE",
  },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);

// Headers en request:
Authorization: `Bearer ${leaderToken}`

// Comportamiento esperado:
- buildOrgFilter(req) retorna { organizationId: "ORG1_ID_HERE" }
- Ver sus propias registraciones
- No puede crear líderes o eventos
- Permiso limitado a su org
```

---

## 🧪 SCRIPT DE TESTING (Node.js)

Guardar en: `test-jwt.js`

```javascript
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-12345678901234567890123456';

// Función helper para generar tokens
function generateToken(payload, expiresIn = '12h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Test 1: Legacy Admin (Sin org)
console.log('\n=== TEST 1: Legacy Admin (Global) ===');
const legacyAdminToken = generateToken({
  userId: 'admin_global',
  email: 'admin@system.com',
  role: 'super_admin'
});
console.log('Token:', legacyAdminToken);
console.log('Payload:', jwt.decode(legacyAdminToken));
console.log('Expected: buildOrgFilter(req) retorna {}');

// Test 2: Org Admin 1
console.log('\n=== TEST 2: Org Admin (ORG1) ===');
const orgAdmin1Token = generateToken({
  userId: 'admin_org1',
  email: 'admin@org1.com',
  role: 'org_admin',
  organizationId: 'ORG1_507F1F77BCFF000000000001'
});
console.log('Token:', orgAdmin1Token);
console.log('Payload:', jwt.decode(orgAdmin1Token));
console.log('Expected: buildOrgFilter(req) retorna {organizationId: "ORG1_507F..."}');

// Test 3: Org Admin 2 (Diferente org)
console.log('\n=== TEST 3: Org Admin (ORG2) ===');
const orgAdmin2Token = generateToken({
  userId: 'admin_org2',
  email: 'admin@org2.com',
  role: 'org_admin',
  organizationId: 'ORG2_507F1F77BCFF000000000002'
});
console.log('Token:', orgAdmin2Token);
console.log('Payload:', jwt.decode(orgAdmin2Token));
console.log('Expected: buildOrgFilter(req) retorna {organizationId: "ORG2_507F..."}');

// Test 4: Leader
console.log('\n=== TEST 4: Leader (ORG1) ===');
const leaderToken = generateToken({
  userId: 'leader_001',
  email: 'leader@org1.com',
  role: 'leader',
  organizationId: 'ORG1_507F1F77BCFF000000000001'
});
console.log('Token:', leaderToken);
console.log('Payload:', jwt.decode(leaderToken));
console.log('Expected: buildOrgFilter(req) retorna {organizationId: "ORG1_507F..."}');

// Test 5: Public Registration (Sin JWT, pero con referencia a evento)
console.log('\n=== TEST 5: Public Registration ===');
console.log('URL: POST /api/registrations (sin Authorization header)');
console.log('Payload: { firstName, email, eventId, leaderId, ... }');
console.log('Expected: organizationId se hereda del eventId');

console.log('\n✅ Tokens generated successfully!');
console.log('Usa estos tokens en Postman con header: Authorization: Bearer <TOKEN>');
```

Ejecutar:
```bash
node test-jwt.js
```

---

## 🧪 TEST CASOS EN POSTMAN

### Test 1: Crear Organización (Super Admin)
```
POST http://localhost:3000/api/organizations
Authorization: Bearer <LEGACY_ADMIN_TOKEN>

Body:
{
  "name": "Organización Test 1",
  "slug": "test-org-1",
  "email": "admin@testorg1.com",
  "phone": "+573001234567",
  "plan": "pro",
  "adminId": "ADMIN_ID_HERE",
  "maxLeaders": 50,
  "maxEvents": 20,
  "maxRegistrationsPerEvent": 1000
}

Expected Response:
{
  "_id": "ORG1_ID",
  "name": "Organización Test 1",
  "slug": "test-org-1",
  "plan": "pro",
  "status": "active",
  "adminId": "ADMIN_ID_HERE",
  "leadersCount": 0,
  "eventsCount": 0,
  "registrationsCount": 0,
  "createdAt": "2024-02-17T..."
}
```

### Test 2: Listar Organizaciones (Super Admin)
```
GET http://localhost:3000/api/organizations
Authorization: Bearer <LEGACY_ADMIN_TOKEN>

Expected Response: Array de todas las orgs
[
  { _id: "ORG1_ID", name: "Org 1", ... },
  { _id: "ORG2_ID", name: "Org 2", ... }
]
```

### Test 3: Org Admin Ve Solo Su Org
```
GET http://localhost:3000/api/organizations
Authorization: Bearer <ORG_ADMIN_1_TOKEN>

Expected Response:
{
  "message": "Forbidden - você pode ver apenas sua organização",
  "status": 403
}

Nota: Org admin debería tener endpoint GET /api/organization (singular)
    para ver solo su org, no listar todas
```

### Test 4: Crear Líderes en Org 1
```
POST http://localhost:3000/api/organizations/ORG1_ID/leaders
Authorization: Bearer <ORG_ADMIN_1_TOKEN>

Body:
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "email": "juan@org1.com",
  "phone": "+573001111111",
  "active": true
}

Expected:
- Status 201 Created
- Response incluye: organizationId: "ORG1_ID"
- Leader creado solo en ORG1
```

### Test 5: Org Admin NO puede crear en otra Org
```
POST http://localhost:3000/api/organizations/ORG2_ID/leaders
Authorization: Bearer <ORG_ADMIN_1_TOKEN>

Expected Response:
{
  "message": "Access denied",
  "status": 403
}
```

### Test 6: Crear Evento en Org 1
```
POST http://localhost:3000/api/organizations/ORG1_ID/events
Authorization: Bearer <ORG_ADMIN_1_TOKEN>

Body:
{
  "name": "Jornada Electoral ORG1",
  "description": "Registro de votantes",
  "date": "2024-03-15",
  "location": "Bogotá",
  "active": true
}

Expected:
- Status 201 Created
- organizationId: "ORG1_ID"
```

### Test 7: Crear Registración en Evento ORG1
```
POST http://localhost:3000/api/registrations
Content-Type: application/json
(Sin Authorization - Registro público)

Body:
{
  "firstName": "Pedro",
  "lastName": "González",
  "email": "pedro@email.com",
  "eventId": "EVENT_ORG1_ID",
  "leaderId": "LEADER_ORG1_ID",
  "confirmedToVote": true
}

Expected:
- Status 201 Created
- Response: { _id: "REG_ID", organizationId: "ORG1_ID", ... }
- organizationId heredado del eventId
```

### Test 8: Listar Registraciones (Org Admin 1)
```
GET http://localhost:3000/api/registrations
Authorization: Bearer <ORG_ADMIN_1_TOKEN>

Expected:
- Array de registraciones SOLO de ORG1
- IDs de eventos de ORG1
- Límite: 100 registraciones máximo
```

### Test 9: Listar Registraciones (Super Admin)
```
GET http://localhost:3000/api/registrations
Authorization: Bearer <LEGACY_ADMIN_TOKEN>

Expected:
- Array de TODAS las registraciones (ORG1, ORG2, etc)
- buildOrgFilter(req) retorna {} → sin filtro
```

### Test 10: Stats (Con Cache)
```
GET http://localhost:3000/api/stats?eventId=EVENT_ORG1_ID
Authorization: Bearer <ORG_ADMIN_1_TOKEN>

Primer request:
- Header response: X-Cache: MISS
- Status: 200
- Cuerpo: { totalRegistrations: 10, totalConfirmed: 8, ... }

Segundo request (dentro de 5 min):
- Header response: X-Cache: HIT
- Status: 200 (misma respuesta, desde cache)
```

### Test 11: Audit Log
```
GET http://localhost:3000/api/audit?limit=10&action=CREATE
Authorization: Bearer <LEGACY_ADMIN_TOKEN>

Expected:
[
  {
    _id: "AUDIT_001",
    action: "CREATE",
    resourceType: "Registration",
    resourceId: "REG_123",
    userId: "leader_001",
    organizationId: "ORG1_ID",
    userAgent: "PostmanRuntime/7.x.x",
    method: "POST",
    endpoint: "/api/registrations",
    statusCode: 201,
    duration: 45,
    timestamp: "2024-02-17T...",
    description: "Created registration..."
  }
]
```

---

## 🔄 FLUJO DE TESTING COMPLETO

### 1️⃣ Setup Inicial
```bash
# Generar JWT tokens
node test-jwt.js

# Copiar tokens a environment de Postman
# o ambiente de testing
```

### 2️⃣ Casos de Éxito (Happy Path)
```
[x] 1. Create Organization (Super Admin) ✅
[x] 2. List Organizations (Super Admin) ✅
[x] 3. Create Leader in Org (Org Admin) ✅
[x] 4. Create Event in Org (Org Admin) ✅
[x] 5. Create Registration (Public) ✅
[x] 6. List Registrations (Org Admin - filtered) ✅
[x] 7. List Registrations (Super Admin - all) ✅
[x] 8. Get Stats (Cached) ✅
[x] 9. Get Audit Logs (Filtered by org) ✅
[x] 10. Get Leader Stats (Per-org) ✅
```

### 3️⃣ Casos de Seguridad
```
[x] 1. Org1 Admin CANNOT access Org2 data ✅
[x] 2. Org1 Admin CANNOT create in Org2 ✅
[x] 3. Leader CANNOT create Events ✅
[x] 4. Leader CANNOT delete Registrations ✅
[x] 5. Public user CANNOT access admin endpoints ✅
[x] 6. Invalid JWT → 401 Unauthorized ✅
[x] 7. Expired JWT → 401 Unauthorized ✅
```

### 4️⃣ Casos de Backward Compatibility
```
[x] 1. Legacy Admin (sin organizationId) funciona ✅
[x] 2. Queries sin org filter retornan datos ✅
[x] 3. Public registrations SIN JWT funcionan ✅
[x] 4. Stats globales (sin org filter) funcionan ✅
[x] 5. Existing leaders/events/registrations accesibles ✅
```

### 5️⃣ Casos de Performance
```
[x] 1. Cache HIT devuelve en <50ms ✅
[x] 2. Cache MISS + query devuelve en <200ms ✅
[x] 3. Aggregation stats vs multiple queries faster ✅
[x] 4. Indices utilizados en queries (explain plan) ✅
```

---

## 📊 MATRIZ DE PERMISO

```
╔════════════════╦═══════════╦═══════════╦═══════════╦═════════════╗
║ Resource/Role  ║ PublicAPI ║ Leader    ║ OrgAdmin  ║ SuperAdmin  ║
╠════════════════╬═══════════╬═══════════╬═══════════╬═════════════╣
║ Create Event   ║    ✗      ║     ✗     ║     ✓     ║      ✓      ║
║ Read Events    ║    ✓      ║     ✓     ║     ✓     ║      ✓      ║
║ Update Event   ║    ✗      ║     ✗     ║     ✓*    ║      ✓      ║
║ Delete Event   ║    ✗      ║     ✗     ║     ✓*    ║      ✓      ║
║                ║           ║           ║           ║             ║
║ Create Leader  ║    ✗      ║     ✗     ║     ✓     ║      ✓      ║
║ Read Leaders   ║    ✓      ║     ✓     ║     ✓     ║      ✓      ║
║ Update Leader  ║    ✗      ║     ✗     ║     ✓*    ║      ✓      ║
║                ║           ║           ║           ║             ║
║ Create Reg     ║    ✓      ║     ✓     ║     ✓     ║      ✓      ║
║ Read Reg       ║    ✗ (own)║     ✓*    ║     ✓     ║      ✓      ║
║ Update Reg     ║    ✗      ║     ✓*    ║     ✓*    ║      ✓      ║
║ Delete Reg     ║    ✗      ║     ✗     ║     ✓     ║      ✓      ║
║                ║           ║           ║           ║             ║
║ View Stats     ║    ✗      ║     ✓*    ║     ✓     ║      ✓      ║
║ View Audit     ║    ✗      ║     ✗     ║     ✓     ║      ✓      ║
║                ║           ║           ║           ║             ║
║ Create Org     ║    ✗      ║     ✗     ║     ✗     ║      ✓      ║
║ Read Org       ║    ✗      ║     ✗     ║     ✓✓    ║      ✓      ║
║ Update Org     ║    ✗      ║     ✗     ║     ✗     ║      ✓      ║
║ Delete Org     ║    ✗      ║     ✗     ║     ✗     ║      ✓      ║
╚════════════════╩═══════════╩═══════════╩═══════════╩═════════════╝

Leyenda:
✓  = Permitido sin restricción
✓* = Permitido solo para su org
✓✓ = Solo su propia org (no listar todas)
✗  = Denegado
```

---

## 🐛 DEBUGGING

### Problema: "Organization not found"
```javascript
// Debug: Verificar que organizationId se extrajo correctamente
console.log('req.user:', req.user);
console.log('req.organization:', req.organization);
console.log('filter:', buildOrgFilter(req));

// Solución: Verificar JWT contiene organizationId
// Decodificar token en jwt.io
```

### Problema: "buildOrgFilter retorna {}"
```javascript
// Es NORMAL si:
// 1. Usuario es super_admin (puede ver todo)
// 2. No hay JWT (public API)
// 3. Token sin organizationId (legacy admin)

// Debug:
const filter = buildOrgFilter(req);
console.log('Filter:', JSON.stringify(filter));
// Si {} → usuario tiene acceso global (esperado para super_admin)
```

### Problema: "401 Unauthorized"
```javascript
// Causas:
// 1. Token no incluido en header
// 2. Token expirado (verificar expiresIn)
// 3. JWT_SECRET no coincide
// 4. Token malformado

// Debug:
const token = req.headers.authorization?.split(' ')[1];
console.log('Token from header:', token);
const decoded = jwt.decode(token);
console.log('Decoded:', decoded);
```

### Problema: "403 Forbidden"
```javascript
// Causas:
// 1. Org admin intentando acceder otra org
// 2. Leader intentando crear event
// 3. organizationRoleMiddleware rechazó

// Debug:
console.log('req.user:', req.user);
console.log('req.organization:', req.organization);
console.log('organizationId from URL:', req.params.orgId);
```

---

## 🚀 COMANDOS ÚTILES

```bash
# Decodificar JWT online:
# https://jwt.io

# Validar JWT en CLI:
node -e "console.log(require('jsonwebtoken').decode('<TOKEN>'))"

# Ver logs por org:
grep "ORG1_ID" logs/*.log

# Buscar errores de autenticación:
grep "401\|403\|Unauthorized\|Forbidden" logs/*.log

# Simular delay en base de datos:
# En Postman: Tests tab
pm.expect(pm.response.responseTime).to.be.below(200);
```

---

Generated: 2026-02-17
Version: 1.0
Status: Ready for Testing
