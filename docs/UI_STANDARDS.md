# 📐 Guía de Estándares UI - Red Social y Política
> **Actualizado:** Febrero 23, 2026  
> **Versión UI:** 2.7.0

## 🎯 Objetivo
Estandarizar la estructura UI para evitar errores 404, problemas de MIME type, y garantizar consistencia en todo el sistema.

---

## 📁 Estructura de Archivos

```
public/
├── css/                      # Hojas de estilo
│   ├── modern.css           # Estilos base modernos
│   ├── dashboard.css        # Admin dashboard
│   ├── leader.css           # Panel del líder
│   └── analytics-enhanced.css
├── js/                      # Scripts JavaScript
│   ├── config/
│   │   └── ui-version.js   # ⭐ Versionado centralizado
│   ├── modules/            # Módulos reutilizables
│   ├── services/           # Servicios API
│   ├── utils/              # Utilidades
│   ├── index.js            # Core modules loader
│   ├── dashboard.js        # Admin dashboard
│   └── leader/
│       └── leader-main.js  # Leader panel
├── assets/                 # Recursos estáticos
│   └── icons/              # PWA icons
├── index.html              # ⭐ Login principal
├── dashboard.html          # Admin panel
├── leader.html             # Leader panel
├── form.html               # Registration form
├── reset-password.html     # Password reset
├── offline.html            # PWA offline page
└── manifest.json           # PWA manifest
```

---

## ✅ Reglas Obligatorias

### 1. **Rutas Absolutas (SIEMPRE)**
```html
<!-- ❌ INCORRECTO - Rutas relativas -->
<link rel="stylesheet" href="css/modern.css">
<script src="js/dashboard.js"></script>

<!-- ✅ CORRECTO - Rutas absolutas desde raíz -->
<link rel="stylesheet" href="/css/modern.css?v=2.7.0">
<script src="/js/dashboard.js?v=2.7.0"></script>
```

**Razón:** Las rutas relativas fallan cuando navegas a secciones con hash (#) o paths con parámetros.

---

### 2. **Versionado de Cache Busting**
```html
<!-- ✅ SIEMPRE incluir versión en recursos propios -->
<link href="/css/modern.css?v=2.7.0" rel="stylesheet">
<script src="/js/index.js?v=2.7.0"></script>

<!-- ℹ️ CDN externos no necesitan versión -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
```

**Actualizar versión:** Modificar en `public/js/config/ui-version.js`

---

### 3. **Orden de Scripts**
```html
<!-- 1. Librerías externas (CDN) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- 2. Core modules (PRIMERO) -->
<script src="/js/index.js?v=2.7.0"></script>

<!-- 3. Page-specific scripts (DESPUÉS) -->
<script src="/js/dashboard.js?v=2.7.0"></script>
```

**Razón:** Los módulos core deben cargar antes que los scripts específicos que dependen de ellos.

---

### 4. **Estructura HTML Base**
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Título - Red Social y Política</title>
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <!-- Styles (con versión) -->
    <link rel="stylesheet" href="/css/modern.css?v=2.7.0">
    
    <!-- Libraries (si necesarias) -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <!-- CONTENIDO -->
    
    <!-- Scripts (al final del body) -->
    <script src="/js/index.js?v=2.7.0"></script>
</body>
</html>
```

---

## 🚫 Errores Comunes y Soluciones

### Error 1: "Failed to load resource: 404"
```
URL incorrecta: https://example.com/dashboard.html/css/modern.css
                                      └───────┬───────┘
                                        Parte de la ruta!
```

**Causa:** Rutas relativas + navegación con hash  
**Solución:** Usar rutas absolutas con `/` inicial

---

### Error 2: "MIME type 'application/json' is not a supported stylesheet"
```
Servidor devuelve HTML cuando esperas CSS
```

**Causa:** Ruta wildcard en servidor captura recursos estáticos  
**Solución:** Eliminar rutas como `app.get("/dashboard.html/:section")`

---

### Error 3: "Refused to execute script... MIME type checking enabled"
```html
<!-- Script interpretado como JSON/HTML en lugar de JS -->
```

**Causa:** Misma que Error 2  
**Solución:** Verificar que `express.static` esté antes de rutas dinámicas

---

### Error 4: Scripts ejecutan antes de DOM cargado
```javascript
// ❌ INCORRECTO
document.getElementById('myButton').addEventListener('click', ...);
// Error: Cannot read property 'addEventListener' of null

// ✅ CORRECTO
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('myButton').addEventListener('click', ...);
});
```

---

## 📋 Checklist de Validación

Antes de hacer commit, verificar:

- [ ] Todas las rutas CSS/JS son absolutas (inician con `/`)
- [ ] Todos los recursos propios tienen `?v=2.7.0`
- [ ] Scripts core cargan antes que scripts específicos
- [ ] No hay archivos `.html` legacy activos
- [ ] `express.static` está antes de rutas dinámicas en `app.js`
- [ ] No hay rutas wildcard que capturen recursos estáticos
- [ ] Event listeners envueltos en `DOMContentLoaded`
- [ ] Console sin errores 404 o MIME type

---

## 🔧 Configuración del Servidor

### app.js - Orden correcto
```javascript
// 1. Servir archivos estáticos (PRIMERO)
app.use(express.static(join(__dirname, "../public")));

