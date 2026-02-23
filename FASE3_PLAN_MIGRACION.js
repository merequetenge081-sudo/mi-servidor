/**
 * PLAN DE MIGRACIÓN CONTROLADA - FASE 3
 * =====================================
 * 
 * Migración de dashboard.js (2572 líneas legacy) a arquitectura modular
 * SIN ROMPER ABSOLUTAMENTE NADA
 */

// ===============================================
// ANÁLISIS DEL CÓDIGO LEGACY
// ===============================================

/**
 * VARIABLES GLOBALES IDENTIFICADAS EN dashboard.js:
 * 
 * ✅ Migrables a AppState:
 * - currentToken          → AppState.user.token
 * - currentEventId        → AppState.user.eventId
 * - allLeaders            → AppState.data.leaders
 * - allRegistrations      → AppState.data.registrations
 * - charts                → AppState.ui.charts
 * - currentPageBogota     → AppState.ui.pagination.bogota
 * - currentPageResto      → AppState.ui.pagination.resto
 * - currentTab            → AppState.ui.currentTab
 * 
 * ⚠️ Constantes (mantener):
 * - API_URL               (constante, OK)
 * - SESSION_TIMEOUT_MS    (constante, OK)
 * - itemsPerPage          (constante, OK)
 */

/**
 * FUNCIONES GLOBALES IDENTIFICADAS (50+):
 * 
 * CATEGORÍA 1: Session Management (SEGURO - migrar primero)
 * - touchActivity()
 * - isSessionExpired()
 * - enforceSessionTimeout()
 * - bindSessionActivity()
 * 
 * CATEGORÍA 2: Utilities (SEGURO)
 * - getBogotaLocalidades()
 * - showAlert()
 * - showConfirm()
 * 
 * CATEGORÍA 3: Dashboard Stats (SEGURO)
 * - updateStats()
 * - loadRecentRegistrations()
 * 
 * CATEGORÍA 4: Charts (CRÍTICO - migrar con cuidado)
 * - loadCharts()
 * - destroyChart() (si existe)
 * 
 * CATEGORÍA 5: Notifications (SEGURO)
 * - updateNotificationsBadge()
 * - loadNotifications()
 * 
 * CATEGORÍA 6: Exports (SEGURO)
 * - exportToExcel()
 * - exportAllRegistrations()
 * - exportByLeader()
 * - exportLeaderStats()
 * 
 * CATEGORÍA 7: Leaders (COMPLEJO - migrar después)
 * - loadLeadersTable()
 * - filterLeadersByName()
 * - deleteLeader()
 * - showEditLeader()
 * - generateNewPassword()
 * - sendAccessEmail()
 * 
 * CATEGORÍA 8: Registrations (COMPLEJO)
 * - loadRegistrationsTabbed()
 * - filterRegistrations()
 * - renderRegistrationTable()
 * - toggleConfirm()
 * 
 * CATEGORÍA 9: Analytics (COMPLEJO)
 * - loadAnalytics()
 * - renderLeaderAnalyticsTable()
 */

// ===============================================
// ORDEN DE MIGRACIÓN (DE SEGURO A COMPLEJO)
// ===============================================

/**
 * FASE 3.1 - Variables globales → AppState (30 min)
 * FASE 3.2 - Session management wrappers (15 min)
 * FASE 3.3 - Utilities wrappers (15 min)
 * FASE 3.4 - Notifications wrappers (20 min)
 * FASE 3.5 - Dashboard stats wrappers (20 min)
 * FASE 3.6 - Charts migration (30 min)
 * FASE 3.7 - Exports wrappers (20 min)
 * FASE 3.8 - Testing exhaustivo (30 min)
 * FASE 3.9 - Limpieza progresiva (depende de tests)
 * 
 * TOTAL: ~3 horas para migración segura completa
 */

// ===============================================
// FASE 3.1 - MIGRACIÓN DE VARIABLES A AppState
// ===============================================

