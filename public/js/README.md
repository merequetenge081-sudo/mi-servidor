# Frontend JS Modules

## Estructura

```
public/js/
├── dashboard.js           # Archivo principal actual (2571 líneas)
├── xlsx.full.min.js       # Librería Excel
│
├── modules/               # Módulos nuevos (usar en futuro)
│   └── ui.module.js       # Alertas, confirmaciones, toasts
│
├── utils/                 # Utilidades (usar en futuro)
│   ├── constants.js       # Constantes, localidades
│   └── helpers.js         # Funciones auxiliares
│
└── index.js               # Punto de entrada para módulos
```

## Cómo usar los nuevos módulos

### Opción 1: Importación en HTML (para páginas nuevas)

```html
<script type="module">
    import { showAlert, getBogotaLocalidades } from '/js/index.js';
    
    // Usar
    await showAlert('Hola mundo', 'success');
    const localidades = getBogotaLocalidades();
</script>
```

### Opción 2: Migración gradual (recomendado)

Cuando necesites modificar una función en `dashboard.js`:
1. Verificar si ya existe en los módulos
2. Si existe, reemplazar la llamada
3. Si no, mover la función al módulo correspondiente

## Módulos disponibles

### utils/constants.js
- `BOGOTA_LOCALIDADES` - Array de localidades
- `getBogotaLocalidades()` - Retorna array
- `isBogota(localidad)` - Verifica si es Bogotá

### utils/helpers.js
- `debounce(fn, wait)` - Debounce function
- `throttle(fn, limit)` - Throttle function
- `formatDate(date)` - Formatea fecha
- `formatNumber(num)` - Formatea número
- `escapeHtml(text)` - Escapa HTML
- Y más helpers...

### modules/ui.module.js
- `showAlert(message, type)` - Muestra alerta
- `showConfirm(message)` - Muestra confirmación
- `showToast(message, type)` - Toast notification
- `showLoading(message)` - Loading overlay
- `hideLoading()` - Oculta loading

## Plan de migración

1. **No cambiar código existente** hasta que sea necesario
2. **Usar módulos nuevos** solo en código nuevo
3. **Migrar gradualmente** cuando se modifiquen funciones
4. **Eliminar duplicados** solo cuando todo funcione

## Verificación

El servidor no necesita cambios porque:
- Los archivos nuevos son estáticos
- dashboard.js sigue siendo el archivo principal
- Los módulos solo se cargan si se importan explícitamente
