/**
 * Module Loader - Index.js
 * Carga TODOS los módulos de la arquitectura modular
 * en el orden correcto de dependencias.
 * 
 * ORDEN CRÍTICO:
 * 1. Core (state, dom, router)
 * 2. Utils (helpers, formatters, validators)
 * 3. Services (data, chart, export)
 * 4. Modules (dashboard, notifications, modals, export)
 * 5. App entry point
 */

(function() {
    'use strict';

    const modules = [
        // CORE (fundamentos)
        'core/state.js',
        'core/dom.js',
        'core/router.js',
        
        // UTILS (sin dependencias)
        'utils/formatters.js',
        'utils/validators.js',
        'utils/helpers.js',
        
        // SERVICES (dependen de core + utils)
        'services/data.service.js',
        'services/chart.service.js',
        'services/export.service.js',
        'services/bootstrap.service.js',
        
        // MODULES (dependen de todo lo anterior)
        'modules/dashboard.module.js',
        'modules/analytics.module.js',
        'modules/leaders.module.js',
        'modules/registrations.module.js',
        'modules/notifications.module.js',
        'modules/modals.module.js',
        'modules/export.module.js',
        
        // CORE EVENTS (delegacion centralizada)
        'core/events.js',
        
        // APP (entry point)
        'core/app.js'
    ];

    let loadedCount = 0;
    const totalModules = modules.length;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `js/${src}`;
            script.onload = () => {
                loadedCount++;
                console.log(`[${loadedCount}/${totalModules}] ✅ ${src}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ Error cargando: ${src}`);
                reject(new Error(`Failed to load ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    async function loadAllModules() {
        console.log('🚀 Iniciando carga de arquitectura modular...');
        console.log('📚 Ver documentación en: js/REFACTORIZACION_DOCUMENTACION.js');
        
        try {
            // Cargar módulos secuencialmente (respetando dependencias)
            for (const module of modules) {
                await loadScript(module);
            }
            
            console.log(`✅ Todos los módulos cargados (${totalModules}/${totalModules})`);
            console.log('🎉 Arquitectura modular lista para usar!');
            console.log('⚡ Dashboard.js original puede ahora usar estos módulos');
            
        } catch (error) {
            console.error('❌ Error durante la carga de módulos:', error);
        }
    }

    // Iniciar carga cuando DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAllModules);
    } else {
        loadAllModules();
    }
})();