/**
 * ESTRATEGIA: Usar Object.defineProperty para crear aliases
 * 
 * VENTAJA:
 * - El código legacy que hace "currentToken = 'abc'" funciona
 * - El código legacy que lee "console.log(currentToken)" funciona
 * - Internamente todo se guarda en AppState (centralizado)
 * - Eliminación de duplicación de estado
 * 
 * IMPLEMENTACIÓN:
 */

// En dashboard.js, al inicio (después de declarar variables legacy):

/* ========== INICIO DE MIGRACIÓN A AppState ========== */

// 1. Migrar currentToken
Object.defineProperty(window, 'currentToken', {
    get() {
        return AppState.user.token;
    },
    set(value) {
        AppState.setUser({ token: value });
    },
    configurable: true
});

// 2. Migrar currentEventId
Object.defineProperty(window, 'currentEventId', {
    get() {
        return AppState.user.eventId;
    },
    set(value) {
        AppState.setUser({ eventId: value });
    },
    configurable: true
});

// 3. Migrar allLeaders
Object.defineProperty(window, 'allLeaders', {
    get() {
        return AppState.data.leaders;
    },
    set(value) {
        AppState.setData({ leaders: value });
    },
    configurable: true
});

// 4. Migrar allRegistrations
Object.defineProperty(window, 'allRegistrations', {
    get() {
        return AppState.data.registrations;
    },
    set(value) {
        AppState.setData({ registrations: value });
    },
    configurable: true
});

// 5. Migrar charts
Object.defineProperty(window, 'charts', {
    get() {
        return AppState.ui.charts;
    },
    set(value) {
        // No permitir asignación directa
        console.warn('Use AppState.setUI({ charts: {...} }) en lugar de asignar charts directamente');
    },
    configurable: true
});

// 6. Migrar currentPageBogota
Object.defineProperty(window, 'currentPageBogota', {
    get() {
        return AppState.ui.pagination.bogota.currentPage;
    },
    set(value) {
        AppState.setUI({ 
            pagination: { 
                ...AppState.ui.pagination,
                bogota: { ...AppState.ui.pagination.bogota, currentPage: value }
            }
        });
    },
    configurable: true
});

// 7. Migrar currentPageResto
Object.defineProperty(window, 'currentPageResto', {
    get() {
        return AppState.ui.pagination.resto.currentPage;
    },
    set(value) {
        AppState.setUI({ 
            pagination: { 
                ...AppState.ui.pagination,
                resto: { ...AppState.ui.pagination.resto, currentPage: value }
            }
        });
    },
    configurable: true
});

// 8. Migrar currentTab
Object.defineProperty(window, 'currentTab', {
    get() {
        return AppState.ui.currentTab;
    },
    set(value) {
        AppState.setUI({ currentTab: value });
    },
    configurable: true
});

/* ========== FIN DE MIGRACIÓN A AppState ========== */

/**
 * RESULTADO:
 * - Código legacy funciona igual
 * - Estado centralizado en AppState
 * - No hay duplicación
 * - No se rompe nada
 */

// ===============================================
// FASE 3.2 - WRAPPERS DE SESSION MANAGEMENT
// ===============================================

/**
 * ESTRATEGIA: Mover lógica a Helpers, mantener funciones globales como wrappers
 */

// En dashboard.js, reemplazar implementaciones:

// ANTES (lógica directa en dashboard.js):
/*
function touchActivity() {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

function isSessionExpired() {
    const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
    if (!last) return false;
    return Date.now() - last > SESSION_TIMEOUT_MS;
}
*/

// DESPUÉS (wrapper que delega a Helpers):
window.touchActivity = function() {
    return Helpers.touchActivity();
};

window.isSessionExpired = function() {
    return Helpers.isSessionExpired();
};

