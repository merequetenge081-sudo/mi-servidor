// Registrations.js - Gestión profesional de registros

// Estado global
let currentPage = 1;
const limit = 20;
let totalPages = 1;
let currentFilters = {};
let allLeaders = [];
let allEvents = [];

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

function openModal(title, message, onConfirm, icon = 'fa-exclamation-triangle', iconColor = 'text-yellow-500') {
  const modal = document.getElementById('confirm-modal');
  const modalIcon = document.getElementById('modal-icon');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  modalIcon.className = `fas ${icon} text-3xl ${iconColor}`;
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  
  confirmBtn.onclick = () => {
    closeModal();
    onConfirm();
  };
  
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
}

// ==================== DATA LOADING ====================

async function loadLeaders() {
  try {
    const result = await api.getLeaders();
    allLeaders = result || [];
    
    const select = document.getElementById('filter-leader');
    select.innerHTML = '<option value="">Todos los líderes</option>';
    allLeaders.forEach(leader => {
      select.innerHTML += `<option value="${leader.leaderId}">${leader.name}</option>`;
    });
  } catch (error) {
    console.error('Error cargando líderes:', error);
  }
}

async function loadEvents() {
  try {
    const result = await api.getEvents();
    allEvents = result || [];
    
    const select = document.getElementById('filter-event');
    select.innerHTML = '<option value="">Todos los eventos</option>';
    allEvents.forEach(event => {
      select.innerHTML += `<option value="${event._id}">${event.name}</option>`;
    });
  } catch (error) {
    console.error('Error cargando eventos:', error);
  }
}

async function loadRegistrations() {
  showLoader();
  try {
    const params = {
      page: currentPage,
      limit,
      ...currentFilters
    };

    const response = await api.getRegistrations(params);
    
    if (!response || !response.data) {
      showToast('Error al cargar registros', 'error');
      hideLoader();
      return;
    }

    renderTable(response.data);
    updatePagination(response);
    updateCounters(response);
  } catch (error) {
    console.error('Error cargando registros:', error);
    showToast('Error al cargar registros', 'error');
  } finally {
    hideLoader();
  }
}

