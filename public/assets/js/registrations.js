// Registrations.js - Gestión de registros
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

// Cargar registros
async function loadRegistrations() {
  const registrations = await authFetch("/api/registrations");
  if (!registrations) return;

  const tbody = document.getElementById("registrations-tbody");
  if (!tbody) return;

  if (!registrations.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-4 text-center text-gray-500">
          No hay registros
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = registrations.map(reg => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-6 py-4 text-sm font-medium text-gray-900">${reg.name || 'Sin nombre'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${reg.email || 'Sin email'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${reg.phone || 'Sin teléfono'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${reg.locality || 'Sin localidad'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${reg.address || 'Sin dirección'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${reg.leaderName || reg.leaderId || 'Sin líder'}
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${reg.eventName || reg.eventId || 'Sin evento'}
      </td>
      <td class="px-6 py-4 text-sm text-gray-500">
        ${reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '-'}
      </td>
    </tr>
  `).join('');

  // Actualizar contador
  const counter = document.getElementById("registrations-count");
  if (counter) {
    counter.textContent = registrations.length;
  }
}

// Filtrar registros
function filterRegistrations() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase();
  const rows = document.querySelectorAll("#registrations-tbody tr");

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? "" : "none";
  });
}

// Inicializar
async function initRegistrations() {
  checkAuth();
  await loadRegistrations();

  // Agregar listener para búsqueda
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", filterRegistrations);
  }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRegistrations);
} else {
  initRegistrations();
}

// Exponer funciones globalmente
window.logout = logout;
window.loadRegistrations = loadRegistrations;
window.filterRegistrations = filterRegistrations;
