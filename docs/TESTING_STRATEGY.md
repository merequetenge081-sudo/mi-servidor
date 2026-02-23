# 🧪 Estrategia de Testing - Mi Servidor

## Resumen Ejecutivo

Se ha implementado una **suite de testing completa** con Jest que cubre:
- ✅ Tests unitarios para servicios críticos
- ✅ Tests unitarios para controladores
- ✅ Tests de integración
- ✅ Configuración de cobertura automática
- ✅ Scripts listos para CI/CD

**Objetivo:** Alcanzar 70% de cobertura en servicios y 60% general en 3-4 semanas.

---

## 📋 Estructura de Testing

```
tests/
├── unit/
│   ├── services/
│   │   ├── validation.service.test.js     ✅ NUEVO
│   │   └── email.service.test.js           ✅ NUEVO
│   ├── controllers/
│   │   └── auth.controller.test.js         ✅ NUEVO
│   ├── asyncHandler.test.js
│   └── AppError.test.js
├── integration/
│   ├── emailService.integration.test.js    ✅ NUEVO
│   └── emailService.integration.test.js    (original)
├── e2e/
│   └── errorMiddleware.e2e.test.js
└── setup.js                                ✅ MEJORADO
```

### Archivos Creados
- `jest.config.js` - Configuración completa de Jest
- `tests/setup.js` - Setup mejorado con custom matchers
- `tests/unit/services/validation.service.test.js` - 7 tests
- `tests/unit/services/email.service.test.js` - 15+ tests
- `tests/unit/controllers/auth.controller.test.js` - 12+ tests
- `tests/integration/emailService.integration.test.js` - 10+ tests

---

## 🚀 Cómo Ejecutar Tests

### Tests Básicos
```bash
# Ejecutar todos los tests
npm test

# Tests en modo watch (se actualizan automáticamente)
npm run test:watch

# Tests solo unitarios
npm run test:unit

# Tests solo de integración
npm run test:integration

# Tests E2E
npm run test:e2e
```

### Tests con Cobertura
```bash
# Cobertura completa
npm run test:coverage

# Solo servicios (80% mínimo)
npm run test:services

# Solo controladores (70% mínimo)
npm run test:controllers

# Todo con reporte detallado
npm run test:all
```

### Para CI/CD
```bash
# Optimizado para pipelines (máx 2 workers)
npm run test:ci
```

---

## 📊 Reportes de Cobertura

Después de ejecutar `npm run test:coverage`, se generan:

```
coverage/
├── lcov-report/
│   └── index.html         ← Abrir en navegador
├── lcov.info              ← Para CI/CD
└── coverage-summary.json
```

**Para ver reporte HTML:**
```bash
npm run test:report
```

---

## 🎯 Cobertura por Código

### Umbrales Actuales
```javascript
// jest.config.js
{
  global: {
    branches: 50%,      // Mínimo
    functions: 60%,
    lines: 60%,
    statements: 60%
  },
  './src/services/': {
    branches: 70%,      // Más estricto
    functions: 80%,
    lines: 80%,
    statements: 80%
  }
}
```

### Cómo Aumentar Cobertura
1. **Identificar gaps:**
   ```bash
   npm run test:coverage
   # Ver reporte en coverage/index.html
   ```

2. **Escribir tests para funciones no cubiertas:**
   - Copiar patrón de archivos .test.js existentes
   - Colocar en directorio paralelo a código

3. **Seguir convención de nombres:**
   - `validation.service.js` → `validation.service.test.js`
   - `auth.controller.js` → `auth.controller.test.js`

---

## 🧬 Patrones de Testing Implementados

### Unit Tests - Services
```javascript
describe('ValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();    // Limpiar mocks
  });

  it('debería validar duplicados', async () => {
    Registration.findOne.mockResolvedValue(null);
    const result = await ValidationService.checkDuplicate('123', 'evt1');
    expect(result).toBeNull();
  });
});
```

