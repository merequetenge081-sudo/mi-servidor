# Sistema de Revisión de Puestos de Votación

## Resumen de Implementación

Sistema completo para marcar y gestionar registros que requieren verificación del puesto de votación.

## Cambios Realizados

### 1. Modelo de Datos (`src/models/Registration.js`)
- **Nuevo campo**: `requiereRevisionPuesto` (Boolean, default: false)
- **Nuevo campo**: `revisionPuestoResuelta` (Boolean, default: false)
- **Índices optimizados**: agregados para consultas de revisión

### 2. Script de Marcado (`tools/mark_revision_from_report.js`)
- Lee `tools/standardize_report.json`
- Marca automáticamente registros con `action: "review"` como `requiereRevisionPuesto: true`
- Limpia flags de registros que ya no requieren revisión

**Ejecutar con:**
```bash
node tools/mark_revision_from_report.js
```

### 3. Panel de Líder (`public/leader.html`)

#### Notificación Destacada
- Alerta visual en color amarillo que aparece automáticamente cuando hay registros pendientes
- Botón directo para filtrar y ver solo registros que requieren revisión

#### Visualización en Tabla
- Badge "⚠ Revisar puesto" en columna de estado para registros que requieren atención
- Indicador visual claro sin afectar el flujo existente

#### Funciones JS agregadas:
- `checkRevisionPendiente()`: verifica si hay registros con revisión pendiente
- `filtrarRegistrosRevision()`: filtra y muestra solo registros para revisar

### 4. Panel Admin (`public/registrations.html`)

#### Filtro Nuevo
- Dropdown "Revisión Puesto" con opciones:
  - Todos
  - Requiere revisión
  - Sin revisión

#### Tabla Mejorada
- Columna "Puesto" con badge "⚠ Revisar" para registros pendientes
- Diseño coherente con el resto del sistema

### 5. Backend (`src/controllers/registrations.controller.js`)

#### Endpoint `GET /api/registrations`
- Nuevo parámetro query: `requiereRevisionPuesto` (true/false)
- Filtra automáticamente por `revisionPuestoResuelta: false` cuando se requiere revisión
- Incluye `confirmedCount` en respuesta para estadísticas

### 6. Frontend Admin (`public/assets/js/registrations.js`)
- Filtro `requiereRevisionPuesto` integrado en `applyFilters()`
- Renderizado de badge de revisión en tabla
- Populate de información del puesto desde `puestoId`

## Flujo de Trabajo

### Proceso Automático
1. **Estandarización**: `tools/standardize_registrations_puestos.js` genera reporte
2. **Marcado**: `tools/mark_revision_from_report.js` marca registros para revisión
3. **Notificación**: Líder ve alerta automática en su panel
4. **Revisión**: Líder verifica y corrige información del puesto
5. **Resolución**: Una vez editado, el registro puede ser marcado como resuelto

### Para el Líder
1. Ingresa a su panel
2. Ve alerta amarilla si hay registros pendientes
3. Click en "Ver registros" para filtrar solo los que requieren atención
4. Edita cada registro para confirmar/corregir el puesto de votación
5. Sistema marca automáticamente como revisado al guardar cambios

### Para el Admin
1. Aplica filtro "Revisión Puesto → Requiere revisión"
2. Ve todos los registros pendientes de todas las organizaciones/líderes
3. Puede tomar acción directa o coordinar con líderes

## Estadísticas Actuales

**Última ejecución** (tools/mark_revision_from_report.js):
- 180 registros marcados para revisión
- 0 registros limpiados (ya resueltos)

## Archivos Modificados

```
src/
  models/Registration.js
  controllers/registrations.controller.js

public/
  leader.html
  registrations.html
  assets/js/registrations.js

tools/
  mark_revision_from_report.js (nuevo)
  standardize_report.json (entrada)
```

## Comandos Útiles

```bash
# Actualizar aliases desde GEOJSON
node tools/update_puesto_aliases_from_geojson.js

# Re-estandarizar con aliases actualizados
node tools/standardize_registrations_puestos.js

# Marcar registros que requieren revisión
node tools/mark_revision_from_report.js
```

## Consideraciones

- Los registros se marcan automáticamente al ejecutar el script de marcado
- La alerta en panel de líder solo aparece si hay registros pendientes
- El filtro en admin permite identificar rápidamente problemas sistémicos
- El sistema es compatible con el flujo existente de edición/confirmación

## Próximos Pasos Sugeridos

1. Agregar botón "Marcar como revisado" en modal de edición
2. Implementar endpoint para resolver revisión manualmente
3. Agregar estadísticas de revisión en dashboard admin
4. Notificaciones por email para líderes con muchos registros pendientes
