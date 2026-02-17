// Leaders.js - Advanced professional leaders management

// State
let allLeaders = [];
let filteredLeaders = [];
let leaderStats = {};
let editingLeaderId = null;
let confirmCallback = null;
let currentUser = null;
let isProcessing = false;
let currentQRLeader = null;
let currentQRData = null;

// ==================== UX UTILITIES ====================

function showLoader() {
  document.getElementById('loader-overlay').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loader-overlay').classList.add('hidden');
}

function setProcessing(value) {
  isProcessing = value;
  document.getElementById('submit-btn').disabled = value;
  if (value) {
    document.getElementById('submit-btn').classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    document.getElementById('submit-btn').classList.remove('opacity-50', 'cursor-not-allowed');
  }
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

// ==================== VALIDATION ====================

function clearErrors() {
  document.getElementById('leaderId-error').textContent = '';
  document.getElementById('leaderId-error').classList.add('hidden');
  document.getElementById('name-error').textContent = '';
  document.getElementById('name-error').classList.add('hidden');
  document.getElementById('email-error').textContent = '';
  document.getElementById('email-error').classList.add('hidden');
  document.getElementById('password-error').textContent = '';
  document.getElementById('password-error').classList.add('hidden');
}

function showFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

function validateForm() {
  clearErrors();
  let isValid = true;

  const leaderId = document.getElementById('leaderId').value.trim();
  if (!leaderId) {
    showFieldError('leaderId', 'Leader ID es requerido');
    isValid = false;
  }

  const name = document.getElementById('name').value.trim();
  if (!name) {
    showFieldError('name', 'Nombre es requerido');
    isValid = false;
  } else if (name.length < 3) {
    showFieldError('name', 'El nombre debe tener al menos 3 caracteres');
    isValid = false;
  }

  const email = document.getElementById('email').value.trim();
  if (email && !isValidEmail(email)) {
    showFieldError('email', 'Email no es válido');
    isValid = false;
  }

  const password = document.getElementById('password').value;
  if (password && password.length < 6) {
    showFieldError('password', 'La contraseña debe tener al menos 6 caracteres');
    isValid = false;
  }

  return isValid;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==================== PERMISSIONS ====================

function canManageLeaders() {
  return currentUser && currentUser.role === 'admin';
}

function updateVisibleActions() {
  const createBtn = document.getElementById('create-btn');
  if (createBtn) {
    createBtn.style.display = canManageLeaders() ? 'flex' : 'none';
  }
}

// ==================== FORM MODAL ====================

function openCreateModal() {
  if (!canManageLeaders()) {
    showToast('No tienes permisos para crear líderes', 'error');
    return;
  }

  editingLeaderId = null;
  document.getElementById('modal-title').textContent = 'Crear Líder';
  document.getElementById('password-hint').textContent = '(requerida)';
  document.getElementById('leader-form').reset();
  document.getElementById('leader-id').value = '';
  document.getElementById('password').required = true;
  clearErrors();
  document.getElementById('form-modal').classList.remove('hidden');
}

function openEditModal(leader) {
  if (!canManageLeaders()) {
    showToast('No tienes permisos para editar líderes', 'error');
    return;
  }

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
  clearErrors();
  document.getElementById('form-modal').classList.remove('hidden');
}

function closeFormModal() {
  document.getElementById('form-modal').classList.add('hidden');
  editingLeaderId = null;
}

// ==================== QR MODAL ====================

function closeQRModal() {
  const modal = document.getElementById('qr-modal');
  const content = document.getElementById('qr-modal-content');
  
  modal.style.opacity = '0';
  content.style.transform = 'scale(0.95)';
  
  setTimeout(() => {
    modal.classList.add('hidden');
    currentQRLeader = null;
    currentQRData = null;
  }, 300);
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

async function loadTopLeaders() {
  try {
    // Sort leaders by registrations count (descending) and take top 5
    const sorted = [...allLeaders].sort((a, b) => (b.registrations || 0) - (a.registrations || 0));
    const topLeaders = sorted.slice(0, 5);
    renderRanking(topLeaders);
  } catch (error) {
    console.error('Error loading top leaders:', error);
  }
}

function renderRanking(leaders) {
  const container = document.getElementById('ranking-container');
  
  if (!leaders || leaders.length === 0) {
    container.innerHTML = '<p class="col-span-5 text-center text-gray-500">Sin datos de ranking</p>';
    return;
  }

  container.innerHTML = leaders.map((leader, index) => {
    const medal = ['🥇', '🥈', '🥉', '⭐', '⭐'][index] || '⭐';
    return `
      <div class="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition">
        <div class="flex items-center justify-between mb-3">
          <span class="text-3xl">${medal}</span>
          <span class="text-2xl font-bold text-blue-600">#${index + 1}</span>
        </div>
        <h3 class="font-semibold text-gray-800 truncate">${leader.name}</h3>
        <p class="text-sm text-gray-600 mb-2">${leader.leaderId}</p>
        <div class="space-y-1">
          <p class="text-sm"><span class="font-semibold text-blue-600">${leader.registrations || 0}</span> registros</p>
          <p class="text-xs text-gray-600">${leader.area || 'Sin área'}</p>
        </div>
      </div>
    `;
  }).join('');
}

async function loadLeaderStats(leaderId) {
  try {
    const result = await api.getRegistrations({ leaderId, limit: 10000 });
    const total = result.total || 0;
    const confirmed = (result.data || []).filter(r => r.confirmed).length;
    return {
      total: total,
      confirmed: confirmed
    };
  } catch (error) {
    console.error('Error loading stats for leader:', leaderId);
    return { total: 0, confirmed: 0 };
  }
}

async function loadLeaders() {
  showLoader();
  try {
    // Load current user
    const user = getUser();
    currentUser = user;
    updateVisibleActions();

    // Load leaders
    const response = await api.getLeaders();
    allLeaders = response || [];

    // Load stats for all leaders
    for (let leader of allLeaders) {
      leaderStats[leader._id] = await loadLeaderStats(leader.leaderId);
    }

    filteredLeaders = [...allLeaders];
    renderTable(filteredLeaders);
    updateCounters();

    // Load ranking
    await loadTopLeaders();
  } catch (error) {
    console.error('Error loading leaders:', error);
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
        <td colspan="8" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-inbox text-5xl mb-4 text-gray-300"></i>
          <p class="text-lg font-semibold">No se encontraron líderes</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leaders.map(leader => {
    const stats = leaderStats[leader._id] || { total: 0, confirmed: 0 };
    const percentage = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
    const canEdit = canManageLeaders();

    return `
      <tr class="border-b hover:bg-gray-50 transition">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${leader.name || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${leader.leaderId || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${leader.area || '-'}</td>
        <td class="px-6 py-4 text-center">
          <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            ${stats.total}
          </span>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            ${stats.confirmed}
          </span>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <div class="w-24 bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
            <span class="text-xs font-semibold text-gray-700">${percentage}%</span>
          </div>
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
            ${canEdit ? `
              <button onclick="toggleActive('${leader._id}', ${leader.active})" class="p-2 ${leader.active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'} rounded transition" title="${leader.active ? 'Desactivar' : 'Activar'}">
                <i class="fas fa-${leader.active ? 'ban' : 'check'}"></i>
              </button>
              <button onclick="editLeader('${leader._id}')" class="p-2 text-orange-600 hover:bg-orange-50 rounded transition" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
    const leader = allLeaders.find(l => l.leaderId === leaderId);
    if (!leader) {
      showToast('Líder no encontrado', 'error');
      return;
    }

    currentQRLeader = leader;

    const response = await api.getLeaderQR(leaderId);
    currentQRData = response;

    // Fill modal with data
    document.getElementById('qr-image').src = response.qrCode;
    document.getElementById('qr-link').value = response.formUrl;
    document.getElementById('qr-leader-name').textContent = leader.name;
    document.getElementById('qr-leader-id').textContent = leader.leaderId;
    document.getElementById('qr-registrations').textContent = leaderStats[leader._id]?.total || 0;

    // Animate modal opening
    const modal = document.getElementById('qr-modal');
    const content = document.getElementById('qr-modal-content');
    
    modal.classList.remove('hidden');
    // Reset transform for animation
    content.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      modal.style.opacity = '1';
      content.style.transform = 'scale(1)';
    }, 10);
  } catch (error) {
    console.error('Error obtaining QR:', error);
    showToast('Error al obtener el código QR', 'error');
  } finally {
    hideLoader();
  }
}

async function downloadQR() {
  if (!currentQRData || !currentQRLeader) {
    showToast('Datos de QR no disponibles', 'error');
    return;
  }

  const btn = document.getElementById('download-qr-btn');
  btn.disabled = true;
  btn.classList.add('opacity-50', 'cursor-not-allowed');

  try {
    const link = document.createElement('a');
    link.href = currentQRData.qrCode;
    link.download = `QR_${currentQRLeader.leaderId}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Código QR descargado exitosamente', 'success');
  } catch (error) {
    console.error('Error downloading QR:', error);
    showToast('Error al descargar el código QR', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

async function copyLink() {
  const btn = document.getElementById('copy-link-btn');
  btn.disabled = true;
  btn.classList.add('opacity-50', 'cursor-not-allowed');

  try {
    const link = document.getElementById('qr-link').value;
    await navigator.clipboard.writeText(link);
    showToast('Link copiado al portapapeles', 'success');
  } catch (error) {
    console.error('Error copying link:', error);
    showToast('Error al copiar el link', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

async function openForm() {
  if (!currentQRData) {
    showToast('Datos de formulario no disponibles', 'error');
    return;
  }

  const btn = document.getElementById('open-form-btn');
  btn.disabled = true;
  btn.classList.add('opacity-50', 'cursor-not-allowed');

  try {
    window.open(currentQRData.formUrl, '_blank');
    showToast('Formulario abierto en nueva pestaña', 'success');
  } catch (error) {
    console.error('Error opening form:', error);
    showToast('Error al abrir el formulario', 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

function copyLeaderLink(leaderId) {
  const leader = allLeaders.find(l => l.leaderId === leaderId);
  if (!leader || !leader.token) {
    showToast('Token no disponible', 'error');
    return;
  }

  const baseUrl = window.location.origin;
  const link = `${baseUrl}/form.html?token=${leader.token}`;
  
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('Error al copiar el link', 'error');
  });
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

function editLeader(leaderId) {
  const leader = allLeaders.find(l => l._id === leaderId);
  if (leader) {
    openEditModal(leader);
  }
}

// ==================== FORM ====================

document.getElementById('leader-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  if (isProcessing) {
    return;
  }

  setProcessing(true);

  const payload = {
    leaderId: document.getElementById('leaderId').value.trim(),
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    area: document.getElementById('area').value.trim(),
    eventId: document.getElementById('eventId').value.trim()
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
    console.error('Error saving leader:', error);
    showToast(error.message || 'Error al guardar líder', 'error');
  } finally {
    hideLoader();
    setProcessing(false);
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
window.downloadQR = downloadQR;
window.copyLink = copyLink;
window.openForm = openForm;
window.copyLeaderLink = copyLeaderLink;
window.copyQRLink = copyQRLink;
window.toggleActive = toggleActive;
window.editLeader = editLeader;
window.logout = logout;

