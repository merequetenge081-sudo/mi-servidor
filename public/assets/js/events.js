// Events.js - Gestión de eventos
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

// Cargar eventos
async function loadEvents() {
  const events = await authFetch("/api/events");
  if (!events) return;

  const tbody = document.getElementById("events-tbody");
  if (!tbody) return;

  if (!events.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-gray-500">
          No hay eventos registrados
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(event => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-6 py-4 text-sm text-gray-900">${event.name || 'Sin nombre'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${event.description || 'Sin descripción'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${event.location || 'Sin ubicación'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${event.date ? new Date(event.date).toLocaleDateString('es-CO') : 'Sin fecha'}
      </td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${event.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${event.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${event.registrations || 0} registros
      </td>
    </tr>
  `).join('');

  // Actualizar contador
  const counter = document.getElementById("events-count");
  if (counter) {
    counter.textContent = events.length;
  }
}

// Inicializar
async function initEvents() {
  checkAuth();
  await loadEvents();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEvents);
} else {
  initEvents();
}

// Exponer funciones globalmente
window.logout = logout;
window.loadEvents = loadEvents;
