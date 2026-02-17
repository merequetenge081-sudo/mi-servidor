// Leaders.js - Gestión profesional de líderes

// State
let allLeaders = [];
let filteredLeaders = [];
let editingLeaderId = null;
let confirmCallback = null;

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

// ==================== FORM MODAL ====================

function openCreateModal() {
  editingLeaderId = null;
  document.getElementById('modal-title').textContent = 'Crear Líder';
  document.getElementById('password-hint').textContent = '(requerida)';
  document.getElementById('leader-form').reset();
  document.getElementById('leader-id').value = '';
  document.getElementById('password').required = true;
  document.getElementById('form-modal').classList.remove('hidden');
}

function openEditModal(leader) {
  editingLeaderId = leader._id;
  document.getElementById('modal-title').textContent = 'Editar Líder';
  document.getElementById('password-hint').textContent = '(dejar en blanco para no cambiar)';
  document.getElementById('leader-id').value = leader._id;
  document.getElementById('leaderId').value = leader.leaderId;
  document.getElementById('name').value = leader.name;
  document.getElementById('email').value = leader.email || '';
  document.getElementById('phone').value = leader.phone || '';
  document.getElementById('area').value = leader.area || '';
  document.getElementById('eventId').value = leader.eventId || '';
  document.getElementById('password').value = '';
  document.getElementById('password').required = false;
  document.getElementById('form-modal').classList.remove('hidden');
}

function closeFormModal() {
  document.getElementById('form-modal').classList.add('hidden');
  editingLeaderId = null;
}

// ==================== QR MODAL ====================

function closeQRModal() {
  document.getElementById('qr-modal').classList.add('hidden');
}

function copyQRLink() {
  const link = document.getElementById('qr-link').value;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('Error al copiar el link', 'error');
  });
}

// ==================== DATA LOADING ====================

async function loadLeaders() {
  showLoader();
  try {
    const response = await api.getLeaders();
    allLeaders = response || [];
    filteredLeaders = [...allLeaders];
    renderTable(filteredLeaders);
    updateCounters();
  } catch (error) {
    console.error('Error cargando líderes:', error);
    showToast('Error al cargar líderes', 'error');
  } finally {
    hideLoader();
  }
}

function renderTable(leaders) {
  const tbody = document.getElementById('leaders-tbody');
  
  if (!leaders || leaders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-inbox text-5xl mb-4 text-gray-300"></i>
          <p class="text-lg font-semibold">No se encontraron líderes</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leaders.map(leader => `
    <tr class="border-b hover:bg-gray-50 transition">
      <td class="px-6 py-4 text-sm font-medium text-gray-900">${leader.name || '-'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${leader.leaderId || '-'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${leader.area || '-'}</td>
      <td class="px-6 py-4 text-sm text-gray-600">${leader.eventId || '-'}</td>
      <td class="px-6 py-4 text-center">
        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
          ${leader.registrations || 0}
        </span>
      </td>
      <td class="px-6 py-4 text-center">
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${
          leader.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }">
          ${leader.active ? '✓ Activo' : '✗ Inactivo'}
        </span>
      </td>
      <td class="px-6 py-4 text-center">
        <div class="flex items-center justify-center gap-1">
          <button onclick="viewQR('${leader.leaderId}')" class="p-2 text-purple-600 hover:bg-purple-50 rounded transition" title="Ver QR">
            <i class="fas fa-qrcode"></i>
          </button>
          <button onclick="copyLeaderLink('${leader.leaderId}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded transition" title="Copiar link">
            <i class="fas fa-link"></i>
          </button>
          <button onclick="toggleActive('${leader._id}', ${leader.active})" class="p-2 ${leader.active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'} rounded transition" title="${leader.active ? 'Desactivar' : 'Activar'}">
            <i class="fas fa-${leader.active ? 'ban' : 'check'}"></i>
          </button>
          <button onclick="editLeader('${leader._id}')" class="p-2 text-orange-600 hover:bg-orange-50 rounded transition" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateCounters() {
  document.getElementById('total-leaders').textContent = allLeaders.length;
  document.getElementById('active-leaders').textContent = allLeaders.filter(l => l.active).length;
  document.getElementById('inactive-leaders').textContent = allLeaders.filter(l => !l.active).length;
}

// ==================== FILTERS ====================

function applyFilters() {
  const nameFilter = document.getElementById('filter-name').value.toLowerCase();
  const statusFilter = document.getElementById('filter-status').value;

  filteredLeaders = allLeaders.filter(leader => {
    const nameMatch = !nameFilter || leader.name.toLowerCase().includes(nameFilter);
    const statusMatch = statusFilter === '' || String(leader.active) === statusFilter;
    return nameMatch && statusMatch;
  });

  renderTable(filteredLeaders);
}

function clearFilters() {
  document.getElementById('filter-name').value = '';
  document.getElementById('filter-status').value = '';
  filteredLeaders = [...allLeaders];
  renderTable(filteredLeaders);
}

// ==================== ACTIONS ====================

async function viewQR(leaderId) {
  showLoader();
  try {
    const response = await api.getLeaderQR(leaderId);
    
    document.getElementById('qr-image').src = response.qrCode;
    document.getElementById('qr-link').value = response.formUrl;
    document.getElementById('qr-modal').classList.remove('hidden');
  } catch (error) {
    console.error('Error obteniendo QR:', error);
    showToast('Error al obtener el código QR', 'error');
  } finally {
    hideLoader();
  }
}

function copyLeaderLink(leaderId) {
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/form.html?token=${generateMockToken(leaderId)}`;
  
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('Error al copiar el link', 'error');
  });
}

