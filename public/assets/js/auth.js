import { auth, apiFetch, showToast } from "./utils.js";

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  if (!username || !password) {
    showToast("Por favor completa todos los campos", "warning");
    return;
  }

  try {
    const endpoint = role === "admin" ? "/auth/admin-login" : "/auth/leader-login";
    
    const response = await fetch(`http://localhost:5000/api${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: role === "admin" ? username : undefined,
        password,
        leaderId: role === "leader" ? username : undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || "Credenciales inválidas", "error");
      return;
    }

    auth.setToken(data.token);
    auth.setUser({ role, username });

    showToast(`Bienvenido, ${username}!`, "success");
    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1500);
  } catch (error) {
    console.error("Login error:", error);
    showToast("Error al conectar con el servidor", "error");
  }
}

export function setupLoginPage() {
  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", handleLogin);
  }

  // Si ya está autenticado, redirigir
  if (auth.isAuthenticated()) {
    window.location.href = "/dashboard.html";
  }
}

setupLoginPage();
