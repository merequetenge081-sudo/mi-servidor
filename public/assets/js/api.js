// API.js - Cliente HTTP centralizado con autenticación
const baseUrl = window.location.origin;
const API_V1_BASE = "/api";
const API_V2_BASE = "/api/v2";

// ============================================
// FASE 4: MONITORING & DEPRECATION TRACKING
// ============================================
window._apiMetrics = {
  session_start: new Date().toISOString(),
  v2_success: 0,
  v2_failed: 0,
  v1_fallback: 0,
  endpoints_used: {},
  last_fallback: null,
  last_error: null
};

// Helper function to log metrics
function logMetric(type, data = {}) {
  if (type === 'fallback') {
    window._apiMetrics.v1_fallback++;
    window._apiMetrics.last_fallback = {
      timestamp: new Date().toISOString(),
      from: data.from,
      to: data.to,
      reason: data.reason
    };
    
    if (!window._apiMetrics.endpoints_used[data.from]) {
      window._apiMetrics.endpoints_used[data.from] = {
        fallbacks: 0,
        timestamps: [],
        last_error: null
      };
    }
    window._apiMetrics.endpoints_used[data.from].fallbacks++;
    window._apiMetrics.endpoints_used[data.from].timestamps.push(new Date().toISOString());
    if (data.error) {
      window._apiMetrics.endpoints_used[data.from].last_error = data.error;
    }
  } else if (type === 'success') {
    window._apiMetrics.v2_success++;
  } else if (type === 'error') {
    window._apiMetrics.v2_failed++;
    window._apiMetrics.last_error = {
      timestamp: new Date().toISOString(),
      endpoint: data.endpoint,
      message: data.message,
      status: data.status
    };
  }
}

// Console helpers for debugging
window._getApiMetrics = () => window._apiMetrics;

window._exportApiMetrics = function() {
  const metricsJson = JSON.stringify(window._apiMetrics, null, 2);
  console.log('%c========== API METRICS ==========', 'color: blue; font-weight: bold;');
  console.log(metricsJson);
  console.log('%c=================================', 'color: blue; font-weight: bold;');
  return window._apiMetrics;
};

window._clearApiMetrics = () => {
  window._apiMetrics = {
    ...window._apiMetrics,
    v2_success: 0,
    v2_failed: 0,
    v1_fallback: 0,
    endpoints_used: {},
    last_fallback: null,
    last_error: null
  };
  console.log('✅ API Metrics cleared');
};

// Log deprecation warning
function logDeprecationWarning(endpoint, fallback, reason) {
  const sunsetDate = new Date('2026-06-30');
  const daysUntilSunset = Math.ceil((sunsetDate - new Date()) / (1000 * 60 * 60 * 24));
  
  console.warn(
    '%c⚠️ DEPRECATED ENDPOINT',
    'background: #ff9800; color: white; font-weight: bold; padding: 5px 10px; border-radius: 3px; font-size: 12px;'
  );
  console.warn(`📍 Endpoint: ${endpoint}`);
  console.warn(`🔄 Using fallback: ${fallback}`);
  console.warn(`❌ Reason: ${reason}`);
  console.warn(`⏳ Days until sunset: ${daysUntilSunset} (June 30, 2026)`);
  console.warn(`📚 Migration guide: /docs/api-v2-migration`);
}

// Obtener token de sessionStorage o localStorage
function getToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token");
}

// Verificar autenticación
function isAuthenticated() {
  return !!getToken();
}

// Obtener usuario de storage (compatible con sesiones antiguas)
function getUser() {
  const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.warn("No se pudo parsear user en storage:", error);
    }
  }

  const role = sessionStorage.getItem("role") || localStorage.getItem("role");
  const username = sessionStorage.getItem("username") || localStorage.getItem("username");
  if (!role && !username) {
    return null;
  }

  return { role, username };
}

// Logout y redirección
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  localStorage.removeItem("admin_token");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("username");
  sessionStorage.removeItem("admin_token");
  window.location.href = "/";
}

// Verificar si el usuario está autenticado antes de cargar la página
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = "/";
    return false;
  }
  return true;
}

// Función fetchWithAuth solicitada por el usuario
async function fetchWithAuth(url, options = {}) {
  const token = getToken();

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
    sessionStorage.removeItem("token");
    window.location.href = "/";
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
      const requestError = new Error(errorData.error || `Error ${response.status}`);
      requestError.status = response.status;
      throw requestError;
    }

    return await response.json();
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
}

