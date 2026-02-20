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
let dailyTrendChart = null;
let topLeadersChart = null;

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
  if (!modal) {
    console.error('confirm-modal no encontrado');
    return;
  }
  
  document.getElementById('confirm-icon').className = `fas ${icon} text-3xl ${iconColor}`;
  document.getElementById('confirm-title').textContent = title;
  
  // Usar innerHTML para mostrar saltos de línea y formato
  const messageElement = document.getElementById('confirm-message');
  messageElement.innerHTML = message.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  
  confirmCallback = callback;
  document.getElementById('confirm-btn').onclick = () => {
    closeConfirmModal();
    callback();
  };
  
  // Mostrar modal - remover hidden y usar display
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  console.log('Modal abierto:', title);
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
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

    // Load analytics
    await loadAnalytics();

    // Render password reset requests
    renderPasswordRequests();
  } catch (error) {
    console.error('Error loading leaders:', error);
    showToast('Error al cargar líderes', 'error');
  } finally {
    hideLoader();
  }
}

// ==================== ANALYTICS ====================

async function loadAnalytics() {
  try {
    // Load KPIs
    await loadKPIs();
    
    // Load daily trend chart
    await loadDailyTrendChart();
    
    // Load top leaders chart
    await loadTopLeadersChart();
    
    // Load recent activity
    await loadRecentActivity();
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

async function loadKPIs() {
  try {
    const stats = await api.get('/api/stats');
    
    const totalLeaders = allLeaders.length;
    const totalRegistrations = stats.totalRegistrations || 0;
    const confirmed = stats.confirmedRegistrations || 0;
    const conversion = totalRegistrations > 0 ? Math.round((confirmed / totalRegistrations) * 100) : 0;

    document.getElementById('kpi-total-leaders').textContent = totalLeaders;
    document.getElementById('kpi-total-registrations').textContent = totalRegistrations;
    document.getElementById('kpi-confirmed').textContent = confirmed;
    document.getElementById('kpi-conversion').textContent = conversion + '%';
  } catch (error) {
    console.error('Error loading KPIs:', error);
  }
}

async function loadDailyTrendChart() {
  try {
    // Hide skeleton
    const skeleton = document.getElementById('daily-chart-skeleton');
    const canvas = document.getElementById('dailyTrendChart');
    
    const dailyStats = await api.get('/api/stats/daily');
    
    if (!dailyStats || !dailyStats.data || dailyStats.data.length === 0) {
      return;
    }

    const sortedData = dailyStats.data.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);
    
    const labels = sortedData.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
    });

    const registrationData = sortedData.map(d => d.registrations || 0);
    const confirmedData = sortedData.map(d => d.confirmed || 0);

    skeleton.classList.add('hidden');
    canvas.classList.remove('hidden');

    if (dailyTrendChart) {
      dailyTrendChart.destroy();
    }

    dailyTrendChart = new Chart(document.getElementById('dailyTrendChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Registros',
            data: registrationData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#3b82f6'
          },
          {
            label: 'Confirmados',
            data: confirmedData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#10b981'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading daily trend chart:', error);
  }
}

async function loadTopLeadersChart() {
  try {
    const skeleton = document.getElementById('top-leaders-skeleton');
    const canvas = document.getElementById('topLeadersChart');

    // Get top 5 leaders sorted by registrations
    const topLeaders = [...allLeaders]
      .sort((a, b) => (b.registrations || 0) - (a.registrations || 0))
      .slice(0, 5)
      .reverse();

    if (!topLeaders || topLeaders.length === 0) {
      return;
    }

    const labels = topLeaders.map(l => l.name);
    const registrationData = topLeaders.map(l => l.registrations || 0);

    skeleton.classList.add('hidden');
    canvas.classList.remove('hidden');

    if (topLeadersChart) {
      topLeadersChart.destroy();
    }

    topLeadersChart = new Chart(document.getElementById('topLeadersChart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Registros',
            data: registrationData,
            backgroundColor: [
              '#3b82f6',
              '#10b981',
              '#f59e0b',
              '#ef4444',
              '#8b5cf6'
            ],
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading top leaders chart:', error);
  }
}

async function loadRecentActivity() {
  try {
    const skeleton = document.getElementById('recent-activity-skeleton');
    const listContainer = document.getElementById('recent-activity-list');

    const registrations = await api.getRegistrations({ limit: 5 });
    const recentData = (registrations.data || []).slice(0, 5);

    if (!recentData || recentData.length === 0) {
      skeleton.classList.add('hidden');
      listContainer.classList.remove('hidden');
      listContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Sin registros recientes</p>';
      return;
    }

    const html = recentData.map(reg => `
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
        <div class="flex-1">
          <p class="font-semibold text-gray-800">${reg.firstName} ${reg.lastName}</p>
          <p class="text-sm text-gray-600">Cédula: ${reg.cedula}</p>
          <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span><i class="fas fa-user text-blue-600 mr-1"></i>${reg.leaderName}</span>
            <span><i class="fas fa-clock text-gray-600 mr-1"></i>${new Date(reg.createdAt).toLocaleDateString('es-CO')}</span>
            <span class="px-2 py-1 rounded-full ${reg.confirmed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
              ${reg.confirmed ? '✓ Confirmado' : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>
    `).join('');

    skeleton.classList.add('hidden');
    listContainer.classList.remove('hidden');
    listContainer.innerHTML = html;
  } catch (error) {
    console.error('Error loading recent activity:', error);
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
            ${canEdit && leader.email ? `
              <button onclick="openSendEmailsModal('${leader._id}')" class="p-2 text-green-600 hover:bg-green-50 rounded transition" title="Enviar Correos">
                <i class="fas fa-envelope"></i>
              </button>
            ` : ''}
            ${canEdit && leader.email ? `
              <button onclick="generatePasswordForLeader('${leader._id}')" class="p-2 text-red-600 hover:bg-red-50 rounded transition" title="Generar Contraseña">
                <i class="fas fa-key"></i>
              </button>
            ` : ''}
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

// ==================== PASSWORD RESET REQUESTS ====================

function renderPasswordRequests() {
  const section = document.getElementById('password-requests-section');
  const listContainer = document.getElementById('password-requests-list');
  
  // Filter leaders with passwordResetRequested
  const requesters = allLeaders.filter(l => l.passwordResetRequested === true);
  
  if (requesters.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  
  listContainer.innerHTML = requesters.map(leader => `
    <div class="flex items-center justify-between bg-white p-3 rounded-lg border border-yellow-200">
      <div class="flex-1">
        <p class="font-semibold text-gray-800">${leader.name}</p>
        <p class="text-sm text-gray-600">ID: ${leader.leaderId} • Email: ${leader.email || 'No configurado'}</p>
      </div>
      <button 
        onclick="generatePasswordForLeader('${leader._id}')" 
        class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center gap-2 ${!leader.email ? 'opacity-50 cursor-not-allowed' : ''}"
        ${!leader.email ? 'disabled' : ''}
      >
        <i class="fas fa-key"></i>
        Generar Contraseña
      </button>
    </div>
  `).join('');
}

async function generatePasswordForLeader(leaderId) {
  console.log('🔑 generatePasswordForLeader llamado con:', leaderId);
  
  const leader = allLeaders.find(l => l._id === leaderId);
  if (!leader) {
    console.error('❌ Líder no encontrado:', leaderId);
    showToast('Líder no encontrado', 'error');
    return;
  }
  
  console.log('📋 Líder encontrado:', leader.name, 'isTemporaryPassword:', leader.isTemporaryPassword, 'passwordResetRequested:', leader.passwordResetRequested);
  
  if (!leader.email) {
    showToast('El líder no tiene email configurado', 'error');
    return;
  }
  
  // Verificación simple: si NO es temporal y NO hay solicitud pendiente, mostrar advertencia
  const needsWarning = !leader.isTemporaryPassword && !leader.passwordResetRequested;
  console.log('⚠️ Necesita advertencia:', needsWarning);
  
  if (needsWarning) {
    const message = `⚠️ ADVERTENCIA IMPORTANTE\n\n${leader.name} ya tiene una CONTRASEÑA FIJA y no hay solicitud de cambio pendiente.\n\n¿Desea REALMENTE generar una nueva contraseña temporal? Esto SOBRESCRIBIRÁ su contraseña actual.`;
    console.log('Mostrando alert con mensaje:', message);
    const confirmed = confirm(message);
    console.log('Usuario confirmó:', confirmed);
    
    if (!confirmed) {
      showToast('Operación cancelada', 'info');
      return;
    }
  }
  
  // Proceder a generar la contraseña
  try {
    showLoader();
    console.log('Enviando solicitud a /api/auth/reset-password...');
    
    const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        leaderId: leader._id
      })
    });
    
    const data = await response.json();
    console.log('✅ Respuesta del servidor:', data);
    
    if (response.ok && data.success) {
      showToast('✅ Contraseña temporal generada y enviada por email', 'success');
      await loadLeaders();
    } else {
      showToast(data.error || 'Error al generar contraseña', 'error');
    }
  } catch (error) {
    console.error('❌ Error en generatePasswordForLeader:', error);
    showToast('Error: ' + error.message, 'error');
  } finally {
    hideLoader();
  }
}
        showToast('Error al generar contraseña', 'error');
      } finally {
        hideLoader();
      }
    },
    'fa-key',
    'text-yellow-500'
  );
}

