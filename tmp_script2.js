 duplicado ha sido eliminado. -->
<script>
const API_BASE = `${window.location.origin}/api`;
let leaders = [];
let registrations = [];
let activeEventId = localStorage.getItem('activeEventId') || '';
let activeEvent = null;

async function registerPerson() {
  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;

  const leaderToken = localStorage.getItem("publicLeaderToken");
  const resLeader = await fetch("/api/leaders");
  const leaders = await resLeader.json();
  const leader = leaders.find(l => l.token === leaderToken);
  const leaderId = leader ? leader._id : null;

  const res = await fetch("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leaderId, firstName, lastName, email, phone }),
  });

  if (res.ok) {
    alert("âœ… Persona registrada correctamente");
    updateDashboard();
  } else {
    alert("âŒ Error al registrar la persona");
  }
}

// Guardar registro desde el modal del admin
async function saveAdminRegistration() {
    const first = document.getElementById("adminFirstName")?.value.trim() || '';
    const last = document.getElementById("adminLastName")?.value.trim() || '';
    const name = (first + ' ' + last).trim();
    const leaderId = document.getElementById("adminLeaderSelect")?.value;

    if (!name || !leaderId) {
        alert("Por favor completa todos los campos antes de guardar.");
        return;
    }

    const reg = { name, leaderId };

    try {
        const response = await fetch("/api/registrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reg)
        });

        if (response.ok) {
            alert("Registro guardado correctamente âœ…");
            document.getElementById("adminFirstName").value = "";
            document.getElementById("adminLastName").value = "";
            const modal = bootstrap.Modal.getInstance(document.getElementById("adminRegistrationModal"));
            if (modal) modal.hide();
            loadRegistrations(); // refresca la tabla
        } else {
            alert("Hubo un error al guardar el registro.");
        }
    } catch (err) {
        console.error('Error guardando registro admin:', err);
        alert('Hubo un error al guardar el registro.');
    }
}

async function deleteRegistration(id) {
  if (!confirm("¿Eliminar este registro?")) return;
  await fetch(`/api/registrations/${id}`, { method: "DELETE" });
  alert("âœ… Registro eliminado");
  loadRegistrations();
}

function editRegistration(id) {
  alert("âœï¸ Función de edición pendiente â€” aquí puedes abrir un modal con los datos.");
}

// ðŸ”¹ Define primero la función updateDashboard (solicitud del usuario)
async function updateDashboard() {
    try {
        // Obtener líderes y registros
        const leadersUrl = `${API_BASE}/leaders${activeEventId ? '?eventId=' + activeEventId : ''}`;
        const regsUrl = `${API_BASE}/registrations${activeEventId ? '?eventId=' + activeEventId : ''}`;
        const [leadersRes, regsRes] = await Promise.all([
            fetch(leadersUrl),
            fetch(regsUrl),
        ]);
        const leadersData = await leadersRes.json();
        const regs = await regsRes.json();

        // Calcular datos
        const activeLeaders = (leadersData.filter(l => l.active).length) || leadersData.length;
        const totalRegs = regs.length;

        // Actualizar la UI (elementos nuevos)
        const activeEl = document.getElementById('activeLeadersCount');
        if (activeEl) activeEl.innerText = activeLeaders;
        const regsEl = document.getElementById('registrationsCount');
        if (regsEl) regsEl.innerText = totalRegs;
        const msgsEl = document.getElementById('messagesCount');
        if (msgsEl) msgsEl.innerText = 0; // placeholder
    } catch (err) {
        console.error('Error actualizando dashboard:', err);
    }
}

// ===================== ðŸ”¹ Events management =====================
async function loadEvents() {
    try {
        const res = await fetch(`${API_BASE}/events`);
        if (!res.ok) throw new Error('Error cargando eventos');
        const events = await res.json();
        const container = document.getElementById('eventsList');
        if (container) {
            if (events.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay eventos. Crea uno nuevo abajo.</p>';
            } else {
                container.innerHTML = events.map(ev => `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong>${ev.name}</strong>
                            <div><small class="text-muted">${ev.date ? new Date(ev.date).toLocaleDateString() : ''} - ${ev.description || ''}</small></div>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="selectEvent('${ev._id}')">Seleccionar</button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="editEvent('${ev._id}')">Editar</button>
                        </div>
                    </div>
                `).join('');
            }
        }
        return events;
    } catch (err) {
        console.error('Error loadEvents:', err);
        showToast('danger', 'Error cargando eventos');
        return [];
    }
}

