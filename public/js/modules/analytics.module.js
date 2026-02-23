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
        console.log('[AnalyticsModule] � Cargando Advanced Analytics desde servidor...');
        
        // Mostrar skeleton loaders mientras se cargan los datos
        showSkeletonLoaders();
        
        // Construir parámetros de filtro
        const params = new URLSearchParams();
        if (currentFilter.leaderId) params.append('leaderId', currentFilter.leaderId);
        
        // Fetch del nuevo endpoint avanzado
        fetch(`/api/v2/analytics/advanced?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(response => {
                if (!response.success) throw new Error(response.message || 'Error en respuesta');
                
                const data = response.data;
                console.log('[AnalyticsModule] 📊 Datos Advanced recibidos:', data);
                
                // Guardar en estado global para compatibilidad
                AppState.data.advancedAnalytics = data;
                
                // Actualizar todas las secciones
                renderKPICards(data);
                renderChartsAdvanced(data);
                
                // Resetear filtros
                currentFilter = { region: 'all', leaderId: null };
                currentAnalyticsPage = 1;
                
                console.log('[AnalyticsModule] ✅ Advanced Analytics cargado exitosamente');
                hideSkeletonLoaders();
            })
            .catch(error => {
                console.error('[AnalyticsModule] ❌ Error cargando advanced analytics:', error);
                hideSkeletonLoaders();
                showErrorMessage('Error cargando análisis avanzado');
            });
    }

    // ===================================
    // VINCULACIÓN DE EVENTOS
    // ===================================
    function bindEvents() {
        // Botones principales
        const applyBtn = DOMUtils.byId('applyAnalyticsFilterBtn');
        const exportBtn = DOMUtils.byId('exportAnalyticsBtn');

        // Cuando se hace click en "Actualizar", fetch con filtros
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const leaderId = DOMUtils.byId('analyticsLeaderFilter')?.value;
                const localidad = DOMUtils.byId('analyticsLocalidadFilter')?.value;
                const startDate = DOMUtils.byId('analyticsStartDateFilter')?.value;

                // Construir parámetros
                const params = new URLSearchParams();
                if (leaderId) params.append('leaderId', leaderId);
                if (localidad) params.append('localidad', localidad);
                if (startDate) params.append('startDate', startDate);

                console.log('[AnalyticsModule] Aplicando filtros:', { leaderId, localidad, startDate });
                
                // Mostrar loaders
                showSkeletonLoaders();

                // Fetch con parámetros
                fetch(`/api/v2/analytics/advanced?${params.toString()}`)
                    .then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.json();
                    })
                    .then(response => {
                        if (!response.success) throw new Error(response.message);
                        
                        const data = response.data;
                        AppState.data.advancedAnalytics = data;
                        
                        renderKPICards(data);
                        renderChartsAdvanced(data);
                        
                        hideSkeletonLoaders();
                        console.log('[AnalyticsModule] ✅ Filtros aplicados exitosamente');
                    })
                    .catch(error => {
                        console.error('[AnalyticsModule] Error:', error);
                        hideSkeletonLoaders();
                        showErrorMessage('Error aplicando filtros: ' + error.message);
                    });
            });
        }

        // Botón exportar
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportAnalyticsToExcel();
            });
        }

        // Auto-cargar analytics al iniciar
        console.log('[AnalyticsModule] bindEvents - Cargando initial data...');
        loadAnalytics();
    }

    // ===================================
    // SKELETON LOADERS
    // ===================================
    function showSkeletonLoaders() {
        const containers = document.querySelectorAll('[data-analytics-section]');
        containers.forEach(container => {
            container.innerHTML = '<div class="animated-pulse bg-gray-200 h-40 rounded mb-4"></div>';
        });
    }

    function hideSkeletonLoaders() {
        // Los loaders se reemplazan con contenido real en renderKPICards y renderChartsAdvanced
    }

    function showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    // ===================================
    // RENDER KPI CARDS - Enterprise UI
    // ===================================
    function renderKPICards(data) {
        const container = DOMUtils.byId('kpiCardsContainer');
        if (!container) return;

        const { totalVotes, leaders, puestos, distribution } = data;
        
        // Calcular pendientes
        const pendientes = totalVotes.total - totalVotes.confirmed;
        const ratioBogota = distribution.find(d => d.region === 'Bogotá')?.votes || 0;
        
        const html = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 12px rgba(102,126,234,0.3); color: #fff; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(102,126,234,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.3)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <p style="margin: 0 0 8px 0; font-size: 12px; opacity: 0.9; font-weight: 500;">📊 Total de Votos</p>
                        <h2 style="margin: 0; font-size: 36px; font-weight: 700;">${totalVotes.total.toLocaleString()}</h2>
                        <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">✓ ${totalVotes.confirmed} confirmados</p>
                    </div>
                </div>
            </div>

            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 12px rgba(245,87,108,0.3); color: #fff; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(245,87,108,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(245,87,108,0.3)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <p style="margin: 0 0 8px 0; font-size: 12px; opacity: 0.9; font-weight: 500;">✅ Confirmación</p>
                        <h2 style="margin: 0; font-size: 36px; font-weight: 700;">${parseFloat(totalVotes.confirmationRate).toFixed(1)}%</h2>
                        <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">⏳ ${pendientes} pendientes</p>
                    </div>
                </div>
            </div>

            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,242,254,0.3); color: #fff; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,242,254,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,242,254,0.3)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <p style="margin: 0 0 8px 0; font-size: 12px; opacity: 0.9; font-weight: 500;">👥 Líderes Activos</p>
                        <h2 style="margin: 0; font-size: 36px; font-weight: 700;">${leaders.total}</h2>
                        <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">🏆 Top 10 mostrados</p>
                    </div>
                </div>
            </div>

            <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 20px; border-radius: 10px; box-shadow: 0 4px 12px rgba(67,233,123,0.3); color: #fff; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(67,233,123,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(67,233,123,0.3)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <p style="margin: 0 0 8px 0; font-size: 12px; opacity: 0.9; font-weight: 500;">🗺️ Regiones</p>
                        <h2 style="margin: 0; font-size: 36px; font-weight: 700;">${distribution.length}</h2>
                        <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">📍 Bogotá: ${ratioBogota}</p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        
        // Actualizar timestamp
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        }
    }

    // ===================================
    // HELPER: Destruir todos los charts existentes
    // ===================================
    function destroyAllCharts() {
        const chartIds = ['leadersChart', 'localidadesChart', 'timelineChart', 'puestosChart'];
        chartIds.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas && canvas.chart) {
                try {
                    canvas.chart.destroy();
                    canvas.chart = null;
                } catch (e) {
                    console.warn(`[Analytics] Warning destroying chart ${id}:`, e.message);
                }
            }
        });
    }

    // ===================================
    // RENDER CHARTS - Advanced Aggregation
    // ===================================
    function renderChartsAdvanced(data) {
        const { totalVotes, leaders, localidades, puestos, timeline, distribution } = data;

        // Destruir gráficos anteriores antes de crear nuevos
        destroyAllCharts();

        // Gráfico 1: Top Leaders (Bar Chart)
        renderLeadersChart(leaders.top);
        
        // Gráfico 2: Top Localidades (Doughnut Chart)
        renderLocalidadesChart(localidades.top);
        
        // Gráfico 3: Timeline (Line Chart)
        renderTimelineChart(timeline);
        
        // Gráfico 4: Top Puestos (Horizontal Bar Chart)
        renderPuestosChart(puestos.top);
    }

    function renderLeadersChart(leadersData) {
        const chartContainer = document.getElementById('leadersChart');
        if (!chartContainer) {
            console.warn('[Analytics] Canvas #leadersChart not found');
            return;
        }

        const ctx = chartContainer.getContext('2d');
        if (!ctx) return;

        const medals = ['🥇', '🥈', '🥉'];
        
        chartContainer.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: leadersData.map((l, i) => `${medals[i] || '•'} ${l.leaderName}`),
                datasets: [{
                    label: 'Votos',
                    data: leadersData.map(l => l.votes),
                    backgroundColor: leadersData.map((_, i) => {
                        const colors = ['rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)', 'rgba(168, 85, 247, 0.8)'];
                        return colors[i] || 'rgba(100, 116, 139, 0.8)';
                    }),
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: { text: 'Top 10 Líderes', display: true }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Votos' } }
                }
            }
        });
    }

    function renderLocalidadesChart(localidadesData) {
        const chartContainer = document.getElementById('localidadesChart');
        if (!chartContainer) {
            console.warn('[Analytics] Canvas #localidadesChart not found');
            return;
        }

        const ctx = chartContainer.getContext('2d');
        if (!ctx) return;

        const colors = [
            'rgba(59, 130, 246, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(248, 113, 113, 0.8)',
            'rgba(251, 146, 60, 0.8)',
            'rgba(236, 72, 153, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(20, 184, 166, 0.8)',
            'rgba(245, 158, 11, 0.8)'
        ];

        chartContainer.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: localidadesData.map(l => l.localidad),
                datasets: [{
                    data: localidadesData.map(l => l.votes),
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { text: 'Top 10 Localidades', display: true }
                }
            }
        });
    }

    function renderTimelineChart(timelineData) {
        const chartContainer = document.getElementById('timelineChart');
        if (!chartContainer) {
            console.warn('[Analytics] Canvas #timelineChart not found');
            return;
        }

        const ctx = chartContainer.getContext('2d');
        if (!ctx) return;

        chartContainer.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.map(t => t.date),
                datasets: [{
                    label: 'Votos Diarios',
                    data: timelineData.map(t => t.votes),
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: true },
                    title: { text: 'Timeline de Votos (Últimos 30 días)', display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function renderPuestosChart(puestosData) {
        const chartContainer = document.getElementById('puestosChart');
        if (!chartContainer) {
            console.warn('[Analytics] Canvas #puestosChart not found');
            return;
        }

        const ctx = chartContainer.getContext('2d');
        if (!ctx) return;

        // FIX: Usar 'bar' con indexAxis: 'y' en lugar de 'barH'
        chartContainer.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: puestosData.map(p => p.puestoName || 'N/A'),
                datasets: [{
                    label: 'Votos',
                    data: puestosData.map(p => p.votes),
                    backgroundColor: 'rgba(248, 113, 113, 0.8)',
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: { text: 'Top 10 Puestos de Votación', display: true }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            }
        });
    }

    // ===================================
    // EXPORTAR A EXCEL (Stub)
    // ===================================
    function exportAnalyticsToExcel() {
        console.log('[AnalyticsModule] 📥 Export analytics start...');
        
        try {
            const data = AppState.data.advancedAnalytics;
            if (!data) {
                alert('No hay datos para exportar');
                return;
            }
            
            // Aquí va la lógica de exportación con exceljs
            console.log('Exporting advanced analytics data');
            alert('Exportación en desarrollo. Los datos están listos en /api/v2/analytics/advanced');
        } catch (error) {
            console.error('Error en export:', error);
            alert('Error al exportar datos');
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
        updateStats,
        exportAnalyticsToExcel,
        renderKPICards,
        renderChartsAdvanced
    };
})();

// Auto-inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AnalyticsModule.init);
} else {
    AnalyticsModule.init();
}

