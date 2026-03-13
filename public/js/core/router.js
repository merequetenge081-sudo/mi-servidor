/**
 * CORE ROUTER
 * Maneja navegación entre secciones sin frameworks
 * Mantiene exactamente el mismo comportamiento que antes
 */

const Router = {
    shouldDebugTraces() {
        try {
            return window.APP_DEBUG_TRACES === true || localStorage.getItem('debugTraces') === '1';
        } catch (_) {
            return window.APP_DEBUG_TRACES === true;
        }
    },

    trace(...args) {
        if (this.shouldDebugTraces()) console.debug(...args);
    },

    /**
     * Inicializa el router
     * Vincula los clicks en nav-links
     */
    init() {
        const getSectionFromHash = () => {
            const raw = (window.location.hash || '').replace(/^#/, '').trim();
            return raw || null;
        };

        window.addEventListener('hashchange', () => {
            const section = getSectionFromHash();
            if (!section) return;
            if (section === this.getCurrentSection()) return;
            this.navigate(section, { updateHash: false });
        });

        const initialSection = getSectionFromHash() || this.getCurrentSection() || 'dashboard';
        this.navigate(initialSection, { updateHash: false });
        console.log('[Router] Inicializado');
    },

    /**
     * Navega a una sección
     * @param {string} sectionId - ID de la sección a mostrar
     */
    navigate(sectionId, options = {}) {
        const { updateHash = true } = options;
        const validSections = ['dashboard', 'leaders', 'registrations', 'analytics', 'export', 'validacion-datos-reales', 'deletion-requests'];
        const targetSection = validSections.includes(sectionId) ? sectionId : 'dashboard';

        this.trace('[ROUTER TRACE] clicked route=' + targetSection, { requested: sectionId });

        // Actualizar estado actual
        AppState.setUI('currentSection', targetSection);

        // Ocultar todas las secciones
        document.querySelectorAll('section[id]').forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar la sección seleccionada
        const section = document.getElementById(targetSection);
        if (section) {
            section.classList.add('active');
        }

        // Actualizar nav-links activos
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`.nav-link[data-section="${targetSection}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Actualizar page title
        this.updatePageTitle(targetSection);

        // Cargar datos específicos de la sección (lazy loading)
        this.loadSectionData(targetSection);

        if (updateHash && window.location.hash !== `#${targetSection}`) {
            window.location.hash = targetSection;
        }

        // Cerrar sidebar en mobile
        this.closeSidebarMobile();

        console.log(`[Router] Navegó a: ${targetSection}`);
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
            'export': 'Centro de Descargas',
            'validacion-datos-reales': 'Confirmacion E14 por Mesa',
            'deletion-requests': 'Solicitudes de Eliminación'
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
        try {
            switch (sectionId) {
                case 'dashboard':
                    // Dashboard debe refrescarse siempre desde métricas limpias backend
                    if (typeof DashboardModule !== 'undefined' && DashboardModule.refresh) {
                        DashboardModule.refresh();
                    } else if (typeof loadDashboard === 'function') {
                        // Fallback legacy
                        loadDashboard();
                    }
                    if (typeof SkillsModule !== 'undefined' && SkillsModule.refreshJobs) {
                        SkillsModule.refreshJobs();
                    }
                    if (typeof SkillsModule !== 'undefined' && SkillsModule.refreshHealth) {
                        SkillsModule.refreshHealth();
                    }
                    if (typeof SkillsModule !== 'undefined' && SkillsModule.refreshInconsistencies) {
                        SkillsModule.refreshInconsistencies();
                    }
                    this.trace('[ROUTER TRACE] mounted module=dashboard');
                    break;
                case 'analytics':
                    this.trace('[VIEW TRACE] Analisis <- dashboard.html/router.js', {
                        module: 'AnalyticsModule',
                        endpoint: '/api/v2/analytics/metrics',
                        eventId: AppState.user.eventId || null
                    });
                    // Poblar filtro de líder
                    if (typeof LeadersModule !== 'undefined' && LeadersModule.populateAnalyticsLeaderFilter) {
                        LeadersModule.populateAnalyticsLeaderFilter();
                    }
                    
                    // Cargar analytics (siempre recargar para actualizar datos)
                    if (typeof AnalyticsModule !== 'undefined' && AnalyticsModule.loadAnalytics) {
                        AnalyticsModule.loadAnalytics();
                    }
                    this.trace('[ROUTER TRACE] mounted module=analytics');
                    break;
                case 'registrations':
                    // Cargar registros
                    if (typeof RegistrationsModule !== 'undefined' && RegistrationsModule.load) {
                        RegistrationsModule.load();
                    } else if (typeof filterRegistrations === 'function') {
                        filterRegistrations();
                    }
                    this.trace('[ROUTER TRACE] mounted module=registrations');
                    break;
                case 'deletion-requests':
                    if (typeof loadDeletionRequests === 'function') {
                        loadDeletionRequests();
                    } else if (typeof window !== 'undefined' && typeof window.loadDeletionRequests === 'function') {
                        window.loadDeletionRequests();
                    }
                    this.trace('[ROUTER TRACE] mounted module=deletion-requests');
                    break;
                case 'leaders':
                    const leaderSearchInput = document.getElementById('leaderSearchInput');
                    if (leaderSearchInput && !leaderSearchInput.dataset.bound) {
                        leaderSearchInput.addEventListener('input', (e) => {
                            if (typeof LeadersModule !== 'undefined' && LeadersModule.filterByName) {
                                LeadersModule.filterByName(e.target.value);
                            } else {
                                console.warn('[Router] LeadersModule.filterByName no disponible');
                            }
                        });
                        leaderSearchInput.dataset.bound = 'true';
                    }
                    if (typeof LeadersModule !== 'undefined' && LeadersModule.loadTable) {
                        LeadersModule.loadTable();
                    }
                    this.trace('[ROUTER TRACE] mounted module=leaders');
                    break;
                case 'export':
                    if (typeof ExportsModule !== 'undefined' && ExportsModule.init) {
                        ExportsModule.init();
                    }
                    this.trace('[ROUTER TRACE] mounted module=export');
                    break;
                case 'validacion-datos-reales':
                    if (typeof RealDataValidationModule !== 'undefined' && RealDataValidationModule.mount) {
                        RealDataValidationModule.mount();
                    }
                    this.trace('[ROUTER TRACE] mounted module=validacion-datos-reales');
                    break;
            }
        } catch (error) {
            console.error('[ROUTER TRACE] failed module=' + sectionId, error);
            const host = document.getElementById(sectionId);
            if (host && !host.querySelector('.router-error-banner')) {
                const banner = document.createElement('div');
                banner.className = 'router-error-banner';
                banner.style.cssText = 'background:#fee2e2;color:#991b1b;padding:12px;border-radius:8px;margin-bottom:12px;border:1px solid #fecaca;';
                banner.textContent = `No se pudo cargar el módulo "${sectionId}".`;
                host.prepend(banner);
            }
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
