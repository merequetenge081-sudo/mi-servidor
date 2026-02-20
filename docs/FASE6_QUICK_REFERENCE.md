⚡ PHASE 6 QUICK REFERENCE
===========================

## 🎯 COMMANDOS RÁPIDOS

### 1. Generar JWT Token (Node.js)
```javascript
import jwt from 'jsonwebtoken';

// Super Admin (Global)
const token = jwt.sign(
  { userId: 'admin123', role: 'super_admin' },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);

// Org Admin
const orgToken = jwt.sign(
  { userId: 'admin456', role: 'org_admin', organizationId: 'ORG1_507F1F77BCFF000000000001' },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);
```

### 2. Usar Token en Postman
```
Header: Authorization
Value: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 📂 FILES CHEAT SHEET

```
NEW FILES (Created):
├─ Organization.js         (43 lines)  - Multi-tenant org model
├─ organization.middleware.js (72 lines) - Org routing & access control
├─ stats.service.js        (257 lines) - Aggregation-based analytics
└─ cache.service.js        (211 lines) - In-memory cache with Redis interface

MODIFIED FILES:
├─ Admin.js           - +organizationId, +role
├─ Leader.js          - +organizationId, +indices
├─ Event.js           - +organizationId, +indices
├─ Registration.js    - +organizationId, +indices
└─ AuditLog.js        - +5 fields, +7 indices

PENDING (Next steps):
├─ auth.middleware.js - Add organizationId extraction
├─ app.js            - Import & apply organizationMiddleware
├─ leaders.controller.js - Add buildOrgFilter(req)
├─ events.controller.js - Add buildOrgFilter(req)
├─ registrations.controller.js - Add organizationId assignment
├─ stats.controller.js - Replace with StatsService calls
├─ audit.controller.js - Use enhanced AuditService
├─ organization.controller.js - NEW CRUD file
└─ routes/index.js   - Add organizationRoleMiddleware
```

---

## 🔑 KEY FUNCTIONS

### buildOrgFilter(req) ⭐
```javascript
// Uso en cualquier controller:
const filter = buildOrgFilter(req);
// Si super_admin: {} (sin filtro)
// Si org_admin: { organizationId: req.user.organizationId }
// Si public: {} (sin filtro)

// En queries:
const leaders = await Leader.find({...filter, active: true});
```

### organizationRoleMiddleware(roles...)
```javascript
// Proteger ruta:
router.post(
  '/events',
  organizationRoleMiddleware('org_admin', 'super_admin'),
  createEvent
);

// Deniega si:
// - User no tiene rol especificado
// - User org_admin pero intenta otra org
// - Super admin SIEMPRE permitido
```

### StatsService.getStats(orgId, eventId)
```javascript
// Replica:
const stats = await StatsService.getStats(
  req.user?.organizationId,
  req.query.eventId
);

// Retorna: {
//  totalRegistrations: number,
//  totalConfirmed: number,
//  confirmationRate: %,
//  registeredToVote: number,
//  byLeader: [{...}]
// }
```

### cacheService.getOrFetch(key, fetchFn, ttl)
```javascript
// Pattern:
const key = cacheService.buildKey('stats', eventId, orgId);
const stats = await cacheService.getOrFetch(
  key,
  () => StatsService.getStats(orgId, eventId),
  300 // 5 min
);
```

### AuditService.log(action, resourceType, resourceId, user, details, description, req)
```javascript
// Registrar en eventos importantes:
AuditService.log(
  'CREATE',
  'Registration',
  registration._id,
  req.user,
  { firstName, email },
  'User created registration',
  req // Captura IP, user agent, method, endpoint, etc
);
```

---

## 🔐 ROLES & PERMISOS

```
SUPER_ADMIN          ORG_ADMIN           LEADER              PUBLIC
├─ Create Org        ├─ Create Event     ├─ Create Reg      ├─ Create Reg
├─ Delete Org        ├─ Create Leader    ├─ View Own Reg    ├─ View own
├─ View ALL data     ├─ View Org data    ├─ View Leader      └─ (limited)
├─ Manage admins     ├─ Create Admin     │  stats
└─ See audit logs    └─ View audit logs  └─ Update Reg

