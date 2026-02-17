// Leader Dashboard - Professional Leader Panel

// State
let currentLeader = null;
let currentQRData = null;
let allRegistrations = [];
let currentPage = 1;
let totalPages = 1;
let confirmCallback = null;
const PAGE_SIZE = 10;

// ==================== UX UTILITIES ====================

function showLoader() {
  document.getElementById('loader-overlay').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loader-overlay').classList.add('hidden');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `px-6 py-4 rounded-lg shadow-lg text-white flex items-center gap-3 transform transition-all duration-300 ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  }`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} text-xl"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function openConfirmModal(title, message, callback, icon = 'fa-exclamation-triangle', iconColor = 'text-yellow-500') {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-icon').className = `fas ${icon} text-3xl ${iconColor}`;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  
  confirmCallback = callback;
  document.getElementById('confirm-btn').onclick = () => {
    closeConfirmModal();
    callback();
  };
  
  modal.classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  confirmCallback = null;
}

// ==================== INITIALIZATION ====================

async function init() {
  // Verify authentication
  if (!requireAuth()) {
    window.location.href = '/login.html';
    return;
  }

  // Get current user
  const user = getUser();
  if (!user || user.role !== 'leader') {
    showToast('Acceso denegado. Solo líderes pueden acceder.', 'error');
    logout();
    return;
  }

  currentLeader = user;
  document.getElementById('leader-name-header').textContent = user.username || user.name || '-';

  showLoader();
  try {
    // Load leader info
    await loadLeaderInfo();
    
    // Load active event
    await loadActiveEvent();
    
    // Load QR
    await loadQRData();
    
    // Load registrations
    await loadRegistrationsData();
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showToast('Error al cargar el panel', 'error');
  } finally {
    hideLoader();
  }
}

// ==================== DATA LOADING ====================

async function loadLeaderInfo() {
  try {
    document.getElementById('leader-name').textContent = currentLeader.name || currentLeader.username || '-';
    document.getElementById('leader-id').textContent = currentLeader.leaderId || '-';
    document.getElementById('leader-area').textContent = currentLeader.area || 'Sin área';
  } catch (error) {
    console.error('Error loading leader info:', error);
  }
}

async function loadActiveEvent() {
  try {
    const event = await api.getActiveEvent();
    if (event && event._id) {
      document.getElementById('leader-event').textContent = event.name || event._id;
    }
  } catch (error) {
    console.error('Error loading active event:', error);
  }
}

async function loadQRData() {
  try {
    currentQRData = await api.getLeaderQR(currentLeader.leaderId);
    document.getElementById('qr-image').src = currentQRData.qrCode;
    document.getElementById('qr-link').value = currentQRData.formUrl;
  } catch (error) {
    console.error('Error loading QR:', error);
    showToast('Error al cargar código QR', 'error');
  }
}

async function loadRegistrationsData() {
  try {
    const response = await api.getRegistrations({ leaderId: currentLeader.leaderId, page: 1, limit: 10000 });
    allRegistrations = response.data || [];

    const total = allRegistrations.length;
    const confirmed = allRegistrations.filter(r => r.confirmed).length;
    const conversion = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    // Update KPIs
    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-confirmed').textContent = confirmed;
    document.getElementById('kpi-conversion').textContent = conversion + '%';

    // Calculate pagination
    currentPage = 1;
    totalPages = Math.ceil(total / PAGE_SIZE);

    // Render first page
    renderRegistrationsPage();
  } catch (error) {
    console.error('Error loading registrations:', error);
    showToast('Error al cargar registros', 'error');
  }
}

// ==================== TABLE RENDERING ====================

function renderRegistrationsPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageRegistrations = allRegistrations.slice(start, end);

  renderRegistrationsTable(pageRegistrations);
  updatePaginationControls();
}