async function apiRequestWithFallback(primaryEndpoint, fallbackEndpoint, options = {}) {
  try {
    const response = await apiRequest(primaryEndpoint, options);
    logMetric('success', { endpoint: primaryEndpoint });
    return response;
  } catch (error) {
    if (error.status === 404 && fallbackEndpoint) {
      // v2 endpoint not found, using v1 fallback
      logMetric('fallback', {
        from: primaryEndpoint,
        to: fallbackEndpoint,
        reason: `${error.status} Not Found`,
        error: error.message
      });
      
      logDeprecationWarning(primaryEndpoint, fallbackEndpoint, `${error.status} Not Found (v2 endpoint)`);
      
      try {
        const fallbackResponse = await apiRequest(fallbackEndpoint, options);
        return fallbackResponse;
      } catch (fallbackError) {
        logMetric('error', {
          endpoint: fallbackEndpoint,
          message: fallbackError.message,
          status: fallbackError.status
        });
        throw fallbackError;
      }
    }
    
    // Handle other errors
    logMetric('error', {
      endpoint: primaryEndpoint,
      message: error.message,
      status: error.status
    });
    throw error;
  }
}

function unwrapData(response) {
  if (response && response.success === true && response.data !== undefined) {
    return response.data;
  }
  return response;
}

function normalizeRegistrationsResponse(response) {
  if (response && response.success === true && response.data !== undefined) {
    const pagination = response.pagination || {};
    return {
      data: response.data,
      total: pagination.total ?? response.total ?? 0,
      confirmedCount: response.confirmedCount ?? 0,
      page: pagination.page ?? response.page ?? 1,
      limit: pagination.pageSize ?? response.limit ?? 20,
      pages: pagination.totalPages ?? response.pages ?? 1
    };
  }

  return response;
}

