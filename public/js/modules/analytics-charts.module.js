import { repairDisplayText, resolveChartLabel, truncateLabel } from './analytics-ui.module.js';

function getOrCreateEmptyChart(ctx, type = 'bar') {
    return new Chart(ctx, {
        type,
        data: type === 'bar'
            ? { labels: ['Sin datos'], datasets: [{ label: 'Registros', data: [0], backgroundColor: 'rgba(203, 213, 225, 0.8)' }] }
            : { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#e5e7eb'], borderWidth: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: type !== 'bar', position: 'right' } },
            ...(type === 'bar' ? { scales: { y: { beginAtZero: true } } } : { cutout: '60%' })
        }
    });
}

function normalizeChartRows(scope, rows = []) {
    return (Array.isArray(rows) ? rows : [])
        .map((row) => {
            const name = resolveChartLabel(row, scope);
            const totalVotes = Number(row?.totalVotes ?? row?.totalVotos ?? row?.totalRegistros ?? 0);
            const totalRegistros = Number(row?.totalRegistros ?? row?.totalVotes ?? row?.totalVotos ?? 0);
            return {
                id: row?.id || row?._id || name,
                name,
                totalVotes,
                totalRegistros,
                raw: row || {}
            };
        })
        .filter((row) => row.totalVotes > 0 || row.totalRegistros > 0 || row.name);
}

function buildBarAxisLabel(label) {
    const repaired = repairDisplayText(label);
    if (!repaired) return 'Desconocido';

    const compact = truncateLabel(repaired, 22);
    const parts = compact.split(' ');
    if (parts.length <= 2 || compact.length <= 14) return compact;

    const midpoint = Math.ceil(parts.length / 2);
    const first = parts.slice(0, midpoint).join(' ');
    const second = parts.slice(midpoint).join(' ');
    return [first, second].filter(Boolean);
}

export function createAnalyticsChartsManager() {
    const charts = {
        puestos: null,
        localidades: null
    };

    function setPlaceholderState(type, state, message = '') {
        const placeholder = document.getElementById(`${type}-chart-placeholder`);
        const canvas = document.getElementById(type === 'puestos' ? 'puestosChart' : 'localidadesChart');
        if (!placeholder || !canvas) return;

        if (state === 'ready') {
            placeholder.classList.add('hidden');
            canvas.classList.remove('opacity-0');
            return;
        }

        placeholder.classList.remove('hidden');
        canvas.classList.add('opacity-0');

        if (state === 'error') {
            placeholder.innerHTML = `<div class="flex h-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-center text-red-600 text-sm font-medium">${message || 'No se pudo cargar el grafico.'}</div>`;
            return;
        }

        placeholder.innerHTML = `
            <div class="h-full rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div class="h-4 w-40 rounded bg-slate-200 animate-pulse mb-4"></div>
                <div class="h-44 rounded bg-gradient-to-b from-slate-100 to-slate-200 animate-pulse"></div>
            </div>
        `;
    }

    function renderPuestosChart(puestosData = []) {
        const canvas = document.getElementById('puestosChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (charts.puestos) charts.puestos.destroy();

        const normalized = normalizeChartRows('puesto', puestosData).slice(0, 10);
        const fullLabels = normalized.map((item) => item.name);
        const axisLabels = fullLabels.map((label) => buildBarAxisLabel(label));
        const data = normalized.map((item) => item.totalVotes);

        if (!data.length) {
            charts.puestos = getOrCreateEmptyChart(ctx, 'bar');
            setPlaceholderState('puestos', 'ready');
            return;
        }

        charts.puestos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: axisLabels,
                datasets: [{
                    label: 'Registros',
                    data,
                    backgroundColor: 'rgba(99, 102, 241, 0.78)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 8,
                    maxBarThickness: 34
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const index = items?.[0]?.dataIndex ?? 0;
                                return repairDisplayText(fullLabels[index] || 'Desconocido');
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 28,
                            minRotation: 28,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
        setPlaceholderState('puestos', 'ready');
    }

    function renderLocalidadesChart(localidadesData = []) {
        const canvas = document.getElementById('localidadesChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (charts.localidades) charts.localidades.destroy();

        const normalized = normalizeChartRows('localidad', localidadesData).slice(0, 8);
        const fullLabels = normalized.map((item) => item.name);
        const data = normalized.map((item) => item.totalVotes);

        if (!data.length) {
            charts.localidades = getOrCreateEmptyChart(ctx, 'doughnut');
            setPlaceholderState('localidades', 'ready');
            return;
        }

        const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'];
        charts.localidades = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: fullLabels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 14,
                            usePointStyle: true,
                            generateLabels(chart) {
                                return fullLabels.map((label, index) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta?.controller?.getStyle(index) || {};
                                    return {
                                        text: repairDisplayText(label || 'Desconocido'),
                                        fillStyle: style.backgroundColor || colors[index],
                                        strokeStyle: style.borderColor || '#ffffff',
                                        lineWidth: style.borderWidth || 0,
                                        hidden: !chart.getDataVisibility(index),
                                        index
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const index = items?.[0]?.dataIndex ?? 0;
                                return repairDisplayText(fullLabels[index] || 'Desconocido');
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
        setPlaceholderState('localidades', 'ready');
    }

    function renderCharts(chartsData = {}) {
        renderPuestosChart(chartsData.topPuestos || []);
        renderLocalidadesChart(chartsData.topLocalidades || []);
    }

    function setChartsLoading() {
        setPlaceholderState('puestos', 'loading');
        setPlaceholderState('localidades', 'loading');
    }

    function setChartsError(message) {
        setPlaceholderState('puestos', 'error', message);
        setPlaceholderState('localidades', 'error', message);
    }

    return {
        renderCharts,
        setChartsLoading,
        setChartsError
    };
}
