// API.js - Cliente HTTP centralizado con autenticación
const baseUrl = window.location.origin;

// Obtener token de localStorage
function getToken() {
  return localStorage.getItem("token");
}

// Verificar autenticación
function isAuthenticated() {
  return !!getToken();
}

// Obtener usuario de localStorage
function getUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

// Logout y redirección
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

// Verificar si el usuario está autenticado antes de cargar la página
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

// Función fetchWithAuth solicitada por el usuario
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
    return;
  }

  return response.json();
}

// Cliente HTTP genérico con autenticación
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  if (!token) {
    logout();
    throw new Error("No autenticado");
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    // Manejar 401 - No autorizado
    if (response.status === 401) {
      logout();
      throw new Error("Sesión expirada");
    }

    // Manejar 403 - Prohibido
    if (response.status === 403) {
      throw new Error("No tienes permiso para realizar esta acción");
    }

    // Si la respuesta no es OK, lanzar error
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
}

// Métodos específicos
const api = {
  // GET request
  get: (endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return apiRequest(url, { method: "GET" });
  },

  // POST request
  post: (endpoint, data = {}) => {
    return apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  // PUT request
  put: (endpoint, data = {}) => {
    return apiRequest(endpoint, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  // DELETE request
  delete: (endpoint) => {
    return apiRequest(endpoint, { method: "DELETE" });
  },

  // Endpoints específicos para el sistema

  // Estadísticas
  getStats: () => api.get("/api/stats"),
  getDailyStats: () => api.get("/api/stats/daily"),

  // Eventos
  getEvents: (params) => api.get("/api/events", params),
  getActiveEvent: () => api.get("/api/events/active"),
  getEvent: (id) => api.get(`/api/events/${id}`),
  createEvent: (data) => api.post("/api/events", data),
  updateEvent: (id, data) => api.put(`/api/events/${id}`, data),
  deleteEvent: (id) => api.delete(`/api/events/${id}`),

  // Líderes
  getLeaders: (params) => api.get("/api/leaders", params),
  getTopLeaders: (limit = 10) => api.get("/api/leaders/top", { limit }),
  getLeader: (id) => api.get(`/api/leaders/${id}`),
  getLeaderQR: (leaderId) => api.get(`/api/leaders/${leaderId}/qr`),
  createLeader: (data) => api.post("/api/leaders", data),
  updateLeader: (id, data) => api.put(`/api/leaders/${id}`, data),
  deleteLeader: (id) => api.delete(`/api/leaders/${id}`),

  // Registros
  getRegistrations: (params) => api.get("/api/registrations", params),
  getRegistrationsByLeader: (leaderId, params) => api.get(`/api/registrations/leader/${leaderId}`, params),
  getRegistration: (id) => api.get(`/api/registrations/${id}`),
  createRegistration: (data) => api.post("/api/registrations", data),
  updateRegistration: (id, data) => api.put(`/api/registrations/${id}`, data),
  deleteRegistration: (id) => api.delete(`/api/registrations/${id}`),
  confirmRegistration: (id) => api.post(`/api/registrations/${id}/confirm`),
  unconfirmRegistration: (id) => api.post(`/api/registrations/${id}/unconfirm`),

  // Duplicados
  getDuplicates: () => api.get("/api/duplicates"),

  // Auditoría
  getAuditLogs: (params) => api.get("/api/audit-logs", params),
  getAuditStats: () => api.get("/api/audit-stats"),

  // Exportar
  exportData: (type) => {
    const token = getToken();
    const url = `${baseUrl}/api/export/${type}`;
    window.open(`${url}?token=${token}`, "_blank");
  }
};

// Exponer API globalmente
window.api = api;
window.requireAuth = requireAuth;
window.logout = logout;
window.getUser = getUser;
window.isAuthenticated = isAuthenticated;
window.fetchWithAuth = fetchWithAuth;