window.enforceSessionTimeout = function() {
    if (!window.currentToken) return false;
    if (window.isSessionExpired()) {
        // Limpiar storage
        ['token', 'role', 'eventId', 'username'].forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
        window.location.href = '/';
        return true;
    }
    return false;
};

window.bindSessionActivity = function() {
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, window.touchActivity, { passive: true });
    });
};

/**
 * NOTA: La lógica real ya está en utils/helpers.js (creado en Fase 1)
 */

// ===============================================
// FASE 3.3 - WRAPPERS DE UTILIDADES
// ===============================================

// ANTES:
/*
function getBogotaLocalidades() {
    return ['Usaquén', 'Chapinero', ...];
}
*/

// DESPUÉS:
window.getBogotaLocalidades = function() {
    return Helpers.getBogotaLocalidades();
};

// ANTES:
/*
function showAlert(message, type = 'info') {
    // 100+ líneas de lógica de modal
}
*/

// DESPUÉS:
window.showAlert = function(message, type = 'info') {
    return ModalsModule.showAlert(message, type);
};

window.showConfirm = function(message, title = 'Confirmar') {
    return ModalsModule.showConfirm(message, title);
};

/**
 * RESULTADO:
 * - onclick="showAlert('mensaje')" sigue funcionando
 * - Lógica centralizada en módulos
 * - dashboard.js solo tiene wrappers ligeros
 */

// ===============================================
// FASE 3.4 - WRAPPERS DE NOTIFICACIONES
// ===============================================

// ANTES:
/*
function updateNotificationsBadge() {
    // lógica de badge
}

function loadNotifications() {
    // lógica de cargar notificaciones
}
*/

// DESPUÉS:
window.updateNotificationsBadge = function() {
    return NotificationsModule.updateBadge();
};

window.loadNotifications = function() {
    return NotificationsModule.loadNotifications();
};

// ===============================================
// FASE 3.5 - WRAPPERS DE DASHBOARD STATS
// ===============================================

// ANTES:
/*
function updateStats() {
    const leaders = allLeaders || [];
    const registrations = allRegistrations || [];
    // ... lógica stats
}
*/

// DESPUÉS:
window.updateStats = function() {
    return DashboardModule.updateStats();
};

window.loadRecentRegistrations = function() {
    return DashboardModule.loadRecentRegistrations();
};

// ===============================================
// FASE 3.6 - MIGRACIÓN DE CHARTS (CRÍTICA)
// ===============================================

/**
 * PROBLEMA ACTUAL:
 * - dashboard.js hace: new Chart(ctx, config)
 * - No destruye charts existentes
 * - Causa error "Canvas already in use"
 * 
 * SOLUCIÓN:
 * - Usar ChartService.createChart() que destruye automáticamente
 */

// ANTES:
/*
function loadCharts() {
    const ctx1 = document.getElementById('confirmationChart');
    new Chart(ctx1, {
        type: 'doughnut',
        data: { ... },
        options: { ... }
    });
}
*/

// DESPUÉS:
window.loadCharts = function() {
    return DashboardModule.loadCharts();
};

// Y en DashboardModule.loadCharts():
/*
function loadCharts() {
    // Destruir charts existentes
    ChartService.destroyChart('confirmationChart');
    ChartService.destroyChart('registrationsTimelineChart');
    
    // Crear nuevos
    const ctx1 = document.getElementById('confirmationChart');
    ChartService.createChart('confirmationChart', ctx1, 'doughnut', data, options);
    
    // ...
}
*/

/**
 * CRÍTICO: Esto elimina el error "Canvas already in use"
 */

// ===============================================
// FASE 3.7 - WRAPPERS DE EXPORTS
// ===============================================

// ANTES:
/*
function exportToExcel(data, filename) {
    // lógica XLSX
}
*/

// DESPUÉS:
window.exportToExcel = function(data, filename) {
    return ExportService.exportToExcel(data, filename);
};

window.exportAllRegistrations = function() {
    return ExportModule.exportRegistrations();
};

