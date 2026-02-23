# 📋 Testing Suite - Documentación Automática

**Generado:** 23/2/2026, 4:40:42 a. m.  
**Total Tests:** 162  
**Total Suites:** 80

> ℹ️ Esta documentación se genera automáticamente con `npm run docs:generate`

---

## 📊 Resumen Global

```
Test Suites: 80
Tests:       162
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
│   ├── emailService.integration.test.js (4 tests)
│   └── Total: 4 tests
│
├── unit/
│   ├── AppError.test.js (4 tests)
│   ├── asyncHandler.test.js (4 tests)
│   └── Total: 8 tests
│
├── unit/controllers/
│   ├── auth.controller.test.js (15 tests)
│   └── Total: 15 tests
│
├── unit/middleware/
│   ├── middleware.test.js (38 tests)
│   └── Total: 38 tests
│
├── unit/models/
│   ├── models.test.js (27 tests)
│   └── Total: 27 tests
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
```

---

## 📈 Estadísticas por Categoría

### Unit Tests

**Total:** 151 tests

| Archivo | Tests |
|---------|-------|
| AppError.test.js | 4 |
| asyncHandler.test.js | 4 |
| auth.controller.test.js | 15 |
| middleware.test.js | 38 |
| models.test.js | 27 |
| email.service.test.js | 17 |
| validation.service.test.js | 15 |
| utilities.test.js | 31 |

### Integration Tests

**Total:** 4 tests

| Archivo | Tests |
|---------|-------|
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

**Last Update:** 2026-02-23T10:40:42.618Z
