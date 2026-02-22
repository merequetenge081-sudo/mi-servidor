/**
 * CORE ROUTER
 * Maneja navegación entre secciones sin frameworks
 * Mantiene exactamente el mismo comportamiento que antes
 */

const Router = {
    /**
     * Inicializa el router
     * Vincula los clicks en nav-links
     */
    init() {
        // Delegación centralizada en Events
        console.log('[Router] Inicializado');
    },

    /**
     * Navega a una sección
     * @param {string} sectionId - ID de la sección a mostrar
     */
    navigate(sectionId) {
        // Actualizar estado actual
        AppState.setUI('currentSection', sectionId);

        // Ocultar todas las secciones
        document.querySelectorAll('section[id]').forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar la sección seleccionada
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
        }

        // Actualizar nav-links activos
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Actualizar page title
        this.updatePageTitle(sectionId);

        // Cargar datos específicos de la sección (lazy loading)
        this.loadSectionData(sectionId);

        // Cerrar sidebar en mobile
        this.closeSidebarMobile();

        console.log(`[Router] Navegó a: ${sectionId}`);
    },

    /**
     * Actualiza el título de la página
     */
    updatePageTitle(sectionId) {
        const titles = {
            'dashboard': 'Dashboard',
            'leaders': 'Líderes',
            'registrations': 'Registros',
            'analytics': 'Análisis y Reportes',
            'export': 'Centro de Descargas'
        };
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = titles[sectionId] || 'Dashboard';
        }
    },

    /**
     * Carga datos específicos de la sección
     * Evita cargar todo al inicio (lazy loading)
     */
    loadSectionData(sectionId) {
        switch (sectionId) {
            case 'dashboard':
                // Cargar charts si no están cargados
                if (typeof DashboardModule !== 'undefined' && DashboardModule.loadCharts) {
                    const alreadyLoaded = AppState.getUI('chartsLoaded');
                    if (!alreadyLoaded) {
                        DashboardModule.loadCharts();
                        AppState.setUI('chartsLoaded', true);
                    }
                } else if (typeof loadCharts === 'function') {
                    // Fallback a función global para compatibilidad
                    const alreadyLoaded = typeof chartsLoaded !== 'undefined' ? chartsLoaded : AppState.getUI('chartsLoaded');
                    if (!alreadyLoaded) {
                        loadCharts();
                        if (typeof chartsLoaded !== 'undefined') chartsLoaded = true;
                        AppState.setUI('chartsLoaded', true);
                    }
                }
                break;
            case 'analytics':
                // Poblar filtro de líder
                if (typeof LeadersModule !== 'undefined' && LeadersModule.populateAnalyticsLeaderFilter) {
                    LeadersModule.populateAnalyticsLeaderFilter();
                }
                
                // Cargar analytics
                if (typeof AnalyticsModule !== 'undefined' && AnalyticsModule.loadAnalytics) {
                    const alreadyLoaded = AppState.getUI('analyticsLoaded');
                    if (!alreadyLoaded) {
                        AnalyticsModule.loadAnalytics();
                        AppState.setUI('analyticsLoaded', true);
                    }
                }
                break;
            case 'registrations':
                if (typeof filterRegistrations === 'function') {
                    filterRegistrations();
                }
                break;
            case 'leaders':
                const leaderSearchInput = document.getElementById('leaderSearchInput');
                if (leaderSearchInput && !leaderSearchInput.dataset.bound) {
                    leaderSearchInput.addEventListener('input', (e) => {
                        if (typeof filterLeadersByName === 'function') {
                            filterLeadersByName(e.target.value);
                        }
                    });
                    leaderSearchInput.dataset.bound = 'true';
                }
                break;
        }
    },

    /**
     * Cierra el sidebar en mobile
     */
    closeSidebarMobile() {
        const overlay = document.querySelector('.sidebar-overlay');
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth < 768) {
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        }
    },

    /**
     * Obtiene la sección actual
     */
    getCurrentSection() {
        return AppState.getUI('currentSection');
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Router;
}