window.exportByLeader = function() {
    return ExportModule.exportByLeader();
};

window.exportLeaderStats = function() {
    return ExportModule.exportLeaderStats();
};

// ===============================================
// FASE 3.8 - PREVENCIÓN DE DOBLE INICIALIZACIÓN
// ===============================================

/**
 * PROBLEMA:
 * - index.js carga módulos e inicializa
 * - dashboard.js ejecuta DOMContentLoaded e inicializa
 * - Resultado: Doble ejecución
 * 
 * SOLUCIÓN:
 * Agregar flag de inicialización en cada módulo
 */

// En cada módulo (ejemplo DashboardModule):
const DashboardModule = (() => {
    'use strict';
    
    let initialized = false;
    
    function init() {
        if (initialized) {
            console.warn('[DashboardModule] Ya inicializado, saltando...');
            return;
        }
        initialized = true;
        console.log('[DashboardModule] Inicializando...');
        // ... lógica de init
    }
    
    return {
        init,
        // ... otros métodos
    };
})();

/**
 * RESULTADO:
 * - Si se llama init() dos veces, la segunda se ignora
 * - No hay duplicación de event listeners
 * - No hay doble carga de datos
 */

// ===============================================
// FASE 3.9 - LIMPIEZA PROGRESIVA
// ===============================================

/**
 * Después de verificar que TODO funciona:
 * 
 * 1. Eliminar declaraciones de variables globales (ya están en AppState)
 * 2. Eliminar implementaciones de funciones (solo mantener wrappers)
 * 3. Reducir dashboard.js de 2572 → ~500 líneas
 * 
 * DASHBOARD.JS FINAL quedaría:
 */

/*
// ===================================
// DASHBOARD.JS - ARCHIVO DE COMPATIBILIDAD
// ===================================
// Este archivo mantiene compatibilidad con código legacy
// La lógica real vive en js/modules/*

// Constantes (mantener)
const API_URL = window.location.origin;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivity';
const itemsPerPage = 5;

// Variables migrables a AppState (wrappers)
Object.defineProperty(window, 'currentToken', {
    get() { return AppState.user.token; },
    set(value) { AppState.setUser({ token: value }); }
});

Object.defineProperty(window, 'allLeaders', {
    get() { return AppState.data.leaders; },
    set(value) { AppState.setData({ leaders: value }); }
});

// ... (resto de variables)

// ===================================
// WRAPPERS DE FUNCIONES GLOBALES
// ===================================

// Session Management
window.touchActivity = () => Helpers.touchActivity();
window.isSessionExpired = () => Helpers.isSessionExpired();
window.enforceSessionTimeout = () => Helpers.checkAuth();

// Utilities
window.getBogotaLocalidades = () => Helpers.getBogotaLocalidades();
window.showAlert = (msg, type) => ModalsModule.showAlert(msg, type);
window.showConfirm = (msg, title) => ModalsModule.showConfirm(msg, title);

// Dashboard
window.updateStats = () => DashboardModule.updateStats();
window.loadRecentRegistrations = () => DashboardModule.loadRecentRegistrations();
window.loadCharts = () => DashboardModule.loadCharts();

// Notifications
window.updateNotificationsBadge = () => NotificationsModule.updateBadge();
window.loadNotifications = () => NotificationsModule.loadNotifications();

// Exports
window.exportToExcel = (data, filename) => ExportService.exportToExcel(data, filename);
window.exportAllRegistrations = () => ExportModule.exportRegistrations();
window.exportByLeader = () => ExportModule.exportByLeader();
window.exportLeaderStats = () => ExportModule.exportLeaderStats();

// Leaders (cuando se cree LeadersModule)
// window.loadLeadersTable = () => LeadersModule.loadTable();
// window.deleteLeader = (id) => LeadersModule.deleteLeader(id);
// ... etc

// Registrations (cuando se cree RegistrationsModule)
// window.loadRegistrationsTabbed = () => RegistrationsModule.loadTabbed();
// window.filterRegistrations = () => RegistrationsModule.filter();
// ... etc

// Analytics (cuando se cree AnalyticsModule)
// window.loadAnalytics = () => AnalyticsModule.load();
// ... etc

// ===================================
// INICIALIZACIÓN LEGACY
// ===================================

// Session activity tracking
window.bindSessionActivity = function() {
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, window.touchActivity, { passive: true });
    });
};

// DOMContentLoaded - solo si módulos no iniciaron
document.addEventListener('DOMContentLoaded', () => {
    // Los módulos ya se inicializaron en index.js
    // Solo mantener compatibilidad con código legacy
    
    console.log('[dashboard.js] Compatibilidad legacy activa');
    
    // Verificar autenticación
    if (!window.currentToken) {
        window.location.href = '/';
        return;
    }
    
    // Bind session activity
    window.bindSessionActivity();
});
*/

