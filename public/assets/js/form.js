// ==================== STATE ====================
const state = {
  leaderData: null,
  activeEvent: null,
  currentUser: null,
  isSubmitting: false,
  isDuplicateCheck: false,
  pendingSubmit: null,
  urlParams: new URLSearchParams(window.location.search),
  tokenParam: new URLSearchParams(window.location.search).get('token'),
  leaderIdParam: new URLSearchParams(window.location.search).get('leaderId')
};

// ==================== VALIDATION RULES ====================
const validators = {
  name: (value) => {
    if (!value.trim()) return 'El nombre es obligatorio';
    if (value.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
    return null;
  },
  cedula: (value) => {
    if (!value.trim()) return 'La cédula es obligatoria';
    if (!/^\d+$/.test(value.trim())) return 'La cédula debe contener solo números';
    if (value.trim().length < 5) return 'La cédula debe tener al menos 5 dígitos';
    return null;
  },
  phone: (value) => {
    if (!value.trim()) return 'El teléfono es obligatorio';
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(value.trim())) return 'El teléfono no es válido';
    return null;
  },
  email: (value) => {
    if (!value.trim()) return null; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value.trim())) return 'El email no es válido';
    return null;
  }
};

// ==================== UX UTILITIES ====================
function showLoader() {
  document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loader').classList.add('hidden');
}

function showErrorScreen(message) {
  document.getElementById('error-screen-message').textContent = message;
  document.getElementById('error-screen').classList.remove('hidden');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
  
  toast.className = `px-6 py-4 rounded-lg shadow-lg text-white flex items-center gap-3 transform transition-all duration-300 ${bgColor} animate-slide-in`;
  toast.innerHTML = `
    <i class="fas fa-${icon} text-xl flex-shrink-0"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function clearFieldError(fieldId) {
  const errorElement = document.getElementById(`${fieldId}-error`);
  if (errorElement) {
    errorElement.classList.add('hidden');
    errorElement.textContent = '';
  }
  
  const inputElement = document.getElementById(fieldId);
  if (inputElement) {
    inputElement.classList.remove('border-red-500');
  }
}

function showFieldError(fieldId, message) {
  const errorElement = document.getElementById(`${fieldId}-error`);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }
  
  const inputElement = document.getElementById(fieldId);
  if (inputElement) {
    inputElement.classList.add('border-red-500');
  }
}

function openDuplicateModal() {
  document.getElementById('duplicate-modal').classList.remove('hidden');
}

function closeDuplicateModal() {
  document.getElementById('duplicate-modal').classList.add('hidden');
  state.isSubmitting = false;
  document.getElementById('submitBtn').disabled = false;
}

function openSuccessModal(registrationId) {
  document.getElementById('registration-id').textContent = registrationId;
  document.getElementById('success-modal').classList.remove('hidden');
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.add('hidden');
}

// ==================== FIELD VALIDATION ====================
function validateField(fieldId, validatorFn) {
  const value = document.getElementById(fieldId).value;
  const error = validatorFn(value);
  
  if (error) {
    showFieldError(fieldId, error);
    return false;
  } else {
    clearFieldError(fieldId);
    return true;
  }
}

function validateForm() {
  let isValid = true;
  
  isValid &= validateField('firstName', validators.name);
  isValid &= validateField('lastName', validators.name);
  isValid &= validateField('cedula', validators.cedula);
  isValid &= validateField('phone', validators.phone);
  isValid &= validateField('email', validators.email);
  
  return isValid;
}

// Setup real-time validation
function setupRealtimeValidation() {
  document.getElementById('firstName').addEventListener('blur', () => {
    validateField('firstName', validators.name);
  });
  
  document.getElementById('lastName').addEventListener('blur', () => {
    validateField('lastName', validators.name);
  });
  
  document.getElementById('cedula').addEventListener('blur', () => {
    validateField('cedula', validators.cedula);
  });
  
  document.getElementById('phone').addEventListener('blur', () => {
    validateField('phone', validators.phone);
  });
  
  document.getElementById('email').addEventListener('blur', () => {
    validateField('email', validators.email);
  });
}

// ==================== ANTI-DUPLICATE CHECK ====================
async function checkDuplicateCedula(cedula) {
  try {
    const response = await fetch(`/api/registrations?cedula=${encodeURIComponent(cedula)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return false; // No duplicate
      }
      throw new Error('Error checking duplicates');
    }
    
    const data = await response.json();
    // If we get data array or single object, it means cedula exists
    return Array.isArray(data) ? data.length > 0 : !!data;
  } catch (error) {
    console.error('Error checking duplicate cedula:', error);
    return false; // Continue even if check fails
  }
}

function confirmDuplicateSubmit() {
  closeDuplicateModal();
  submitRegistration(true);
}