function renderRegistrationsTable(registrations) {
  const tbody = document.getElementById('registrations-tbody');
  
  if (!registrations || registrations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-inbox text-5xl mb-4 text-gray-300"></i>
          <p class="text-lg font-semibold">No hay registros</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = registrations.map(reg => `
    <tr class="border-b hover:bg-gray-50 transition">
      <td class="px-6 py-4 text-sm font-medium text-gray-900">${reg.firstName} ${reg.lastName}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${reg.cedula || '-'}</td>
      <td class="px-6 py-4 text-center">
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${
          reg.confirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }">
          ${reg.confirmed ? '✓ Confirmado' : 'Pendiente'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-600">${new Date(reg.createdAt).toLocaleDateString('es-CO')}</td>
      <td class="px-6 py-4 text-center">
        <div class="flex items-center justify-center gap-2">
          ${!reg.confirmed ? `
            <button onclick="confirmRegistration('${reg._id}')" class="p-2 text-green-600 hover:bg-green-50 rounded transition" title="Confirmar">
              <i class="fas fa-check"></i>
            </button>
          ` : `
            <button onclick="unconfirmRegistration('${reg._id}')" class="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition" title="Desconfirmar">
              <i class="fas fa-times"></i>
            </button>
          `}
          <button onclick="deleteRegistration('${reg._id}')" class="p-2 text-red-600 hover:bg-red-50 rounded transition" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updatePaginationControls() {
  document.getElementById('pagination-info').textContent = `Página ${currentPage} de ${totalPages}`;
  document.getElementById('prev-btn').disabled = currentPage === 1;
  document.getElementById('next-btn').disabled = currentPage === totalPages;
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    renderRegistrationsPage();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderRegistrationsPage();
  }
}

// ==================== QR ACTIONS ====================

function copyQRLink() {
  if (!currentQRData || !currentQRData.formUrl) {
    showToast('Link no disponible', 'error');
    return;
  }

  navigator.clipboard.writeText(currentQRData.formUrl).then(() => {
    showToast('Link copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('Error al copiar el link', 'error');
  });
}

function downloadQR() {
  if (!currentQRData || !currentQRData.qrCode) {
    showToast('Código QR no disponible', 'error');
    return;
  }

  const link = document.createElement('a');
  link.href = currentQRData.qrCode;
  link.download = `QR_${currentLeader.leaderId}_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Código QR descargado', 'success');
}

function openForm() {
  if (!currentQRData || !currentQRData.formUrl) {
    showToast('URL del formulario no disponible', 'error');
    return;
  }

  window.open(currentQRData.formUrl, '_blank');
  showToast('Formulario abierto en nueva pestaña', 'success');
}

function shareQR() {
  if (!currentQRData || !currentQRData.formUrl) {
    showToast('URL no disponible', 'error');
    return;
  }

  const text = `Escanea mi código QR o accede aquí: ${currentQRData.formUrl}`;
  
  if (navigator.share) {
    navigator.share({
      title: 'Mi Código QR',
      text: text,
      url: currentQRData.formUrl
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Información copiada', 'success');
    });
  }
}

// ==================== REGISTRATION ACTIONS ====================

async function confirmRegistration(registrationId) {
  openConfirmModal(
    'Confirmar Registro',
    '¿Está seguro que desea confirmar este registro?',
    async () => {
      showLoader();
      try {
        await api.confirmRegistration(registrationId);
        showToast('Registro confirmado exitosamente', 'success');
        await loadRegistrationsData();
      } catch (error) {
        showToast('Error al confirmar registro', 'error');
      } finally {
        hideLoader();
      }
    },
    'fa-check-circle',
    'text-green-500'
  );
}

async function unconfirmRegistration(registrationId) {
  openConfirmModal(
    'Desconfirmar Registro',
    '¿Está seguro que desea desconfirmar este registro?',
    async () => {
      showLoader();
      try {
        await api.unconfirmRegistration(registrationId);
        showToast('Registro desconfirmado exitosamente', 'success');
        await loadRegistrationsData();
      } catch (error) {
        showToast('Error al desconfirmar registro', 'error');
      } finally {
        hideLoader();
      }
    },
    'fa-times-circle',
    'text-yellow-500'
  );
}

async function deleteRegistration(registrationId) {
  openConfirmModal(
    'Eliminar Registro',
    '¿Está seguro que desea eliminar este registro? Esta acción no se puede deshacer.',
    async () => {
      showLoader();
      try {
        await api.deleteRegistration(registrationId);
        showToast('Registro eliminado exitosamente', 'success');
        await loadRegistrationsData();
      } catch (error) {
        showToast('Error al eliminar registro', 'error');
      } finally {
        hideLoader();
      }
    },
    'fa-trash',
    'text-red-500'
  );
}

// ==================== EXPORT ====================

function exportRegistrations() {
  showLoader();
  try {
    const token = localStorage.getItem('token');
    const url = `/api/export/registrations?leaderId=${currentLeader.leaderId}&token=${token}`;
    window.open(url, '_blank');
    showToast('Iniciando descarga de Excel', 'success');
  } catch (error) {
    console.error('Error exporting:', error);
    showToast('Error al exportar registros', 'error');
  } finally {
    hideLoader();
  }
}

// ==================== INITIALIZATION ====================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose globally
window.copyQRLink = copyQRLink;
window.downloadQR = downloadQR;
window.openForm = openForm;
window.shareQR = shareQR;
window.confirmRegistration = confirmRegistration;
window.unconfirmRegistration = unconfirmRegistration;
window.deleteRegistration = deleteRegistration;
window.exportRegistrations = exportRegistrations;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.closeConfirmModal = closeConfirmModal;
window.logout = logout;
