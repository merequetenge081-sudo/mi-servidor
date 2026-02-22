/**
 * ANALYTICS MODULE
 * Maneja gráficos, filtros y reportes de la sección analytics
 * Análisis de datos en tiempo real desde MongoDB via AppState
 * 
 * ESTRUCTURA DE DATOS:
 * - Registrations: leaderId, leaderName, firstName, lastName, cedula, email, phone
 *   - Localización: localidad (Bogotá), departamento (Resto), capital
 *   - Votación: registeredToVote, votingPlace, votingTable
 *   - Estado: confirmed, confirmedAt, date
 * - Leaders: _id, name, email, active, registrations (count)
 */

const AnalyticsModule = (() => {
    'use strict';

    // ===================================
    // CONSTANTES - Localidades de Bogotá
    // ===================================
    const BOGOTA_LOCALIDADES = new Set([
        'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme',
        'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá',
        'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño',
        'Puente Aranda', 'La Candelaria', 'Rafael Uribe', 'Ciudad Bolívar', 'Sumapaz'
    ]);

    // ===================================
    // ESTADO INTERNO
    // ===================================
    let currentFilter = {
        region: 'all',      // 'all', 'bogota', 'resto'
        leaderId: null      // null = todos
    };
    let currentAnalyticsPage = 1;
    const ITEMS_PER_PAGE = 10;

    // ===================================
    // UTILIDADES - Identificar región
    // ===================================
    function isBogotaRegistration(registration) {
        // Criterios:
        // 1. registeredToVote = true (indica que es Bogotá)
        // 2. O tiene localidad válida (localidades bogotanas)
        if (registration.registeredToVote === true) return true;
        if (registration.localidad && BOGOTA_LOCALIDADES.has(normalizeText(registration.localidad))) return true;
        return false;
    }

    function normalizeText(text) {
        if (!text) return '';
        return text.trim().charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    function getLocationDisplay(registration) {
        // Retorna: localidad para Bogotá, departamento para Resto
        if (isBogotaRegistration(registration)) {
            return registration.localidad || 'Bogotá (Otra)';
        } else {
            return registration.departamento || registration.capital || 'Sin especificar';
        }
    }

    // ===================================
    // FILTRAR REGISTROS POR REGIÓN
    // ===================================
    function filterRegistrations(registrations, region, leaderId) {
        let filtered = [...registrations];

        // Filtro por región
        if (region === 'bogota') {
            filtered = filtered.filter(r => isBogotaRegistration(r));
        } else if (region === 'resto') {
            filtered = filtered.filter(r => !isBogotaRegistration(r));
        }

        // Filtro por líder
        if (leaderId) {
            filtered = filtered.filter(r => r.leaderId === leaderId);
        }

        return filtered;
    }

    // ===================================
    // CALCULAR ESTADÍSTICAS
    // ===================================
    function calculateStats(registrations) {
        const bogota = registrations.filter(r => isBogotaRegistration(r)).length;
        const resto = registrations.filter(r => !isBogotaRegistration(r)).length;
        const confirmed = registrations.filter(r => r.confirmed === true || r.confirmed === 'true').length;
        const pending = registrations.filter(r => r.confirmed !== true && r.confirmed !== 'true').length;
        const confirmRate = registrations.length > 0 ? ((confirmed / registrations.length) * 100).toFixed(1) : '0.0';

        console.log('[Analytics Debug] Stats:', {
            totalRegs: registrations.length,
            bogota,
            resto,
            confirmed,
            pending,
            confirmRate: confirmRate + '%'
        });

        return { confirmRate, bogota, resto, confirmed, pending, total: registrations.length };
    }

    // ===================================
    // ACTUALIZAR ESTADÍSTICAS
    // ===================================
    function updateStats() {
        const registrations = AppState.data.registrations || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);
        const stats = calculateStats(filtered);

        console.log('[Analytics] Actualizando stats - Filtrados:', filtered.length);

        DOMUtils.tryUpdate('avgConfirmRate', `${stats.confirmRate}%`);
        DOMUtils.tryUpdate('avgRegsPerLeader', stats.total);
        DOMUtils.tryUpdate('bogotaCount', stats.bogota);
        DOMUtils.tryUpdate('restoCount', stats.resto);
    }

    // ===================================
    // CARGAR DETALLE POR LÍDER EN TABLA
    // ===================================
    function populateLeaderDetailTable() {
        const registrations = AppState.data.registrations || [];
        const leaders = AppState.data.leaders || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);
        const tbody = DOMUtils.byId('leaderDetailTable');

        if (!tbody) return;

        console.log('[Analytics] Populate table - Total registrations:', registrations.length, 'Filtered:', filtered.length);

        // Calcular stats por cada líder EN LA REGIÓN FILTRADA
        const leaderStats = leaders.map(leader => {
            const leaderRegs = filtered.filter(r => r.leaderId === leader._id);
            const confirmed = leaderRegs.filter(r =>
                r.confirmed === true || r.confirmed === 'true'
            ).length;
            const pending = leaderRegs.length - confirmed;
            const rate = leaderRegs.length > 0 ? ((confirmed / leaderRegs.length) * 100).toFixed(1) : '0.0';

            return {
                _id: leader._id,
                name: leader.name,
                total: leaderRegs.length,
                confirmed,
                pending,
                rate
            };
        }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

        console.log('[Analytics] Leader stats count:', leaderStats.length);

        // Paginación
        const totalPages = Math.ceil(leaderStats.length / ITEMS_PER_PAGE);
        currentAnalyticsPage = Math.min(currentAnalyticsPage, Math.max(1, totalPages || 1));
        const start = (currentAnalyticsPage - 1) * ITEMS_PER_PAGE;
        const pageItems = leaderStats.slice(start, start + ITEMS_PER_PAGE);

        // Renderizar tabla
        let html = pageItems.map(stat => `
            <tr>
                <td><strong>${stat.name}</strong></td>
                <td><strong style="color: #667eea;">${stat.total}</strong></td>
                <td><span class="badge bg-success">${stat.confirmed}</span></td>
                <td><span class="badge bg-warning text-dark">${stat.pending}</span></td>
                <td><strong style="color: #667eea;">${stat.rate}%</strong></td>
            </tr>
        `).join('');

        tbody.innerHTML = html || '<tr><td colspan="5" class="text-center" style="color: #999;">Sin datos para la región seleccionada</td></tr>';

        // Actualizar paginación
        const indicador = DOMUtils.byId('leaderPageIndicator');
        if (indicador) indicador.textContent = `Pág ${currentAnalyticsPage} de ${totalPages || 1}`;
    }

    // ===================================
    // CARGAR GRÁFICOS CON DATOS REALES
    // ===================================
    function loadCharts() {
        const registrations = AppState.data.registrations || [];
        const leaders = AppState.data.leaders || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);

        console.log('[Analytics] Charts - Filtered registrations:', filtered.length);

        // ===== GRÁFICO 1: DESEMPEÑO POR LÍDER (TOP 10) =====
        try {
            const leaderChartData = leaders
                .map(leader => {
                    const leaderRegs = filtered.filter(r => r.leaderId === leader._id);
                    return {
                        name: leader.name.substring(0, 20),
                        total: leaderRegs.length
                    };
                })
                .filter(l => l.total > 0)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            console.log('[Analytics] Leader chart data points:', leaderChartData.length);

            if (leaderChartData.length === 0) {
                console.warn('[AnalyticsModule] Sin datos para gráfico de líderes');
            }

            ChartService.createChart('leaderRegistrationsChart', {
                type: 'bar',
                data: {
                    labels: leaderChartData.map(l => l.name),
                    datasets: [{
                        label: 'Registros',
                        data: leaderChartData.map(l => l.total),
                        backgroundColor: '#3b82f6',
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { color: '#9ca3af' },
                            grid: { color: 'rgba(156, 163, 175, 0.1)' }
                        },
                        y: {
                            ticks: { color: '#9ca3af' }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('[AnalyticsModule] Error cargando leaderRegistrationsChart:', err.message);
        }

        // ===== GRÁFICO 2: TOP 10 LOCALIDADES/DEPARTAMENTOS =====
        try {
            const locationMap = {};
            
            filtered.forEach(reg => {
                const location = getLocationDisplay(reg);
                locationMap[location] = (locationMap[location] || 0) + 1;
            });

            const topLocations = Object.entries(locationMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            console.log('[Analytics] Location chart data points:', topLocations.length);

            if (topLocations.length === 0) {
                console.warn('[AnalyticsModule] Sin datos para gráfico de ubicaciones');
            }

            ChartService.createChart('localityChart', {
                type: 'doughnut',
                data: {
                    labels: topLocations.map(l => l[0]),
                    datasets: [{
                        data: topLocations.map(l => l[1]),
                        backgroundColor: [
                            '#667eea', '#764ba2', '#f093fb', '#4facfe',
                            '#43e97b', '#fa709a', '#feca57', '#ff6b6b',
                            '#ee5a6f', '#c44569'
                        ],
                        borderWidth: 2,
                        borderColor: '#1f2937'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#9ca3af',
                                font: { size: 11 },
                                padding: 15
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('[AnalyticsModule] Error cargando localityChart:', err.message);
        }
    }

    // ===================================
    // APLICAR FILTROS
    // ===================================
    function applyFilters() {
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');

        currentFilter.region = regionSelect ? regionSelect.value : 'all';
        currentFilter.leaderId = leaderSelect ? leaderSelect.value : null;
        currentAnalyticsPage = 1;

        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        const regionText = currentFilter.region === 'bogota' ? 'Bogotá' : 
                          currentFilter.region === 'resto' ? 'Resto del País' : 'Todo el País';
        const leaderText = currentFilter.leaderId ? 
                          AppState.data.leaders.find(l => l._id === currentFilter.leaderId)?.name : '';
        
        ModalsModule.showAlert(`Filtros aplicados: ${regionText}${leaderText ? ' - ' + leaderText : ''}`, 'success');
    }

    function clearFilters() {
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');

        if (regionSelect) regionSelect.value = 'all';
        if (leaderSelect) leaderSelect.value = '';

        currentFilter = { region: 'all', leaderId: null };
        currentAnalyticsPage = 1;

        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        ModalsModule.showAlert('Filtros limpiados', 'info');
    }

    // ===================================
    // CARGAR ANALYTICS (ENTRY POINT)
    // ===================================
    function loadAnalytics() {
        console.log('[AnalyticsModule] 🔍 Cargando analytics desde base de datos...');
        
        const allRegs = AppState.data.registrations || [];
        const allLeaders = AppState.data.leaders || [];
        
        console.log('[AnalyticsModule] Datos disponibles:', {
            registrations: allRegs.length,
            leaders: allLeaders.length
        });
        
        currentAnalyticsPage = 1;
        
        // Poblar selector de líderes
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');
        if (leaderSelect) {
            const leaders = AppState.data.leaders || [];
            leaderSelect.innerHTML = '<option value="">Todos los Líderes</option>' +
                leaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
        }

        // Cargar análisis completamente desde AppState (MongoDB)
        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        console.log('[AnalyticsModule] ✅ Analytics cargado desde base de datos');
    }

    // ===================================
    // VINCULACIÓN DE EVENTOS
    // ===================================
    function bindEvents() {
        const applyBtn = DOMUtils.byId('applyAnalyticsFilterBtn');
        const clearBtn = DOMUtils.byId('clearAnalyticsFilterBtn');
        const prevBtn = DOMUtils.byId('prevLeaderPageBtn');
        const nextBtn = DOMUtils.byId('nextLeaderPageBtn');

        if (applyBtn) applyBtn.addEventListener('click', applyFilters);
        if (clearBtn) clearBtn.addEventListener('click', clearFilters);

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentAnalyticsPage > 1) {
                    currentAnalyticsPage--;
                    populateLeaderDetailTable();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const registrations = AppState.data.registrations || [];
                const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);
                const leaders = AppState.data.leaders || [];
                const leaderStats = leaders.map(leader => ({
                    total: filtered.filter(r => r.leaderId === leader._id).length
                })).filter(s => s.total > 0);

                const totalPages = Math.ceil(leaderStats.length / ITEMS_PER_PAGE);
                if (currentAnalyticsPage < totalPages) {
                    currentAnalyticsPage++;
                    populateLeaderDetailTable();
                }
            });
        }
    }

    // ===================================
    // INICIALIZACIÓN
    // ===================================
    function init() {
        console.log('[AnalyticsModule] Inicializado');
        bindEvents();
    }

    // Exponer métodos públicos
    return {
        init,
        loadAnalytics,
        applyFilters,
        clearFilters,
        updateStats
    };
})();

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AnalyticsModule.init);
} else {
    AnalyticsModule.init();
}

    // ===================================
    // UTILIDADES - Identificar región
    // ===================================
    function isBogotaRegistration(registration) {
        // Criterios:
        // 1. registeredToVote = true (indica que es Bogotá)
        // 2. O tiene localidad válida (localidades bogotanas)
        if (registration.registeredToVote === true) return true;
        if (registration.localidad && BOGOTA_LOCALIDADES.has(normalizeText(registration.localidad))) return true;
        return false;
    }

    function normalizeText(text) {
        if (!text) return '';
        return text.trim().charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    function getLocationDisplay(registration) {
        // Retorna: localidad para Bogotá, departamento para Resto
        if (isBogotaRegistration(registration)) {
            return registration.localidad || 'Bogotá (Otra)';
        } else {
            return registration.departamento || registration.capital || 'Sin especificar';
        }
    }

    // ===================================
    // FILTRAR REGISTROS POR REGIÓN
    // ===================================
    function filterRegistrations(registrations, region, leaderId) {
        let filtered = [...registrations];

        // Filtro por región
        if (region === 'bogota') {
            filtered = filtered.filter(r => isBogotaRegistration(r));
        } else if (region === 'resto') {
            filtered = filtered.filter(r => !isBogotaRegistration(r));
        }

        // Filtro por líder
        if (leaderId) {
            filtered = filtered.filter(r => r.leaderId === leaderId);
        }

        return filtered;
    }

    // ===================================
    // CALCULAR ESTADÍSTICAS
    // ===================================
    function calculateStats(registrations) {
        const bogota = registrations.filter(r => isBogotaRegistration(r)).length;
        const resto = registrations.filter(r => !isBogotaRegistration(r)).length;

        const leaders = AppState.data.leaders || [];
        let totalConfirm = 0;
        let totalRegs = 0;

        leaders.forEach(leader => {
            const leaderRegs = registrations.filter(r => r.leaderId === leader._id);
            const leaderConfirm = leaderRegs.filter(r =>
                r.confirmed === true || r.confirmed === 'true' || r.confirmado === true || r.confirmado === 'true'
            ).length;
            totalConfirm += leaderConfirm;
            totalRegs += leaderRegs.length;
        });

        const avgConfirmRate = totalRegs > 0 ? ((totalConfirm / totalRegs) * 100).toFixed(1) : '0.0';
        const avgRegsPerLeader = leaders.length > 0 ? (totalRegs / leaders.length).toFixed(1) : '0.0';

        return { avgConfirmRate, avgRegsPerLeader, bogota, resto };
    }

    // ===================================
    // ACTUALIZAR ESTADÍSTICAS
    // ===================================
    function updateStats() {
        const registrations = AppState.data.registrations || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);
        const stats = calculateStats(filtered);

        DOMUtils.tryUpdate('avgConfirmRate', `${stats.avgConfirmRate}%`);
        DOMUtils.tryUpdate('avgRegsPerLeader', stats.avgRegsPerLeader);
        DOMUtils.tryUpdate('bogotaCount', stats.bogota);
        DOMUtils.tryUpdate('restoCount', stats.resto);
    }

    // ===================================
    // CARGAR DETALLE POR LÍDER EN TABLA
    // ===================================
    function populateLeaderDetailTable() {
        const registrations = AppState.data.registrations || [];
        const leaders = AppState.data.leaders || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);
        const tbody = DOMUtils.byId('leaderDetailTable');

        if (!tbody) return;

        // Calcular stats por cada líder EN LA REGIÓN FILTRADA
        const leaderStats = leaders.map(leader => {
            const leaderRegs = filtered.filter(r => r.leaderId === leader._id);
            const confirmed = leaderRegs.filter(r =>
                r.confirmed === true || r.confirmed === 'true' || r.confirmado === true || r.confirmado === 'true'
            ).length;
            const pending = leaderRegs.length - confirmed;
            const rate = leaderRegs.length > 0 ? ((confirmed / leaderRegs.length) * 100).toFixed(1) : '0.0';

            return {
                _id: leader._id,
                name: leader.name,
                total: leaderRegs.length,
                confirmed,
                pending,
                rate
            };
        }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

        // Paginación
        const totalPages = Math.ceil(leaderStats.length / ITEMS_PER_PAGE);
        currentAnalyticsPage = Math.min(currentAnalyticsPage, Math.max(1, totalPages || 1));
        const start = (currentAnalyticsPage - 1) * ITEMS_PER_PAGE;
        const pageItems = leaderStats.slice(start, start + ITEMS_PER_PAGE);

        // Renderizar tabla
        let html = pageItems.map(stat => `
            <tr>
                <td><strong>${stat.name}</strong></td>
                <td>${stat.total}</td>
                <td><span class="badge bg-success">${stat.confirmed}</span></td>
                <td><span class="badge bg-warning">${stat.pending}</span></td>
                <td><strong style="color: #667eea;">${stat.rate}%</strong></td>
            </tr>
        `).join('');

        tbody.innerHTML = html || '<tr><td colspan="5" class="text-center" style="color: #999;">Sin datos para la región seleccionada</td></tr>';

        // Actualizar paginación
        const indicador = DOMUtils.byId('leaderPageIndicator');
        if (indicador) indicador.textContent = `Pág ${currentAnalyticsPage} de ${totalPages || 1}`;
    }

    // ===================================
    // CARGAR GRÁFICOS CON DATOS REALES
    // ===================================
    function loadCharts() {
        const registrations = AppState.data.registrations || [];
        const leaders = AppState.data.leaders || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);

        // ===== GRÁFICO 1: DESEMPEÑO POR LÍDER (TOP 10) =====
        try {
            const leaderChartData = leaders
                .map(leader => {
                    const leaderRegs = filtered.filter(r => r.leaderId === leader._id);
                    return {
                        name: leader.name.substring(0, 15),
                        total: leaderRegs.length
                    };
                })
                .filter(l => l.total > 0)
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            if (leaderChartData.length === 0) {
                console.warn('[AnalyticsModule] Sin datos para gráfico de líderes');
            }

            ChartService.createChart('leaderRegistrationsChart', {
                type: 'bar',
                data: {
                    labels: leaderChartData.map(l => l.name),
                    datasets: [{
                        label: 'Registros',
                        data: leaderChartData.map(l => l.total),
                        backgroundColor: '#3b82f6',
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { color: '#9ca3af' },
                            grid: { color: 'rgba(156, 163, 175, 0.1)' }
                        },
                        y: {
                            ticks: { color: '#9ca3af' }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('[AnalyticsModule] Error cargando leaderRegistrationsChart:', err.message);
        }

        // ===== GRÁFICO 2: TOP 10 LOCALIDADES/DEPARTAMENTOS =====
        try {
            const locationMap = {};
            
            filtered.forEach(reg => {
                const location = getLocationDisplay(reg);
                locationMap[location] = (locationMap[location] || 0) + 1;
            });

            const topLocations = Object.entries(locationMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            if (topLocations.length === 0) {
                console.warn('[AnalyticsModule] Sin datos para gráfico de ubicaciones');
            }

            ChartService.createChart('localityChart', {
                type: 'doughnut',
                data: {
                    labels: topLocations.map(l => l[0]),
                    datasets: [{
                        data: topLocations.map(l => l[1]),
                        backgroundColor: [
                            '#667eea', '#764ba2', '#f093fb', '#4facfe',
                            '#43e97b', '#fa709a', '#feca57', '#ff6b6b',
                            '#ee5a6f', '#c44569'
                        ],
                        borderWidth: 2,
                        borderColor: '#1f2937'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#9ca3af',
                                font: { size: 11 },
                                padding: 15
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('[AnalyticsModule] Error cargando localityChart:', err.message);
        }
    }

    // ===================================
    // APLICAR FILTROS
    // ===================================
    function applyFilters() {
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');

        currentFilter.region = regionSelect ? regionSelect.value : 'all';
        currentFilter.leaderId = leaderSelect ? leaderSelect.value : null;
        currentAnalyticsPage = 1;

        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        const regionText = currentFilter.region === 'bogota' ? 'Bogotá' : 
                          currentFilter.region === 'resto' ? 'Resto del País' : 'Todo el País';
        const leaderText = currentFilter.leaderId ? 
                          AppState.data.leaders.find(l => l._id === currentFilter.leaderId)?.name : '';
        
        ModalsModule.showAlert(`Filtros aplicados: ${regionText}${leaderText ? ' - ' + leaderText : ''}`, 'success');
    }

    function clearFilters() {
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');

        if (regionSelect) regionSelect.value = 'all';
        if (leaderSelect) leaderSelect.value = '';

        currentFilter = { region: 'all', leaderId: null };
        currentAnalyticsPage = 1;

        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        ModalsModule.showAlert('Filtros limpiados', 'info');
    }

    // ===================================
    // CARGAR ANALYTICS (ENTRY POINT)
    // ===================================
    function loadAnalytics() {
        console.log('[AnalyticsModule] 🔍 Cargando analytics desde base de datos...');
        
        currentAnalyticsPage = 1;
        
        // Poblar selector de líderes
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');
        if (leaderSelect) {
            const leaders = AppState.data.leaders || [];
            leaderSelect.innerHTML = '<option value="">Todos los Líderes</option>' +
                leaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
        }

        // Cargar análisis completamente desde AppState (MongoDB)
        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        console.log('[AnalyticsModule] ✅ Analytics cargado desde base de datos');
    }

    // ===================================
    // VINCULACIÓN DE EVENTOS
    // ===================================
    function bindEvents() {
        const applyBtn = DOMUtils.byId('applyAnalyticsFilterBtn');
        const clearBtn = DOMUtils.byId('clearAnalyticsFilterBtn');
        const prevBtn = DOMUtils.byId('prevLeaderPageBtn');
        const nextBtn = DOMUtils.byId('nextLeaderPageBtn');

        if (applyBtn) applyBtn.addEventListener('click', applyFilters);
        if (clearBtn) clearBtn.addEventListener('click', clearFilters);

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentAnalyticsPage > 1) {
                    currentAnalyticsPage--;
                    populateLeaderDetailTable();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const registrations = AppState.data.registrations || [];
                const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);
                const leaders = AppState.data.leaders || [];
                const leaderStats = leaders.map(leader => ({
                    total: filtered.filter(r => r.leaderId === leader._id).length
                })).filter(s => s.total > 0);

                const totalPages = Math.ceil(leaderStats.length / ITEMS_PER_PAGE);
                if (currentAnalyticsPage < totalPages) {
                    currentAnalyticsPage++;
                    populateLeaderDetailTable();
                }
            });
        }
    }

    // ===================================
    // INICIALIZACIÓN
    // ===================================
    function init() {
        console.log('[AnalyticsModule] Inicializado');
        bindEvents();
    }

    // Exponer métodos públicos
    return {
        init,
        loadAnalytics,
        applyFilters,
        clearFilters,
        updateStats
    };
})();

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AnalyticsModule.init);
} else {
    AnalyticsModule.init();
}
