/**
 * APPLICATION ENTRY POINT - PHASE 5 (COMPLETE)
 * 
 * Orquesta todos los módulos y servicios en arquitectura 100% modular.
 * NO depende de dashboard.js (fase 5 completada).
 * 
 * FLUJO PRINCIPAL:
 * 1. Verificar autenticación (Helpers.checkAuth)
 * 2. Inicializar Router
 * 3. Inicializar delegación centralizada de eventos (Events)
 * 4. Cargar datos iniciales (BootstrapService.initAppData)
 * 5. Vincular session timeout (Helpers.bindSessionActivity)
 * 
 * TODO depende de módulos y servicios, no de funciones globales legacy.
 */

// ========================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ========================================

// Ejecutar directamente (no esperar DOMContentLoaded porque ya ocurrió)
(async function() {
    console.log('[App] DOMContentLoaded ya ocurrió, ejecutando app.js directamente...');
    console.log('[App] Inicializando aplicación...');

    try {
        // 1. Verificar autenticación
        console.log('[App] Verificando autenticación...');
        await Helpers.checkAuth();
        console.log('[App] ✅ Autenticación OK');

        // 2. Inicializar router
        console.log('[App] Inicializando router...');
        Router.init();
        console.log('[App] ✅ Router OK');

        // 2.1 Inicializar delegación de eventos
        console.log('[App] Tipo de Events:', typeof Events);
        if (typeof Events !== 'undefined' && Events.init) {
            console.log('[App] Llamando Events.init()...');
            Events.init();
            console.log('[App] ✅ Events.init() completado');
        } else {
            console.warn('[App] ⚠️ Events no disponible');
        }

        // 3. Cargar dashboard principal
        console.log('[App] Cargando datos iniciales...');
        if (typeof BootstrapService !== 'undefined' && BootstrapService.initAppData) {
            await BootstrapService.initAppData();
        } else {
            console.warn('[App] ⚠️ BootstrapService no disponible, fallback a loadDashboard');
            if (typeof loadDashboard === 'function') {
                await loadDashboard();
            }
        }
        console.log('[App] ✅ Dashboard cargado');

        // 4. Vincular session timeout
        console.log('[App] Vinculando session activity...');
        if (typeof Helpers !== 'undefined' && Helpers.bindSessionActivity) {
            Helpers.bindSessionActivity();
        } else if (typeof bindSessionActivity === 'function') {
            bindSessionActivity(); // Fallback a función global
        }
        console.log('[App] ✅ Session activity vinculada');

        // 5. Configurar auto-refresco (tiempo real aproximado, cada 10s)
        console.log('[App] Configurando actualización en tiempo real...');
        setInterval(async () => {
            try {
                if (typeof BootstrapService !== 'undefined' && BootstrapService.loadLeaders && BootstrapService.loadRegistrations) {
                    
                    // No actualizar forzosamente si el usuario está interactuando con un modal abierto
                    const activeModals = document.querySelectorAll('.modal-overlay.active');
                    if (activeModals.length > 0) return;

                    // Refrescar en silencio en segundo plano
                    await BootstrapService.loadLeaders();
                    await BootstrapService.loadRegistrations();
                    
                    const currentSection = AppState.getUI('currentSection');
                    if (currentSection === 'dashboard' && window.DashboardModule) {
                        window.DashboardModule.refresh();
                    } else if (currentSection === 'registrations' && window.RegistrationsModule) {
                        window.RegistrationsModule.applyFilters();
                    } else if (currentSection === 'leaders' && window.LeadersModule) {
                        const searchInput = document.getElementById('leaderSearchInput');
                        if (searchInput && searchInput.value) {
                            window.LeadersModule.filterByName(searchInput.value);
                        } else {
                            window.LeadersModule.loadTable();
                        }
                    }
                }
            } catch (err) {
                console.error('[App] Auto-refresh error:', err);
            }
        }, 10000);
        console.log('[App] ✅ Auto-refresco en background activado');

        console.log('[App] ✅ Aplicarión inicializada correctamente');

    } catch (err) {
        console.error('[App] Error inicializando:', err);
        console.error('[App] Stack:', err.stack);
        if (typeof Helpers !== 'undefined' && Helpers.showAuthError) {
            Helpers.showAuthError(err.message);
        }
    }
})();

/**
 * Hook para que otros scripts puedan interactuar con la app
 */
window.AppAPI = {
    getState: () => AppState,
    getRouter: () => Router,
    getDataService: () => DataService,
    getChartService: () => ChartService,
    getExportService: () => ExportService
};

console.log('[App] AppAPI disponible en window.AppAPI');
