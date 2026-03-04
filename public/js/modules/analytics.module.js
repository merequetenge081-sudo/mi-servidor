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
    function renderLeaderPerformanceChart(leaderStats) {
        try {
            const data = Array.isArray(leaderStats) ? leaderStats : [];
            if (data.length === 0) {
                const canvas = document.getElementById('leaderRegistrationsChart');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.font = '14px Inter';
                    ctx.fillStyle = '#9ca3af';
                    ctx.textAlign = 'center';
                    ctx.fillText('No hay datos disponibles', canvas.width / 2, canvas.height / 2);
                }
                return;
            }

            const topLeaders = data
                .map((l) => ({
                    name: (l.name || 'Sin lider').split(' ')[0],
                    bogota: l.bogota || 0,
                    resto: l.resto || 0,
                    total: l.total || 0
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            const labels = topLeaders.map((l) => l.name);
            const bogotaData = topLeaders.map((l) => l.bogota);
            const restoData = topLeaders.map((l) => l.resto);

            ChartService.createChart('leaderRegistrationsChart', {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Bogotá',
                            data: bogotaData,
                            backgroundColor: '#667eea',
                            borderRadius: 6
                        },
                        {
                            label: 'Resto del País',
                            data: restoData,
                            backgroundColor: '#f093fb',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#9ca3af' },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        x: {
                            ticks: { color: '#9ca3af', maxRotation: 0 },
                            grid: { display: false }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#9ca3af',
                                padding: 20,
                                boxWidth: 12,
                                boxHeight: 12
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(17, 24, 39, 0.95)',
                            titleColor: '#f3f4f6',
                            bodyColor: '#d1d5db',
                            padding: 12,
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            displayColors: true,
                            callbacks: {
                                title: function(context) {
                                    return context[0].label || '';
                                },
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y || 0;
                                    return `${label}: ${value} registros`;
                                },
                                afterBody: function(context) {
                                    const index = context[0].dataIndex;
                                    const bogota = bogotaData[index];
                                    const resto = restoData[index];
                                    const total = bogota + resto;
                                    return ['', `Total: ${total} registros`];
                                }
                            }
                        }
                    }
                }
            });
        } catch (err) {
            console.error('[Analytics] Error en renderLeaderPerformanceChart:', err);
        }
    }
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
    async function refreshMetrics() {
        const params = new URLSearchParams();
        const eventId = AppState.user?.eventId || null;
        if (eventId) params.set('eventId', eventId);
        if (currentFilter.region && currentFilter.region !== 'all') {
            params.set('region', currentFilter.region);
        }
        if (currentFilter.leaderId) params.set('leaderId', currentFilter.leaderId);

        const query = params.toString();
        const endpoint = query ? `/api/v2/analytics/metrics?${query}` : '/api/v2/analytics/metrics';
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${AppState.user.token}`
            }
        });

        if (!response.ok) throw new Error('Error obteniendo metrics');
        const payload = await response.json();
        if (!payload || !payload.success) throw new Error('Respuesta inválida de metrics');

        cachedMetrics = payload.data;
        return cachedMetrics;
    }

    function updateStats() {
        const totals = cachedMetrics?.totals;
        if (!totals) return;

        DOMUtils.tryUpdate('avgConfirmRate', `${totals.confirmRate || 0}%`);
        DOMUtils.tryUpdate('avgRegsPerLeader', totals.avgRegsPerLeader || 0);
        DOMUtils.tryUpdate('bogotaCount', totals.bogotaCount || 0);
        DOMUtils.tryUpdate('restoCount', totals.restoCount || 0);
    }

    // ===================================
    // CARGAR DETALLE POR LÍDER EN TABLA
    // ===================================
    function populateLeaderDetailTable() {
        const leaderStats = cachedMetrics?.leaders || [];
        const tbody = DOMUtils.byId('leaderDetailTable');

        if (!tbody) return;
        if (leaderStats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin datos</td></tr>';
            return;
        }

        // Paginación
        const totalPages = Math.ceil(leaderStats.length / ITEMS_PER_PAGE);
        currentAnalyticsPage = Math.min(currentAnalyticsPage, Math.max(1, totalPages || 1));
        const start = (currentAnalyticsPage - 1) * ITEMS_PER_PAGE;
        const pageItems = leaderStats.slice(start, start + ITEMS_PER_PAGE);

        // Renderizar tabla
        let html = pageItems.map(stat => `
            <tr>
                <td><strong>${stat.name || 'Sin lider'}</strong></td>
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
    // GRÁFICO DE BARRAS AGRUPADAS: BOGOTÁ VS RESTO
    // ===================================
    function renderLeaderPerformanceChart(registrations, leaders) {
        try {
            console.log('[Analytics] Leader Performance Chart - Total registros recibidos:', registrations.length);

            if (registrations.length === 0) {
                console.warn('[Analytics] Sin registros para el gráfico');
                const canvas = document.getElementById('leaderRegistrationsChart');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.font = '14px Inter';
                    ctx.fillStyle = '#9ca3af';
                    ctx.textAlign = 'center';
                    ctx.fillText('No hay datos disponibles', canvas.width / 2, canvas.height / 2);
                }
                return;
            }

            // 2. Agrupar por líder y región (TODOS los registros, no solo confirmados)
            const leaderData = {};

            console.log('[Analytics] Clasificando registros...');
            let bogotaCount = 0;
            let restoCount = 0;
            let sinLocalidad = 0;

            registrations.forEach(reg => {
                const leaderId = reg.leaderId;
                if (!leaderId) return;

                if (!leaderData[leaderId]) {
                    leaderData[leaderId] = {
                        name: reg.leaderName || 'Sin nombre',
                        bogota: 0,
                        resto: 0
                    };
                }

                // Clasificar por región
                const esBogota = isBogotaRegistration(reg);
                if (esBogota) {
                    leaderData[leaderId].bogota++;
                    bogotaCount++;
                } else {
                    leaderData[leaderId].resto++;
                    restoCount++;
                    if (!reg.localidad) sinLocalidad++;
                }
            });

            console.log(`[Analytics] Clasificación: ${bogotaCount} Bogotá, ${restoCount} Resto del País (${sinLocalidad} sin localidad)`);

            // 3. Obtener nombres completos de líderes desde AppState
            const leaderMap = {};
            leaders.forEach(leader => {
                leaderMap[leader._id] = leader.name;
            });

            // Actualizar nombres
            Object.keys(leaderData).forEach(leaderId => {
                if (leaderMap[leaderId]) {
                    leaderData[leaderId].name = leaderMap[leaderId];
                }
            });

            // 4. Convertir a array y ordenar por total
            const leaderArray = Object.entries(leaderData).map(([id, data]) => ({
                id,
                name: data.name.substring(0, 25), // Limitar longitud
                bogota: data.bogota,
                resto: data.resto,
                total: data.bogota + data.resto
            }));

            // Ordenar por total descendente y tomar top 10
            leaderArray.sort((a, b) => b.total - a.total);
            const top10 = leaderArray.slice(0, 10);

            console.log('[Analytics] Leader Performance Chart - Top 10:', top10);

            // 5. Preparar datos para Chart.js
            const labels = top10.map(l => l.name);
            const bogotaData = top10.map(l => l.bogota);
            const restoData = top10.map(l => l.resto);

            // 6. Crear gráfico con Chart.js
            ChartService.createChart('leaderRegistrationsChart', {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Bogotá',
                            data: bogotaData,
                            backgroundColor: '#6366f1',
                            borderRadius: 4,
                            borderSkipped: false,
                            maxBarThickness: 40
                        },
                        {
                            label: 'Resto del País',
                            data: restoData,
                            backgroundColor: '#8b5cf6',
                            borderRadius: 4,
                            borderSkipped: false,
                            maxBarThickness: 40
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    barPercentage: 0.75,
                    categoryPercentage: 0.8,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { 
                                color: '#6b7280',
                                precision: 0,
                                font: {
                                    size: 11
                                }
                            },
                            grid: { 
                                color: 'rgba(229, 231, 235, 0.8)',
                                drawBorder: false
                            },
                            border: {
                                display: false
                            }
                        },
                        x: {
                            ticks: { 
                                color: '#4b5563',
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: 11,
                                    weight: '500'
                                },
                                autoSkip: false
                            },
                            grid: { 
                                display: false,
                                drawBorder: false
                            },
                            border: {
                                display: false
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            align: 'end',
                            labels: {
                                color: '#4b5563',
                                font: {
                                    size: 11,
                                    weight: '600'
                                },
                                padding: 12,
                                usePointStyle: true,
                                pointStyle: 'rect',
                                boxWidth: 12,
                                boxHeight: 12
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(17, 24, 39, 0.95)',
                            titleColor: '#f3f4f6',
                            bodyColor: '#d1d5db',
                            padding: 12,
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            displayColors: true,
                            callbacks: {
                                title: function(context) {
                                    return context[0].label || '';
                                },
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y || 0;
                                    return `${label}: ${value} registros`;
                                },
                                afterBody: function(context) {
                                    const index = context[0].dataIndex;
                                    const bogota = bogotaData[index];
                                    const resto = restoData[index];
                                    const total = bogota + resto;
                                    return [
                                        '',
                                        `Total: ${total} registros`
                                    ];
                                }
                            }
                        }
                    }
                }
            });

            console.log('[Analytics] ✅ Leader Performance Chart renderizado');

        } catch (err) {
            console.error('[Analytics] Error en renderLeaderPerformanceChart:', err);
        }
    }

    // ===================================
    // CARGAR GRÁFICOS CON DATOS REALES
    // ===================================
    function loadCharts() {
        if (!cachedMetrics) return;

        renderLeaderPerformanceChart(cachedMetrics.leaders || []);

        try {
            const topLocations = cachedMetrics.locality || [];
            ChartService.createChart('localityChart', {
                type: 'doughnut',
                data: {
                    labels: topLocations.map(l => l.name),
                    datasets: [{
                        data: topLocations.map(l => l.count),
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
    async function applyFilters() {
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');

        currentFilter.region = regionSelect ? regionSelect.value : 'all';
        currentFilter.leaderId = leaderSelect ? leaderSelect.value : null;
        currentAnalyticsPage = 1;

        await refreshMetrics();
        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        const regionText = currentFilter.region === 'bogota' ? 'Bogotá' : 
                          currentFilter.region === 'resto' ? 'Resto del País' : 'Todo el País';
        const leaderText = currentFilter.leaderId ? 
                          AppState.data.leaders.find(l => l._id === currentFilter.leaderId)?.name : '';
        
        ModalsModule.showAlert(`Filtros aplicados: ${regionText}${leaderText ? ' - ' + leaderText : ''}`, 'success');
    }

    async function clearFilters() {
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');

        if (regionSelect) regionSelect.value = 'all';
        if (leaderSelect) leaderSelect.value = '';

        currentFilter = { region: 'all', leaderId: null };
        currentAnalyticsPage = 1;

        await refreshMetrics();
        updateStats();
        populateLeaderDetailTable();
        loadCharts();

        ModalsModule.showAlert('Filtros limpiados', 'info');
    }

    // ===================================
    // CARGAR ANALYTICS (ENTRY POINT)
    // ===================================
    async function loadAnalytics() {
        console.log('[AnalyticsModule] 🔍 Cargando analytics desde base de datos...');
        
        console.log('[AnalyticsModule] Datos disponibles:', {
            leaders: (AppState.data.leaders || []).length
        });
        
        // Resetear filtros al cargar
        currentFilter = { region: 'all', leaderId: null };
        currentAnalyticsPage = 1;
        
        // Poblar selector de región y resetear
        const regionSelect = DOMUtils.byId('analyticsRegionFilter');
        if (regionSelect) {
            regionSelect.value = 'all';
        }
        
        // Poblar selector de líderes
        const leaderSelect = DOMUtils.byId('analyticsLeaderFilter');
        if (leaderSelect) {
            const leaders = AppState.data.leaders || [];
            leaderSelect.innerHTML = '<option value="">Todos los Líderes</option>' +
                leaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
        }

        await refreshMetrics();
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
                const totalLeaders = cachedMetrics?.leaders?.length || 0;
                const totalPages = Math.ceil(totalLeaders / ITEMS_PER_PAGE) || 1;
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

// Export to window
window.AnalyticsModule = AnalyticsModule;