function normalizeAnalyticsResponse(response) {
  // v2 analytics returns {success, data, message}
  // Convert to flat object for dashboard compatibility
  if (response && response.success === true && response.data !== undefined) {
    return response.data; // Return just the data payload
  }
  return response; // v1 or already flat
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

  // Estadísticas (v2 only - v1 endpoints don't exist)
  getStats: () => apiRequest(
    `${API_V2_BASE}/analytics/dashboard`,
    { method: "GET" }
  ).then(normalizeAnalyticsResponse),
  
  getDailyStats: () => apiRequest(
    `${API_V2_BASE}/analytics/trends`,
    { method: "GET" }
  ).then(normalizeAnalyticsResponse),

  // Eventos
  getEvents: (params) => apiRequestWithFallback(
    `${API_V2_BASE}/events${params ? `?${new URLSearchParams(params)}` : ""}`,
    `${API_V1_BASE}/events${params ? `?${new URLSearchParams(params)}` : ""}`,
    { method: "GET" }
  ).then(unwrapData),
  getActiveEvent: () => apiRequestWithFallback(
    `${API_V2_BASE}/events/active/current`,
    `${API_V1_BASE}/events/active`,
    { method: "GET" }
  ).then(unwrapData),
  getEvent: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/events/${id}`,
    `${API_V1_BASE}/events/${id}`,
    { method: "GET" }
  ).then(unwrapData),
  createEvent: (data) => apiRequestWithFallback(
    `${API_V2_BASE}/events`,
    `${API_V1_BASE}/events`,
    { method: "POST", body: JSON.stringify(data) }
  ).then(unwrapData),
  updateEvent: (id, data) => apiRequestWithFallback(
    `${API_V2_BASE}/events/${id}`,
    `${API_V1_BASE}/events/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  ).then(unwrapData),
  deleteEvent: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/events/${id}`,
    `${API_V1_BASE}/events/${id}`,
    { method: "DELETE" }
  ).then(unwrapData),

  // Líderes
  getLeaders: (params) => apiRequestWithFallback(
    `${API_V2_BASE}/leaders${params ? `?${new URLSearchParams(params)}` : ""}`,
    `${API_V1_BASE}/leaders${params ? `?${new URLSearchParams(params)}` : ""}`,
    { method: "GET" }
  ).then(unwrapData),
  getTopLeaders: (limit = 10) => apiRequestWithFallback(
    `${API_V2_BASE}/leaders/top?${new URLSearchParams({ limit })}`,
    `${API_V1_BASE}/leaders/top?${new URLSearchParams({ limit })}`,
    { method: "GET" }
  ).then(unwrapData),
  getLeader: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/leaders/${id}`,
    `${API_V1_BASE}/leaders/${id}`,
    { method: "GET" }
  ).then(unwrapData),
  getLeaderQR: (leaderId) => api.get(`${API_V1_BASE}/leaders/${leaderId}/qr`),
  createLeader: (data) => apiRequestWithFallback(
    `${API_V2_BASE}/leaders`,
    `${API_V1_BASE}/leaders`,
    { method: "POST", body: JSON.stringify(data) }
  ).then(unwrapData),
  updateLeader: (id, data) => apiRequestWithFallback(
    `${API_V2_BASE}/leaders/${id}`,
    `${API_V1_BASE}/leaders/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  ).then(unwrapData),
  deleteLeader: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/leaders/${id}`,
    `${API_V1_BASE}/leaders/${id}`,
    { method: "DELETE" }
  ).then(unwrapData),

  // Registros
  getRegistrations: (params) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations${params ? `?${new URLSearchParams(params)}` : ""}`,
    `${API_V1_BASE}/registrations${params ? `?${new URLSearchParams(params)}` : ""}`,
    { method: "GET" }
  ).then(normalizeRegistrationsResponse),
  getRegistrationsByLeader: (leaderId, params) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations/leader/${leaderId}${params ? `?${new URLSearchParams(params)}` : ""}`,
    `${API_V1_BASE}/registrations/leader/${leaderId}${params ? `?${new URLSearchParams(params)}` : ""}`,
    { method: "GET" }
  ).then(normalizeRegistrationsResponse),
  getRegistration: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations/${id}`,
    `${API_V1_BASE}/registrations/${id}`,
    { method: "GET" }
  ).then(unwrapData),
  createRegistration: (data) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations`,
    `${API_V1_BASE}/registrations`,
    { method: "POST", body: JSON.stringify(data) }
  ).then(unwrapData),
  updateRegistration: (id, data) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations/${id}`,
    `${API_V1_BASE}/registrations/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  ).then(unwrapData),
  deleteRegistration: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations/${id}`,
    `${API_V1_BASE}/registrations/${id}`,
    { method: "DELETE" }
  ).then(unwrapData),
  confirmRegistration: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations/${id}/confirm`,
    `${API_V1_BASE}/registrations/${id}/confirm`,
    { method: "POST" }
  ).then(unwrapData),
  unconfirmRegistration: (id) => apiRequestWithFallback(
    `${API_V2_BASE}/registrations/${id}/unconfirm`,
    `${API_V1_BASE}/registrations/${id}/unconfirm`,
    { method: "POST" }
  ).then(unwrapData),

  // Duplicados
  getDuplicates: () => apiRequestWithFallback(
    `${API_V2_BASE}/duplicates/report`,
    `${API_V1_BASE}/duplicates`,
    { method: "GET" }
  ).then(unwrapData),

  // Auditoría
  getAuditLogs: (params) => apiRequestWithFallback(
    `${API_V2_BASE}/audit/logs${params ? `?${new URLSearchParams(params)}` : ""}`,
    `${API_V1_BASE}/audit-logs${params ? `?${new URLSearchParams(params)}` : ""}`,
    { method: "GET" }
  ).then(unwrapData),
  getAuditStats: () => apiRequestWithFallback(
    `${API_V2_BASE}/audit/stats`,
    `${API_V1_BASE}/audit-stats`,
    { method: "GET" }
  ).then(unwrapData),

  // Exportar (v2 endpoints)
  exportData: (type) => {
    const token = getToken();
    const url = `${baseUrl}${API_V2_BASE}/exports/${type}`;
    window.open(`${url}?token=${token}`, "_blank");
  },
  
  // Export by type (with parameters)
  exportRegistrations: (params = {}) => {
    const token = getToken();
    const queryString = new URLSearchParams({ type: 'registrations', ...params }).toString();
    const url = `${baseUrl}${API_V2_BASE}/exports/registrations?${queryString}&token=${token}`;
    window.open(url, "_blank");
  },
  
  exportLeaders: (params = {}) => {
    const token = getToken();
    const queryString = new URLSearchParams({ type: 'leaders', ...params }).toString();
    const url = `${baseUrl}${API_V2_BASE}/exports/leaders?${queryString}&token=${token}`;
    window.open(url, "_blank");
  },
  
  exportByLeader: (leaderId, params = {}) => {
    const token = getToken();
    const queryString = new URLSearchParams({ leaderId, ...params }).toString();
    const url = `${baseUrl}${API_V2_BASE}/exports/by-leader?${queryString}&token=${token}`;
    window.open(url, "_blank");
  }
};

// Exponer API globalmente
window.api = api;
window.requireAuth = requireAuth;
window.logout = logout;
window.getUser = getUser;
window.isAuthenticated = isAuthenticated;
window.fetchWithAuth = fetchWithAuth;
