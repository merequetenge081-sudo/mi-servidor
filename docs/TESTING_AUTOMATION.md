# 🧪 Testing Automation Suite

Documentación automática de tests totalmente automatizada.

## 🚀 Scripts Disponibles

### Tests Base
```bash
npm test                    # Ejecutar todos los tests (rápido)
npm run test:watch         # Modo watch
npm run test:coverage      # Con reporte de cobertura
```

### 📝 Documentación Automática
```bash
npm run docs:generate      # Generar markdown TESTING_SUITE.md
```

### 📊 Reportes Automáticos
```bash
npm run report:json        # Generar reporte JSON (tests.json)
npm run report:dashboard   # Generar dashboard HTML
npm run report:full        # ★ Completo: tests + json + dashboard + docs
```

### 🔄 Combinados
```bash
npm run docs:auto          # Tests + documentación markdown
npm run report:full        # Tests + JSON + HTML + Markdown (COMPLETO)
```

## 📁 Estructura de Salida

```
reports/
├── .gitignore           # Ignora archivos generados
├── tests.json           # Metadatos de tests (auto-generado)
└── dashboard.html       # Dashboard interactivo (auto-generado)

docs/
└── TESTING_SUITE.md     # Documentación en markdown (auto-generada)
```

## ⚡ Flujo Recomendado

### Durante desarrollo
```bash
npm run test:watch          # En una terminal
# ... edita código ...
```

### Antes de commit
```bash
npm run report:full         # Genera todo automáticamente
git add .
git commit ...
git push
```

### En CI/CD
```bash
npm run test:ci             # Para pipelines (coverage + ci mode)
```

## 🎯 ¿Cómo Funciona?

### 1. `generateTestDocs.js`
- Lee todos los archivos `.test.js`
- Cuenta tests y describe blocks
- Genera `docs/TESTING_SUITE.md` con estructura

### 2. `generateTestReport.js`
- Extrae información detallada de cada test
- Genera `reports/tests.json` con metadatos
- Incluye: total tests, suites, categorías

### 3. `generateDashboard.js`
- Lee `reports/tests.json`
- Genera `reports/dashboard.html` interactivo
- Visualización con gráficos y tablas

## 📊 Ejemplo de Salida

```
npm run report:full

> Generando documentación de tests...
✓ Encontrados 10 archivos
✓ Detectados 162 tests
✓ Detectados 80 describe blocks

✅ Documentación generada: docs/TESTING_SUITE.md
📊 Generando reporte JSON de tests...
✓ Encontrados 10 archivos
✅ Reporte JSON generado: reports/tests.json
✅ Dashboard HTML generado: reports/dashboard.html
```

## 🔍 Verificar Resultados

### Ver documentación markdown
```bash
cat docs/TESTING_SUITE.md
```

### Ver dashboard HTML
```bash
# Abre en navegador:
open reports/dashboard.html
# O desde terminal:
start reports/dashboard.html  # Windows
xdg-open reports/dashboard.html  # Linux
```

### Analizar reporte JSON
```bash
cat reports/tests.json | jq '.summary'
```

## 🛠️ Personalización

### Cambiar directorio de salida
Edita la variable `docsDir` o `reportsDir` en los scripts

### Cambiar formato del dashboard
Edita `scripts/generateDashboard.js` - sección de CSS/HTML

### Agregar nuevas categorías
Actualiza `getTestType()` en `generateTestReport.js`

## ⚠️ Notas Importantes

1. **Archivos generados** → No hacer commit a GIT (están en `.gitignore`)
2. **Ejecutar con Node.js** → Requiere `--experimental-vm-modules` para ESM
3. **Después de agregar tests** → Ejecutar `npm run report:full` para actualizar

## 🚦 Estado de Tests

| Métrica | Valor |
|---------|-------|
| Tests | 162 |
| Describe Blocks | 80 |
| Archivos | 10 |
| Success Rate | 100% |

---

**Última actualización:** Febrero 23, 2026
