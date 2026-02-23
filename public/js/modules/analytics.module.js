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
        'Puente Aranda', 'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
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
        // Solo clasificar como Bogotá si tiene una de las 20 localidades
        // Buscar coincidencias en el campo localidad (case insensitive)
        if (!registration.localidad) return false;
        
        const localidad = registration.localidad.trim().toLowerCase();
        
        // Búsqueda case-insensitive
        for (const loc of BOGOTA_LOCALIDADES) {
            const locLower = loc.toLowerCase();
            // Coincidencia exacta o parcial (contiene la localidad)
            if (localidad === locLower || localidad.includes(locLower) || locLower.includes(localidad)) {
                return true;
            }
        }
        
        return false;
    }

    function normalizeText(text) {
        if (!text) return '';
        return text.trim().charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Normaliza y estandariza nombres de ubicaciones
     * - Quita tildes/acentos
     * - Convierte a Title Case
     * - Unifica variaciones (ATLANTICO, atlántico, Atlántico -> Atlántico)
     */
    function normalizeLocation(text) {
        if (!text || text.trim() === '') return '';
        
        // Limpiar y convertir a minúsculas
        let normalized = text.trim().toLowerCase();
        
        // Mapa de reemplazos para estandarizar nombres comunes
        const locationMap = {
            'atlantico': 'Atlántico',
            'bogota': 'Bogotá',
            'bolivar': 'Bolívar',
            'boyaca': 'Boyacá',
            'cordoba': 'Córdoba',
            'narino': 'Nariño',
            'quindio': 'Quindío',
            'valle del cauca': 'Valle del Cauca',
            'valle': 'Valle del Cauca',
            'medellin': 'Medellín',
            'barranquilla': 'Barranquilla',
            'cartagena': 'Cartagena',
            'cucuta': 'Cúcuta',
            'bucaramanga': 'Bucaramanga',
            'pereira': 'Pereira',
            'santa marta': 'Santa Marta',
            'ibague': 'Ibagué',
            'pasto': 'Pasto',
            'manizales': 'Manizales',
            'neiva': 'Neiva',
            'villavicencio': 'Villavicencio',
            'armenia': 'Armenia',
            'valledupar': 'Valledupar',
            'monteria': 'Montería',
            'sincelejo': 'Sincelejo',
            'popayan': 'Popayán',
            'tunja': 'Tunja',
            'florencia': 'Florencia',
            'riohacha': 'Riohacha',
            'yopal': 'Yopal',
            'quibdo': 'Quibdó',
            'arauca': 'Arauca',
            'mocoa': 'Mocoa',
            'san andres': 'San Andrés',
            'leticia': 'Leticia',
            'puerto carreno': 'Puerto Carreño',
            'inirida': 'Inírida',
            'mitu': 'Mitú'
        };
        
        // Buscar coincidencia exacta o parcial
        for (const [key, value] of Object.entries(locationMap)) {
            if (normalized === key || normalized.includes(key)) {
                return value;
            }
        }
        
        // Si no hay coincidencia, aplicar Title Case
        return normalized
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function getLocationDisplay(registration) {
        // Retorna: localidad para Bogotá, departamento/capital para Resto
        if (isBogotaRegistration(registration)) {
            return normalizeLocation(registration.localidad) || 'Bogotá (Otra)';
        } else {
            // Prioridad: capital > departamento > localidad > Sin especificar
            // Normalizar para unificar variaciones (ATLANTICO, atlántico, Atlántico)
            if (registration.capital && registration.capital.trim() !== '') {
                return normalizeLocation(registration.capital);
            }
            if (registration.departamento && registration.departamento.trim() !== '') {
                return normalizeLocation(registration.departamento);
            }
            if (registration.localidad && registration.localidad.trim() !== '') {
                return normalizeLocation(registration.localidad);
            }
            return 'Sin especificar';
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
        const registrations = AppState.data.registrations || [];
        const leaders = AppState.data.leaders || [];
        const filtered = filterRegistrations(registrations, currentFilter.region, currentFilter.leaderId);

        console.log('[Analytics] Charts - Filtered registrations:', filtered.length);

        // ===== GRÁFICO 1: DESEMPEÑO POR LÍDER - BOGOTÁ VS RESTO DEL PAÍS =====
        // Si hay filtro de región, mostrar solo esa región (pero ambos datasets se calculan desde filtered)
        // Si no hay filtro de región, mostrar comparación completa
        renderLeaderPerformanceChart(filtered, leaders);

        // ===== GRÁFICO 2: TOP 10 LOCALIDADES/DEPARTAMENTOS =====
        try {
            const locationMap = {};
            
            console.log('[Analytics] Construyendo gráfico de ubicaciones...');
            
            filtered.forEach(reg => {
                const location = getLocationDisplay(reg);
                locationMap[location] = (locationMap[location] || 0) + 1;
            });

            const topLocations = Object.entries(locationMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            console.log('[Analytics] Top ubicaciones:', topLocations.map(l => `${l[0]}: ${l[1]}`).join(', '));

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

