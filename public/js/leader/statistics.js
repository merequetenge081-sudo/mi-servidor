// statistics.js - Manejo de gráficos y estadísticas
export class StatisticsManager {
    static statusChart = null;
    static dailyChart = null;

    static loadStatistics(registrations) {
        const total = registrations.length;
        const confirmed = registrations.filter(r => r.confirmed).length;
        const pending = total - confirmed;
        const confirmRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

        document.getElementById('totalRegistrationsStat').textContent = total;
        document.getElementById('confirmedStat').textContent = confirmed;
        document.getElementById('pendingStat').textContent = pending;
        document.getElementById('confirmRateStat').textContent = confirmRate + '%';

        this.renderStatusChart(confirmed, pending);
        this.renderDailyChart(registrations);
    }

    static renderStatusChart(confirmed, pending) {
        const statusCtx = document.getElementById('statusChart');
        if (this.statusChart) this.statusChart.destroy();
        
        this.statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Confirmados', 'Pendientes'],
                datasets: [{
                    data: [confirmed, pending],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    static renderDailyChart(registrations) {
        const today = new Date();
        const last7Days = [];
        const counts = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('es-CO', { weekday: 'short' });
            last7Days.push(dateStr);

            const count = registrations.filter(r => {
                const regDate = new Date(r.date);
                return regDate.toDateString() === date.toDateString();
            }).length;
            counts.push(count);
        }

        const dailyCtx = document.getElementById('dailyChart');
        if (this.dailyChart) this.dailyChart.destroy();
        
        this.dailyChart = new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Registros',
                    data: counts,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
}