function renderTable(registrations) {
  const tbody = document.getElementById('registrations-tbody');
  
  if (!registrations || registrations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-inbox text-5xl mb-4 text-gray-300"></i>
          <p class="text-lg font-semibold">No se encontraron registros</p>
          <p class="text-sm mt-2">Intenta cambiar los filtros o realiza una nueva búsqueda</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = registrations.map(reg => {
    const leaderName = allLeaders.find(l => l.leaderId === reg.leaderId)?.name || reg.leaderId || 'Sin líder';
    const eventName = allEvents.find(e => e._id === reg.eventId)?.name || reg.eventId || 'Sin evento';
    
    return `
      <tr class="border-b hover:bg-gray-50 transition" data-id="${reg._id}">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${reg.name || 'Sin nombre'}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${reg.cedula || 'Sin cédula'}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${leaderName}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${eventName}</td>
        <td class="px-6 py-4 text-center">
          <span class="px-3 py-1 rounded-full text-xs font-semibold ${
            reg.confirmed 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }">
            ${reg.confirmed ? '✓ Confirmado' : '✗ No confirmado'}
          </span>
        </td>
        <td class="px-6 py-4 text-center">
          <div class="flex items-center justify-center gap-2">
            ${reg.confirmed 
              ? `<button onclick="unconfirmRegistration('${reg._id}')" class="text-yellow-600 hover:text-yellow-800 transition p-2 rounded hover:bg-yellow-50" title="Desconfirmar">
                   <i class="fas fa-times-circle"></i>
                 </button>`
              : `<button onclick="confirmRegistration('${reg._id}')" class="text-green-600 hover:text-green-800 transition p-2 rounded hover:bg-green-50" title="Confirmar">
                   <i class="fas fa-check-circle"></i>
                 </button>`
            }
            <button onclick="deleteRegistration('${reg._id}')" class="text-red-600 hover:text-red-800 transition p-2 rounded hover:bg-red-50" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updatePagination(response) {
  totalPages = response.pages || 1;
  document.getElementById('current-page').textContent = currentPage;
  document.getElementById('total-pages').textContent = totalPages;
  
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;
}

function updateCounters(response) {
  document.getElementById('registrations-count').textContent = response.total || 0;
  document.getElementById('confirmed-count').textContent = response.confirmedCount || 0;
}

// ==================== FILTERS ====================

function applyFilters() {
  currentFilters = {};
  
  const leaderId = document.getElementById('filter-leader').value;
  const eventId = document.getElementById('filter-event').value;
  const confirmed = document.getElementById('filter-confirmed').value;
  const cedula = document.getElementById('filter-cedula').value;
  
  if (leaderId) currentFilters.leaderId = leaderId;
  if (eventId) currentFilters.eventId = eventId;
  if (confirmed) currentFilters.confirmed = confirmed;
  if (cedula) currentFilters.cedula = cedula;
  
  currentPage = 1;
  loadRegistrations();
}

function clearFilters() {
  document.getElementById('filter-leader').value = '';
  document.getElementById('filter-event').value = '';
  document.getElementById('filter-confirmed').value = '';
  document.getElementById('filter-cedula').value = '';
  
  currentFilters = {};
  currentPage = 1;
  loadRegistrations();
}

// ==================== PAGINATION ====================

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    loadRegistrations();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    loadRegistrations();
  }
}

// ==================== ACTIONS ====================

async function confirmRegistration(id) {
  openModal(
    'Confirmar registro',
    '¿Está seguro que desea confirmar este registro?',
    async () => {
      showLoader();
      try {
        await api.confirmRegistration(id);
        showToast('Registro confirmado exitosamente', 'success');
        await loadRegistrations();
      } catch (error) {
        showToast('Error al confirmar registro', 'error');
        console.error(error);
      } finally {
        hideLoader();
      }
    },
    'fa-check-circle',
    'text-green-500'
  );
}

async function unconfirmRegistration(id) {
  openModal(
    'Desconfirmar registro',
    '¿Está seguro que desea desconfirmar este registro?',
    async () => {
      showLoader();
      try {
        await api.unconfirmRegistration(id);
        showToast('Registro desconfirmado exitosamente', 'success');
        await loadRegistrations();
      } catch (error) {
        showToast('Error al desconfirmar registro', 'error');
        console.error(error);
      } finally {
        hideLoader();
      }
    },
    'fa-times-circle',
    'text-yellow-500'
  );
}

async function deleteRegistration(id) {
  openModal(
    'Eliminar registro',
    '¿Está seguro que desea eliminar este registro? Esta acción no se puede deshacer.',
    async () => {
      showLoader();
      try {
        await api.deleteRegistration(id);
        showToast('Registro eliminado exitosamente', 'success');
        await loadRegistrations();
      } catch (error) {
        showToast('Error al eliminar registro', 'error');
        console.error(error);
      } finally {
        hideLoader();
      }
    },
    'fa-trash',
    'text-red-500'
  );
}

function exportRegistrations() {
  try {
    api.exportData('registrations');
    showToast('Exportando registros...', 'info');
  } catch (error) {
    showToast('Error al exportar registros', 'error');
    console.error(error);
  }
}

// ==================== INITIALIZATION ====================

async function init() {
  requireAuth();
  
  showLoader();
  try {
    await Promise.all([
      loadLeaders(),
      loadEvents(),
      loadRegistrations()
    ]);
  } catch (error) {
    console.error('Error en inicialización:', error);
    showToast('Error al inicializar la página', 'error');
  } finally {
    hideLoader();
  }

  // Enter key para aplicar filtros en búsqueda de cédula
  document.getElementById('filter-cedula').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilters();
  });
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exponer funciones globalmente
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.confirmRegistration = confirmRegistration;
window.unconfirmRegistration = unconfirmRegistration;
window.deleteRegistration = deleteRegistration;
window.exportRegistrations = exportRegistrations;
window.closeModal = closeModal;
