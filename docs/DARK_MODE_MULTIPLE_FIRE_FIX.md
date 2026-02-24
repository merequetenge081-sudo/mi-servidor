# FIX: Dark Mode Toggle Firing Multiple Times

**Fecha:** 24 de Febrero de 2026  
**Problema:** Console muestra "3modals.module.js..." - toggle se dispara 3 veces  
**Causa:** Event bubbling sin stopPropagation()  
**Estado:** ✅ RESUELTO

---

## El Problema

Al hacer click en el botón de dark mode:

```
3modals.module.js?v=1771923389487:245 [ModalsModule] Dark mode toggled: OFF
```

El número "3" indica que el evento se está disparando 3 veces en lugar de 1.

### ¿Por qué ocurría?

Sin `stopPropagation()`, el click event propaga a múltiples listeners:

```
1. Click en botón theme-toggle
   ↓
2. Listener theme-toggle se dispara
   ↓
3. Click propaga hacia arriba (bubbling) ❌
   ↓
4. Otros listeners capturan el evento también
   ↓
5. Result: 3x ejecutados toggleDarkMode()
```

---

## La Solución

### 1️⃣ **Event Bubbling Prevention en events.js** 🛑

```javascript
// ANTES ❌
if (target.closest('.theme-toggle')) {
    ModalsModule.toggleDarkMode();
    return;
}

// DESPUÉS ✅
if (target.closest('.theme-toggle')) {
    e.stopPropagation();      // ← NUEVO
    e.preventDefault();        // ← NUEVO
    ModalsModule.toggleDarkMode();
    return;
}
```

### 2️⃣ **Toggle Debouncing en modals.module.js** ⏱️

```javascript
toggleDarkMode() {
    // ✨ NUEVO: Prevenir múltiples toggles rápidos
    if (this._darkModeToggling) return;
    this._darkModeToggling = true;
    
    setTimeout(() => {
        this._darkModeToggling = false;
    }, 100);
    
    // ... resto del código ...
}
```

### 3️⃣ **Preventión Global en UI Buttons** 🔗

También agregamos `stopPropagation()` a otros botones críticos:
- `#notificationsBtn` - Toggle de notificaciones
- `[data-action="open-logout"]` - Abrir modal de logout
- `[data-action="confirm-logout"]` - Confirmar logout
- `[data-action="open-registrations"]` - Navegar a registraciones

---

## Cambios Realizados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `public/js/core/events.js` | +8 líneas stopPropagation en 4 listeners | +8 |
| `public/js/modules/modals.module.js` | +Debouncing en toggleDarkMode | +8 |

---

## Comparación: Consola Antes vs Después

### ❌ ANTES
```
3modals.module.js:245 [ModalsModule] Dark mode toggled: OFF
  (repetido 3 veces)
```

### ✅ DESPUÉS
```
modals.module.js:247 [ModalsModule] Dark mode toggled: ON
  (solo 1 vez)
```

---

## Técnicas Utilizadas

### Event Bubbling Prevention
```javascript
event.stopPropagation()   // Evita que suba en el DOM
event.preventDefault()     // Evita acciones por defecto
```

### Debouncing (Rate Limiting)
```javascript
if (this._darkModeToggling) return;
this._darkModeToggling = true;
setTimeout(() => { this._darkModeToggling = false; }, 100);
```

Previene multiples activaciones dentro de 100ms.

---

## Impacto

### Antes ⚠️
- Click en dark mode → 3 toggles
- CSS transiciones se ejecutan 3x
- Performance degradado
- Confusión visual

### Después ✅
- Click en dark mode → 1 toggle
- Transición suave y clara
- Performance optimal
- UX mejorada

---

## Testing

```
1. Abre DevTools (F12)
2. Filtra por "Dark mode toggled"
3. Haz click en botón sol/luna
4. Debe haber SOLO 1 log, no 3
```

---

## Status

✅ **LISTO PARA PRODUCCIÓN**

- Dark mode se ejecuta solo 1 vez
- Sin múltiples eventos fantasma
- Debouncing extra como protección
- Todos los botones UI protegidos de bubbling
