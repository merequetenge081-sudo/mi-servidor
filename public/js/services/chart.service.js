/**
 * CHART SERVICE
 * Centraliza creación y destrucción de gráficos
 * Evita "Canvas already in use" y memory leaks
 */

const ChartService = (() => {
    // Map adicional para rastrear gráficos (redundancia para seguridad)
    const chartsMap = new Map();

    return {
        /**
         * Crea un nuevo gráfico
         * @param {string} canvasId - ID del canvas
         * @param {object} config - Configuración de Chart.js
         * @returns {Chart} instancia del gráfico
         */
        createChart(canvasId, config) {
            // Destroye gráfico anterior si existe (doble seguridad)
            this.destroyChart(canvasId);

            try {
                const canvas = document.getElementById(canvasId);
                if (!canvas) {
                    console.warn(`[ChartService] Canvas no encontrado: ${canvasId}`);
                    return null;
                }

                // Chart.js registry fallback (si hay instancia huérfana)
                const existingChart = Chart.getChart(canvas);
                if (existingChart && typeof existingChart.destroy === 'function') {
                    existingChart.destroy();
                }

                // Limpia el canvas completamente
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Pequeño delay para asegurar que Chart.js limpió referencias
                const chart = new Chart(ctx, config);
                
                // Guarda en múltiples lugares
                AppState.addChart(canvasId, chart);
                chartsMap.set(canvasId, chart);
                
                console.log(`[ChartService] ✅ Gráfico creado: ${canvasId}`);
                return chart;
            } catch (err) {
                console.error(`[ChartService] ❌ Error creando gráfico ${canvasId}:`, err);
                return null;
            }
        },

        /**
         * Destroye un gráfico completamente
         */
        destroyChart(canvasId) {
            try {
                // Obtiene de AppState
                const chart = AppState.getChart(canvasId);
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                    console.log(`[ChartService] ✅ Gráfico destruido: ${canvasId}`);
                }
                
                // Obtiene de Map local
                const localChart = chartsMap.get(canvasId);
                if (localChart && typeof localChart.destroy === 'function' && localChart !== chart) {
                    localChart.destroy();
                }
                
                // Último recurso: Chart.js registry
                const canvas = document.getElementById(canvasId);
                const registryChart = canvas ? Chart.getChart(canvas) : null;
                if (registryChart && typeof registryChart.destroy === 'function') {
                    registryChart.destroy();
                }

                // Limpia referencias
                AppState.destroyChart(canvasId);
                chartsMap.delete(canvasId);
                
            } catch (err) {
                console.warn(`[ChartService] Warning destruyendo gráfico ${canvasId}:`, err);
            }
        },

        /**
         * Destroye todos los gráficos
         */
        destroyAllCharts() {
            AppState.clearCharts();
            chartsMap.forEach((chart) => {
                if (chart && typeof chart.destroy === 'function') {
                    try { chart.destroy(); } catch (e) { }
                }
            });
            chartsMap.clear();
            console.log('[ChartService] ✅ Todos los gráficos destruidos');
        },

        /**
         * Obtiene un gráfico
         */
        getChart(canvasId) {
            return AppState.getChart(canvasId) || chartsMap.get(canvasId);
        },


        /**
         * Config predefinida: Gráfico de barras simple
         */
        barChartConfig(labels, datasets) {
            return {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true } },
                    scales: { y: { beginAtZero: true } }
                }
            };
        },

        /**
         * Config predefinida: Gráfico de línea
         */
        lineChartConfig(labels, datasets) {
            return {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true } },
                    borderColor: '#667eea',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            };
        },

        /**
         * Config predefinida: Gráfico de dona
         */
        doughnutChartConfig(labels, data) {
            return {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: [
                            '#667eea', '#764ba2', '#FF6B6B', '#4ECDC4', '#45B7D1',
                            '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
                        ],
                        borderWidth: 2,
                        borderColor: 'white'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } }
                }
            };
        }
    };
})();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartService;
}

if (typeof globalThis !== 'undefined') {
    globalThis.ChartService = ChartService;
}