// ==================== LOAD LEADER DATA ====================
async function loadLeaderInfo() {
  showLoader();
  
  try {
    if (state.tokenParam) {
      // Validate and load leader by token
      const response = await fetch(`/api/registro/${state.tokenParam}`);
      
      if (!response.ok) {
        let errorMsg = 'Error al validar el token';
        if (response.status === 404) {
          errorMsg = 'Token inválido. Verifica el enlace del QR.';
        } else if (response.status === 403) {
          errorMsg = 'El líder está inactivo. Contacta con el administrador.';
        }
        showErrorScreen(errorMsg);
        hideLoader();
        return false;
      }
      
      state.leaderData = await response.json();
    } else if (state.leaderIdParam) {
      // Fallback: load by leaderId (legacy support, requires manual data)
      state.leaderData = { leaderId: state.leaderIdParam, name: 'Líder' };
    } else {
      showErrorScreen('No se proporcionó token válido. Verifica el enlace del QR.');
      hideLoader();
      return false;
    }
    
    // Display leader info
    const infoDiv = document.getElementById('leader-info');
    document.getElementById('leader-name').textContent = state.leaderData.name || 'Líder del evento';
    infoDiv.classList.remove('hidden');
    
    hideLoader();
    return true;
  } catch (error) {
    console.error('Error loading leader:', error);
    showErrorScreen('Error al conectar con el servidor. Intenta más tarde.');
    hideLoader();
    return false;
  }
}

// ==================== LOAD ACTIVE EVENT ====================
async function loadActiveEvent() {
  try {
    const response = await fetch('/api/events/active');
    
    if (response.ok) {
      state.activeEvent = await response.json();
      const eventName = document.getElementById('event-name');
      if (eventName && state.activeEvent.name) {
        eventName.textContent = `Evento: ${state.activeEvent.name}`;
      }
    }
  } catch (error) {
    console.error('Error loading active event:', error);
    // Not critical, continue anyway
  }
}

// ==================== FORM SUBMISSION ====================
async function submitRegistration(skipDuplicateCheck = false) {
  if (!validateForm()) {
    showToast('Por favor corrige los errores', 'error');
    return;
  }
  
  if (!state.leaderData) {
    showToast('Error: Líder no validado', 'error');
    return;
  }
  
  // Check for duplicate cedula before submitting
  if (!skipDuplicateCheck) {
    const cedula = document.getElementById('cedula').value.trim();
    const isDuplicate = await checkDuplicateCedula(cedula);
    
    if (isDuplicate) {
      openDuplicateModal();
      return;
    }
  }
  
  showLoader();
  
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const cedula = document.getElementById('cedula').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  
  const payload = {
    leaderId: state.leaderData.leaderId,
    eventId: state.activeEvent?.id || state.leaderData.eventId,
    firstName,
    lastName,
    cedula,
    email,
    phone,
    confirmed: false
  };
  
  try {
    const response = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      let errorMsg = 'Error al enviar el registro';
      
      if (response.status === 400) {
        const error = await response.json();
        errorMsg = error.error || 'Datos inválidos';
      } else if (response.status === 500) {
        errorMsg = 'Error del servidor. Intenta más tarde.';
      }
      
      hideLoader();
      showToast(errorMsg, 'error');
      return;
    }
    
    const result = await response.json();
    hideLoader();
    
    showToast('¡Registro enviado exitosamente!', 'success');
    openSuccessModal(result.id || 'N/A');
    
  } catch (error) {
    console.error('Error submitting registration:', error);
    hideLoader();
    showToast('Error de conexión. Intenta nuevamente.', 'error');
  } finally {
    state.isSubmitting = false;
    document.getElementById('submitBtn').disabled = false;
  }
}

// ==================== FORM EVENTS ====================
function setupFormEvents() {
  const form = document.getElementById('publicForm');
  const submitBtn = document.getElementById('submitBtn');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Prevent double submit
    if (state.isSubmitting) {
      return;
    }
    
    state.isSubmitting = true;
    submitBtn.disabled = true;
    
    await submitRegistration();
  });
}

// ==================== MODAL FUNCTIONS (Global) ====================
function registerAnother() {
  closeSuccessModal();
  document.getElementById('publicForm').reset();
  document.getElementById('submitBtn').disabled = false;
  state.isSubmitting = false;
  
  // Clear all field errors
  ['firstName', 'lastName', 'cedula', 'phone', 'email'].forEach(fieldId => {
    clearFieldError(fieldId);
  });
}

function closeForm() {
  window.close();
}

// ==================== INITIALIZATION ====================
async function init() {
  // Setup validation
  setupRealtimeValidation();
  setupFormEvents();
  
  // Load leader and event data
  const leaderLoaded = await loadLeaderInfo();
  if (!leaderLoaded) {
    return; // Error screen already shown
  }
  
  // Load active event (not critical if fails)
  await loadActiveEvent();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
