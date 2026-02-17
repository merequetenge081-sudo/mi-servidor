// Leader Dashboard JS
let currentLeader = null;
let currentQRData = null;
let allRegistrations = [];

// Inicializar dashboard
async function initLeaderDashboard() {
  if (!requireAuth()) return;

  const user = getUser();
  if (!user || user.role !== "leader") {
    alert("Acceso denegado. Solo líderes pueden acceder.");
    logout();
    return;
  }

  currentLeader = user;
  await loadLeaderData();
  await loadRegistrations();

  // Agregar listener para búsqueda
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", filterRegistrations);
  }
}

// Cargar datos del líder
async function loadLeaderData() {
  try {
    const leaderNameEl = document.getElementById("leader-name");
    const leaderInfoEl = document.getElementById("leader-info");

    leaderNameEl.textContent = currentLeader.username || "Líder";
    leaderInfoEl.textContent = `ID: ${currentLeader.leaderId}`;
  } catch (error) {
    console.error("Error cargando datos del líder:", error);
  }
}

// Cargar registros del líder
async function loadRegistrations() {
  try {
    const data = await api.getRegistrationsByLeader(currentLeader.leaderId, { limit: 1000 });
    
    allRegistrations = data.data || [];
    const total = data.total || 0;
    const confirmed = data.confirmedCount || 0;
    const pending = total - confirmed;

    // Actualizar estadísticas
    document.getElementById("total-registrations").textContent = total;
    document.getElementById("confirmed-registrations").textContent = confirmed;
    document.getElementById("pending-registrations").textContent = pending;

    // Renderizar tabla
    renderRegistrations(allRegistrations);
  } catch (error) {
    console.error("Error cargando registros:", error);
    showError("Error al cargar registros");
  }
}

// Renderizar tabla de registros
function renderRegistrations(registrations) {
  const tbody = document.getElementById("registrations-tbody");
  if (!tbody) return;

  if (!registrations || registrations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-gray-500">
          <i class="fas fa-inbox text-4xl mb-2"></i>
          <p>No hay registros aún</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = registrations.map(reg => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 text-sm font-medium text-gray-900">
        ${reg.firstName || ''} ${reg.lastName || ''}
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${reg.cedula || 'N/A'}
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${reg.phone || 'N/A'}
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">
        ${reg.localidad || 'N/A'}
      </td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 text-xs rounded-full ${reg.confirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
          ${reg.confirmed ? 'Confirmado' : 'Pendiente'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-500">
        ${reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('es-CO') : 'N/A'}
      </td>
    </tr>
  `).join('');
}

// Filtrar registros
function filterRegistrations() {
  const searchInput = document.getElementById("search-input");
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase();
  
  const filtered = allRegistrations.filter(reg => {
    const name = `${reg.firstName || ''} ${reg.lastName || ''}`.toLowerCase();
    const cedula = (reg.cedula || '').toLowerCase();
    const phone = (reg.phone || '').toLowerCase();
    const localidad = (reg.localidad || '').toLowerCase();
    
    return name.includes(searchTerm) || 
           cedula.includes(searchTerm) || 
           phone.includes(searchTerm) || 
           localidad.includes(searchTerm);
  });

  renderRegistrations(filtered);
}

// Mostrar modal QR
async function showQRModal() {
  const modal = document.getElementById("qr-modal");
  if (!modal) return;

  modal.classList.remove("hidden");

  try {
    const qrData = await api.getLeaderQR(currentLeader.leaderId);
    currentQRData = qrData;

    const qrContainer = document.getElementById("qr-container");
    const formUrlEl = document.getElementById("form-url");

    if (qrContainer && qrData.qrCode) {
      qrContainer.innerHTML = `<img src="${qrData.qrCode}" alt="QR Code" class="mx-auto" />`;
    }

    if (formUrlEl && qrData.formUrl) {
      formUrlEl.textContent = qrData.formUrl;
    }
  } catch (error) {
    console.error("Error generando QR:", error);
    showError("Error al generar código QR");
    closeQRModal();
  }
}

// Cerrar modal QR
function closeQRModal() {
  const modal = document.getElementById("qr-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// Descargar QR
function downloadQR() {
  if (!currentQRData || !currentQRData.qrCode) {
    showError("No hay código QR para descargar");
    return;
  }

  const link = document.createElement("a");
  link.download = `qr-leader-${currentLeader.leaderId}.png`;
  link.href = currentQRData.qrCode;
  link.click();
}

// Copiar link del formulario
async function copyFormLink() {
  try {
    const qrData = await api.getLeaderQR(currentLeader.leaderId);
    
    if (qrData.formUrl) {
      await navigator.clipboard.writeText(qrData.formUrl);
      showSuccess("Link copiado al portapapeles");
    }
  } catch (error) {
    console.error("Error copiando link:", error);
    showError("Error al copiar link");
  }
}

// Exportar registros del líder
function exportMyRegistrations() {
  try {
    const token = localStorage.getItem("token");
    const url = `${window.location.origin}/api/export/registrations?leaderId=${currentLeader.leaderId}&token=${token}`;
    window.open(url, "_blank");
    showSuccess("Iniciando descarga...");
  } catch (error) {
    console.error("Error exportando:", error);
    showError("Error al exportar registros");
  }
}

// Mostrar mensaje de éxito
function showSuccess(message) {
  alert(message);
}

// Mostrar mensaje de error
function showError(message) {
  alert(message);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeaderDashboard);
} else {
  initLeaderDashboard();
}

// Exponer funciones globalmente
window.showQRModal = showQRModal;
window.closeQRModal = closeQRModal;
window.downloadQR = downloadQR;
window.copyFormLink = copyFormLink;
window.exportMyRegistrations = exportMyRegistrations;
window.loadRegistrations = loadRegistrations;
