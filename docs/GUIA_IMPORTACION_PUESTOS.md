# 🗳️ Importación de Puestos de Votación Oficial - Guía Completa

## Contexto
El sistema ha sido actualizado para usar datos estructurados de puestos de votación en lugar de texto libre. Estos datos provienen del dataset oficial de Bogotá: **Puesto de Votación. Bogota D.C**

**Dataset Oficial:** https://datosabiertos.bogota.gov.co/dataset/puesto-de-votacion

---

## Paso 1: Descargar GeoJSON Oficial

### Opción A: Descarga Manual (Recomendado si la descarga automática falla)
1. Ir a: https://datosabiertos.bogota.gov.co/dataset/puesto-de-votacion
2. Descargar el archivo **"Geo JavaScript Object Notation (GEOJSON)"** (pvo.geojson)
3. Guardar en: `tools/pvo_oficial.geojson`

### Opción B: Descarga Automática (Ejecutar en Render)
```bash
# En servidor con conexión a internet (Render)
node tools/procesar_geojson_puestos.cjs
```

El script intentará descargar automáticamente del servidor oficial.

---

## Paso 2: Procesar GeoJSON

Una vez que tengas el archivo pvo.geojson, procesa los datos:

```bash
node tools/procesar_geojson_puestos.cjs tools/pvo_oficial.geojson
```

**Output esperado:**
```
📖 Leyendo GeoJSON desde: tools/pvo_oficial.geojson
🔄 Procesando ~940 features...
✅ Procesamiento completado:
   • Puestos únicos: ~930
   • Mesas adicionales encontradas: 10
   • Total para importar: ~930

📊 Distribución por localidad:
   Engativá                   +50 puestos
   Kennedy                    +45 puestos
   Suba                       +40 puestos
   ...

💾 Datos guardados en: tools/puestos_procesados.json
```

---

## Paso 3: Importar a MongoDB

Con el archivo procesado, ejecuta la importación:

```bash
node tools/import_puestos.js --file tools/puestos_procesados.json
```

**Output esperado:**
```
✅ Se importaron ~930 puestos de votación

📊 Estadísticas por localidad:
═══════════════════════════════════════════════════════
  Engativá                      → 52 puesto(s) | 85 mesa(s)
  Kennedy                       → 48 puesto(s) | 78 mesa(s)
  Suba                          → 41 puesto(s) | 65 mesa(s)
  ...
═══════════════════════════════════════════════════════
```

---

## Paso 4: Verificar Importación

```bash
node tools/verify_puestos.js
```

Debería mostrar:
```
✅ Puestos importados: ~930
✅ Localidades: 20
  Usaquén, Chapinero, Santa Fe, San Cristóbal, Usme, ...
```

---

## Paso 5: Probar en Formulario

1. Acceder a: http://localhost:3000/form.html (o producción)
2. Seleccionar una Localidad (ej: "Kennedy")
3. Verificar que se carguen automáticamente los puestos
4. Seleccionar un puesto
5. Verificar que se carguen las mesas disponibles

---

## Mapeo de Campos

| Campo GeoJSON | Campo Schema | Ejemplo |
|---|---|---|
| `PVOCODIGO` | `codigoPuesto` | "160010907" |
| `PVONOMBRE` | `nombre` | "Colegio Distrital República de Costa Rica" |
| `LOCNOMBRE` | `localidad` | "Kennedy" |
| `PVODIRECCI` | `direccion` | "Carrera 79 F No. 46 - 16 Sur" |
| `PVONPUESTO` | `mesas[]` | [5, 6, 7] |
| `geometry.coordinates` | `coordinates` | {longitude: -74.16, latitude: 4.67} |

---

## Endpoints API Disponibles

### Públicos (Sin Autenticación)
```bash
# Obtener todas las localidades
GET /api/public/localidades

# Obtener puestos por localidad
GET /api/public/puestos?localidad=Kennedy

# Obtener mesas de un puesto específico
GET /api/public/puestos/{id}
```

### Privados (Requieren JWT)
```bash
# Admin: Importar datos
POST /api/puestos/import
Content-Type: application/json
Authorization: Bearer {token}

{
  "puestos": [
    {
      "codigoPuesto": "160010907",
      "nombre": "Colegio Distrital...",
      "localidad": "Kennedy",
      "direccion": "...",
      "mesas": [5, 6, 7]
    }
  ]
}
```

---

## Solución de Problemas

### Error: "querySrv ENOTFOUND _mongodb._tcp.cluster0.mongodb.net"
**Causa:** DNS no resuelve MongoDB Atlas desde la red local
**Solución:** Ejecutar en Render (que tiene internet completo) o usar VPN

### Error: "Archivo no encontrado: pvo_oficial.geojson"
**Causa:** El archivo no está en la ruta esperada
**Solución:** Descargar manualmente desde datosabiertos.bogota.gov.co

### No se cargan puestos en el formulario
**Causa:** Datos no están importados
**Solución:** Ejecutar primero `node tools/import_puestos.js --file tools/puestos_procesados.json`

---

## Archivos Relacionados

| Archivo | Propósito |
|---|---|
| `src/models/Puestos.js` | Schema de MongoDB |
| `src/controllers/puestos.controller.js` | Lógica de negocio |
| `src/routes/index.js` | Rutas API |
| `public/form.html` | Formulario con selects dinámicos |
| `tools/procesar_geojson_puestos.cjs` | Convierte GeoJSON a JSON |
| `tools/import_puestos.js` | Importa a MongoDB |
| `tools/verify_puestos.js` | Verifica datos importados |

---

## Status Actual

✅ **Completado:**
- Schema Puestos creado
- Controlador API implementado
- Rutas públicas y privadas creadas
- Formulario actualizado con selects dinámicos
- Script de procesamiento GeoJSON
- Script de importación MongoDB

🟡 **Pendiente:**
- Descargar GeoJSON oficial (si DNS permite)
- Procesar datos (~940 registros)
- Importar a MongoDB Atlas
- Testear en producción

❌ **Bloqueado temporalmente:**
- Descarga directa desde local (DNS limitation)
- Solución: Ejecutar en Render production

---

## Próximos Pasos

1. **Ejecutar en Render:** SSH a Render y ejecutar pasos 1-3 arriba
2. **Sincronizar datos:** Base de datos quedará actualizada
3. **Testing:** Probar formulario en producción
4. **Rollout:** Sistema listo para las elecciones

**Tiempo estimado:** 5 minutos en servidor con internet