function generateMockToken(leaderId) {
  const leader = allLeaders.find(l => l.leaderId === leaderId);
  return leader?.token || 'token_placeholder';
}

function toggleActive(leaderId, currentStatus) {
  const action = currentStatus ? 'desactivar' : 'activar';
  openConfirmModal(
    `${action.charAt(0).toUpperCase() + action.slice(1)} líder`,
    `¿Está seguro que desea ${action} este líder?`,
    async () => {
      showLoader();
      try {
        await api.updateLeader(leaderId, { active: !currentStatus });
        showToast(`Líder ${action}do exitosamente`, 'success');
        await loadLeaders();
      } catch (error) {
        showToast(`Error al ${action} el líder`, 'error');
      } finally {
        hideLoader();
      }
    },
    currentStatus ? 'fa-times-circle' : 'fa-check-circle',
    currentStatus ? 'text-yellow-500' : 'text-green-500'
  );
}

async function editLeader(leaderId) {
  const leader = allLeaders.find(l => l._id === leaderId);
  if (leader) {
    openEditModal(leader);
  }
}

// ==================== FORM ====================

document.getElementById('leader-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const payload = {
    leaderId: document.getElementById('leaderId').value,
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    area: document.getElementById('area').value,
    eventId: document.getElementById('eventId').value
  };

  const password = document.getElementById('password').value;
  if (password) {
    payload.password = password;
  }

  showLoader();
  try {
    if (editingLeaderId) {
      await api.updateLeader(editingLeaderId, payload);
      showToast('Líder actualizado exitosamente', 'success');
    } else {
      await api.post('/api/leaders', payload);
      showToast('Líder creado exitosamente', 'success');
    }

    closeFormModal();
    await loadLeaders();
  } catch (error) {
    console.error('Error guardando líder:', error);
    showToast(error.message || 'Error al guardar líder', 'error');
  } finally {
    hideLoader();
  }
});

// ==================== INITIALIZATION ====================

async function init() {
  requireAuth();
  await loadLeaders();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose globally
window.openCreateModal = openCreateModal;
window.openEditModal = openEditModal;
window.closeFormModal = closeFormModal;
window.closeQRModal = closeQRModal;
window.closeConfirmModal = closeConfirmModal;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.viewQR = viewQR;
window.copyLeaderLink = copyLeaderLink;
window.copyQRLink = copyQRLink;
window.toggleActive = toggleActive;
window.editLeader = editLeader;
window.logout = logout;