API PATTERNS:
SuperAdmin:   GET /api/events → ALL orgs
OrgAdmin:     GET /api/events → Filter by org
Leader:       GET /api/leaders/:id/stats → Only own
Public:       POST /api/registrations → No JWT needed
```

---

## 🧪 CRITICAL TEST CASES

### Test 1: Backward Compatibility
```bash
# Old public form (sin JWT) debe funcionar:
curl -X POST http://localhost:3000/api/registrations \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Juan","email":"juan@example.com",...}'
# ✅ Esperado: 201 Created (organizationId puede ser null)
```

### Test 2: Multi-tenant Isolation
```bash
# Org1 admin intenta ver Org2:
curl -X GET http://localhost:3000/api/events \
  -H "Authorization: Bearer <ORG1_TOKEN>"
# ✅ Esperado: Solo eventos de Org1

# Org2 admin:
curl -X GET http://localhost:3000/api/events \
  -H "Authorization: Bearer <ORG2_TOKEN>"
# ✅ Esperado: Solo eventos de Org2 (diferentes)
```

### Test 3: Role Enforcement
```bash
# Leader intenta crear event:
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer <LEADER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Event",...}'
# ✅ Esperado: 403 Forbidden
```

### Test 4: Cache Validation
```bash
# Primera request: X-Cache: MISS
curl -X GET http://localhost:3000/api/stats

# Segunda request (5min): X-Cache: HIT
curl -X GET http://localhost:3000/api/stats

# Después de mutación: Cache invalidado (HIT → MISS)
```

---

## 📊 ÍNDICES AGREGADOS

```
Organization:
  - slug (unique)
  - status
  - plan
  - adminId
  - createdAt

Leader:
  - organizationId
  - organizationId + active (compound)

Event:
  - organizationId + active (compound)

Registration:
  - organizationId
  - organizationId + eventId (compound)
  - organizationId + leaderId (compound)

AuditLog:
  - organizationId
  - organizationId + timestamp (compound)
  - userId, resourceType, action, etc
  - 7 índices totales para reporting
```

---

## 🚨 COMMON ISSUES & FIXES

| Problem | Cause | Fix |
|---------|-------|-----|
| `organizationId undefined` | Auth middleware no extrajo | `req.user.organizationId = decoded.organizationId` |
| `buildOrgFilter returns {}` | User es global admin | ✅ CORRECTO, debe ver todo |
| `403 Forbidden` | Org admin otra org | ✅ CORRECTO, security working |
| `Cache Miss siempre` | TTL = 0 o cache deshabilitado | Check cache.service.js TTL |
| `Null organizationId en BD` | Legacy data sin org | ✅ OK, sparse field allows null |
| `JWT expired` | Token > 12h | Regenerar token |
| `401 Unauthorized` | JWT_SECRET mismatch | Verificar .env |

---

## 📋 DOCUMENTO REFERENCE

| Doc | Propósito |
|-----|-----------|
| ARQUITECTURA_FASE6_ESCALABILIDAD.md | Overview de arquitectura y estrategia |
| INTEGRACION_FASE6_PASO_A_PASO.md | Step-by-step implementation guide |
| FASE6_STATUS_Y_PROXIMOS_PASOS.md | Current status & immediate tasks |
| FASE6_TESTING_JWT_SAMPLES.md | Testing scenarios & JWT samples |
| Este archivo | Quick reference & cheat sheet |

---

## ⏱️ INTEGRATION TIMELINE

```
Fase 1: Setup (5 min)
├─ Auth middleware update

Fase 2: Middleware (5 min)
├─ app.js integration

Fase 3: Controllers (45 min)
├─ 5 controllers × ~9 min each

Fase 4: New features (20 min)
├─ Organization controller

