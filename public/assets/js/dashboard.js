// Dashboard.js - Gestión del panel principal

// Cargar estadísticas
async function loadStats() {
  try {
    const stats = await api.getStats();
    if (!stats) return;

    document.getElementById("total-registrations").textContent = stats.totalRegistrations || 0;
    document.getElementById("total-leaders").textContent = stats.totalLeaders || 0;
    document.getElementById("total-events").textContent = stats.totalEvents || 0;
    document.getElementById("active-leaders").textContent = stats.activeLeaders || 0;
  } catch (error) {
    console.error("Error cargando estadísticas:", error);
  }
}

// Cargar gráfico de registros diarios
async function loadDailyStats() {
  try {
    const dailyStats = await api.getDailyStats();
    if (!dailyStats || !dailyStats.length) return;

    const container = document.getElementById("daily-stats");
    if (!container) return;

    container.innerHTML = dailyStats.slice(0, 7).map(day => `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
        <span class="text-sm font-medium">${new Date(day.date).toLocaleDateString('es-CO')}</span>
        <span class="text-lg font-bold text-blue-600">${day.count}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error("Error cargando estadísticas diarias:", error);
  }
}

// Cargar top líderes
async function loadTopLeaders() {
  try {
    const leaders = await api.getTopLeaders(5);
    if (!leaders || !leaders.length) return;

    const container = document.getElementById("top-leaders");
    if (!container) return;

    container.innerHTML = leaders.map((leader, index) => `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
        <div class="flex items-center gap-3">
          <span class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold">
            ${index + 1}
          </span>
          <span class="font-medium">${leader.name || 'Sin nombre'}</span>
        </div>
        <span class="text-lg font-bold text-green-600">${leader.registrations || 0}</span>
      </div>
    `).join('');
  } catch (error) {
    console.error("Error cargando top líderes:", error);
  }
}

// Inicializar dashboard
async function initDashboard() {
  requireAuth();
  await Promise.all([
    loadStats(),
    loadDailyStats(),
    loadTopLeaders()
  ]);
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

