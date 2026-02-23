# 📋 Testing Suite - Documentación Automática

**Generado:** 23/2/2026, 5:26:41 a. m.  
**Total Tests:** 473  
**Total Suites:** 180

> ℹ️ Esta documentación se genera automáticamente con `npm run docs:generate`

---

## 📊 Resumen Global

```
Test Suites: 180
Tests:       473
```

---

## 📁 Struktura de Tests

```
tests/
├── e2e/
│   ├── errorMiddleware.e2e.test.js (7 tests)
│   └── Total: 7 tests
│
├── integration/
│   ├── api.endpoints.integration.test.js (29 tests)
│   ├── emailService.integration.test.js (4 tests)
│   └── Total: 33 tests
│
├── unit/
│   ├── AppError.test.js (4 tests)
│   ├── asyncHandler.test.js (4 tests)
│   └── Total: 8 tests
│
├── unit/business/
│   ├── businessLogic.test.js (25 tests)
│   ├── registrations.business.test.js (21 tests)
│   └── Total: 46 tests
│
├── unit/controllers/
│   ├── auth.controller.test.js (15 tests)
│   └── Total: 15 tests
│
├── unit/data/
│   ├── dataManagement.test.js (18 tests)
│   └── Total: 18 tests
│
├── unit/helpers/
│   ├── helpers.test.js (26 tests)
│   └── Total: 26 tests
│
├── unit/middleware/
│   ├── critical.middleware.test.js (35 tests)
│   ├── middleware.test.js (38 tests)
│   └── Total: 73 tests
│
├── unit/models/
│   ├── models.test.js (27 tests)
│   └── Total: 27 tests
│
├── unit/performance/
│   ├── performance.test.js (27 tests)
│   └── Total: 27 tests
│
├── unit/realtime/
│   ├── websocket.test.js (26 tests)
│   └── Total: 26 tests
│
├── unit/routes/
│   ├── routes.test.js (32 tests)
│   └── Total: 32 tests
│
├── unit/security/
│   ├── securityPatterns.test.js (40 tests)
│   └── Total: 40 tests
│
├── unit/services/
│   ├── email.service.test.js (17 tests)
│   ├── validation.service.test.js (15 tests)
│   └── Total: 32 tests
│
├── unit/utils/
│   ├── utilities.test.js (31 tests)
│   └── Total: 31 tests
│
├── unit/validation/
│   ├── electoralValidation.test.js (32 tests)
│   └── Total: 32 tests
│
```

---

## 📈 Estadísticas por Categoría

### Unit Tests

**Total:** 433 tests

| Archivo | Tests |
|---------|-------|
| AppError.test.js | 4 |
| asyncHandler.test.js | 4 |
| businessLogic.test.js | 25 |
| registrations.business.test.js | 21 |
| auth.controller.test.js | 15 |
| dataManagement.test.js | 18 |
| helpers.test.js | 26 |
| critical.middleware.test.js | 35 |
| middleware.test.js | 38 |
| models.test.js | 27 |
| performance.test.js | 27 |
| websocket.test.js | 26 |
| routes.test.js | 32 |
| securityPatterns.test.js | 40 |
| email.service.test.js | 17 |
| validation.service.test.js | 15 |
| utilities.test.js | 31 |
| electoralValidation.test.js | 32 |

### Integration Tests

**Total:** 33 tests

| Archivo | Tests |
|---------|-------|
| api.endpoints.integration.test.js | 29 |
| emailService.integration.test.js | 4 |

### E2E Tests

**Total:** 7 tests

| Archivo | Tests |
|---------|-------|
| errorMiddleware.e2e.test.js | 7 |

---

## 🔄 Comandos Útiles

```bash
npm test                  # Ejecutar todos los tests
npm run test:watch       # Modo watch
npm run test:coverage    # Con reporte de coverage
npm run docs:generate    # Regenerar esta documentación
```

---

**Last Update:** 2026-02-23T11:26:41.969Z
