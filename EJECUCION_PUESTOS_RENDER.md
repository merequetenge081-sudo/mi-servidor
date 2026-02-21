# 🚀 GUÍA RÁPIDA: ACTIVACIÓN DEL SISTEMA DE PUESTOS EN RENDER

## Estado Actual
✅ Código completado y committeado  
✅ Scripts de importación listos  
✅ Formulario actualizado con selectores dinámicos  
✅ Base de datos conectada (MongoDB Atlas)  
⏳ Esperando ejecución en Render (DNS bloquea localmente)

---

## 🎯 OBJETIVO FINAL
**Importar ~940 puestos de votación de Bogotá → Sistema con selección estructurada en formulario**

### Antes (Antiguo)
```
votingPlace: "algo cualquiera"      ← Texto libre ❌
votingTable: "23"                   ← Texto libre ❌
```

### Después (Nuevo)
```
localidad: "Kennedy"                ← Dropdown estructurado ✅
puestoId: "6789abc..."              ← Referencia a Puestos ✅
mesa: 3                             ← Número del puesto ✅
```

---

## 📋 PASOS PARA EJECUTAR EN RENDER

### Opción A: Ejecución Manual (Recomendado)

1. **Conectarse a Render via SSH:**
   ```bash
   ssh -p 22 <usuario>@<host>.onrender.com
   cd app
   ```

2. **Ejecutar importación con datos de ejemplo:**
   ```bash
   node tools/import_puestos.js
   ```
   
   📊 **Output esperado:**
   ```
   📍 Conectado a MongoDB
   🗑️  Colección anterior limpiada
   ✅ Se importaron 22 puestos de votación
   
   📊 Estadísticas por localidad:
   ═══════════════════════════════════════════════════════
     Usaquén                        2 puesto(s) |   5 mesa(s)
     Chapinero                      2 puesto(s) |   6 mesa(s)
     ...
   ```

3. **Verificar la importación:**
   ```bash
   node tools/verify_puestos.js
   ```

4. **Probar en producción:**
   - Abrir: `https://mi-servidor.onrender.com/form.html`
   - Seleccionar localidad en dropdown
   - Verificar que aparecen puestos
   - Seleccionar puesto para ver mesas

---

### Opción B: Automatizar con Script Bash

1. **Asegurar permisos de ejecución:**
   ```bash
   chmod +x deploy_puestos.sh
   ```

2. **Ejecutar el script completo (4 pasos automáticos):**
   ```bash
   bash deploy_puestos.sh
   ```
   
   **El script:**
   - 📥 Descarga GeoJSON oficial (~940 puestos)
   - 🔄 Convierte a formato compatible
   - 📤 Importa a la base de datos
   - ✅ Verifica que funcionó

---

## 🔍 VERIFICACIÓN RÁPIDA POST-IMPORTACIÓN

### Ver total de puestos:
```bash
node -e "import('mongoose').then(m => m.default.connect('mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor').then(async () => { const Puestos = (await import('./src/models/index.js')).Puestos; console.log('Puestos:', await Puestos.countDocuments()); process.exit(0); }))"
```

### Probar API pública (sin autenticación):
```bash
curl https://mi-servidor.onrender.com/api/public/localidades
```

Debería devolver: `["Usaquén", "Chapinero", "Santa Fe", ...]`

### Obtener puestos de una localidad:
```bash
curl "https://mi-servidor.onrender.com/api/public/puestos?localidad=Kennedy"
```

---

## 📂 ESTRUCTURA DE DATOS IMPORTADOS

Cada puesto tiene esta estructura:
```json
{
  "codigoPuesto": "018001",           // Código oficial IDECA
  "nombre": "Colegio Kennedy",        // Nombre del lugar
  "localidad": "Kennedy",             // Localidad (20 disponibles)
  "direccion": "Cra 68 #36-45",      // Dirección completa
  "mesas": [1, 2, 3, 4, 5],          // Números de mesas en este puesto
  "activo": true,
  "fuente": "IDECA",
  "createdAt": "2024-...",
  "updatedAt": "2024-..."
}
```

---

## 🐛 TROUBLESHOOTING

### "Error: connect ENOTFOUND _mongodb._tcp..."
**Causa:** DNS local no puede resolver MongoDB Atlas  
**Solución:** Solo ocurre localmente. ✅ Funcionará en Render  

### "No hay puestos válidos para importar"
**Causa:** Archivo JSON mal formado  
**Solución:** 
```bash
# Usar datos de ejemplo:
node tools/import_puestos.js

# O procesar GeoJSON correctamente:
node tools/procesar_geojson_puestos.cjs tools/pvo_oficial.geojson
```

### Formulario no carga puestos
**Causa:** API no disponible o CORS  
**Solución:**
1. Verificar que servidor está corriendo
2. Abrir DevTools → Console para ver errores
3. Ejecutar verificación de BD

---

## 📊 DATOS DISPONIBLES

**Localidades de Bogotá (20 localidades):**
1. Usaquén
2. Chapinero
3. Santa Fe
4. San Cristóbal
5. Usme
6. Tunjuelito
7. Bosa
8. Kennedy
9. Fontibón
10. Engativá
11. Suba
12. Barrios Unidos
13. Teusaquillo
14. Los Mártires
15. Antonio Nariño
16. Puente Aranda
17. La Candelaria
18. Rafael Uribe Uribe
19. Ciudad Bolívar
20. Sumapaz

**Fuente Oficial:** datosabiertos.bogota.gov.co (IDECA)

---

## ✅ CHECKLIST FINAL

- [ ] Conectar a Render via SSH
- [ ] Ejecutar: `node tools/import_puestos.js`
- [ ] Confirmar que se importaron ~22 puestos de ejemplo (o ~940 si descarga oficial)
- [ ] Verificar con: `node tools/verify_puestos.js`
- [ ] Abrir formulario en producción
- [ ] Probar dropdown de localidades
- [ ] Seleccionar localidad y verificar puestos aparecen
- [ ] Seleccionar puesto y verificar mesas en select
- [ ] ✅ Sistema funcional

---

## 📞 NOTAS IMPORTANTES

- **Backwards compatible:** Registros antiguos con `votingPlace` texto libre siguen funcionando
- **Rate limiting:** API pública limitada a 100 req/15min por IP
- **Seguridad:** Endpoints de importación requieren JWT + rol admin
- **Escalabilidad:** Soporta ~1000 puestos sin problemas

---

**Última actualización:** 2024-02-21
**Status:** Listo para producción ✅
