// Dashboard.js - Gestión del panel principal
const baseUrl = window.location.origin;

// Verificar autenticación
function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return null;
  }
  return token;
}

// Logout
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

// Fetch con autorización
async function authFetch(endpoint) {
  const token = checkAuth();
  if (!token) return null;

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (response.status === 401) {
      logout();
      return null;
    }

    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error en fetch:", error);
    return null;
  }
}

// Cargar estadísticas
async function loadStats() {
  const stats = await authFetch("/api/stats");
  if (!stats) return;

  document.getElementById("total-registrations").textContent = stats.totalRegistrations || 0;
  document.getElementById("total-leaders").textContent = stats.totalLeaders || 0;
  document.getElementById("total-events").textContent = stats.totalEvents || 0;
  document.getElementById("active-leaders").textContent = stats.activeLeaders || 0;
}

// Cargar gráfico de registros diarios
async function loadDailyStats() {
  const dailyStats = await authFetch("/api/stats/daily");
  if (!dailyStats || !dailyStats.length) return;

  const container = document.getElementById("daily-stats");
  if (!container) return;

  container.innerHTML = dailyStats.slice(0, 7).map(day => `
    <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
      <span class="text-sm font-medium">${new Date(day.date).toLocaleDateString('es-CO')}</span>
      <span class="text-lg font-bold text-blue-600">${day.count}</span>
    </div>
  `).join('');
}

// Cargar top líderes
async function loadTopLeaders() {
  const leaders = await authFetch("/api/leaders/top");
  if (!leaders || !leaders.length) return;

  const container = document.getElementById("top-leaders");
  if (!container) return;

  container.innerHTML = leaders.slice(0, 5).map((leader, index) => `
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
}

// Inicializar dashboard
async function initDashboard() {
  checkAuth();
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

// Exponer logout globalmente
window.logout = logout;
