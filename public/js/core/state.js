/**
 * CORE STATE MANAGEMENT
 * Centraliza TODO el estado de la aplicación
 * Evita variables globales sueltas
 */

const AppState = {
    // === AUTHENTICATION ===
    user: {
        token: sessionStorage.getItem('token') || localStorage.getItem('token') || null,
        role: sessionStorage.getItem('role') || localStorage.getItem('role') || null,
        username: sessionStorage.getItem('username') || localStorage.getItem('username') || null,
        eventId: sessionStorage.getItem('eventId') || localStorage.getItem('eventId') || null,
        eventName: sessionStorage.getItem('eventName') || localStorage.getItem('eventName') || 'Evento'
    },

    // === DATA ===
    data: {
        leaders: [],
        registrations: [],
        events: [],
        notifications: []
    },

    // === UI STATE ===
    ui: {
        currentSection: 'dashboard',
        chartsLoaded: false,
        analyticsLoaded: false,
        analyticsFiltersBound: false,
        
        // Paginación
        currentPageBogota: 1,
        currentPageResto: 1,
        currentTab: 'bogota',
        currentAnalyticsPage: 1,
        
        // Modales
        activeModals: new Set(),
        
        // Charts
        charts: {}
    },

    // === CONSTANTS ===
    constants: {
        API_URL: window.location.origin,
        SESSION_TIMEOUT_MS: 30 * 60 * 1000,
        ITEMS_PER_PAGE: 25,
        ANALYTICS_ITEMS_PER_PAGE: 25,
        BOGOTA_LOCALIDADES: [
            'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito',
            'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos',
            'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
            'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
        ]
    },

    // ===  METHODS ===
    
    setUser(userData) {
        this.user = { ...this.user, ...userData };
    },

    setData(dataTypeOrObj, data) {
        // Soporta tanto setData('leaders', []) como setData({ leaders: [] })
        if (typeof dataTypeOrObj === 'object') {
            Object.entries(dataTypeOrObj).forEach(([key, value]) => {
                if (this.data.hasOwnProperty(key)) {
                    this.data[key] = value;
                }
            });
        } else if (this.data.hasOwnProperty(dataTypeOrObj)) {
            this.data[dataTypeOrObj] = data;
        }
    },

    setUI(uiKeyOrObj, value) {
        // Soporta tanto setUI('currentTab', 'bogota') como setUI({ currentTab: 'bogota' })
        if (typeof uiKeyOrObj === 'object') {
            Object.entries(uiKeyOrObj).forEach(([key, val]) => {
                if (this.ui.hasOwnProperty(key)) {
                    this.ui[key] = val;
                }
            });
        } else if (this.ui.hasOwnProperty(uiKeyOrObj)) {
            this.ui[uiKeyOrObj] = value;
        }
    },

    getUser() {
        return { ...this.user };
    },

    getData(dataType) {
        return dataType ? this.data[dataType] : { ...this.data };
    },

    getUI(uiKey) {
        return uiKey ? this.ui[uiKey] : { ...this.ui };
    },

    addChart(id, chartInstance) {
        this.ui.charts[id] = chartInstance;
    },

    getChart(id) {
        return this.ui.charts[id];
    },

    destroyChart(id) {
        if (this.ui.charts[id]) {
            this.ui.charts[id].destroy();
            delete this.ui.charts[id];
        }
    },

    clearCharts() {
        Object.values(this.ui.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.ui.charts = {};
    },

    addModal(id) {
        this.ui.activeModals.add(id);
    },

    removeModal(id) {
        this.ui.activeModals.delete(id);
    },

    clearAllModals() {
        this.ui.activeModals.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.classList.remove('active');
        });
        this.ui.activeModals.clear();
    },

    reset() {
        this.setData('leaders', []);
        this.setData('registrations', []);
        this.clearCharts();
        this.clearAllModals();
        this.ui.chartsLoaded = false;
        this.ui.analyticsLoaded = false;
    }
};

// Export para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppState;
}

// Exponer globalmente para uso en navegador
window.AppState = AppState;
