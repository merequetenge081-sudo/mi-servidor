📱 GUÍA INTEGRACIÓN FASE 6
==========================

## 🎯 OBJETIVO
Integrar arquitectura multi-tenant en rutas y controladores SIN romper sistema actual.

## 🔄 ORDEN DE INTEGRACIÓN

### PASO 1: Actualizar auth.middleware.js
**Archivo:** `src/middleware/auth.middleware.js`

Cambio requerido: Extraer organizationId del JWT

```javascript
// Current implementation (buscar esta sección):
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// AGREGAR DESPUÉS:
// Soporte para organizationId en JWT
if (decoded.organizationId) {
  req.user.organizationId = decoded.organizationId;
  req.user.role = decoded.role || 'admin';
} else {
  // BC: admins sin org son super_admin
  req.user.role = decoded.role || 'super_admin';
}

// Now req.user = {
//   userId: "...",
//   organizationId: "..." || null,  // NEW
//   role: "super_admin|org_admin|leader"  // NEW
// }
```

---

### PASO 2: Integrar organization.middleware.js en app.js
**Archivo:** `src/app.js`

```javascript
// Agregar import en el top file:
import {
  organizationMiddleware,
  buildOrgFilter,
  requireOrganization,
  organizationRoleMiddleware
} from "./middleware/organization.middleware.js";

// Luego de app.use(authMiddleware):
app.use(organizationMiddleware); // Verifica org, popula req.organization

// Ahora todos los handlers tienen acceso a:
// - req.organization (verified active org, if present)
// - buildOrgFilter(req) (para queries)
// - req.user.organizationId (for conditional logic)
```

---

### PASO 3: Actualizar Leaders Controller
**Archivo:** `src/controllers/leaders.controller.js`

Pattern a seguir:

```javascript
// ANTES: (current implementation)
const leaders = await Leader.find({ active: true })
  .sort({ registrations: -1 })
  .limit(10);

// DESPUÉS: (multi-tenant ready)
import { buildOrgFilter } from "../middleware/organization.middleware.js";

// En cada método:
export const getTopLeaders = async (req, res) => {
  try {
    const filter = buildOrgFilter(req);  // Gets { organizationId: req.user.organizationId }
    
    const leaders = await Leader.find({ ...filter, active: true })
      .sort({ registrations: -1 })
      .limit(10);
    
    res.json(leaders);
  } catch (err) {
    logger.error('Error fetching leaders', { error: err.message, userId: req.user?.userId });
    res.status(500).json({ message: 'Error fetching leaders' });
  }
};

// Métodos a actualizar en leaders.controller.js:
// 1. getLeaders() - GET /api/leaders
// 2. getLeaderStats() - GET /api/leaders/:id/stats
// 3. updateLeader() - PUT /api/leaders/:id (if exists)
// 4. createLeader() - POST /api/leaders (if exists)
```

**Aplicar filter en métodos:**
- `getTopLeaders()` - Ranking list
- `getLeaderStats()` - Individual stats
- `searchLeaders()` - Search (if exists)

---

### PASO 4: Actualizar Events Controller
**Archivo:** `src/controllers/events.controller.js`

```javascript
import { buildOrgFilter } from "../middleware/organization.middleware.js";

// Patrón para get events:
export const getEvents = async (req, res) => {
  try {
    const filter = buildOrgFilter(req);
    
    const events = await Event.find({ ...filter, active: true });
    res.json(events);
  } catch (err) {
    logger.error('Error fetching events', { error: err.message });
    res.status(500).json({ message: 'Error fetching events' });
  }
};

// Métodos a actualizar:
// 1. getEvents() - GET /api/events
// 2. getEventDetails() - GET /api/events/:id
// 3. createEvent() - POST /api/events (+ assign organizationId if new org)
// 4. updateEvent() - PUT /api/events/:id
// 5. deleteEvent() - DELETE /api/events/:id
```

---

### PASO 5: Actualizar Registrations Controller
**Archivo:** `src/controllers/registrations.controller.js`

```javascript
import { buildOrgFilter } from "../middleware/organization.middleware.js";

// Para crear registration:
export const createRegistration = async (req, res) => {
  try {
    const { firstName, email, eventId, leaderId, confirmedToVote, ...rest } = req.body;
    
    // Verificar que el event pertenece a la org del leader
    const filter = buildOrgFilter(req);
    const event = await Event.findOne({ _id: eventId, ...filter });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Nuevo registration hereda organizationId del event
    const registration = new Registration({
      firstName,
      email,
      eventId,
      leaderId,
      confirmedToVote,
      organizationId: event.organizationId, // NEW
      ...rest
    });
    
    await registration.save();
    res.status(201).json(registration);
  } catch (err) {
    logger.error('Error creating registration', { error: err.message });
    res.status(400).json({ message: 'Error creating registration' });
  }
};

// Para obtener registrations:
export const getRegistrations = async (req, res) => {
  try {
    const filter = buildOrgFilter(req);
    const registrations = await Registration.find(filter).limit(100);
    res.json(registrations);
  } catch (err) {
    logger.error('Error fetching registrations', { error: err.message });
    res.status(500).json({ message: 'Error fetching registrations' });
  }
};

// Métodos a actualizar:
// 1. createRegistration() - POST /api/registrations (agregar organizationId)
// 2. getRegistrations() - GET /api/registrations
// 3. getRegistrationsByEvent() - GET /api/events/:eventId/registrations
// 4. getRegistrationsByLeader() - GET /api/leaders/:leaderId/registrations
// 5. updateRegistration() - PUT /api/registrations/:id
// 6. deleteRegistration() - DELETE /api/registrations/:id
```

