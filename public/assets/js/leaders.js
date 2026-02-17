// Leaders.js - Gestión de líderes
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
async function authFetch(endpoint, options = {}) {
  const token = checkAuth();
  if (!token) return null;

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers
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

// Cargar líderes
async function loadLeaders() {
  const leaders = await authFetch("/api/leaders");
  if (!leaders) return;

  const tbody = document.getElementById("leaders-tbody");
  if (!tbody) return;

  if (!leaders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-4 text-center text-gray-500">
          No hay líderes registrados
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leaders.map(leader => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-6 py-4 text-sm font-medium text-gray-900">${leader.name || 'Sin nombre'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${leader.email || 'Sin email'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${leader.phone || 'Sin teléfono'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${leader.area || 'Sin área'}</td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${leader.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${leader.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">
        <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
          ${leader.registrations || 0}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-500">
        ${leader.createdAt ? new Date(leader.createdAt).toLocaleDateString('es-CO') : '-'}
      </td>
    </tr>
  `).join('');

  // Actualizar contador
  const counter = document.getElementById("leaders-count");
  if (counter) {
    counter.textContent = leaders.length;
  }

  // Contar activos
  const activeCount = leaders.filter(l => l.active).length;
  const activeCounter = document.getElementById("active-leaders-count");
  if (activeCounter) {
    activeCounter.textContent = activeCount;
  }
}

// Inicializar
async function initLeaders() {
  checkAuth();
  await loadLeaders();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeaders);
} else {
  initLeaders();
}

// Exponer funciones globalmente
window.logout = logout;
window.loadLeaders = loadLeaders;
