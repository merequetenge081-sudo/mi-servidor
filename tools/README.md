# 📁 Tools Directory - Inventory (Limpiado 25 Febrero 2026)

## ✅ Estado Actual
- **Archivos activos**: 11 (depurado de 108)
- **Eliminados**: 89 archivos históricos
- **Reducción**: 91% menos archivos

## 📋 Archivos Activos

### 🔧 Parsers & Data Processing
1. **parse-todos-csvs.js**
   - Lee 19 localidades CSVs
   - Genera JSON consolidado (751 puestos)
   - Assign códigos automáticos
   - Uso: `node parse-todos-csvs.js`

2. **check-duplicates.js**
   - Verifica duplicados en datos consolidados
   - Identifica puestos nuevos vs existentes
   - Uso: `node check-duplicates.js`

### 📊 Data Files (JSON)
3. **todos-puestos-consolidados.json**
   - 751 puestos de todas las 19 localidades
   - Incluye: códigos, aliases, localidades, direcciones
   - Actualizado: 25 Feb 2026

4. **puestos-nuevos-all.json**
   - 699 puestos nuevos (sin duplicados)
   - Utilizado para imports incrementales

### 🚀 Importadores
5. **bulk-import-staging.js**
   - Esperador automático de Render staging
   - POST masivo a `/api/puestos/import`
   - Maneja 751 puestos en una operación
   - Uso: `node bulk-import-staging.js` (background)

### 🧪 Testing & Validation
6. **test-verify-endpoint.js**
   - Test del endpoint `/verify` registraciones
   - Mock de request/response
   - Valida HTTP 200 responses

7. **test-leader-matching.js**
   - Test de fuzzy matching de puestos
   - Prueba con líderes reales
   - Genera reportes de coincidencias

8. **test-puestos-endpoint.js**
   - Test general del endpoint de puestos
   - Valida CRUD operations

9. **quick-validate.js**
   - Validación rápida de puestos en BD
   - Verifica integridad básica

### 🔀 Utilities
10. **add-found-aliases.js**
    - Agrega aliases automáticamente a puestos
    - Mejora fuzzy matching
    - Uso: cuando se encuentran variantes de nombres

11. **add-missing-puestos.js**
    - Importa puestos faltantes individuales
    - Permite agregar registros específicos
    - Uso: para casos puntuales

## 🗑️ Eliminado

### Categorías de Archivos Removidos
- **FASE 1-3 Files** (histórico de desarrollo)
- **Import Scripts antiguos** (import-*faltantes*, import-*localidad*, etc)
- **Upload Scripts** (upload-*, upload_puestos_*, etc)
- **Parse Scripts antiguos** (parse-rafael-uribe, parse-registraduria)
- **GeoJSON Processing** (procesar_geojson, generate_svg_from_geojson)
- **Migration Scripts** (migrate_events_org, migrate_org_to_default)
- **Search/Debug Tools** (search-ciudad-bochica, debug-puestos, etc)
- **Reportes viejos** (comparacion-puestos, puestos-analysis, etc)
- **Data duplicada** (puestos-descargados, puestos-exactos, etc)
- **Tests antiguos** (test-all-modules, test-verify-flow, etc)

**Total eliminado**: 89 archivos | **~238KB reducidos**

## 📊 Estadísticas

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| Total archivos | 108 | 11 | -91% |
| Parsers | 8 | 1 | -87% |
| Importadores | 15+ | 1 | -93% |
| Data files | 20+ | 2 | -90% |
| Tests | 10+ | 4 | -60% |
| Tamaño repo(KB) | 1200+ | ~238 | -80% |

## 🎯 Casos de Uso

### 1. Procesar nuevos CSVs
```bash
node tools/parse-todos-csvs.js
```

### 2. Validar duplicados
```bash
node tools/check-duplicates.js
```

### 3. Importar a BD (staging)
```bash
node tools/bulk-import-staging.js  # Espera automáticamente
```

### 4. Test del matching
```bash
node tools/test-leader-matching.js <leaderId> <threshold>
```

### 5. Validación rápida
```bash
node tools/quick-validate.js
```

## 🔗 Relaciones de Datos

```
Local CSV Files
    ↓
parse-todos-csvs.js
    ↓
todos-puestos-consolidados.json (751 puestos)
    ↓
check-duplicates.js
    ↓
puestos-nuevos-all.json
    ↓
bulk-import-staging.js
    ↓
MongoDB BD (seguimiento-datos)
    ↓
test-leader-matching.js (validación)
```

## 📝 Notas

- Todos los scripts mantienen el formato ESM (import/export)
- JSON consolidado con UTF-8 y codificación de localidades
- Imports via API (POST a /api/puestos/import)
- Aliases incluidos para mejorar matching
- Documentación completa en README.md raíz

## 🔄 Último Commit

```
chore: Depuración de tools - eliminar 89 archivos históricos no usados
- 89 files changed, 18 insertions(+), 237621 deletions(-)
- Commit: ae09f407
- Fecha: 25 Febrero 2026
```

---
Creado: 25 Febrero 2026 | Versión: 1.0 (Post-Cleanup)
