/**
 * CHART SERVICE
 * Centraliza creación y destrucción de gráficos
 * Evita "Canvas already in use" y memory leaks
 */

const ChartService = {
    /**
     * Crea un nuevo gráfico
     * @param {string} canvasId - ID del canvas
     * @param {object} config - Configuración de Chart.js
     * @returns {Chart} instancia del gráfico
     */
    createChart(canvasId, config) {
        // Destroye gráfico anterior si existe
        this.destroyChart(canvasId);

        try {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.warn(`[ChartService] Canvas no encontrado: ${canvasId}`);
                return null;
            }

            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx, config);
            
            // Guarda en estado
            AppState.addChart(canvasId, chart);
            
            console.log(`[ChartService] Gráfico creado: ${canvasId}`);
            return chart;
        } catch (err) {
            console.error(`[ChartService] Error creando gráfico ${canvasId}:`, err);
            return null;
        }
    },

    /**
     * Actualiza datos de un gráfico existente
     */
    updateChart(canvasId, newData) {
        const chart = AppState.getChart(canvasId);
        if (chart) {
            chart.data = newData;
            chart.update();
            console.log(`[ChartService] Gráfico actualizado: ${canvasId}`);
            return true;
        }
        console.warn(`[ChartService] Gráfico no encontrado: ${canvasId}`);
        return false;
    },

    /**
     * Destroye un gráfico
     */
    destroyChart(canvasId) {
        const chart = AppState.getChart(canvasId);
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
            console.log(`[ChartService] Gráfico destruido: ${canvasId}`);
        }
        AppState.destroyChart(canvasId);
    },

    /**
     * Destroye todos los gráficos
     */
    destroyAllCharts() {
        AppState.clearCharts();
        console.log('[ChartService] Todos los gráficos destruidos');
    },

    /**
     * Obtiene un gráfico
     */
    getChart(canvasId) {
        return AppState.getChart(canvasId);
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

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartService;
}
