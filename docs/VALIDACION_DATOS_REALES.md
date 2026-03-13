# Confirmacion E14 por mesa (vista agregada)

## Objetivo operativo
La seccion ahora trabaja por unidad electoral agregada:
- `localidad + puesto + mesa`

Ya no prioriza filas individuales de registro/lider en la vista principal.

## Mapeo Bogota (zona)
Se implemento utilidad reusable:
- Backend: `src/shared/bogota-zones.js`
- Frontend: `public/js/utils/bogota-zones.js`

Funciones:
- `getBogotaZoneCode(localidad)`
- `getBogotaZoneLabel(localidad)`
- `buildE14NavigationHint(registrationOrMesa)`

## Estructura de datos nueva (opcion A)
Coleccion nueva:
- `e14_confirmation_by_mesa`

Modelo:
- `src/models/E14ConfirmationByMesa.js`

Campos principales:
- `localidad`
- `puesto`
- `mesa`
- `zoneCode`
- `votosReportadosTotales`
- `votosE14Candidate105`
- `e14ListVotes`
- `confirmacionPorcentaje`
- `diferencia`
- `estado`
- `notes`
- `validatedAt`
- `validatedBy`
- `source = manual/system`

Indice unico:
- `organizationId + eventId + normalizedLocalidad + normalizedPuesto + mesa`

## Endpoints
### V2
- `GET /api/v2/admin/e14-confirmation/by-mesa`
- `POST /api/v2/admin/e14-confirmation/by-mesa/manual-save`

### Compatibilidad
- `GET /api/v2/admin/e14-confirmation` (apunta a vista agregada)
- `GET /api/v2/admin/validacion-datos-reales` (compat)
- `POST /api/v2/admin/validacion-datos-reales/run` (recalculo)
- Legacy equivalentes en `/api/admin/...`

## Logica de calculo
`confirmacionPorcentaje = min((votosE14Candidate105 / votosReportadosTotales) * 100, 100)`

`diferencia = votosE14Candidate105 - votosReportadosTotales`

Estados:
- `confirmado` (100)
- `confirmacion_alta` (60-99)
- `confirmacion_parcial` (30-59)
- `confirmacion_baja` (1-29)
- `sin_confirmacion` (0)
- `pendiente_e14` (sin votos E14)
- `sin_votos_reportados`
- `datos_incompletos` (falta localidad/puesto/mesa)

## Frontend
Archivos:
- `public/dashboard.html`
- `public/js/modules/real-data-validation.module.js`
- `public/js/services/data.service.js`

Cambios:
- tabla principal agregada por mesa
- accion principal por fila: `Confirmar voto`
- modal por mesa (no por registro)
- botones operativos:
  - `Abrir E14`
  - `Copiar referencia`
  - `Guardar confirmacion`
- KPIs sobre mesas agregadas:
  - mesas analizadas
  - mesas pendientes E14
  - mesas confirmadas
  - confirmacion promedio
  - votos reportados totales
  - votos E14 totales
