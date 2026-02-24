/**
 * Fix: Dashboard Load Cache Clear
 * Resuelve el error de URL malformada /api/leaders:1 que aparece al recargar
 */

(function() {
    'use strict';

    // Asegurar que los selectores de URL estén bien formateados
    const OriginalFetch = window.fetch;
    
    window.fetch = function(...args) {
        const url = args[0];
        
        // Validar que las URLs no tengan el pat ó malformado
        if (typeof url === 'string') {
            // Detectar pattern /api/leaders:X (incorrecto)
            if (url.match(/\/api\/leaders:\d+/)) {
                console.warn('[Dashboard Fix] ⚠️ URL malformada detectada:', url);
                console.warn('[Dashboard Fix] 💡 Reemplazando con URL correcta');
                
                // Convertir /api/leaders:X a /api/v2/leaders/X
                const correctedUrl = url.replace(/\/api\/leaders:(\d+)/, '/api/v2/leaders/$1');
                console.log('[Dashboard Fix] ✅ URL corregida:', correctedUrl);
                args[0] = correctedUrl;
            }
        }
        
        return OriginalFetch.apply(this, args);
    };

    console.log('[Dashboard Fix] ✅ Fetch wrapper inicializado');
    console.log('[Dashboard Fix] URLs malformadas serán detectadas y corregidas');
})();
