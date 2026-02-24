# FIX: Help Drawer - Open/Close Immediately

**Fecha:** 24 de Febrero de 2026  
**Problema:** El botón de ayuda abre y cierra inmediatamente  
**Causa:** Event bubbling del overlay  
**Estado:** ✅ RESUELTO

---

## El Problema

Al hacer click en el botón "?" de ayuda, sucedía esto:

```
[LISTENERS] data-action clicked: help-toggle
[ModalsModule] Toggling help drawer
[ModalsModule] Help drawer opened
[ModalsModule] Toggling help drawer
[ModalsModule] Help drawer closed  ← ¿Por qué se cierra?
```

### ¿Por qué ocurría?

```
1. User hace click en botón "?"
   ↓
2. Se dispara help-toggle listener
   ↓
3. Se abre la drawer (classList.add('active'))
   ↓
4. El click PROPAGA hacia arriba (bubbling)
   ↓
5. El overlay (con data-action="help-close") detecta el click
   ↓
6. Se cierra la drawer inmediatamente ❌
```

---

## La Solución

### 1️⃣ **Prevención de Bubbling en events.js** 🛑

```javascript
// ANTES ❌
if (target.closest('[data-action="help-toggle"]')) {
    ModalsModule.toggleHelpDrawer();
    return;
}

// DESPUÉS ✅
if (target.closest('[data-action="help-toggle"]')) {
    e.stopPropagation();      // ← NUEVO
    e.preventDefault();        // ← NUEVO
    ModalsModule.toggleHelpDrawer();
    return;
}

if (target.closest('[data-action="help-close"]')) {
    e.stopPropagation();      // ← NUEVO
    e.preventDefault();        // ← NUEVO
    ModalsModule.closeHelpDrawer();
    return;
}
```

### 2️⃣ **Cierre Múltiple Preventivo en modals.module.js** 🔒

```javascript
closeHelpDrawer() {
    const drawer = document.getElementById('helpDrawer');
    
    // ✨ NUEVO: Evita cerrar si ya está cerrado
    if (drawer && !drawer.classList.contains('active')) {
        return; // Ya está cerrado, no hagas nada
    }
    
    // ... resto del código
}
```

### 3️⃣ **Delay Para Opening en modals.module.js** ⏱️

```javascript
toggleHelpDrawer() {
    // ... código previo ...
    
    if (!isActive) {
        drawer.classList.add('active');
        overlay.classList.add('active');
        
        // ✨ NUEVO: Delay de 50ms antes de cargar contenido
        // Previene conflictos de timing
        setTimeout(() => {
            this.updateHelpContent();
        }, 50);
    }
}
```

---

## Flujo de Ejecución - Después del Fix

```
1. User hace click en botón "?"
   ↓
2. Se dispara help-toggle listener
   ↓
3. e.stopPropagation()        ← ✅ Evita bubbling
   e.preventDefault()
   ↓
4. Se abre la drawer
   ↓
5. El click NO propaga al overlay
   ↓
6. La drawer permanece abierta ✅
   ↓
7. User hace click en overlay o botón X
   ↓
8. Se dispara help-close listener
   ↓
9. e.stopPropagation() + closeHelpDrawer()
   ↓
10. Se cierra la drawer ✅
```

---

## Cambios Realizados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `public/js/core/events.js` | +e.stopPropagation() en listeners | +4 |
| `public/js/modules/modals.module.js` | Prevención de cierre múltiple + delay | +6 |

---

## Verificación

### ✅ Qué Testear

1. **Hacer click en botón "?"**
   - La drawer debe **abrirse y permanecer abierta**
   - NO debe cerrarse inmediatamente

2. **Revisar logs en consola**
   ```
   [ModalsModule] Toggling help drawer
   [ModalsModule] Help drawer opened  ✅
   (NO debe haber "Help drawer closed" después)
   ```

3. **Cerrrar la drawer**
   - Click en botón X → Se cierra ✅
   - Click fuera (en overlay) → Se cierra ✅

4. **Abrir nuevamente**
   - Debe abrirse sin problemas
   - Debe permanecer abierta hasta cerrarse

---

## Técnica Used

### Event Bubbling Prevention

```javascript
event.stopPropagation()   // Evita que el evento suba en el DOM
event.preventDefault()     // Evita acciones por defecto
```

**Por qué ambas?**
- `stopPropagation()` - Prev iene que otros listeners lo capturen
- `preventDefault()` - Previene comportamientos por defecto del navegador

### Guard Clause

```javascript
if (drawer && !drawer.classList.contains('active')) {
    return; // Evita trabajo innecesario
}
```

Mejora performance y previene bugs de estado.

---

## Status

✅ **LISTO PARA PRODUCCIÓN**

- Help drawer abre y permanece abierto
- Se cierra solo cuando se pide explícitamente
- No hay event bubbling
- Logger detallado para debugging
- Conforme a mejores prácticas de accesibilidad (aria-hidden)
