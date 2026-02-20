const API_URL = window.location.origin + "/api";

export const auth = {
  token: localStorage.getItem("token"),
  user: JSON.parse(localStorage.getItem("user") || "null"),

  setToken(token) {
    this.token = token;
    localStorage.setItem("token", token);
  },

  setUser(user) {
    this.user = user;
    localStorage.setItem("user", JSON.stringify(user));
  },

  getToken() {
    return localStorage.getItem("token");
  },

  getUser() {
    return JSON.parse(localStorage.getItem("user") || "null");
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  isAuthenticated() {
    return !!this.getToken();
  }
};

export async function apiFetch(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  const token = auth.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      auth.logout();
      window.location.href = "/login.html";
      return null;
    }

    return response;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

export function showToast(message, type = "info", duration = 3000) {
  const toast = document.createElement("div");
  toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white text-sm font-semibold z-50 ${
    type === "success" ? "bg-green-500" :
    type === "error" ? "bg-red-500" :
    type === "warning" ? "bg-yellow-500" :
    "bg-blue-500"
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString("es-ES");
}

export function formatDateTime(date) {
  return new Date(date).toLocaleDateString("es-ES") + " " + 
         new Date(date).toLocaleTimeString("es-ES");
}