// ==================== SEND EMAILS MODAL ====================

function openSendEmailsModal(leaderId) {
  const leader = allLeaders.find(l => l._id === leaderId);
  if (!leader) {
    showToast('Líder no encontrado', 'error');
    return;
  }

  if (!leader.email) {
    showToast('Este líder no tiene email configurado', 'error');
    return;
  }

  document.getElementById('send-emails-leader-id').value = leaderId;
  document.getElementById('send-emails-leader-name').textContent = leader.name;
  
  // Reset checkboxes
  document.getElementById('send-welcome-check').checked = false;
  document.getElementById('send-credentials-check').checked = false;
  document.getElementById('send-qr-check').checked = true;
  document.getElementById('send-warning-check').checked = false;
  
  // Hide result message
  const resultDiv = document.getElementById('send-emails-result');
  resultDiv.classList.add('hidden');
  
  document.getElementById('send-emails-modal').classList.remove('hidden');
}

function closeSendEmailsModal() {
  document.getElementById('send-emails-modal').classList.add('hidden');
}

async function confirmSendEmails() {
  const leaderId = document.getElementById('send-emails-leader-id').value;
  const sendWelcome = document.getElementById('send-welcome-check').checked;
  const sendCredentials = document.getElementById('send-credentials-check').checked;
  const sendQR = document.getElementById('send-qr-check').checked;
  const sendWarning = document.getElementById('send-warning-check').checked;

  const resultDiv = document.getElementById('send-emails-result');
  const sendBtn = document.getElementById('send-emails-btn');

  // Validate at least one checkbox
  if (!sendWelcome && !sendCredentials && !sendQR && !sendWarning) {
    resultDiv.className = 'p-3 rounded-lg bg-yellow-100 text-yellow-800';
    resultDiv.textContent = '⚠️ Debes seleccionar al menos un correo';
    resultDiv.classList.remove('hidden');
    return;
  }

  try {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    resultDiv.className = 'p-3 rounded-lg bg-blue-100 text-blue-800';
    resultDiv.textContent = '📧 Enviando correos...';
    resultDiv.classList.remove('hidden');

    const response = await fetch(`${API_BASE}/api/leaders/${leaderId}/send-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        sendWelcomeEmail: sendWelcome,
        sendCredentialsEmail: sendCredentials,
        sendQRCodeEmail: sendQR,
        sendWarningEmail: sendWarning
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      resultDiv.className = 'p-3 rounded-lg bg-green-100 text-green-800';
      resultDiv.textContent = '✅ Correos enviados exitosamente';
      showToast('Correos enviados correctamente', 'success');
      
      setTimeout(() => {
        closeSendEmailsModal();
      }, 2000);
    } else {
      resultDiv.className = 'p-3 rounded-lg bg-red-100 text-red-800';
      resultDiv.textContent = `❌ ${data.message || 'Error al enviar correos'}`;
      showToast(data.message || 'Error al enviar correos', 'error');
    }
  } catch (error) {
    console.error('Error sending emails:', error);
    resultDiv.className = 'p-3 rounded-lg bg-red-100 text-red-800';
    resultDiv.textContent = '❌ Error de conexión';
    showToast('Error al enviar correos', 'error');
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
  }
}

// Expose globally
window.openCreateModal = openCreateModal;
window.openEditModal = openEditModal;
window.closeFormModal = closeFormModal;
window.closeQRModal = closeQRModal;
window.closeConfirmModal = closeConfirmModal;
window.openSendEmailsModal = openSendEmailsModal;
window.closeSendEmailsModal = closeSendEmailsModal;
window.confirmSendEmails = confirmSendEmails;
window.generatePasswordForLeader = generatePasswordForLeader;
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
window.toggleNotifications = toggleNotifications;
window.toggleHelp = toggleHelp;

// ==================== NOTIFICATIONS & HELP ====================

function toggleNotifications() {
  showToast('Las notificaciones estarán disponibles próximamente', 'info');
}

function toggleHelp() {
  showToast('La ayuda estará disponible próximamente', 'info');
}