### Unit Tests - Controllers
```javascript
describe('Auth Controller', () => {
  it('debería validar credenciales', async () => {
    req.body = { username: 'admin', password: 'test' };
    authService.adminLogin.mockResolvedValue({ token: 'abc' });
    
    await adminLogin(req, res, next);
    
    expect(res.json).toHaveBeenCalled();
  });
});
```

### Integration Tests
```javascript
describe('EmailService Integration', () => {
  it('debería generar HTML válido', () => {
    const html = emailService.generateEmailHTML('User', 'http://url', 'data:image');
    expect(html).toContain('http://url');
  });
});
```

### Custom Matchers
```javascript
// Disponibles después de setup.js
expect('507f1f77bcf86cd799439011').toBeValidObjectId();
expect('test@example.com').toBeValidEmail();
expect(50).toBeWithinRange(0, 100);
```

---

## 🔄 Prioridades de Testing

### Fase 1 (AHORA - Semana 1)
- ✅ Estructura base completa
- ✅ Tests para ValidationService (validación de datos)
- ✅ Tests para EmailService (email crítico)
- ✅ Tests para Auth Controller (seguridad)
- 📋 Ejecutar y validar

### Fase 2 (Semana 2-3)
- [ ] Tests para models (Registration, Leader, etc)
- [ ] Tests para middleware de autenticación
- [ ] Tests para utils (crypto, validators, etc)
- [ ] Alcanzar 60% cobertura global

### Fase 3 (Semana 4)
- [ ] Tests para estadísticas y analytics
- [ ] Tests para exports (CSV, PDF)
- [ ] Tests de carga (load testing)
- [ ] Alcanzar 70%+ cobertura en servicios

---

## 🐛 Debugging de Tests

### Si un test falla:

```bash
# 1. Ejecutar solo ese archivo
npm test -- tests/unit/services/validation.service.test.js

# 2. Ejecutar con verbose
npm test -- --verbose

# 3. Ejecutar en modo watch para iterar
npm run test:watch

# 4. Actualizar snapshots si cambió código intencionalmente
npm test -- -u
```

### Comandos Útiles
```bash
# Tests que cambió
npm test -- --onlyChanged

# Test específico por nombre
npm test -- --testNamePattern="debería validar duplicados"

# Máximo verbosidad
npm test -- --verbose --bail

# Ver qué archivos se testean
npm test -- --listTests
```

---

## 📝 Checklist para Nuevos Tests

Al escribir un test, verificar:

- [ ] Nombre descriptivo en español
- [ ] `beforeEach()` para limpiar mocks
- [ ] Mocks apropiados para dependencias
- [ ] Test una sola cosa por `it()`
- [ ] Assert claro (qué esperamos)
- [ ] Nombres de variables descriptivos
- [ ] Comentarios si lógica compleja

**Ejemplo correcto:**
```javascript
describe('ValidationService', () => {
  let validationService;

  beforeEach(() => {
    validationService = new ValidationService();
    jest.clearAllMocks();
  });

  it('debería detectar cédula duplicada en mismo evento', async () => {
    // ARRANGE
    const mockReg = { _id: '123', cedula: '1234567890' };
    Registration.findOne.mockResolvedValue(mockReg);

    // ACT
    const result = await validationService.checkDuplicate('1234567890', 'evt1');

    // ASSERT
    expect(result).toEqual(mockReg);
    expect(Registration.findOne).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔗 Integración con CI/CD

Para GitHub Actions (próximo paso):

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v2
```

---

## 📚 Recursos

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest para integraciones](https://github.com/visionmedia/supertest)
- [MongoDB Testing](https://github.com/mongodb-js/mongodb-core)

---

## ✨ Next Steps

1. **Ahora:** `npm test` para verificar que funciona
2. **Después:** Escribir tests para otros servicios
3. **Meta:** 70% cobertura global en 30 días

---

**Última actualización:** Febrero 23, 2026
**Versión:** 1.0