// 2. Rutas HTML específicas (DESPUÉS)
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "../public/index.html"));
});

app.get("/dashboard.html", (req, res) => {
    res.sendFile(join(__dirname, "../public/dashboard.html"));
});

// ❌ NO hacer esto (captura recursos CSS/JS)
app.get("/dashboard.html/:section", (req, res) => {
    res.sendFile(join(__dirname, "../public/dashboard.html"));
});
```

---

## 📦 Archivos Críticos

| Archivo | Propósito | Rutas |
|---------|-----------|-------|
| `index.html` | Login principal | `/`, `/login` |
| `dashboard.html` | Admin panel | `/dashboard.html` |
| `leader.html` | Leader panel | `/leader` |
| `form.html` | Registration | `/form`, `/registration/:token` |
| `reset-password.html` | Password reset | (API endpoint) |

---

## 🎨 Sistema de Diseño

### Colores (SaaS Style)
```css
--color-bg-neutral: #f8fafc;      /* Fondo neutral */
--color-border: #e2e8f0;          /* Bordes suaves */
--color-text-primary: #0f172a;    /* Texto principal */
--color-text-secondary: #64748b;  /* Texto secundario */
--color-primary: #2563eb;         /* Azul primario */
--color-warning: #f59e0b;         /* Amarillo warning */
--color-danger: #dc2626;          /* Rojo danger */
```

### Espaciado
```css
--spacing-xs: 8px;
--spacing-sm: 12px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

### Tipografía
```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-size-xs: 11px;
--font-size-sm: 13px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-size-xl: 20px;
--font-size-2xl: 28px;
--font-size-3xl: 32px;
```

---

## 🚀 Incrementar Versión

Cuando hagas cambios en CSS/JS:

1. **Editar:** `public/js/config/ui-version.js`
```javascript
export const UI_VERSION = "2.8.0"; // Incrementar
```

2. **Buscar y reemplazar** en todos los HTML:
```bash
?v=2.7.0  →  ?v=2.8.0
```

3. **Commit con mensaje:**
```bash
git commit -m "Bump UI version to 2.8.0 - [descripción cambios]"
```

---

## 📚 Referencias

- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Cache Busting Strategies](https://css-tricks.com/strategies-for-cache-busting-css/)
- [Express Static Files](https://expressjs.com/en/starter/static-files.html)

---

## ⚠️ Notas Importantes

1. **Nunca usar rutas relativas** en producción
2. **Siempre probar** en servidor de producción (Render) después de cambios
3. **Verificar Console** del navegador en todas las páginas
4. **Incrementar versión** después de cambios CSS/JS significativos
5. **Documentar** en `VERSION_HISTORY` de `ui-version.js`

---

## 🆘 Troubleshooting

### Recursos no cargan después de deploy
1. Verificar rutas absolutas con `/`
2. Incrementar versión para forzar cache refresh
3. Verificar CSP en `app.js` permite los recursos
4. Verificar orden de rutas en `app.js`

### Estilos no se aplican
1. Hard refresh: `Ctrl + Shift + R` (Windows) / `Cmd + Shift + R` (Mac)
2. Verificar versión en URL (`?v=X.X.X`)
3. Verificar que CSS no tiene errores sintácticos

### Scripts no ejecutan
1. Verificar orden de carga (core → específicos)
2. Verificar `DOMContentLoaded` wrapper
3. Verificar Console por errores de sintaxis
4. Verificar MIME type correcto en Network tab

---

**Última actualización:** 2026-02-23  
**Mantenedor:** Sistema Admin  
**Preguntas:** Consultar en Teams/Slack