async function saveEvent() {
    const name = document.getElementById('eventName').value.trim();
    const date = document.getElementById('eventDate').value || null;
    const description = document.getElementById('eventDescription').value || '';
    if (!name) return showToast('danger', 'El nombre del evento es obligatorio');

    try {
        const res = await fetch(`${API_BASE}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, description })
        });
        if (!res.ok) throw new Error('Error creando evento');
        const ev = await res.json();
        // seleccionar evento creado
        selectEvent(ev._id);
        // cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('eventModal'));
        if (modal) modal.hide();
        showToast('success', 'Evento creado y seleccionado');
    } catch (err) {
        console.error('Error saveEvent:', err);
        showToast('danger', 'Error creando evento');
    }
}

async function selectEvent(eventId) {
    try {
        // cargar evento para mostrar nombre y persistir selección
        const res = await fetch(`${API_BASE}/events`);
        const events = await res.json();
        const ev = events.find(e => String(e._id) === String(eventId));
        if (!ev) return showToast('danger', 'Evento no encontrado');
        activeEventId = ev._id;
        activeEvent = ev;
        localStorage.setItem('activeEventId', activeEventId);
        // cerrar modal si está abierto
        const modalEl = document.getElementById('eventModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        // refrescar datos con el evento seleccionado
        await loadLeaders();
        await loadRegistrations();
        await updateDashboard();
        showToast('success', `Evento seleccionado: ${ev.name}`);
        showSection('dashboard');
    } catch (err) {
        console.error('Error selectEvent:', err);
        showToast('danger', 'Error seleccionando evento');
    }
}

function openEventModal() {
    loadEvents();
    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();
}

function editEvent(id) {
    // placeholder: simple prompt edit
    const name = prompt('Nuevo nombre del evento:');
    if (!name) return;
    fetch(`${API_BASE}/events/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    }).then(() => loadEvents());
}


// ===================== ðŸ”¹ Cargar datos del backend =====================
async function loadLeaders() {
  try {
        const url = `${API_BASE}/leaders${activeEventId ? '?eventId=' + activeEventId : ''}`;
        const res = await fetch(url);
    if (!res.ok) throw new Error('Error cargando líderes');
    leaders = await res.json();
    updateLeadersTable();
    return leaders;
  } catch (error) {
    console.error('Error en loadLeaders:', error);
    showToast('danger', 'Error cargando líderes');
    throw error;
  }

// ===================== ðŸ”¹ Auto-refresh en tiempo real =====================
async function checkForNewRegistrations() {
    try {
        const regsRes = await fetch(`${API_BASE}/registrations`);
        const registrations = await regsRes.json();
        const currentCount = registrations.length;
        
        // Si hay nuevos registros, actualizar automáticamente
        if (currentCount > lastRegistrationCount) {
            lastRegistrationCount = currentCount;
            console.log(`âœ… Nuevo(s) registro(s) detectado(s). Total: ${currentCount}`);
            
            // Actualizar todos los datos
            await loadLeaders();
            await loadRegistrations();
            
            // Actualizar las tablas visibles
            if (document.getElementById('dashboardSection').style.display !== 'none') {
                await updateDashboard();
            }
            
            if (document.getElementById('registrationsSection').style.display !== 'none') {
                updateRegistrationsTable();
            }
            
            if (document.getElementById('analysisSection').style.display !== 'none') {
                await refreshAnalysis();
            }
            
            // Mostrar notificación
            showToast('success', `âœ… Nuevo registro detectado! Total: ${currentCount}`);
        }
    } catch (error) {
        console.error('Error en checkForNewRegistrations:', error);
    }
}

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Verificar cada 5 segundos si hay nuevos registros
    autoRefreshInterval = setInterval(() => {
        checkForNewRegistrations();
    }, 5000);
    
    console.log('ðŸ”„ Auto-refresh iniciado (cada 5 segundos)');
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('â¹ï¸ Auto-refresh detenido');
    }
}

async function loadRegistrations() {
  try {
        const url = `${API_BASE}/registrations${activeEventId ? '?eventId=' + activeEventId : ''}`;
        const res = await fetch(url);
    if (!res.ok) throw new Error('Error cargando registros');
    registrations = await res.json();
    updateRegistrationsTable();
    return registrations;
  } catch (error) {
    console.error('Error en loadRegistrations:', error);
    showToast('danger', 'Error cargando registros');
    throw error;
  }
}

