/**
 * BootstrapService.js
 * 
 * Servicio de Bootstrap centralizado que reemplaza loadDashboard() de dashboard.js
 * Responsable de inicializar todos los datos y módulos de la aplicación.
 * 
 * Incluye:
 * - Cargar líderes y registros
 * - Actualizar UI inicial (username, event name)
 * - Inicializar módulos
 * - Cargar datos en AppState
 * - Populares filtros y selectores
 */

const BootstrapService = (() => {
    'use strict';

    /**
     * Actualizar display de nombre de usuario
     */
    function updateUserDisplay() {
        const userDisplay = document.getElementById('sidebarUsername') || document.getElementById('adminUsername');
        if (userDisplay) {
            userDisplay.textContent = sessionStorage.getItem('username') || localStorage.getItem('username') || 'Admin';
        }
    }

    /**
     * Actualizar display de nombre del evento
     */
    function updateEventNameDisplay() {
        const eventDisplay = document.getElementById('eventNameDisplay');
        if (eventDisplay) {
            eventDisplay.textContent = sessionStorage.getItem('eventName') || localStorage.getItem('eventName') || 'Evento';
        }
        
        // Actualizar en background si está disponible
        if (typeof DataService !== 'undefined' && DataService.getEventName) {
            DataService.getEventName()
                .then(name => {
                    if (eventDisplay && name) {
                        eventDisplay.textContent = name;
                        sessionStorage.setItem('eventName', name);
                    }
                })
                .catch(e => console.warn('[Bootstrap] No se pudo actualizar nombre del evento:', e));
        }
    }

    /**
     * Cargar líderes desde API
     */
    async function loadLeaders() {
        if (typeof DataService === 'undefined' || !DataService.getLeadersPaginated) {
            throw new Error('[Bootstrap] DataService no disponible');
        }

        try {
            const leadersPage = await DataService.getLeadersPaginated({
                page: 1,
                limit: 200,
                sort: 'name',
                order: 'asc'
            });
            const leaders = leadersPage.items || [];
            AppState.setData({ leaders });
            console.log('[Bootstrap] [V2 TRACE] leaders.table <- /api/v2/leaders (snapshot):', leaders.length);
            return leaders;
        } catch (err) {
            console.error('[Bootstrap] Error cargando lideres:', err);
            throw err;
        }
    }

    /**
     * Cargar registos desde API
     */
    async function loadRegistrations() {
        if (typeof DataService === 'undefined' || !DataService.getRegistrationsPaginated) {
            throw new Error('[Bootstrap] DataService no disponible');
        }

        try {
            const registrationsPage = await DataService.getRegistrationsPaginated({
                page: 1,
                limit: 50,
                sort: 'createdAt',
                order: 'desc'
            });
            const registrations = registrationsPage.items || [];
            AppState.setData({ registrations });
            console.log('[Bootstrap] [V2 TRACE] registrations.table <- /api/v2/registrations (snapshot):', registrations.length);
            return registrations;
        } catch (err) {
            console.error('[Bootstrap] Error cargando registraciones:', err);
            throw err;
        }
    }

    /**
     * Inicializar módulos después de cargar datos
     */
    function initializeModules() {
        // Dashboard Module
        if (typeof DashboardModule !== 'undefined' && DashboardModule.init) {
            DashboardModule.init();
            console.log('[Bootstrap] ✅ DashboardModule inicializado');
        }

        // Leaders Module
        if (typeof LeadersModule !== 'undefined' && LeadersModule.init) {
            LeadersModule.init();
            console.log('[Bootstrap] ✅ LeadersModule inicializado');
        }

        // Registrations Module
        if (typeof RegistrationsModule !== 'undefined' && RegistrationsModule.init) {
            RegistrationsModule.init();
            console.log('[Bootstrap] ✅ RegistrationsModule inicializado');
        }

        // Exports Module
        if (typeof ExportsModule !== 'undefined' && ExportsModule.init) {
            ExportsModule.init();
            console.log('[Bootstrap] ✅ ExportsModule inicializado');
        }

        // Notifications Module
        if (typeof NotificationsModule !== 'undefined' && NotificationsModule.init) {
            NotificationsModule.init();
            console.log('[Bootstrap] ✅ NotificationsModule inicializado');
        }

        // Skills Module
        if (typeof SkillsModule !== 'undefined' && SkillsModule.init) {
            SkillsModule.init();
            console.log('[Bootstrap] ✅ SkillsModule inicializado');
        }
    }

    /**
     * Actualizar stats del dashboard
     */
    async function updateDashboardStats() {
        if (typeof DashboardModule !== 'undefined' && DashboardModule.refresh) {
            await DashboardModule.refresh();
            console.log('[Bootstrap] ✅ Dashboard limpio actualizado');
        }
    }

    /**
     * Cargar tabla de líderes
     */
    function loadLeadersTable() {
        if (typeof LeadersModule !== 'undefined' && LeadersModule.loadTable) {
            LeadersModule.loadTable();
            console.log('[Bootstrap] ✅ Tabla de líderes cargada');
        }
    }

    /**
     * Cargar registros recientes
     */
    function loadRecentRegistrations() {
        if (typeof DashboardModule !== 'undefined' && DashboardModule.loadRecentRegistrations) {
            DashboardModule.loadRecentRegistrations();
            console.log('[Bootstrap] ✅ Registraciones recientes cargadas');
        }
    }

    /**
     * Cargar registraciones en tabs
     */
    function loadRegistrationsTabbed() {
        if (typeof RegistrationsModule !== 'undefined' && RegistrationsModule.load) {
            RegistrationsModule.load();
            console.log('[Bootstrap] ✅ Tabla de registraciones cargada');
        }
    }

    /**
     * Poblar filtros de líderes
     */
    function populateLeaderFilter() {
        if (typeof LeadersModule !== 'undefined' && LeadersModule.populateLeaderFilter) {
            LeadersModule.populateLeaderFilter();
            console.log('[Bootstrap] ✅ Filtro de líderes poblado');
        }
    }

    /**
     * Poblar selector de líder para export
     */
    function populateExportLeader() {
        if (typeof LeadersModule !== 'undefined' && LeadersModule.populateExportLeader) {
            LeadersModule.populateExportLeader();
            console.log('[Bootstrap] ✅ Selector de export líder poblado');
        }
    }

    /**
     * Poblar selector de líder para analytics
     */
    function populateAnalyticsLeaderFilter() {
        if (typeof LeadersModule !== 'undefined' && LeadersModule.populateAnalyticsLeaderFilter) {
            LeadersModule.populateAnalyticsLeaderFilter();
            console.log('[Bootstrap] ✅ Selector analytics líder poblado');
        }
    }

    /**
     * Cargar charts (con limpieza previa)
     */
    function loadCharts() {
        try {
            // Destruye todos los gráficos anteriores ANTES de cargar nuevos
            if (typeof ChartService !== 'undefined' && ChartService.destroyAllCharts) {
                ChartService.destroyAllCharts();
            }
            
            // Pequeño delay para asegurar limpieza
            setTimeout(() => {
                if (typeof DashboardModule !== 'undefined' && DashboardModule.loadCharts) {
                    DashboardModule.loadCharts();
                    console.log('[Bootstrap] ✅ Charts cargados correctamente');
                }
            }, 50);
        } catch (err) {
            console.warn('[Bootstrap] Warning en loadCharts:', err);
        }
    }

    /**
     * Actualizar badge de notificaciones
     */
    async function updateNotificationsBadge() {
        if (typeof NotificationsModule !== 'undefined' && NotificationsModule.updateBadge) {
            try {
                await NotificationsModule.updateBadge();
                console.log('[Bootstrap] ✅ Badge de notificaciones actualizado');
            } catch (e) {
                console.warn('[Bootstrap] No se pudo actualizar badge:', e);
            }
        }
    }

    /**
     * Mostrar error en DOM
     */
    function showError(message, err) {
        console.error(`[Bootstrap] ${message}:`, err);
        const debugContainer = document.getElementById('dashboard');
        if (debugContainer) {
            const errorBanner = document.createElement('div');
            errorBanner.style.cssText = 'background: #fee; color: #c33; padding: 20px; margin: 20px; border-radius: 8px; border: 1px solid #fcc;';
            errorBanner.innerHTML = `<strong>⚠️ Error Iniciando:</strong> ${message}`;
            debugContainer.prepend(errorBanner);
        }
    }

    /**
     * MÉTODO PRINCIPAL: Inicializar toda la aplicación
     * 
     * Este es el reemplazo de loadDashboard() de dashboard.js
     */
    async function initAppData() {
        console.log('[Bootstrap] 🚀 Iniciando inicialización de aplicación...');

        try {
            // 1. Actualizar UI inicial
            console.log('[Bootstrap] Actualizando UI inicial...');
            updateUserDisplay();
            updateEventNameDisplay();

            // 2. Cargar datos desde API
            console.log('[Bootstrap] Cargando datos desde API...');
            await loadLeaders();
            await loadRegistrations();

            // 3. Inicializar módulos
            console.log('[Bootstrap] Inicializando módulos...');
            initializeModules();

            // 4. Cargar datos en UI
            console.log('[Bootstrap] Cargando datos en UI...');
            await updateDashboardStats();
            loadLeadersTable();
            loadRegistrationsTabbed();

            // 5. Poblar filtros y selectores
            console.log('[Bootstrap] Poblando filtros...');
            populateLeaderFilter();
            populateExportLeader();
            populateAnalyticsLeaderFilter();

            // 6. Dashboard charts/recientes ya vienen de DashboardModule.refresh()
            console.log('[Bootstrap] Dashboard cards/charts sincronizados con métricas limpias');

            // 7. Actualizar notificaciones
            await updateNotificationsBadge();

            console.log('[Bootstrap] ✅ APLICACIÓN INICIALIZADA CORRECTAMENTE');
            return true;

        } catch (err) {
            showError('No se pudo inicializar la aplicación', err);
            throw err;
        }
    }

    // PUBLIC API
    return {
        initAppData,
        updateUserDisplay,
        updateEventNameDisplay,
        loadLeaders,
        loadRegistrations,
        loadCharts,
        updateNotificationsBadge
    };
})();

// Exponer a window para acceso global
window.BootstrapService = BootstrapService;

/**
 * WRAPPERS GLOBALES PARA COMPATIBILIDAD
 * Estos reemplazan las funciones legacy de dashboard.js
 * Mantienen compatibilidad con código existente durante migración
 */

// Wrapper para apiCall (reemplaza dashboard.js apiCall)
// Necesario para: leaders.module.js y otros módulos que llaman window.apiCall
window.apiCall = async function(endpoint, options = {}) {
    if (typeof DataService !== 'undefined' && DataService.apiCall) {
        return DataService.apiCall(endpoint, options);
    }
    // Fallback: implementar apiCall básico aquí si DataService no está disponible
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AppState.user.token}`,
        ...options.headers
    };
    return fetch(`${AppState.constants.API_URL}${endpoint}`, {
        ...options,
        headers
    });
};

// Wrapper para loadDashboard (reemplaza dashboard.js loadDashboard)
// Necesario para: modules que llaman window.loadDashboard() después de cambios
window.loadDashboard = async function() {
    if (typeof BootstrapService !== 'undefined' && BootstrapService.initAppData) {
        return BootstrapService.initAppData();
    }
    console.warn('[Bootstrap] loadDashboard fallback: BootstrapService no disponible');
};