---

### PASO 6: Actualizar Stats Controller
**Archivo:** `src/controllers/stats.controller.js`

```javascript
import { buildOrgFilter } from "../middleware/organization.middleware.js";
import StatsService from "../services/stats.service.js";
import cacheService from "../services/cache.service.js";

// Reemplazar implementación con StatsService:
export const getStats = async (req, res) => {
  try {
    const { eventId } = req.query;
    const organizationId = req.user?.organizationId || null;
    
    // Usar cache:
    const cacheKey = cacheService.buildKey('stats', eventId, organizationId);
    const stats = await cacheService.getOrFetch(
      cacheKey,
      () => StatsService.getStats(organizationId, eventId),
      300 // 5 min TTL
    );
    
    res.json(stats);
  } catch (err) {
    logger.error('Error fetching stats', { error: err.message });
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

export const getDailyStats = async (req, res) => {
  try {
    const { eventId, days = 30 } = req.query;
    const organizationId = req.user?.organizationId || null;
    
    const stats = await StatsService.getDailyStats(organizationId, eventId, parseInt(days));
    res.json(stats);
  } catch (err) {
    logger.error('Error fetching daily stats', { error: err.message });
    res.status(500).json({ message: 'Error fetching daily stats' });
  }
};

export const getLeaderStats = async (req, res) => {
  try {
    const { leaderId } = req.params;
    const organizationId = req.user?.organizationId || null;
    
    const stats = await StatsService.getLeaderStats(organizationId, leaderId);
    res.json(stats);
  } catch (err) {
    logger.error('Error fetching leader stats', { error: err.message });
    res.status(500).json({ message: 'Error fetching leader stats' });
  }
};

export const getEventStats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId || null;
    const stats = await StatsService.getEventStats(organizationId);
    res.json(stats);
  } catch (err) {
    logger.error('Error fetching event stats', { error: err.message });
    res.status(500).json({ message: 'Error fetching event stats' });
  }
};

// Métodos nuevos:
// 1. getStats() - GET /api/stats
// 2. getDailyStats() - GET /api/stats/daily
// 3. getLeaderStats() - GET /api/leaders/:leaderId/stats
// 4. getEventStats() - GET /api/stats/events
// 5. getGeographicStats() - GET /api/stats/geographic
```

---

### PASO 7: Actualizar Audit Controller
**Archivo:** `src/controllers/audit.controller.js`

```javascript
import { buildOrgFilter } from "../middleware/organization.middleware.js";
import AuditService from "../services/audit.service.js";

export const getAuditLogs = async (req, res) => {
  try {
    const { limit = 50, skip = 0, userId, action } = req.query;
    const organizationId = req.user?.organizationId || null;
    
    const filter = {
      ...buildOrgFilter(req),
      ...(userId && { userId }),
      ...(action && { action })
    };
    
    const logs = await AuditService.getLogs(filter, parseInt(limit), parseInt(skip));
    res.json(logs);
  } catch (err) {
    logger.error('Error fetching audit logs', { error: err.message });
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
};

export const getResourceHistory = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const organizationId = req.user?.organizationId || null;
    
    const logs = await AuditService.getResourceLogs(resourceType, resourceId, organizationId);
    res.json(logs);
  } catch (err) {
    logger.error('Error fetching resource history', { error: err.message });
    res.status(500).json({ message: 'Error fetching resource history' });
  }
};

export const getActionReport = async (req, res) => {
  try {
    const { action, startDate, endDate } = req.query;
    const organizationId = req.user?.organizationId || null;
    
    const report = await AuditService.getActionReport(
      organizationId,
      action,
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json(report);
  } catch (err) {
    logger.error('Error generating action report', { error: err.message });
    res.status(500).json({ message: 'Error generating action report' });
  }
};
```

---

## 🛡️ PROTEGER RUTAS CON organizationRoleMiddleware

**Archivo:** `src/routes/index.js`