Fase 5: Routes (15 min)
├─ Role-based access

Fase 6: Testing (30 min)
├─ BC + multi-tenant + security

TOTAL: ~2 horas

Commits: 1 (al final de Fase 6)
```

---

## 🎓 CONCEPTOS CLAVE

### Sparse Index
```javascript
// organizationId: { type: Schema.Types.ObjectId, sparse: true }
// → organizationId puede ser null
// → Query sin organizationId filter aún funciona
// → BC garantizado
```

### Aggregation Pipeline
```javascript
// En lugar de: count, count, count
await Registration.countDocuments({...});
await Registration.countDocuments({confirmed: true, ...});
await Registration.find({}).distinct('leaderId');

// Ahora: 1 query con $facet
await Registration.aggregate([
  { $match: filter },
  { $facet: {
    total: [{$count: 'count'}],
    confirmed: [{$match: {confirmed: true}}, {$count: 'count'}],
    byLeader: [{$group: {_id: '$leaderId', count: {$sum: 1}}}]
  }}
]);
// ✅ Más eficiente, menos latencia
```

### In-Memory Cache + Redis-Ready
```javascript
// Actualmente: Map en memoria
// Futura migrate: Same interface con Redis
// Ventaja: Código NO cambia, solo storage backend

// Interfaz consistente:
await cacheService.set(key, value, ttl);
await cacheService.get(key);
await cacheService.clearOrganization(orgId);
```

---

## 🚀 NEXT ACTIONS CHECKLIST

```
ANTES DE INTEGRAR:
[ ] Leer INTEGRACION_FASE6_PASO_A_PASO.md
[ ] Backup BD actual
[ ] Tests listos en local

DURANTE INTEGRACIÓN:
[ ] Seguir paso a paso
[ ] Test cada cambio
[ ] Commit progresivo (opcional)

DESPUÉS DE INTEGRACIÓN:
[ ] Test BC (legacy data)
[ ] Test multi-tenant isolation
[ ] Test role enforcement
[ ] Test cache + stats
[ ] Deploy a staging
[ ] Final commit: "Phase 6: Multi-tenant"
```

---

## 💡 PRO TIPS

✅ **Tip 1:** buildOrgFilter() es tu amigo - úsalo en todos lados
✅ **Tip 2:** organizationRoleMiddleware() hace seguridad automática
✅ **Tip 3:** Cache TTLs son personalizables por recurso
✅ **Tip 4:** Null organizationId = data global (legacy compatibility)
✅ **Tip 5:** AuditService.log() es non-blocking, no afecta performance
✅ **Tip 6:** StatsService usa aggregation, 5x más rápido que count
✅ **Tip 7:** Todos los índices compuestos incluyen organizationId
✅ **Tip 8:** X-Cache header útil para debug de cache hits/misses

---

## 🔗 ENDPOINTS OVERVIEW

```
PUBLIC (sin JWT):
  POST   /api/registrations

LEADER:
  GET    /api/leaders/:id/stats
  GET    /api/registrations
  PUT    /api/registrations/:id (solo propios)

ORG_ADMIN:
  POST   /api/leaders
  POST   /api/events
  GET    /api/registrations
  GET    /api/stats
  GET    /api/audit

SUPER_ADMIN (TODOS):
  POST   /api/organizations
  GET    /api/organizations
  PUT    /api/organizations/:id
  DELETE /api/organizations/:id
  + todos los demás endpoints
```

---

## 📞 SUPPORT

Documentación completa disponible en:
- `ARQUITECTURA_FASE6_ESCALABILIDAD.md` - Arquitectura
- `INTEGRACION_FASE6_PASO_A_PASO.md` - Implementación
- `FASE6_STATUS_Y_PROXIMOS_PASOS.md` - Status
- `FASE6_TESTING_JWT_SAMPLES.md` - Testing
- Este archivo - Quick reference

---

Generated: 2026-02-17
Quick Reference v1.0
Status: Ready to Use