// ===================== ðŸ”¹ Actualizar tablas =====================
function updateLeadersTable() {
  const tbody = document.getElementById('leadersTableBody');
  tbody.innerHTML = leaders.map((leader, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${leader.name}</td>
      <td>${leader.token}</td>
      <td>${leader.registrations || 0}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="showQRCode('${leader._id}')" title="Ver QR">
          <i class="bi bi-qr-code"></i>
        </button>
        <button class="btn btn-sm btn-success" onclick="sendQRToLeader('${leader._id}')" title="Enviar QR">
          <i class="bi bi-send"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning" onclick="editLeader('${leader._id}')">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteLeader('${leader._id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateRegistrationsTable() {
    const tbody = document.getElementById('registrationsTableBody');
    tbody.innerHTML = registrations.map(reg => {
        const nombre = reg.name || ((reg.firstName || '') + ' ' + (reg.lastName || '')).trim() || 'Sin nombre';
        const lider = (leaders.find(l => l._id === reg.leaderId)?.name) || reg.leaderName || 'Sin líder';
        const fecha = reg.date ? new Date(reg.date).toLocaleDateString() : 'Sin fecha';
        const confirmed = reg.confirmed ? true : false;
        const confirmedBy = reg.confirmedBy ? reg.confirmedBy : '';
        const confirmedAt = reg.confirmedAt ? new Date(reg.confirmedAt).toLocaleString('es-CO') : '';

        return `
            <tr>
                <td>${new Date(reg.date).toLocaleDateString("es-CO")}</td>
                <td>${nombre}</td>
                <td>${lider}</td>
                <td>
                    ${confirmed ? `
                        <div>
                            <span class="badge bg-success">Asistió âœ…</span>
                            <br><small>${confirmedBy} - ${confirmedAt}</small>
                        </div>
                    ` : `
                        <div>
                            <span class="badge bg-secondary">No confirmado</span>
                        </div>
                    `}
                </td>
                <td>
                  <button class="btn btn-sm btn-outline-primary" onclick="sendNotification('${reg._id}')" title="Reenviar Notificación">
                    <i class="bi bi-envelope-check"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-success" onclick="confirmRegistration('${reg._id}')" title="Confirmar Asistencia">
                    <i class="bi bi-check2-circle"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-warning" onclick="editRegistration('${reg._id}')">âœï¸</button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteRegistration('${reg._id}')">ðŸ—‘ï¸</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ===================== ðŸ”¹ Funciones de la interfaz =====================
function showSection(section) {
  const sections = ['dashboard', 'leaders', 'registrations', 'exports', 'analysis'];
  sections.forEach(s => {
    const el = document.getElementById(s + 'Section');
    if (el) {
      el.style.display = s === section ? 'block' : 'none';
    }
  });
  
  // Si es la sección de análisis, actualizar datos
  if (section === 'analysis') {
    refreshAnalysis();
  }
  
  // Actualizar el estado de los botones de la barra lateral
  const links = document.querySelectorAll('.sidebar .nav-link');
  links.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('onclick')?.includes(section)) {
      link.classList.add('active');
    }
  });
}

function showPublicForm() {
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('publicForm').style.display = 'block';
}

function showAdminPanel() {
  document.getElementById('publicForm').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'flex';
}

function openAdminRegistration() {
  // Limpiar formulario
  document.getElementById('adminRegistrationForm').reset();
  // Cargar líderes para el selector
  const leaderSelect = document.getElementById('adminLeaderSelect');
  leaderSelect.innerHTML = leaders.map(leader => `
    <option value="${leader._id}">${leader.name}</option>
  `).join('');
  // Mostrar modal
  new bootstrap.Modal(document.getElementById('adminRegistrationModal')).show();
}

// ===================== ðŸ”¹ Funciones de registro y exportación =====================
async function saveLeader() {
  const id = document.getElementById('leaderId').value;
  const name = document.getElementById('leaderName').value;
  const email = document.getElementById('leaderEmail').value;
  const phone = document.getElementById('leaderPhone').value;
  const area = document.getElementById('leaderArea').value;
  const active = document.getElementById('leaderActive').checked;
  
  if (!name || !email || !phone) {
    showToast('danger', 'Por favor complete todos los campos obligatorios');
    return;
  }
  
  const res = await fetch(`${API_BASE}/leaders${id ? '/' + id : ''}`, {
    method: id ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      email,
      phone,
      area,
      active
    })
  });
  
  if (res.ok) {
    showToast('success', 'Líder guardado con éxito');
    loadLeaders();
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('leaderModal'));
    modal.hide();
  } else {
    showToast('danger', 'Error al guardar el líder');
  }
}

async function deleteLeader(id) {
  if (!confirm("¿Eliminar este líder?")) return;

  const res = await fetch(`${API_BASE}/leaders/${id}`, { method: "DELETE" });
  if (res.ok) {
    leaders = leaders.filter(l => l._id !== id);
    updateLeadersTable();
    showToast('success', 'Líder eliminado correctamente');
  } else {
    showToast('danger', 'Error al eliminar líder');
  }
}

async function exportToExcel(type) {
    const url = `${API_BASE}/export/${type}${activeEventId ? '?eventId=' + activeEventId : ''}`;
    const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (res.ok) {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `export_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('success', `Datos exportados a Excel (${type})`);
  } else {
    showToast('danger', 'Error al exportar datos');
  }
}

// ===================== ðŸ”¹ Funciones de formulario público =====================
document.getElementById('registrationForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const leaderToken = localStorage.getItem("publicLeaderToken");
  const resLeader = await fetch("/api/leaders");
  const leaders = await resLeader.json();
  const leader = leaders.find(l => l.token === leaderToken);
  const leaderId = leader ? leader._id : null;
  
  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());
  data.leaderId = leaderId;
  
  const res = await fetch(`${API_BASE}/registrations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (res.ok) {
    showToast('success', 'Registro enviado con éxito');
    this.reset();
  } else {
    showToast('danger', 'Error al enviar el registro');
  }
});

// ===================== ðŸ”¹ Funciones de QR y enlace =====================
function showQRCode(leader) {
    // Acepta tanto el objeto leader como su _id
    if (typeof leader === 'string' || typeof leader === 'number') {
        leader = leaders.find(l => l._id === String(leader));
    }

    if (!leader) {
        showToast('danger', 'No se encontró el líder');
        return;
    }

    const qrContainer = document.getElementById('qrContainer');
    if (!qrContainer) {
        console.error('No se encontró #qrContainer en el DOM');
        return;
    }
    qrContainer.innerHTML = ''; // limpiar el contenedor

    // Generar QR con qrcodejs
    new QRCode(qrContainer, {
        text: `${window.location.origin}/registro/${leader.token}`,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    var titleEl = document.getElementById('qrModalTitle');
    if (titleEl) titleEl.innerText = `QR de ${leader.name}`;

    // Mostrar modal simple
    document.getElementById('qrModal').style.display = 'block';
}

function copyLeaderLink() {
    const leaderLink = document.getElementById('leaderLink');
    if (!leaderLink) {
        showToast('danger', 'No hay enlace para copiar');
        return;
    }
    leaderLink.select();
    leaderLink.setSelectionRange(0, 99999); // Para dispositivos móviles

    document.execCommand("copy");
    showToast('success', 'Enlace copiado al portapapeles');
}

// ===================== ðŸ”¹ Registro público (registerPerson) =====================
async function registerPerson() {
    try {
        // intento de obtener leaderId de URL o variable global
        const urlParams = new URLSearchParams(window.location.search);
        const leaderId = window.currentLeaderId || urlParams.get('leader');
        const firstName = document.getElementById('firstName')?.value || '';
        const lastName = document.getElementById('lastName')?.value || '';
        const email = document.getElementById('email')?.value || '';
        const phone = document.getElementById('phone')?.value || '';

        if (!leaderId) {
            alert('No se encontró un líder asociado para este registro.');
            return;
        }

        const res = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leaderId, firstName, lastName, email, phone })
        });

        if (res.ok) {
            alert('âœ… Persona registrada correctamente');
            updateDashboard();
        } else {
            alert('âŒ Error al registrar la persona');
        }
    } catch (err) {
        console.error('Error registerPerson:', err);
        alert('âŒ Error al registrar la persona');
    }
}

// ===================== ðŸ”¹ Funciones de notificaciones =====================
function showToast(type, message) {
  const toastId = type === 'success' ? 'successToast' : 'errorToast';
  const toastEl = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastEl);
  
  // Actualizar el mensaje
  toastEl.querySelector('.toast-body').textContent = message;
  
  toast.show();
}

async function sendWhatsApp(phone, name) {
    if (!phone) {
        showToast("danger", "Este registro no tiene número de teléfono.");
        return;
    }
    const cleaned = String(phone).replace(/[^0-9+]/g, '');
    const message = encodeURIComponent(`Hola ${name || ''}! âœ… Gracias por registrarte con nosotros.`);
    
    try {
        // Enviar mensaje a través del bot de WhatsApp
        const res = await fetch('http://localhost:4000/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                number: cleaned,
                message: `Hola ${name || ''}! âœ… Gracias por registrarte con nosotros.`
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('success', 'Mensaje de WhatsApp enviado correctamente');
            // Actualizar contador de mensajes
            const msgCount = document.getElementById('messagesCount');
            if (msgCount) msgCount.innerText = (parseInt(msgCount.innerText) || 0) + 1;
        } else {
            showToast('danger', 'Error al enviar mensaje de WhatsApp');
        }
    } catch (err) {
        console.error('Error al enviar WhatsApp:', err);
        showToast('danger', 'Error al conectar con el bot de WhatsApp');
        // Si falla el bot, usar el método de respaldo de abrir WhatsApp web
        window.open(`https://wa.me/${cleaned}?text=${message}`, "_blank");
    }
}

// Enviar notificaciones manualmente para un registro
async function sendNotification(registrationId) {
    try {
        console.log('ðŸ”„ Enviando notificación para registro:', registrationId);
        
        const response = await fetch(`/api/send-notification/${registrationId}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        console.log('ðŸ“¨ Respuesta del servidor:', result);
        
        if (result.success) {
            showToast('success', 'Notificaciones enviadas correctamente');
            if (result.results?.email?.success) {
                console.log('âœ… Email enviado exitosamente');
            } else if (result.results?.email?.error) {
                console.log('âŒ Error en email:', result.results.email.error);
            }
        } else {
            showToast('danger', 'Error enviando notificaciones: ' + (result.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('ðŸ’¥ Error de conexión:', error);
        showToast('danger', 'Error de conexión al servidor');
    }
}

// Detectar si es una vista pública del formulario
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const leaderToken = urlParams.get("leader");

  if (leaderToken) {
    // Ocultar todo el dashboard
    document.getElementById("dashboardSection").style.display = "none";
    document.getElementById("leadersSection").style.display = "none";
    document.getElementById("registrationsSection").style.display = "none";

    // Mostrar solo el formulario
        document.getElementById("publicForm").style.display = "block";

    // Guardar el token para registrar con ese líder
    localStorage.setItem("publicLeaderToken", leaderToken);
  }
});

// ===================== ðŸ”¹ Funciones de Análisis de Datos =====================
// Variables globales para filtrado
let allRegistrationsData = [];
let allLeadersData = [];
let currentFilterLeaderId = '';
let currentSearchTerm = '';
let currentConfirmedFilter = '';
let leadersPerformanceMinimized = false;
let autoRefreshInterval = null;
let lastRegistrationCount = 0;

async function refreshAnalysis() {
    try {
        console.log('Iniciando refreshAnalysis');
        const [leadersData, registrationsData] = await Promise.all([
            loadLeaders(),
            loadRegistrations()
        ]);
        
        // Guardar datos globales para filtrado
        allLeadersData = leadersData;
        allRegistrationsData = registrationsData;
        
        // Llenar selector de líderes
        const leaderSelect = document.getElementById('filterLeaderSelect');
        leaderSelect.innerHTML = '<option value="">-- Todos los Líderes --</option>' + 
            leadersData.map(l => `<option value="${l._id}">${l.name} (${leadersData.filter(ld => ld._id === l._id).length ? leadersData.filter(ld => ld._id === l._id).reduce((acc, li) => acc + (registrationsData.filter(r => r.leaderId === li._id).length), 0) : 0} registros)</option>`).join('');

        // Estadísticas generales
        const totalLeaders = leadersData.length;
        const activeLeaders = leadersData.filter(l => l.active).length;
        const totalRegistrations = registrationsData.length;
        const confirmedRegs = registrationsData.filter(r => r.confirmed).length;
        const confirmationRate = totalRegistrations > 0 ? ((confirmedRegs / totalRegistrations) * 100).toFixed(1) : 0;
        const today = new Date().setHours(0,0,0,0);
        
        const todayRegistrations = registrationsData.filter(r => 
            new Date(r.date).setHours(0,0,0,0) === today
        ).length;

        // Última actividad
        const lastReg = registrationsData.sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        const lastActivity = lastReg ? `${lastReg.firstName || ''} ${lastReg.lastName || ''}`.trim() : '-';
        const lastActivityTime = lastReg ? new Date(lastReg.date).toLocaleString('es-CO') : '-';

        // Actualizar cards
        document.getElementById('totalLeaders').textContent = totalLeaders;
        document.getElementById('activeLeaders').textContent = `${activeLeaders} activos`;
        document.getElementById('totalRegistrations').textContent = totalRegistrations;
        document.getElementById('todayRegistrations').textContent = `${todayRegistrations} hoy`;
        document.getElementById('confirmedCount').textContent = confirmedRegs;
        document.getElementById('confirmationRate').textContent = `${confirmationRate}%`;
        document.getElementById('lastActivity').textContent = lastActivity;
        document.getElementById('lastActivityTime').textContent = lastActivityTime;

        // Actualizar tabla de líderes
        updateLeaderAnalysisList(leadersData, registrationsData);
        
        // Aplicar filtros iniciales
        applyFilters();

        showToast('success', 'Análisis actualizado');
    } catch (error) {
        console.error('Error al actualizar análisis:', error);
        showToast('danger', 'Error al actualizar análisis');
    }
}

function updateLeaderAnalysisList(leaders, registrations, sortBy = 'registrations') {
    const today = new Date().setHours(0,0,0,0);
    const leaderStats = leaders.map(leader => {
        const leaderRegs = registrations.filter(r => r.leaderId === leader._id);
        const confirmedRegs = leaderRegs.filter(r => r.confirmed);
        const lastReg = leaderRegs.length ? 
            new Date(Math.max(...leaderRegs.map(r => new Date(r.date)))) : null;
        
        const confirmationRate = leaderRegs.length > 0 ? 
            ((confirmedRegs.length / leaderRegs.length) * 100).toFixed(1) : 0;
        
        return {
            ...leader,
            registrationCount: leaderRegs.length,
            confirmedCount: confirmedRegs.length,
            confirmationRate: confirmationRate,
            lastRegistration: lastReg,
            registrations: leaderRegs
        };
    });

    if (sortBy === 'registrations') {
        leaderStats.sort((a, b) => b.registrationCount - a.registrationCount);
    } else if (sortBy === 'name') {
        leaderStats.sort((a, b) => a.name.localeCompare(b.name));
    }

    const tbody = document.getElementById('leaderAnalysisList');
    tbody.innerHTML = leaderStats.map(leader => `
        <tr style="cursor: pointer;" onclick="selectLeaderFilter('${leader._id}')">
            <td>
                <strong>${leader.name}</strong>
                <br>
                <small class="text-muted">${leader.email}</small>
            </td>
            <td>
                <span class="badge bg-secondary">${leader.area || 'Sin especificar'}</span>
            </td>
            <td>
                <span class="badge bg-primary">${leader.registrationCount}</span>
            </td>
            <td>
                <span class="badge bg-success">${leader.confirmedCount}</span>
            </td>
            <td>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar bg-success" role="progressbar" 
                         style="width: ${leader.confirmationRate}%"
                         title="${leader.confirmationRate}%">
                        ${leader.confirmationRate}%
                    </div>
                </div>
            </td>
            <td>
                <small class="text-muted">${leader.lastRegistration ? leader.lastRegistration.toLocaleString('es-CO') : 'Sin registros'}</small>
            </td>
            <td>
                <span class="status-badge ${leader.active ? 'status-active' : 'status-inactive'}">
                    ${leader.active ? 'Activo âœ…' : 'Inactivo âŒ'}
                </span>
            </td>
        </tr>
    `).join('');
}

function selectLeaderFilter(leaderId) {
    document.getElementById('filterLeaderSelect').value = leaderId;
    filterByLeader();
}

function filterByLeader() {
    currentFilterLeaderId = document.getElementById('filterLeaderSelect').value;
    currentSearchTerm = '';
    document.getElementById('searchUserName').value = '';
    applyFilters();
}

function filterBySearchTerm() {
    currentSearchTerm = document.getElementById('searchUserName').value.toLowerCase();
    currentFilterLeaderId = '';
    document.getElementById('filterLeaderSelect').value = '';
function filterByConfirmed() {
    currentConfirmedFilter = document.getElementById('filterConfirmedSelect').value;
    applyFilters();
}

function applyFilters() {
    let filtered = [...allRegistrationsData];

    // Filtrar por líder
    if (currentFilterLeaderId) {
        filtered = filtered.filter(r => r.leaderId === currentFilterLeaderId);
    }

    // Filtrar por búsqueda de nombre
    if (currentSearchTerm) {
        filtered = filtered.filter(r => {
            const fullName = `${r.firstName || ''} ${r.lastName || ''}`.toLowerCase();
            return fullName.includes(currentSearchTerm);
        });
    }

    // Filtrar por confirmación
    if (currentConfirmedFilter === 'confirmed') {
        filtered = filtered.filter(r => r.confirmed);
    } else if (currentConfirmedFilter === 'unconfirmed') {
        filtered = filtered.filter(r => !r.confirmed);
    }

    // Ordenar por fecha descendente
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Actualizar título
    let titleText = 'Todos los Registros';
    if (currentFilterLeaderId) {
        const leader = allLeadersData.find(l => l._id === currentFilterLeaderId);
        titleText = `Registros de ${leader?.name || 'Líder'}`;
    } else if (currentSearchTerm) {
        titleText = `Búsqueda: "${currentSearchTerm}"`;
    }
    document.getElementById('selectedLeaderTitle').textContent = titleText;
    document.getElementById('registroCount').textContent = `${filtered.length} registros`;

    // Actualizar tabla
    updateFilteredRegistrationsList(filtered);
}

function updateFilteredRegistrationsList(registrations) {
    const tbody = document.getElementById('filteredRegistrationsList');
    
    if (registrations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                    <p>No hay registros que coincidan con los filtros</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = registrations.map(reg => {
        const confirmed = reg.confirmed ? true : false;
        const confirmedBy = reg.confirmedBy || '';
        const confirmedAt = reg.confirmedAt ? new Date(reg.confirmedAt).toLocaleString('es-CO') : '';
        const fullName = `${reg.firstName || ''} ${reg.lastName || ''}`.trim();

        return `
            <tr>
                <td>${new Date(reg.date).toLocaleString('es-CO')}</td>
                <td>
                    <strong>${fullName}</strong>
                </td>
                <td>
                    <code>${reg.cedula || 'N/A'}</code>
                </td>
                <td>${reg.phone || 'N/A'}</td>
                <td>
                    ${confirmed ? `
                        <span class="badge bg-success">Asistió âœ…</span>
                    ` : `
                        <span class="badge bg-secondary">No confirmado</span>
                    `}
                </td>
                <td>
                    ${confirmedBy ? `
                        <small class="text-success">${confirmedBy}</small>
                        <br>
                        <small class="text-muted">${confirmedAt}</small>
                    ` : `
                        <small class="text-muted">-</small>
                    `}
                </td>
                <td>
                    ${confirmed ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="toggleConfirm('${reg._id}', false)" title="Desconfirmar">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline-success" onclick="confirmRegistration('${reg._id}')" title="Confirmar">
                            <i class="bi bi-check-circle"></i>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

// Función para mostrar detalles de un líder específico
function showLeaderDetails(leaderId) {
    selectLeaderFilter(leaderId);
    const leader = allLeadersData.find(l => l._id === leaderId);
    if (!leader) return;
    showToast('success', `Mostrando registros de ${leader.name}`);
}

// Función para exportar datos de un líder específico
async function exportLeaderData(leaderId) {
    const leader = allLeadersData.find(l => l._id === leaderId);
    const leaderRegs = allRegistrationsData.filter(r => r.leaderId === leaderId);
    
    try {
        // Preparar datos para Excel
        const worksheet = XLSX.utils.json_to_sheet(leaderRegs.map(reg => ({
            'Fecha': new Date(reg.date).toLocaleString('es-CO'),
            'Nombre': `${reg.firstName} ${reg.lastName}`,
            'Cédula': reg.cedula || '',
            'Teléfono': reg.phone || '',
            'Email': reg.email || '',
            'Confirmado': reg.confirmed ? 'Sí' : 'No',
            'Confirmado Por': reg.confirmedBy || '',
            'Confirmado En': reg.confirmedAt ? new Date(reg.confirmedAt).toLocaleString('es-CO') : ''
        })));
        
        // Crear libro de Excel
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
        
        // Guardar archivo
        const filename = `registros_${leader.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(workbook, filename);
        
        showToast('success', 'Datos exportados correctamente');
    } catch (error) {
        console.error('Error exportando datos:', error);
        showToast('danger', 'Error al exportar datos');
    }
}

function sortLeadersList(criteria) {
    updateLeaderAnalysisList(allLeadersData, allRegistrationsData, criteria);
}

function toggleLeadersPerformance() {
    const body = document.getElementById('leadersPerformanceBody');
    const btn = document.getElementById('toggleLeadersBtn');
    
    if (leadersPerformanceMinimized) {
        // Expandir
        body.style.display = 'block';
        btn.innerHTML = '<i class="bi bi-chevron-down"></i>';
        document.getElementById('leadersToolbar').style.display = 'flex';
        leadersPerformanceMinimized = false;
    } else {
        // Minimizar
        body.style.display = 'none';
        btn.innerHTML = '<i class="bi bi-chevron-right"></i>';
        document.getElementById('leadersToolbar').style.display = 'none';
        leadersPerformanceMinimized = true;
    }
}

// Función para inicializar la página
async function initializePage() {
    try {
        // Cargar eventos y si hay un evento activo, cargar datos del mismo
        await loadEvents();
        if (activeEventId) {
            // cargar evento activo desde server
            try {
                const evRes = await fetch(`${API_BASE}/events`);
                const events = await evRes.json();
                activeEvent = events.find(e => String(e._id) === String(activeEventId)) || null;
            } catch (e) {
                console.warn('No se pudo cargar evento activo desde server');
            }
            await loadLeaders();
            await loadRegistrations();
            await updateDashboard();
            showSection('dashboard');
        } else {
            // Pedir al usuario que seleccione o cree un evento
            openEventModal();
        }
    } catch (error) {
        console.error('Error inicializando la página:', error);
        showToast('danger', 'Error cargando los datos iniciales');
    }
}

// Cargar datos iniciales
initializePage();

// Iniciar auto-refresh automático
startAutoRefresh();

// ===================== ðŸ”¹ Click handlers para tarjetas =====================
(function(){
    var activeCard = document.getElementById('activeLeadersCard');
    if (activeCard) activeCard.addEventListener('click', function() {
        document.getElementById('leadersSection').scrollIntoView({ behavior: 'smooth' });
    });

    var regsCard = document.getElementById('registrationsCard');
    if (regsCard) regsCard.addEventListener('click', function() {
        document.getElementById('registrationsSection').scrollIntoView({ behavior: 'smooth' });
    });
})();

// Función para editar líder
async function editLeader(id) {
  const leader = leaders.find(l => l._id === id);
  if (!leader) return;

  const nuevoNombre = prompt("Editar nombre del líder:", leader.name);
  if (!nuevoNombre) return;

  const res = await fetch(`${API_BASE}/leaders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _id: id, name: nuevoNombre, token: leader.token, registrations: leader.registrations })
  });

  const updated = await res.json();
  leaders = leaders.map(l => (l._id === updated._id ? updated : l));
  updateLeadersTable();
  showToast('success', 'Líder actualizado correctamente');
}

async function sendQRToLeader(leaderId) {
    try {
        const leader = leaders.find(l => l._id === leaderId);
        if (!leader) {
            showToast('danger', 'No se encontró el líder');
            return;
        }

        const response = await fetch(`/api/leaders/${leaderId}/send-qr`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            let mensaje = 'QR enviado';
            if (result.whatsappSent) mensaje += ' por WhatsApp';
            if (result.emailSent) mensaje += ' por email';
            showToast('success', mensaje);
        } else {
            showToast('danger', result.error || 'Error al enviar QR');
        }
    } catch (error) {
        console.error('Error enviando QR:', error);
        showToast('danger', 'Error al enviar QR');
    }
}

// Funciones para confirmar/desconfirmar asistencia
async function confirmRegistration(regId) {
    try {
        const reg = allRegistrationsData.find(r => r._id === regId);
        if (!reg) {
            showToast('danger', 'Registro no encontrado');
            return;
        }

        // Pedir quién confirma
        const confirmer = prompt('Nombre de la persona que confirma la asistencia:', 'Admin');
        if (!confirmer) return;

        const res = await fetch(`${API_BASE}/registrations/${regId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmedBy: confirmer })
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.error('Confirm failed', res.status, text);
            showToast('danger', 'Error al confirmar asistencia');
            return;
        }

        await loadRegistrations();
        applyFilters();
        showToast('success', 'Asistencia confirmada');
    } catch (err) {
        console.error('Error confirmando registro:', err);
        showToast('danger', 'Error al confirmar asistencia');
    }
}

async function toggleConfirm(regId, value) {
    try {
        const reg = allRegistrationsData.find(r => r._id === regId);
        if (!reg) {
            showToast('danger', 'Registro no encontrado');
            return;
        }

        if (value) {
            // confirmar
            const confirmer = prompt('Nombre de la persona que confirma la asistencia:', 'Admin');
            if (!confirmer) return;
            
            const res = await fetch(`${API_BASE}/registrations/${regId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmedBy: confirmer })
            });

            if (!res.ok) {
                showToast('danger', 'Error al confirmar asistencia');
                return;
            }
        } else {
            // desconfirmar
            const res = await fetch(`${API_BASE}/registrations/${regId}/unconfirm`, {
                method: 'POST'
            });

            if (!res.ok) {
                showToast('danger', 'Error al desconfirmar asistencia');
                return;
            }
        }

        await loadRegistrations();
        applyFilters();
        showToast('success', value ? 'Confirmado' : 'Desconfirmado');
    } catch (err) {
        console.error('Error toggling confirm:', err);
        showToast('danger', 'Error actualizando confirmación');
    }
}