/**
 * RESULTADO FINAL:
 * - dashboard.js: ~500 líneas (solo wrappers + compatibilidad)
 * - Módulos: ~2000 líneas (lógica real)
 * - AppState: Estado único centralizado
 * - ChartService: Charts sin memory leaks
 * - No hay duplicación
 * - No se rompe nada
 * - Consola limpia
 */

// ===============================================
// TESTING CHECKLIST
// ===============================================

/**
 * Después de cada fase, probar:
 * 
 * [ ] Login funciona
 * [ ] Dashboard carga stats correctamente
 * [ ] Navegación entre secciones funciona
 * [ ] Gráficos renderizan sin "Canvas already in use"
 * [ ] Modales (showAlert/showConfirm) funcionan
 * [ ] Búsqueda de líderes funciona
 * [ ] Crear/editar/eliminar líder funciona
 * [ ] Tabs de registros (Bogotá/Resto) funcionan
 * [ ] Paginación funciona
 * [ ] Filtros funcionan
 * [ ] Exports Excel funcionan
 * [ ] Notificaciones badge actualiza
 * [ ] Dark mode funciona
 * [ ] Logout funciona
 * [ ] Session timeout funciona
 * [ ] NO hay errores en consola
 * [ ] NO hay warnings en consola (excepto los normales)
 * [ ] Performance OK (no hay lentitud)
 */

// ===============================================
// MÉTRICAS DE ÉXITO
// ===============================================

/**
 * ANTES (Estado actual):
 * - dashboard.js: 2572 líneas monolíticas
 * - Variables globales: 8+ dispersas
 * - Funciones globales: 50+ sin encapsular
 * - Charts: Memory leaks potenciales
 * - Estado duplicado: AppState + variables legacy
 * - Doble inicialización: Posible
 * 
 * DESPUÉS (Objetivo Fase 3):
 * - dashboard.js: ~500 líneas (solo compatibility layer)
 * - Variables globales: 0 reales (todos son getters/setters a AppState)
 * - Funciones globales: 50+ wrappers ligeros (1 línea cada uno)
 * - Charts: Sin memory leaks (controlados por ChartService)
 * - Estado único: AppState centralizado
 * - Inicialización única: Flags de control
 * - Consola: 100% limpia (0 errores, 0 warnings críticos)
 * - Tests: 100% passing
 * 
 * REDUCCIÓN DE CÓDIGO:
 * - Código duplicado: -80%
 * - Líneas en dashboard.js: -80% (2572 → 500)
 * - Complejidad ciclomática: -60%
 * - Technical debt: -70%
 */

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  PLAN DE MIGRACIÓN FASE 3 - READY TO EXECUTE              ║');
console.log('║  Duración estimada: 3 horas                                ║');
console.log('║  Riesgo: BAJO (migración controlada con wrappers)          ║');
console.log('╚════════════════════════════════════════════════════════════╝');
