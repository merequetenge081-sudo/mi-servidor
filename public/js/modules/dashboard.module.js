/**
 * Dashboard Module
 * Maneja estadísticas generales, actividad reciente
 * Parte de la arquitectura modular de dashboard.js
 */

const DashboardModule = (() => {
    'use strict';

    // ===================================
    // ESTADO INTERNO
    // ===================================
    let statsInterval = null;

    // ===================================
    // ACTUALIZAR ESTADÍSTICAS
    // ===================================
    function updateStats() {
        const leaders = AppState.data.leaders || [];
        const registrations = AppState.data.registrations || [];

        // Registros confirmados
        const confirmed = registrations.filter(r =>
            r.confirmed === true || r.confirmed === 'true' || r.confirmado === true || r.confirmado === 'true'
        ).length;
        // Pendientes
        const pending = registrations.length - confirmed;
        // Tasa de confirmación
        const confirmRate = registrations.length > 0 
            ? ((confirmed / registrations.length) * 100).toFixed(1) 
            : '0.0';

        // Actualizar DOM
        DOMUtils.tryUpdate('totalLeaders', leaders.length);
        DOMUtils.tryUpdate('totalRegistrations', registrations.length);
        DOMUtils.tryUpdate('confirmedCount', confirmed);
        DOMUtils.tryUpdate('confirmRate', `${confirmRate}%`);
    }

    // ===================================
    // CARGAR REGISTROS RECIENTES
    // ===================================
    function loadRecentRegistrations() {
        const registrations = AppState.data.registrations || [];
        const tbody = DOMUtils.byId('recentRegistrations');
        
        if (!tbody) return;

        // Ordenar por fecha reciente
        const recent = [...registrations]
            .sort((a, b) => {
                const dateA = new Date(a.date || a.fechaRegistro || 0);
                const dateB = new Date(b.date || b.fechaRegistro || 0);
                const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
                const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
                return timeB - timeA;
            })
            .slice(0, 10); // Últimos 10

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay registros recientes</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(reg => {
            const leaderName = reg.leaderName || reg.nombreLider || reg.liderNombre || 'Sin líder';
            const isConfirmed = reg.confirmed === true || reg.confirmed === 'true' || reg.confirmado === true || reg.confirmado === 'true';
            const status = isConfirmed
                ? '<span class="badge badge-success">Confirmado</span>'
                : '<span class="badge badge-warning">Pendiente</span>';
            const dateStr = reg.date || reg.fechaRegistro;
            const dateObj = dateStr ? new Date(dateStr) : null;
            const dateLabel = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString('es-CO') : 'N/A';
            const fullName = `${reg.firstName || reg.nombre || ''} ${reg.lastName || ''}`.trim() || 'Sin nombre';

            return `
                <tr>
                    <td>${fullName}</td>
                    <td>${reg.email || 'N/A'}</td>
                    <td>${reg.cedula || 'N/A'}</td>
                    <td>${leaderName}</td>
                    <td>${dateLabel}</td>
                    <td>${status}</td>
                </tr>
            `;
        }).join('');
    }

    // ===================================
    // CARGAR GRÁFICOS (Chart.js)
    // ===================================
    function loadCharts() {
        const registrations = AppState.data.registrations || [];
        
        // Destruir gráficos existentes antes de crear nuevos
        ChartService.destroyChart('confirmationChart');
        ChartService.destroyChart('topLeadersChart');

        loadConfirmationChart(registrations);
        loadTopLeadersChart(registrations);
    }

    function loadConfirmationChart(registrations) {
        const confirmed = registrations.filter(r =>
            r.confirmed === true || r.confirmed === 'true' || r.confirmado === true || r.confirmado === 'true'
        ).length;
        const pending = registrations.length - confirmed;

        ChartService.createChart('confirmationChart', {
            type: 'doughnut',
            data: {
                labels: ['Confirmados', 'Pendientes'],
                datasets: [{
                    data: [confirmed, pending],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 2,
                    borderColor: '#1f2937'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }

    function loadTopLeadersChart(registrations) {
        const leaders = AppState.data.leaders || [];
        const countsByLeader = {};

        registrations.forEach(reg => {
            const leaderId = reg.leaderId || reg.leader_id || reg.liderId;
            const key = leaderId || reg.leaderName || reg.nombreLider || reg.liderNombre || 'sin-lider';
            countsByLeader[key] = (countsByLeader[key] || 0) + 1;
        });

        const items = Object.entries(countsByLeader).map(([key, count]) => {
            let name = 'Sin líder';
            if (key !== 'sin-lider') {
                const leader = leaders.find(l => l._id === key);
                name = leader ? leader.name : key;
            }
            return { name, count };
        }).sort((a, b) => b.count - a.count).slice(0, 5);

        const labels = items.length > 0 ? items.map(i => i.name) : ['Sin datos'];
        const data = items.length > 0 ? items.map(i => i.count) : [0];

        ChartService.createChart('topLeadersChart', {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Registros',
                    data,
                    backgroundColor: '#60a5fa',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)'
                        }
                },
                x: {
                    ticks: {
                        color: '#9ca3af'
                    },
                    grid: {
                        display: false
                    }
                }
            }
            }
        });
    }

    // ===================================
    // INICIALIZACIÓN
    // ===================================
    function init() {
        console.log('[DashboardModule] Inicializado');
        
        // No auto-refresh para evitar sobrecarga
        // El refresh se hace desde loadDashboard() en data.service.js
    }

    function refresh() {
        updateStats();
        loadRecentRegistrations();
        // Gráficos solo se cargan una vez (lazy load)
    }

    // Exponer métodos públicos
    return {
        init,
        refresh,
        updateStats,
        loadRecentRegistrations,
        loadCharts
    };
})();

// Auto-inicializar cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DashboardModule.init);
} else {
    DashboardModule.init();
}
