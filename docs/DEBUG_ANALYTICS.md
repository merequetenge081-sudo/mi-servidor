# DEBUG - Por qué no se ven datos en Analytics

He agregado logging detallado al servidor para diagnósticar por qué no aparecen los 630 registros.

## Pasos para Investigar:

### 1. Abre la Consola del Navegador
- Presiona **F12** en tu navegador
- Ve a la pestaña **Console**
- Si hay errores rojos, toma una screenshot

### 2. Revisa los logs del Servidor  
- En la terminal donde corre npm start, deberías ver:
  ```
  [LeadersController] getLeaders: {
    organizationId: "...",
    filter: { organizationId: "..." },
    eventId: undefined,
    active: undefined
  }
  [LeadersController] Líderes encontrados: 23
  
  [RegistrationsController] getRegistrations: {
    organizationId: "...",
    filter: { organizationId: "..." },
    eventId: undefined,
    page: 1,
    limit: 2000
  }
  [RegistrationsController] Resultados: {
    totalEncontrados: 630,
    registracionesRetornadas: 630,
    confirmedCount: 245
  }
  ```

### 3. En la Consola del Navegador busca:
```
[DataService] Llamando getLeaders:
[DataService] Response status: 200 true
[DataService] Raw leaders data: Array(23)
[DataService] Leaders cargados: 23

[DataService] Llamando getRegistrations:
[DataService] Response status: 200 true
[DataService] Raw data: Object { data: Array(630), total: 630, ... }
[DataService] Registrations cargadas: 630
```

## Posibles Problemas:

### Problema A: organizationId es nulo/vacío
- **Síntoma**: En los logs ves `organizationId: undefined` o `organizationId: null`
- **Causa**: El JWT no incluye organizationId
- **Solución**: Revisar login - probablemente logineas con usuario de memoria

### Problema B: organizationId existe pero sin registros/líderes
- **Síntoma**: Logs muestran `organizationId: "xxx"` pero `Líderes encontrados: 0` o `totalEncontrados: 0`
- **Causa**: No hay documentos en MongoDB con ese organizationId
- **Solución**: Los datos existen pero en otra organizationId

### Problema C: API retorna error
- **Síntoma**: Status 401, 403, 500 en console
- **Causa**: Autenticación fallida o error en servidor
- **Solución**: Revisar token/auth

## Cambios Realizados:

✅ Agregué logging en:
- `src/controllers/leaders.controller.js` - getLeaders()
- `src/controllers/registrations.controller.js` - getRegistrations()
- `public/js/services/data.service.js` - getLeaders() y getRegistrations()

Ahora puedo ver exactamente:
- Qué organizationId se está usando
- Cuántos registros retorna la API
- Si hay errores en las llamadas

## Próximo Paso:

**Envíame una screenshot o un copy-paste de:**
1. Logs del servidor (donde corre npm start)
2. Console del navegador (F12)
3. Especialmente busca: `totalEncontrados`, `Líderes encontrados`, `Registrations cargadas`

Con eso podré identificar exactamente dónde está el problema.
