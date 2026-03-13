/**
 * Dashboard Module
 * Consume metricas limpias desde backend (/api/v2/analytics/metrics)
 * para evitar calculos crudos en frontend.
 */

const DashboardModule = (() => {
    'use strict';

    let dashboardMetrics = null;
    const shouldDebugTraces = () => {
        try {
            return window.APP_DEBUG_TRACES === true || localStorage.getItem('debugTraces') === '1';
        } catch (_) {
            return window.APP_DEBUG_TRACES === true;
        }
    };
    const trace = (...args) => {
        if (shouldDebugTraces()) console.debug(...args);
    };

    async function loadDashboardMetrics() {
        if (typeof DataService === 'undefined' || !DataService.getDashboardMetrics) {
            throw new Error('[DashboardModule] DataService.getDashboardMetrics no disponible');
        }

        const metrics = await DataService.getDashboardMetrics();
        dashboardMetrics = metrics || {};

        const src = dashboardMetrics?.source || {};
        trace('[KPI TRACE] dashboard.cards <- /api/v2/analytics/metrics', {
            eventId: src?.filter?.eventId || AppState.user?.eventId || null,
            region: src?.filter?.region || 'all',
            leaderId: src?.filter?.leaderId || null,
            timestamp: dashboardMetrics?.timestamp || null
        });

        return dashboardMetrics;
    }

    function updateStats() {
        const totals = dashboardMetrics?.operationalTotals || dashboardMetrics?.totals || {};
        const totalLeaders = totals.totalLeaders || totals.leadersCount || 0;
        const totalRegistrations = totals.totalRegistrations || 0;
        const confirmedCount = totals.confirmedCount || 0;
        const confirmRate = totals.confirmRate || 0;
        const eventId = dashboardMetrics?.source?.filter?.eventId || AppState.user?.eventId || null;

        DOMUtils.tryUpdate('totalLeaders', totalLeaders);
        DOMUtils.tryUpdate('totalRegistrations', totalRegistrations);
        DOMUtils.tryUpdate('confirmedCount', confirmedCount);
        DOMUtils.tryUpdate('confirmRate', `${confirmRate}%`);

        trace('[KPI TRACE] Leaders Active -> eventId=' + (eventId || 'null'), { value: totalLeaders });
        trace('[KPI TRACE] Total Records -> eventId=' + (eventId || 'null'), { value: totalRegistrations });
        trace('[KPI TRACE] Confirmed -> eventId=' + (eventId || 'null'), { value: confirmedCount });
        trace('[KPI TRACE] Confirm Rate -> eventId=' + (eventId || 'null'), {
            value: confirmRate,
            formula: `${confirmedCount}/${totalRegistrations}`
        });
    }

    function loadRecentRegistrations() {
        const recent = dashboardMetrics?.recentRecords || [];
        const tbody = DOMUtils.byId('recentRegistrations');
        if (!tbody) return;

        if (!Array.isArray(recent) || recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay registros recientes</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map((reg) => {
            const leaderName = reg.leaderName || 'Sin lider';
            const isConfirmed = reg.confirmed === true || reg.workflowStatus === 'confirmed';
            const status = isConfirmed
                ? '<span class="badge badge-success">Confirmado</span>'
                : '<span class="badge badge-warning">Pendiente</span>';
            const dateObj = reg.createdAt ? new Date(reg.createdAt) : null;
            const dateLabel = (dateObj && !Number.isNaN(dateObj.getTime()))
                ? dateObj.toLocaleDateString('es-CO')
                : 'N/A';
            const fullName = `${reg.firstName || ''} ${reg.lastName || ''}`.trim() || 'Sin nombre';

            return `
                <tr>
                    <td>${fullName}</td>
                    <td>${reg.email || 'N/A'}</td>
                    <td>${reg.phone || 'N/A'}</td>
                    <td>${reg.cedula || 'N/A'}</td>
                    <td>${leaderName}</td>
                    <td>${dateLabel}</td>
                    <td>${status}</td>
                </tr>
            `;
        }).join('');
    }

    function loadConfirmationChart() {
        const totals = dashboardMetrics?.operationalTotals || dashboardMetrics?.totals || {};
        const total = Number(totals.totalRegistrations || 0);
        const confirmed = Number(totals.confirmedCount || 0);
        const pending = Math.max(total - confirmed, 0);

        if (typeof ChartService !== 'undefined') {
            ChartService.destroyChart('confirmationChart');
        }

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

    function loadTopLeadersChart() {
        const leaders = Array.isArray(dashboardMetrics?.leadersOperational)
            ? dashboardMetrics.leadersOperational
            : (Array.isArray(dashboardMetrics?.leaders) ? dashboardMetrics.leaders : []);
        const top = leaders.slice(0, 5);

        const labels = top.length > 0 ? top.map((l) => l.name || 'Sin lider') : ['Sin datos'];
        const data = top.length > 0 ? top.map((l) => Number(l.total || 0)) : [0];

        if (typeof ChartService !== 'undefined') {
            ChartService.destroyChart('topLeadersChart');
        }

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
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(156, 163, 175, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function loadCharts() {
        if (!dashboardMetrics) return;
        loadConfirmationChart();
        loadTopLeadersChart();
    }

    async function refresh() {
        await loadDashboardMetrics();
        trace('[VIEW TRACE] Dashboard <- dashboard.html/modules/dashboard.module.js', {
            endpoint: '/api/v2/analytics/metrics',
            eventId: dashboardMetrics?.source?.filter?.eventId || AppState.user?.eventId || null
        });
        updateStats();
        loadRecentRegistrations();
        loadCharts();
    }

    function init() {
        console.log('[DashboardModule] Inicializado');
    }

    return {
        init,
        refresh,
        updateStats,
        loadRecentRegistrations,
        loadCharts,
        loadDashboardMetrics
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DashboardModule.init);
} else {
    DashboardModule.init();
}

window.DashboardModule = DashboardModule;