```javascript
import {
  organizationRoleMiddleware,
  requireOrganization
} from "../middleware/organization.middleware.js";

// Rutas públicas (sin org required):
router.post('/registrations', rateLimiter, createRegistration);
router.get('/leaders', getTopLeaders);

// Rutas que requieren org + rol específico:
router.post(
  '/organizations/:orgId/leaders',
  organizationRoleMiddleware('org_admin', 'super_admin'),
  createLeader
);

router.put(
  '/organizations/:orgId/events/:eventId',
  organizationRoleMiddleware('org_admin', 'super_admin'),
  updateEvent
);

router.post(
  '/organizations/:orgId/admins',
  organizationRoleMiddleware('super_admin'),
  addAdminToOrg
);

// Rutas admin (solo super_admin):
router.get(
  '/organizations',
  organizationRoleMiddleware('super_admin'),
  getOrganizations
);

router.post(
  '/organizations',
  organizationRoleMiddleware('super_admin'),
  createOrganization
);
```

---

## 📝 IMPLEMENTAR ENDPOINTS DE ORGANIZATION

**Archivo:** `src/controllers/organization.controller.js` (NUEVO)

```javascript
import Organization from '../models/Organization.js';
import { organizationRoleMiddleware } from '../middleware/organization.middleware.js';
import logger from '../config/logger.js';

export const createOrganization = async (req, res) => {
  try {
    const { name, email, phone, plan = 'free', adminId } = req.body;
    
    // Validación
    if (!name || !email || !adminId) {
      return res.status(400).json({ message: 'name, email, adminId required' });
    }
    
    // Generar slug
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const org = new Organization({
      name,
      slug,
      email,
      phone,
      adminId,
      plan,
      status: 'active',
      maxLeaders: plan === 'free' ? 10 : (plan === 'pro' ? 100 : 10000),
      maxEvents: plan === 'free' ? 5 : (plan === 'pro' ? 50 : 10000),
      maxRegistrationsPerEvent: plan === 'free' ? 500 : (plan === 'pro' ? 5000 : 100000)
    });
    
    await org.save();
    logger.info('Organization created', { orgId: org._id, name });
    res.status(201).json(org);
  } catch (err) {
    logger.error('Error creating organization', { error: err.message });
    res.status(400).json({ message: 'Error creating organization' });
  }
};

export const getOrganizations = async (req, res) => {
  try {
    const orgs = await Organization.find();
    res.json(orgs);
  } catch (err) {
    logger.error('Error fetching organizations', { error: err.message });
    res.status(500).json({ message: 'Error fetching organizations' });
  }
};

export const getOrganizationDetails = async (req, res) => {
  try {
    const { orgId } = req.params;
    const org = await Organization.findById(orgId);
    
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    res.json(org);
  } catch (err) {
    logger.error('Error fetching organization', { error: err.message });
    res.status(500).json({ message: 'Error fetching organization' });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, email, phone, plan, status } = req.body;
    
    const org = await Organization.findByIdAndUpdate(
      orgId,
      { name, email, phone, plan, status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    logger.info('Organization updated', { orgId });
    res.json(org);
  } catch (err) {
    logger.error('Error updating organization', { error: err.message });
    res.status(400).json({ message: 'Error updating organization' });
  }
};
```

---

## ✅ CHECKLIST DE INTEGRACIÓN

```
[ ] 1. Actualizar auth.middleware.js con organizationId extraction
[ ] 2. Importar organization.middleware.js en app.js
[ ] 3. Aplicar app.use(organizationMiddleware) en app.js
[ ] 4. Actualizar Leaders controller con buildOrgFilter
[ ] 5. Actualizar Events controller con buildOrgFilter
[ ] 6. Actualizar Registrations controller con organizationId assignment
[ ] 7. Reescribir Stats controller usando StatsService
[ ] 8. Actualizar Audit controller para org filtering
[ ] 9. Crear Organization controller
[ ] 10. Actualizar routes con organizationRoleMiddleware
[ ] 11. Crear endpoints POST /api/organizations
[ ] 12. Crear endpoints GET /api/organizations
[ ] 13. Crear endpoints PUT /api/organizations/:orgId
[ ] 14. Crear endpoints DELETE /api/organizations/:orgId
[ ] 15. Pruebas de backward compatibility (null organizationId)
[ ] 16. Commit Phase 6 changes
[ ] 17. Deploy y monitor
```

---

## 💡 NOTAS IMPORTANTES

### Backward Compatibility Garantizada
- Queries sin organizationId siguen funcionando si organizationId está NULL
- buildOrgFilter(req) devuelve {} si no hay org, así queries no filtran
- Admins sin org pueden ser super_admin de todo el sistema

### Error Handling
- Todos los métodos tienen try-catch
- Errores logged con contexto
- Status codes estándar (400, 404, 500)
- Mensajes genéricos en respuesta (no exponer details)

### Testing Priority
1. Crear registration sin org → debe funcionar
2. Crear registration con org → debe asignar organizationId
3. Listar registrations → debe filtrar por org si user .organizationId
4. Super admin → debe ver todas las orgs
5. Org admin → debe ver solo su org

---

Generated: 2026-02-17
Version: 1.0
Status: Ready for Implementation
