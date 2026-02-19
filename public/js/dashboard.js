const API_URL = window.location.origin;
// Intentar leer token de sessionStorage primero (más seguro), luego localStorage
let currentToken = sessionStorage.getItem('token') || localStorage.getItem('token');
let currentEventId = sessionStorage.getItem('eventId') || localStorage.getItem('eventId');
let allLeaders = [];
let allRegistrations = [];
let charts = {};

// Paginación separada para cada pestaña
let currentPageBogota = 1;
let currentPageResto = 1;
const itemsPerPage = 5;
let currentTab = 'bogota'; // Track current active tab

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivity';

function touchActivity() {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

function isSessionExpired() {
    const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
    if (!last) return false;
    return Date.now() - last > SESSION_TIMEOUT_MS;
}

function enforceSessionTimeout() {
    if (!currentToken) return false;
    if (isSessionExpired()) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('eventId');
        localStorage.removeItem('username');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('eventId');
        sessionStorage.removeItem('username');
        window.location.href = '/';
        return true;
    }
    return false;
}

function bindSessionActivity() {
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, touchActivity, { passive: true });
    });
}

function getBogotaLocalidades() {
    return ['Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda', 'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'];
}

function showAlert(message, type = 'info') {
    return new Promise(resolve => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const palette = {
            info: { bg: '#667eea', text: 'Informacion' },
            success: { bg: '#28a745', text: 'Listo' },
            warning: { bg: '#f0ad4e', text: 'Atencion' },
            error: { bg: '#dc3545', text: 'Error' }
        };
        const theme = palette[type] || palette.info;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        const card = document.createElement('div');
        card.style.cssText = `background: ${isDarkMode ? '#16213e' : '#ffffff'}; color: ${isDarkMode ? '#e0e0e0' : '#333'}; border-radius: 12px; padding: 24px; width: 92%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'};`;

        const header = document.createElement('div');
        header.style.cssText = `display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-weight: 700; color: ${theme.bg};`;
        header.textContent = theme.text;

        const body = document.createElement('div');
        body.style.cssText = 'font-size: 14px; line-height: 1.5; margin-bottom: 18px;';
        body.textContent = message;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `width: 100%; border: none; border-radius: 8px; padding: 10px; background: ${theme.bg}; color: white; font-weight: 600; cursor: pointer;`;
        btn.textContent = 'Aceptar';
        btn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(btn);
        overlay.appendChild(card);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(true);
            }
        });
        document.body.appendChild(overlay);
    });
}

function showConfirm(message) {
    return new Promise(resolve => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        const card = document.createElement('div');
        card.style.cssText = `background: ${isDarkMode ? '#16213e' : '#ffffff'}; color: ${isDarkMode ? '#e0e0e0' : '#333'}; border-radius: 12px; padding: 24px; width: 92%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'};`;

        const header = document.createElement('div');
        header.style.cssText = 'font-weight: 700; margin-bottom: 12px; color: #667eea;';
        header.textContent = 'Confirmar';

        const body = document.createElement('div');
        body.style.cssText = 'font-size: 14px; line-height: 1.5; margin-bottom: 18px;';
        body.textContent = message;

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 10px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.style.cssText = `flex: 1; border: none; border-radius: 8px; padding: 10px; background: ${isDarkMode ? '#4a5568' : '#6c757d'}; color: white; font-weight: 600; cursor: pointer;`;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.style.cssText = 'flex: 1; border: none; border-radius: 8px; padding: 10px; background: #667eea; color: white; font-weight: 600; cursor: pointer;';
        okBtn.textContent = 'Confirmar';
        okBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(actions);
        overlay.appendChild(card);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
        document.body.appendChild(overlay);
    });
}


function filterLeadersByName(searchTerm) {
    const filtered = searchTerm.trim() === '' ? allLeaders :
        allLeaders.filter(leader => leader.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Create filtered table using existing renderLeadersTable logic
    const html = filtered.map(leader => {
        let passwordStatus = '';
        if (leader.passwordResetRequested) {
            passwordStatus = '<span style="background: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-exclamation-triangle"></i> Reset Solicitado</span>';
        } else if (leader.isTemporaryPassword) {
            passwordStatus = '<span style="background: #cfe2ff; color: #084298; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-clock"></i> Temporal</span>';
        } else if (leader.username) {
            passwordStatus = '<span style="background: #d1e7dd; color: #0f5132; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-lock"></i> Fija</span>';
        } else {
            passwordStatus = '<span style="background: #f8d7da; color: #842029; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-x-circle"></i> Sin configurar</span>';
        }

        return `
        <tr>
            <td><strong>${leader.name}</strong></td>
            <td>${leader.email || '<span style="color:#ccc;">Sin correo</span>'}</td>
            <td>${leader.phone || '-'}</td>
            <td><span style="background: #e8f5e9; padding: 4px 12px; border-radius: 20px; color: #2e7d32; font-weight: 600; display: inline-block;">${leader.registrations || 0}</span></td>
            <td>${passwordStatus}</td>
            <td>
                ${leader.username ?
                `<button class="btn btn-sm btn-outline-info view-credentials-btn" data-leader-id="${leader._id}" data-username="${leader.username}" data-password="${leader.tempPasswordPlaintext || '-'}" title="Ver Credenciales (Usuario y Contraseña)">
                        <i class="bi bi-eye"></i> Ver Credenciales
                    </button>`
                : '<span style="color: #999; font-size: 12px;">Sin usuario</span>'}
            </td>
            <td>
                ${leader.email ?
                `<button class="btn btn-sm btn-outline-primary send-email-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}" data-leader-email="${leader.email}" title="Enviar Correo de Acceso">
                        <i class="bi bi-envelope"></i>
                    </button>`
                : ''}
                <button class="btn btn-sm btn-outline-secondary qr-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}" title="Ver QR">
                    <i class="bi bi-qr-code"></i>
                </button>
                <a href="/form.html?token=${leader.token || leader.leaderId || leader._id}" target="_blank" class="btn btn-sm btn-outline-secondary" title="Ver Formulario">
                    <i class="bi bi-box-arrow-up-right"></i>
                </a>
                <button class="btn btn-sm btn-outline-secondary edit-leader-btn" data-leader-id="${leader._id}" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger generate-pass-btn" data-leader-id="${leader._id}" data-can-generate="${leader.passwordResetRequested ? 'true' : 'false'}" ${leader.passwordResetRequested ? '' : 'disabled'} title="${leader.passwordResetRequested ? 'Generar Nueva Contraseña' : 'Solo disponible si el líder solicita'}" style="${leader.passwordResetRequested ? '' : 'opacity: 0.5; cursor: not-allowed;'}">
                    <i class="bi bi-key"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary delete-leader-btn" data-leader-id="${leader._id}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');

    document.getElementById('leadersTable').innerHTML = html || '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #999;">Sin líderes</td></tr>';

    // Reattach event listeners
    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', () => showQR(btn.dataset.leaderId, btn.dataset.leaderName));
    });
    document.querySelectorAll('.delete-leader-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteLeader(btn.dataset.leaderId));
    });
    document.querySelectorAll('.edit-leader-btn').forEach(btn => {
        btn.addEventListener('click', () => showEditLeader(btn.dataset.leaderId));
    });
    document.querySelectorAll('.generate-pass-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.canGenerate !== 'true') {
                showAlert('Solo puedes generar una nueva contraseña si el líder la solicita.', 'warning');
                return;
            }
            generateNewPassword(btn.dataset.leaderId);
        });
    });
    document.querySelectorAll('.view-credentials-btn').forEach(btn => {
        btn.addEventListener('click', () => showCredentials(btn.dataset.leaderId, btn.dataset.username, btn.dataset.password));
    });
    document.querySelectorAll('.send-email-btn').forEach(btn => {
        btn.addEventListener('click', () => sendAccessEmail(btn.dataset.leaderId, btn.dataset.leaderName, btn.dataset.leaderEmail));
    });
}

async function checkAuth() {
    if (!currentToken) {
        window.location.href = '/';
        return false;
    }
    if (!currentEventId) {
        try {
            const evRes = await apiCall('/api/events');
            const events = await evRes.json();
            const evList = Array.isArray(events) ? events : (events.data || []);
            const active = evList.find(e => e.active) || evList[0];
            if (active) {
                currentEventId = active._id;
                localStorage.setItem('eventId', active._id);
                localStorage.setItem('eventName', active.name);
            }
        } catch (err) {
            console.error('Error cargando eventos:', err);
            // Show critical error
            const body = document.querySelector('body');
            const errDiv = document.createElement('div');
            errDiv.style.cssText = 'position:fixed;top:50px;left:0;width:100%;background:#f59e0b;color:black;text-align:center;padding:10px;z-index:9999;';
            errDiv.textContent = `Error conectando con el servidor: ${err.message}. Verifica que el backend esté corriendo.`;
            body.appendChild(errDiv);
        }
    }
    return true;
}

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
        ...options.headers
    };
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
    if (response.status === 401) {
        console.warn('[API] Token inválido (401). Limpiando sesión.');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('eventId');
        localStorage.removeItem('username');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('eventId');
        sessionStorage.removeItem('username');
        window.location.href = '/';
    }
    return response;
}

async function loadDashboard() {

    // Fix for ID mismatch: sidebarUsername instead of adminUsername
    const userDisplay = document.getElementById('sidebarUsername') || document.getElementById('adminUsername');
    if (userDisplay) {
        userDisplay.textContent = sessionStorage.getItem('username') || localStorage.getItem('username') || 'Admin';
    }

    // Set initial text from storage to avoid "Cargando..." hang if API is slow
    document.getElementById('eventNameDisplay').textContent = sessionStorage.getItem('eventName') || localStorage.getItem('eventName') || 'Evento';

    // Update Event Name in background (non-blocking)
    updateEventNameDisplay();

    try {
        const leadersRes = await apiCall(`/api/leaders${currentEventId ? '?eventId=' + currentEventId : ''}`);
        const leadersData = await leadersRes.json();
        const rawLeaders = Array.isArray(leadersData) ? leadersData : (leadersData.data || []);
        allLeaders = processLeaders(rawLeaders);

        const regsRes = await apiCall(`/api/registrations${currentEventId ? '?eventId=' + currentEventId + '&' : '?'}limit=1000`);
        const regsData = await regsRes.json();
        allRegistrations = Array.isArray(regsData) ? regsData : (regsData.data || []);

        updateStats();
        loadLeadersTable();
        loadRecentRegistrations();
        loadRegistrationsTabbed();
        populateLeaderFilter();
        populateExportLeader();
        populateAnalyticsLeaderFilter();

        // Defer heavy work - charts only render when visible
        chartsLoaded = false;
        analyticsLoaded = false;
        if (document.getElementById('dashboard').classList.contains('active')) {
            requestAnimationFrame(() => { loadCharts(); chartsLoaded = true; });
        }
        updateNotificationsBadge();

    } catch (err) {
        console.error('Error cargando dashboard:', err);
        const debugContainer = document.getElementById('dashboard');
        if (debugContainer) {
            const errorBanner = document.createElement('div');
            errorBanner.style.cssText = 'background: #fee2e2; color: #b91c1c; padding: 15px; margin: 20px; border-radius: 8px; border: 1px solid #f87171;';
            errorBanner.innerHTML = `<strong>Error cargando datos:</strong> ${err.message}<br><small>Verifica la consola.</small>`;
            debugContainer.prepend(errorBanner);
        }
    }
}



async function updateEventNameDisplay() {
    try {
        const eventsRes = await apiCall('/api/events');
        const eventsData = await eventsRes.json();
        const eventsList = Array.isArray(eventsData) ? eventsData : (eventsData.data || []);

        if (currentEventId) {
            const currentEv = eventsList.find(e => e._id === currentEventId);
            if (currentEv) {
                const freshName = currentEv.name;
                document.getElementById('eventNameDisplay').textContent = freshName;
                localStorage.setItem('eventName', freshName);
                sessionStorage.setItem('eventName', freshName);
            }
        } else {
            document.getElementById('eventNameDisplay').textContent = 'Seleccione Evento';
        }
    } catch (e) {
        console.warn('Could not refresh event name:', e);
    }
}

// ====== NOTIFICACIONES ======
async function updateNotificationsBadge() {
    try {
        const leadersWithRequests = allLeaders.filter(l => l.passwordResetRequested);
        const count = leadersWithRequests.length;

        // Actualizar badge en navbar (si existe)
        const badge = document.getElementById('notificationsBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        // Actualizar badge en menú hamburguesa
        const badgeMenu = document.getElementById('notificationsBadgeMenu');
        if (badgeMenu) {
            if (count > 0) {
                badgeMenu.textContent = count;
                badgeMenu.style.display = 'flex';
            } else {
                badgeMenu.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error actualizando notificaciones:', err);
    }
}

async function loadNotifications() {
    try {
        const content = document.getElementById('notificationsContent');
        const leadersWithRequests = allLeaders.filter(l => l.passwordResetRequested);

        if (leadersWithRequests.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #999;">
                    <i class="bi bi-bell-slash" style="font-size: 60px; opacity: 0.3; margin-bottom: 15px;"></i>
                    <p style="font-size: 16px;">No hay solicitudes de restablecimiento</p>
                </div>
            `;
            return;
        }

        const html = leadersWithRequests.map(leader => `
            <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 5px;">
                        <i class="bi bi-person-fill" style="color: #667eea;"></i> ${leader.name}
                    </div>
                    <div style="font-size: 13px; color: #666;">
                        Usuario: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${leader.username || '-'}</code>
                    </div>
                    <div style="font-size: 12px; color: #999; margin-top: 3px;">
                        <i class="bi bi-clock"></i> Solicitud pendiente
                    </div>
                </div>
                <button class="btn btn-sm btn-danger" onclick="generateNewPassword('${leader._id}'); document.getElementById('notificationsModal').classList.remove('active');" style="white-space: nowrap;">
                    <i class="bi bi-key"></i> Generar Contraseña
                </button>
            </div>
        `).join('');

        content.innerHTML = html;
    } catch (err) {
        console.error('Error cargando notificaciones:', err);
        document.getElementById('notificationsContent').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <i class="bi bi-exclamation-circle"></i> Error al cargar notificaciones
            </div>
        `;
    }
}

function updateStats() {
    const confirmed = allRegistrations.filter(r => r.confirmed).length;
    const rate = allRegistrations.length > 0 ? ((confirmed / allRegistrations.length) * 100).toFixed(1) : 0;
    document.getElementById('totalLeaders').textContent = allLeaders.length;
    document.getElementById('totalRegistrations').textContent = allRegistrations.length;
    document.getElementById('confirmedCount').textContent = confirmed;
    document.getElementById('confirmRate').textContent = rate + '%';
}

// processLeaders removed - strict event filtering handles duplicates now
function processLeaders(leaders) { return leaders; }

function loadRecentRegistrations() {
    const recent = allRegistrations.slice(0, 10);
    const html = recent.map(reg => `
        <tr>
            <td><strong>${reg.firstName} ${reg.lastName}</strong></td>
            <td>${reg.email || '-'}</td>
            <td>${reg.cedula || '-'}</td>
            <td>${reg.leaderName || '-'}</td>
            <td>${new Date(reg.date).toLocaleDateString('es-CO')}</td>
            <td><span class="badge ${reg.confirmed ? 'badge-confirmed' : 'badge-pending'}">${reg.confirmed ? '✓ Confirmado' : '⏳ Pendiente'}</span></td>
        </tr>
    `).join('');
    document.getElementById('recentRegistrations').innerHTML = html || '<tr><td colspan="6" class="text-center" style="padding: 40px; color: #999;">Sin registros</td></tr>';
}

function loadLeadersTable() {
    const html = allLeaders.map(leader => {
        // Determinar estado de contraseña
        let passwordStatus = '';
        if (leader.passwordResetRequested) {
            passwordStatus = '<span style="background: #fff3cd; color: #856404; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-exclamation-triangle"></i> Reset Solicitado</span>';
        } else if (leader.isTemporaryPassword) {
            passwordStatus = '<span style="background: #cfe2ff; color: #084298; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-clock"></i> Temporal</span>';
        } else if (leader.username) {
            passwordStatus = '<span style="background: #d1e7dd; color: #0f5132; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-lock"></i> Fija</span>';
        } else {
            passwordStatus = '<span style="background: #f8d7da; color: #842029; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;"><i class="bi bi-x-circle"></i> Sin configurar</span>';
        }

        return `
        <tr>
            <td><strong>${leader.name}</strong></td>
            <td>${leader.email || '<span style="color:#ccc;">Sin correo</span>'}</td>
            <td>${leader.phone || '-'}</td>
            <td><span style="background: #e8f5e9; padding: 4px 12px; border-radius: 20px; color: #2e7d32; font-weight: 600; display: inline-block;">${leader.registrations || 0}</span></td>
            <td>${passwordStatus}</td>
            <td>
                ${leader.username ?
                `<button class="btn btn-sm btn-outline-info view-credentials-btn" data-leader-id="${leader._id}" data-username="${leader.username}" data-password="${leader.tempPasswordPlaintext || '-'}" title="Ver Credenciales (Usuario y Contraseña)">
                        <i class="bi bi-eye"></i> Ver Credenciales
                    </button>`
                : '<span style="color: #999; font-size: 12px;">Sin usuario</span>'}
            </td>
            <td>
                ${leader.email ?
                `<button class="btn btn-sm btn-outline-primary send-email-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}" data-leader-email="${leader.email}" title="Enviar Correo de Acceso">
                        <i class="bi bi-envelope"></i>
                    </button>`
                : ''}
                <button class="btn btn-sm btn-outline-secondary qr-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}" title="Ver QR">
                    <i class="bi bi-qr-code"></i>
                </button>
                <a href="/form.html?token=${leader.token || leader.leaderId || leader._id}" target="_blank" class="btn btn-sm btn-outline-secondary" title="Ver Formulario">
                    <i class="bi bi-box-arrow-up-right"></i>
                </a>
                <button class="btn btn-sm btn-outline-secondary edit-leader-btn" data-leader-id="${leader._id}" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger generate-pass-btn" data-leader-id="${leader._id}" title="Generar Nueva Contraseña">
                    <i class="bi bi-key"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary delete-leader-btn" data-leader-id="${leader._id}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');
    document.getElementById('leadersTable').innerHTML = html || '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #999;">Sin líderes</td></tr>';

    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', () => showQR(btn.dataset.leaderId, btn.dataset.leaderName));
    });
    document.querySelectorAll('.delete-leader-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteLeader(btn.dataset.leaderId));
    });
    document.querySelectorAll('.edit-leader-btn').forEach(btn => {
        btn.addEventListener('click', () => showEditLeader(btn.dataset.leaderId));
    });
    document.querySelectorAll('.generate-pass-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            generateNewPassword(btn.dataset.leaderId);
        });
    });
    document.querySelectorAll('.view-credentials-btn').forEach(btn => {
        btn.addEventListener('click', () => showCredentials(btn.dataset.leaderId, btn.dataset.username, btn.dataset.password));
    });
    document.querySelectorAll('.send-email-btn').forEach(btn => {
        btn.addEventListener('click', () => sendAccessEmail(btn.dataset.leaderId, btn.dataset.leaderName, btn.dataset.leaderEmail));
    });
}

// ====== SEND EMAIL MODAL MANAGEMENT ======
let pendingEmailData = null;

async function sendAccessEmail(leaderId, leaderName, leaderEmail) {
    // Guardar datos para usar después
    pendingEmailData = { leaderId, leaderName, leaderEmail };

    // Mostrar modal
    document.getElementById('sendEmailLeaderName').textContent = leaderName;
    document.getElementById('sendEmailLeaderEmail').textContent = leaderEmail;
    document.getElementById('sendEmailModal').classList.add('active');
}

function closeSendEmailModal() {
    document.getElementById('sendEmailModal').classList.remove('active');
    pendingEmailData = null;
}

async function confirmSendAccessEmail() {
    if (!pendingEmailData) return;

    const { leaderId, leaderName, leaderEmail } = pendingEmailData;
    closeSendEmailModal();

    try {
        showAlert('Enviando correo...', 'info');

        const res = await apiCall(`/api/leaders/${leaderId}/send-access`, {
            method: 'POST'
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Error al enviar correo');
        }

        const result = await res.json();

        // Mostrar modal de resultado detallado según el status
        if (result.success === false && result.fallback) {
            // Es fallback - error SMTP
            showAlert(
                `⚠️ Error SMTP: No se pudo enviar el correo a ${leaderEmail}\n\nDetalles: ${result.error}\n\nVerifica los logs del servidor para más información.`,
                'warning'
            );
        } else if (result.mock) {
            // Es modo mock
            showAlert(
                `📋 Modo Simulado: El correo se simula pero no se envía\n\nDestinatario: ${leaderEmail}\n\nNota: Verifica que EMAIL_USER y EMAIL_PASS estén configurados.`,
                'info'
            );
        } else {
            // Es real - exitoso
            showAlert(`✅ Correo enviado exitosamente a ${leaderEmail}\n\nEl líder recibirá su enlace de registro.`, 'success');
        }

    } catch (error) {
        console.error('Error al enviar correo:', error);
        showAlert(`❌ Error al enviar correo: ${error.message}`, 'error');
    }
}

// ====== RESET PASSWORD MODAL ======
window.generateNewPassword = openResetPassModal;

function openResetPassModal(leaderId) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Líder no encontrado', 'error');

    document.getElementById('resetPassLeaderId').value = leaderId;
    document.getElementById('resetPassLeaderName').value = leader.name;
    document.getElementById('resetPassUsername').value = leader.username || '';

    // Auto-generate temp password
    const tempPass = Math.random().toString(36).slice(-8) + 'Aa1!';
    document.getElementById('resetPassPassword').value = tempPass;

    // Reset result area
    document.getElementById('resetPassResult').style.display = 'none';
    document.getElementById('confirmResetPassBtn').disabled = false;
    document.getElementById('confirmResetPassBtn').style.display = '';
    document.getElementById('confirmResetPassBtn').classList.remove('btn-success');
    document.getElementById('confirmResetPassBtn').classList.add('btn-primary');
    document.getElementById('confirmResetPassBtn').innerHTML = '<i class="bi bi-check-circle"></i> Guardar y Restablecer';

    document.getElementById('resetPasswordModal').classList.add('active');
}

document.getElementById('closeResetPassModal').addEventListener('click', () => {
    document.getElementById('resetPasswordModal').classList.remove('active');
});

document.getElementById('generatePassBtn').addEventListener('click', () => {
    document.getElementById('resetPassPassword').value = Math.random().toString(36).slice(-8) + 'Aa1!';
});

document.getElementById('confirmResetPassBtn').addEventListener('click', async () => {
    const leaderId = document.getElementById('resetPassLeaderId').value;
    const newUsername = document.getElementById('resetPassUsername').value.trim();
    const newPassword = document.getElementById('resetPassPassword').value.trim();
    const btn = document.getElementById('confirmResetPassBtn');

    if (!newPassword || newPassword.length < 6) {
        return showAlert('La contraseña debe tener al menos 6 caracteres', 'warning');
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    try {
        const res = await apiCall('/api/auth/admin-reset-password', {
            method: 'POST',
            body: JSON.stringify({ leaderId, newUsername: newUsername || undefined, newPassword: newPassword || undefined })
        });

        const data = await res.json();

        if (res.ok) {
            // Show result
            document.getElementById('resultUsername').textContent = data._username || newUsername;
            document.getElementById('resultPassword').textContent = data._tempPassword;
            document.getElementById('resetPassResult').style.display = 'block';
            btn.innerHTML = '<i class="bi bi-check-circle"></i> ¡Listo!';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
            loadDashboard(); // Refresh table to show updated username
        } else {
            showAlert('Error: ' + (data.error || 'No se pudo restablecer'), 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-circle"></i> Guardar y Restablecer';
        }
    } catch (err) {
        console.error(err);
        showAlert('Error de conexión', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-circle"></i> Guardar y Restablecer';
    }
});

document.getElementById('copyCredsBtn').addEventListener('click', () => {
    const user = document.getElementById('resultUsername').textContent;
    const pass = document.getElementById('resultPassword').textContent;
    const text = `Usuario: ${user}\nContraseña: ${pass}`;
    navigator.clipboard.writeText(text).then(() => {
        document.getElementById('copyCredsBtn').innerHTML = '<i class="bi bi-check"></i> ¡Copiado!';
        setTimeout(() => {
            document.getElementById('copyCredsBtn').innerHTML = '<i class="bi bi-clipboard"></i> Copiar credenciales';
        }, 2000);
    });
});

// ====== GENERATE NEW PASSWORD ======
async function generateNewPassword(leaderId) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) {
        await showAlert('Líder no encontrado', 'error');
        return;
    }

    // Removed check for passwordResetRequested - Admin can always reset

    let message = `¿Generar nueva contraseña temporal para ${leader.name}?`;
    if (leader.passwordResetRequested) {
        message = `El líder ${leader.name} solicitó un reset de contraseña.\n\n¿Generar nueva contraseña temporal?`;
    } else {
        message = `¿Estás seguro de generar una nueva contraseña para ${leader.name}?\n\nLa contraseña anterior dejará de funcionar.`;
    }

    const confirmed = await showConfirm(message);
    if (!confirmed) return;

    try {
        const res = await apiCall('/api/auth/admin-generate-password', {
            method: 'POST',
            body: JSON.stringify({ leaderId })
        });

        const data = await res.json();

        if (res.ok) {
            // Mostrar contraseña generada en modal
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 12px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                    <h4 style="color: #667eea; margin-bottom: 20px;"><i class="bi bi-key-fill"></i> Nueva Contraseña Generada</h4>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <p style="margin: 5px 0;"><strong>Líder:</strong> ${leader.name}</p>
                        <p style="margin: 5px 0;"><strong>Usuario:</strong> <code>${data.username || leader.username}</code></p>
                        <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> <code style="background: #fff3cd; padding: 4px 8px; border-radius: 4px; font-size: 14px; color: #856404;">${data.tempPassword}</code></p>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                        <i class="bi bi-exclamation-triangle"></i> Guarda esta contraseña. El líder debe cambiarla al iniciar sesión.
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="navigator.clipboard.writeText('Usuario: ${data.username || leader.username}\\nContraseña: ${data.tempPassword}'); this.innerHTML='<i class=\\'bi bi-check\\'></i> ¡Copiado!'; this.style.background='#28a745';" class="btn btn-primary" style="flex: 1;">
                            <i class="bi bi-clipboard"></i> Copiar
                        </button>
                        <button onclick="this.closest('div[style*=\\'position: fixed\\']').remove(); loadDashboard();" class="btn btn-secondary" style="flex: 1;">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.onclick = (e) => { if (e.target === modal) { modal.remove(); loadDashboard(); } };
        } else {
            showAlert('Error: ' + (data.error || 'No se pudo generar contraseña'), 'error');
        }
    } catch (err) {
        console.error(err);
        showAlert('Error al generar contraseña', 'error');
    }
}

// ====== MOSTRAR CREDENCIALES ======
function showCredentials(leaderId, username, password) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Líder no encontrado', 'error');

    const isDarkMode = document.body.classList.contains('dark-mode');
    const bgColor = isDarkMode ? '#16213e' : 'white';
    const textColor = isDarkMode ? '#e0e0e0' : '#333';
    const labelColor = isDarkMode ? '#cbd5e0' : '#555';
    const codeBg = isDarkMode ? '#2d3748' : '#e7f3ff';
    const codeColor = isDarkMode ? '#ffd700' : '#333';
    const btnBg = isDarkMode ? '#4a5568' : '#6c757d';

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
    modal.innerHTML = `
        <div style="background: ${bgColor}; padding: 30px; border-radius: 12px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid ${isDarkMode ? '#2d3748' : '#ddd'};">
            <h4 style="color: #667eea; margin-bottom: 20px;"><i class="bi bi-person-badge"></i> Credenciales del Líder</h4>
            <div style="background: ${isDarkMode ? '#2d3748' : '#f8f9fa'}; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid ${isDarkMode ? '#4a5568' : '#ddd'};">
                <p style="margin: 5px 0; color: ${textColor};"><strong style="color: ${labelColor};">Líder:</strong> ${leader.name}</p>
                <p style="margin: 5px 0; color: ${textColor};"><strong style="color: ${labelColor};">Usuario:</strong> <code style="background: ${codeBg}; color: ${codeColor}; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${username}</code></p>
                <p style="margin: 5px 0; color: ${textColor};"><strong style="color: ${labelColor};">Contraseña Temporal:</strong> <code style="background: ${codeBg}; color: ${codeColor}; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 600;">${password}</code></p>
            </div>
            <p style="color: ${labelColor}; font-size: 13px; margin-bottom: 20px;">
                <i class="bi bi-info-circle"></i> Esta es la última contraseña temporal generada por el administrador.
            </p>
            <div style="display: flex; gap: 10px;">
                <button onclick="navigator.clipboard.writeText('Usuario: ${username}\\nContraseña: ${password}'); this.innerHTML='<i class=\\'bi bi-check\\'></i> ¡Copiado!'; this.style.background='#28a745'; this.style.color='white';" class="btn btn-primary" style="flex: 1; background: #667eea; color: white; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: 600;">
                    <i class="bi bi-clipboard"></i> Copiar
                </button>
                <button onclick="this.closest('div[style*=\\'position: fixed\\']').remove();" class="btn btn-secondary" style="flex: 1; background: ${btnBg}; color: white; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: 600;">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function populateLeaderFilter() {
    const select = document.getElementById('leaderFilter');
    select.innerHTML = '<option value="">-- Todos los Líderes --</option>' +
        allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
}

function populateExportLeader() {
    const select = document.getElementById('exportLeaderSelect');
    select.innerHTML = allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
}

function populateAnalyticsLeaderFilter() {
    const select = document.getElementById('analyticsLeaderFilter');
    if (!select) return;
    select.innerHTML = '<option value="all">Todos los líderes</option>' +
        allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
}

function filterRegistrations() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const leaderId = document.getElementById('leaderFilter').value;
    const status = document.getElementById('statusFilter').value;

    // Filtrar registros por búsqueda, líder y estado
    const filtered = allRegistrations.filter(r => {
        const matchSearch = !search ||
            `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
            (r.email && r.email.toLowerCase().includes(search)) ||
            r.cedula.includes(search);
        const matchLeader = !leaderId || r.leaderId === leaderId;
        const matchStatus = !status || (status === 'confirmed' ? r.confirmed : !r.confirmed);
        return matchSearch && matchLeader && matchStatus;
    });

    // Separar por región
    const bogotaFiltered = filtered.filter(r => isBogotaRegistration(r));
    const restoFiltered = filtered.filter(r => !isBogotaRegistration(r) && r.departamento);

    // Aplicar paginación a Bogotá
    renderRegistrationTable('bogota', bogotaFiltered);

    // Aplicar paginación a Resto del País
    renderRegistrationTable('resto', restoFiltered);
}

function renderRegistrationTable(tab, data) {
    const currentPage = tab === 'bogota' ? currentPageBogota : currentPageResto;
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;

    // Ajustar página si está fuera de rango
    if (currentPage > totalPages) {
        if (tab === 'bogota') currentPageBogota = 1;
        else currentPageResto = 1;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const paginated = data.slice(start, start + itemsPerPage);

    // Renderizar tabla según el tab
    const tableId = tab === 'bogota' ? 'bogotaTable' : 'restoTable';
    const html = paginated.map(reg => `
        <tr>
            <td><strong>${reg.firstName} ${reg.lastName}</strong></td>
            <td>${reg.email || '-'}</td>
            <td>${reg.cedula || '-'}</td>
            <td>${tab === 'bogota' ? (reg.localidad || '-') : (reg.departamento || '-')}</td>
            <td>${reg.leaderName || '-'}</td>
            <td>${new Date(reg.date).toLocaleDateString('es-CO')}</td>
            <td><span class="badge ${reg.confirmed ? 'badge-confirmed' : 'badge-pending'}">${reg.confirmed ? '✓ Confirmado' : '⏳ Pendiente'}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-secondary toggle-confirm-btn" data-reg-id="${reg._id}" data-confirmed="${reg.confirmed}">
                    <i class="bi bi-check-circle"></i>
                </button>
            </td>
        </tr>
    `).join('');

    const emptyMessage = tab === 'bogota'
        ? '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #999;">Sin registros en Bogotá</td></tr>'
        : '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #999;">Sin registros en Resto del País</td></tr>';

    document.getElementById(tableId).innerHTML = html || emptyMessage;

    // Actualizar controles de paginación
    updatePaginationControls(tab, currentPage, totalPages);

    // Agregar event listeners a botones de confirmación
    document.querySelectorAll('.toggle-confirm-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleConfirm(btn.dataset.regId, btn.dataset.confirmed === 'true'));
    });
}

function updatePaginationControls(tab, currentPage, totalPages) {
    const suffix = tab === 'bogota' ? 'Bogota' : 'Resto';
    const pageIndicator = document.getElementById(`pageIndicator${suffix}`);
    const prevPageBtn = document.getElementById(`prevPage${suffix}Btn`);
    const nextPageBtn = document.getElementById(`nextPage${suffix}Btn`);
    const firstPageBtn = document.getElementById(`firstPage${suffix}Btn`);

    if (pageIndicator) pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
    if (firstPageBtn) firstPageBtn.disabled = currentPage === 1;
}

function changePageBogota(direction) {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const leaderId = document.getElementById('leaderFilter').value;
    const status = document.getElementById('statusFilter').value;

    const filtered = allRegistrations.filter(r => {
        const matchSearch = !search ||
            `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
            (r.email && r.email.toLowerCase().includes(search)) ||
            r.cedula.includes(search);
        const matchLeader = !leaderId || r.leaderId === leaderId;
        const matchStatus = !status || (status === 'confirmed' ? r.confirmed : !r.confirmed);
        return matchSearch && matchLeader && matchStatus && isBogotaRegistration(r);
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (direction === 'first') {
        currentPageBogota = 1;
    } else if (direction === 'prev' && currentPageBogota > 1) {
        currentPageBogota--;
    } else if (direction === 'next' && currentPageBogota < totalPages) {
        currentPageBogota++;
    }

    filterRegistrations();
}

function changePageResto(direction) {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const leaderId = document.getElementById('leaderFilter').value;
    const status = document.getElementById('statusFilter').value;

    const filtered = allRegistrations.filter(r => {
        const matchSearch = !search ||
            `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
            (r.email && r.email.toLowerCase().includes(search)) ||
            r.cedula.includes(search);
        const matchLeader = !leaderId || r.leaderId === leaderId;
        const matchStatus = !status || (status === 'confirmed' ? r.confirmed : !r.confirmed);
        return matchSearch && matchLeader && matchStatus && !isBogotaRegistration(r) && r.departamento;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (direction === 'first') {
        currentPageResto = 1;
    } else if (direction === 'prev' && currentPageResto > 1) {
        currentPageResto--;
    } else if (direction === 'next' && currentPageResto < totalPages) {
        currentPageResto++;
    }

    filterRegistrations();
}

async function showQR(leaderId, leaderName) {
    const qrContainer = document.getElementById('qrCode');
    qrContainer.innerHTML = '';

    // Find leader to get token
    const leader = allLeaders.find(l => l._id === leaderId);
    const token = leader ? (leader.token || leader.leaderId || leaderId) : leaderId;

    const link = `${API_URL}/form.html?token=${token}`;
    document.getElementById('qrLink').value = link;
    // Check if new QRCode works directly or needs window
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, { text: link, width: 250, height: 250 });
    } else {
        console.error('QRCode library not loaded');
        qrContainer.textContent = 'Error: QRCode lib not loaded';
    }
    document.getElementById('qrModal').classList.add('active');
}

// Delete Leader Logic

// Delete Leader Logic
// leaderToDeleteId and deleteLeader are defined below with other actions

async function toggleConfirm(regId, isConfirmed) {
    const endpoint = isConfirmed ? `/api/registrations/${regId}/unconfirm` : `/api/registrations/${regId}/confirm`;
    await apiCall(endpoint, { method: 'POST' });
    loadDashboard();
}

function showEditLeader(leaderId) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Líder no encontrado', 'error');

    document.getElementById('editLeaderId').value = leaderId;
    document.getElementById('editLeaderName').value = leader.name;
    document.getElementById('editLeaderEmail').value = leader.email || '';
    document.getElementById('editLeaderPhone').value = leader.phone || '';

    document.getElementById('editLeaderModal').classList.add('active');
}

// Bind Edit Leader Save Button
if (document.getElementById('saveEditLeaderBtn')) {
    document.getElementById('saveEditLeaderBtn').addEventListener('click', async () => {
        const id = document.getElementById('editLeaderId').value;
        const name = document.getElementById('editLeaderName').value;
        const email = document.getElementById('editLeaderEmail').value;
        const phone = document.getElementById('editLeaderPhone').value;

        if (!name) return showAlert('El nombre es obligatorio', 'warning');

        try {
            const res = await apiCall(`/api/leaders/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, phone })
            });

            if (res.ok) {
                document.getElementById('editLeaderModal').classList.remove('active');
                loadDashboard();
                showSuccessModal('¡Actualizado!', 'La información del líder ha sido actualizada.');
            } else {
                const data = await res.json();
                showAlert('Error: ' + (data.error || 'No se pudo actualizar'), 'error');
            }
        } catch (err) {
            console.error(err);
            showAlert('Error de conexión', 'error');
        }
    });
}

function showQR(leaderId, leaderName) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return;

    const token = leader.token || leader.leaderId || leader._id;
    const finalLink = `${window.location.origin}/form.html?token=${token}`;

    document.getElementById('qrCode').innerHTML = '';
    // Check if QRCode lib exists
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCode'), {
            text: finalLink,
            width: 200,
            height: 200
        });
    } else {
        document.getElementById('qrCode').textContent = 'Librería QRCode no cargada.';
    }

    const qrLinkInput = document.getElementById('qrLink');
    if (qrLinkInput) qrLinkInput.value = finalLink;

    document.getElementById('qrModal').classList.add('active');
}

// Close listeners for new modals if not already bound
if (document.getElementById('closeEditLeaderModal')) {
    document.getElementById('closeEditLeaderModal').addEventListener('click', () => {
        document.getElementById('editLeaderModal').classList.remove('active');
    });
}

function loadCharts() {
    // Bogotá vs Resto del País
    const bogotaLocalidades = getBogotaLocalidades();
    const bogotaRegs = allRegistrations.filter(r => bogotaLocalidades.includes(r.localidad));
    // const restoRegs = allRegistrations.filter(r => !bogotaLocalidades.includes(r.localidad));

    // Confirmation Pie Chart (Overall)
    const confirmed = allRegistrations.filter(r => r.confirmed).length;
    const pending = allRegistrations.length - confirmed;

    if (charts.confirmation) charts.confirmation.destroy();
    const ctxConfirm = document.getElementById('confirmationChart').getContext('2d');
    charts.confirmation = new Chart(ctxConfirm, {
        type: 'doughnut',
        data: {
            labels: ['Confirmados', 'Pendientes'],
            datasets: [{
                data: [confirmed, pending],
                backgroundColor: ['#4CAF50', '#FFB74D'],
                borderColor: '#ffffff',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Top 5 Leaders Bar Chart
    const leaderData = allLeaders
        .map(l => ({
            name: l.name,
            count: allRegistrations.filter(r => r.leaderId === l._id).length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    if (charts.topLeaders) charts.topLeaders.destroy();
    const ctxTop = document.getElementById('topLeadersChart').getContext('2d');
    charts.topLeaders = new Chart(ctxTop, {
        type: 'bar',
        data: {
            labels: leaderData.map(l => l.name),
            datasets: [{
                label: 'Registros',
                data: leaderData.map(l => l.count),
                backgroundColor: '#667eea',
                borderRadius: 8,
                hoverBackgroundColor: '#764ba2'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function getAnalyticsFilteredData() {
    const regionSelect = document.getElementById('analyticsRegionFilter');
    const leaderSelect = document.getElementById('analyticsLeaderFilter');
    const region = regionSelect ? regionSelect.value : 'all';
    const leaderId = leaderSelect ? leaderSelect.value : 'all';
    // Use the existing helper or fallback to array check if needed, but isBogotaRegistration is used elsewhere
    const bogotaLocalidades = getBogotaLocalidades();

    let regs = allRegistrations;

    // 1. Filter by Leader first (if selected)
    if (leaderId !== 'all') {
        regs = regs.filter(r => r.leaderId === leaderId);
    }

    // 2. Filter by Region
    // Using isBogotaRegistration ensures consistency with the rest of the app
    if (region === 'bogota') {
        regs = regs.filter(r => isBogotaRegistration(r));
    } else if (region === 'resto') {
        regs = regs.filter(r => !isBogotaRegistration(r)); // Include empty local/dept as resto? Or strict? Code used !includes
    }

    let leaders = allLeaders;
    if (leaderId !== 'all') {
        leaders = leaders.filter(l => l._id === leaderId);
    } else {
        // Optimization: If filtering by region, only show leaders relevant to that region (who have at least 1 reg there)
        // OR show all? User complained "it looks wrong". Usually this means too many 0s.
        if (region !== 'all') {
            const activeLeaderIds = new Set(regs.map(r => r.leaderId));
            // We filter leaders to only those who have activity in this filtered view
            // This makes the "Average" meaningful for the region
            leaders = leaders.filter(l => activeLeaderIds.has(l._id));
        }
    }

    return { regs, leaders, bogotaLocalidades };
}

function loadAnalytics() {
    const { regs, leaders } = getAnalyticsFilteredData(); // bogotaLocalidades not strictly needed here if we use helper

    // Split for totals
    // We should use isBogotaRegistration for consistency
    const bogotaRegs = regs.filter(r => isBogotaRegistration(r));
    const restoRegs = regs.filter(r => !isBogotaRegistration(r));

    const total = regs.length;
    const confirmed = regs.filter(r => r.confirmed).length;
    const rate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0;
    const leadersCount = leaders.length;
    const avgRegs = leadersCount > 0 ? (total / leadersCount).toFixed(1) : 0;

    document.getElementById('avgConfirmRate').textContent = rate + '%';
    document.getElementById('avgRegsPerLeader').textContent = avgRegs;
    document.getElementById('bogotaCount').textContent = bogotaRegs.length;
    document.getElementById('restoCount').textContent = restoRegs.length;

    // Leader Registrations Chart
    const leaderStats = leaders.map(l => ({
        name: l.name.split(' ')[0],
        registros: regs.filter(r => r.leaderId === l._id).length,
        bogota: bogotaRegs.filter(r => r.leaderId === l._id).length,
        resto: restoRegs.filter(r => r.leaderId === l._id).length
    })).sort((a, b) => b.registros - a.registros);

    if (charts.leaderRegs) charts.leaderRegs.destroy();
    const ctxLeaderRegs = document.getElementById('leaderRegistrationsChart').getContext('2d');
    charts.leaderRegs = new Chart(ctxLeaderRegs, {
        type: 'bar',
        data: {
            labels: leaderStats.map(l => l.name),
            datasets: [{
                label: 'Bogotá',
                data: leaderStats.map(l => l.bogota),
                backgroundColor: '#667eea',
                borderRadius: 8
            }, {
                label: 'Resto del País',
                data: leaderStats.map(l => l.resto),
                backgroundColor: '#764ba2',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Locality Chart
    const localityData = {};
    regs.forEach(r => {
        const key = r.localidad || r.departamento || 'Sin dato';
        localityData[key] = (localityData[key] || 0) + 1;
    });

    const topLocalities = Object.entries(localityData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (charts.locality) charts.locality.destroy();
    const ctxLocality = document.getElementById('localityChart').getContext('2d');
    charts.locality = new Chart(ctxLocality, {
        type: 'doughnut',
        data: {
            labels: topLocalities.map(l => l[0]),
            datasets: [{
                data: topLocalities.map(l => l[1]),
                backgroundColor: [
                    '#667eea', '#764ba2', '#FF6B6B', '#4ECDC4', '#45B7D1',
                    '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
                ],
                borderWidth: 2,
                borderColor: 'white'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });

    // Leader Details Table - Prepare Data
    leaderAnalyticsData = leaders.map(l => {
        const leaderRegs = regs.filter(r => r.leaderId === l._id);
        const leaderConfirmed = leaderRegs.filter(r => r.confirmed).length;
        return {
            name: l.name,
            total: leaderRegs.length,
            confirmed: leaderConfirmed,
            pending: leaderRegs.length - leaderConfirmed,
            rate: leaderRegs.length > 0 ? ((leaderConfirmed / leaderRegs.length) * 100).toFixed(1) : 0
        };
    }).sort((a, b) => b.total - a.total);

    // Render first page
    currentAnalyticsPage = 1;
    renderLeaderAnalyticsTable();
}

let leaderAnalyticsData = [];
let currentAnalyticsPage = 1;
const analyticsItemsPerPage = 5;

function renderLeaderAnalyticsTable() {
    const totalPages = Math.ceil(leaderAnalyticsData.length / analyticsItemsPerPage) || 1;

    if (currentAnalyticsPage > totalPages) currentAnalyticsPage = 1;
    if (currentAnalyticsPage < 1) currentAnalyticsPage = 1;

    const start = (currentAnalyticsPage - 1) * analyticsItemsPerPage;
    const end = start + analyticsItemsPerPage;
    const pageData = leaderAnalyticsData.slice(start, end);

    const tableHtml = pageData.map(l => `
        <tr>
            <td><strong>${l.name}</strong></td>
            <td><span style="background: #e3f2fd; padding: 6px 12px; border-radius: 20px; color: #667eea; font-weight: 600;">${l.total}</span></td>
            <td><span style="background: #e8f5e9; padding: 6px 12px; border-radius: 20px; color: #2e7d32; font-weight: 600;">${l.confirmed}</span></td>
            <td><span style="background: #fff3e0; padding: 6px 12px; border-radius: 20px; color: #f57c00; font-weight: 600;">${l.pending}</span></td>
            <td><strong style="color: #667eea;">${l.rate}%</strong></td>
        </tr>
    `).join('');

    document.getElementById('leaderDetailTable').innerHTML = tableHtml || '<tr><td colspan="5" class="text-center text-muted">Sin datos</td></tr>';

    // Update Controls
    document.getElementById('leaderPageIndicator').textContent = `Página ${currentAnalyticsPage} de ${totalPages}`;
    document.getElementById('prevLeaderPageBtn').disabled = currentAnalyticsPage === 1;
    document.getElementById('nextLeaderPageBtn').disabled = currentAnalyticsPage === totalPages;
}

// Analytics Pagination Listeners
document.getElementById('prevLeaderPageBtn').addEventListener('click', () => {
    if (currentAnalyticsPage > 1) {
        currentAnalyticsPage--;
        renderLeaderAnalyticsTable();
    }
});

document.getElementById('nextLeaderPageBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(leaderAnalyticsData.length / analyticsItemsPerPage) || 1;
    if (currentAnalyticsPage < totalPages) {
        currentAnalyticsPage++;
        renderLeaderAnalyticsTable();
    }
});

function exportToExcel(data, filename) {
    if (typeof XLSX === 'undefined') {
        showAlert('Error: Librería Excel (XLSX) no cargada. Recarga la página.', 'error');
        return;
    }
    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Datos');
        XLSX.writeFile(wb, filename);
        showAlert('Archivo descargado correctamente', 'success');
    } catch (e) {
        console.error('Error in exportToExcel:', e);
        showAlert('Error generando Excel: ' + e.message, 'error');
    }
}

let chartsLoaded = false;
let analyticsLoaded = false;
let analyticsFiltersBound = false;

function bindAnalyticsFilters() {
    if (analyticsFiltersBound) return;
    const applyBtn = document.getElementById('applyAnalyticsFilterBtn');
    const clearBtn = document.getElementById('clearAnalyticsFilterBtn');
    const regionSelect = document.getElementById('analyticsRegionFilter');
    const leaderSelect = document.getElementById('analyticsLeaderFilter');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            loadAnalytics();
            analyticsLoaded = true;
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (regionSelect) regionSelect.value = 'all';
            if (leaderSelect) leaderSelect.value = 'all';
            loadAnalytics();
            analyticsLoaded = true;
        });
    }

    analyticsFiltersBound = true;
}

// NAV LINKS
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const section = link.dataset.section;
        // Sidebar styling management
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Main content management
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');

        // Lazy-load heavy sections
        requestAnimationFrame(() => {
            if (section === 'registrations') filterRegistrations();
            if (section === 'dashboard' && !chartsLoaded) { loadCharts(); chartsLoaded = true; }
            if (section === 'analytics') {
                populateAnalyticsLeaderFilter();
                bindAnalyticsFilters();
                if (!analyticsLoaded) { loadAnalytics(); analyticsLoaded = true; }
            }

            // Attach leader search listener
            const leaderSearchInput = document.getElementById('leaderSearchInput');
            if (leaderSearchInput && section === 'leaders' && !leaderSearchInput.hasListener) {
                leaderSearchInput.addEventListener('input', (e) => filterLeadersByName(e.target.value));
                leaderSearchInput.hasListener = true;
            }
        });
    });
});

// ============== HAMBURGER MENU ==============
function toggleHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    const overlay = document.getElementById('hamburgerOverlay');
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
}

function closeHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    const overlay = document.getElementById('hamburgerOverlay');
    menu.classList.remove('active');
    overlay.classList.remove('active');
}

// ============== NOTIFICATIONS SYSTEM ==============
let notifications = [];

function toggleNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    const isActive = dropdown.classList.contains('active');

    // Close help drawer if open
    closeHelpDrawer();

    if (isActive) {
        dropdown.classList.remove('active');
    } else {
        dropdown.classList.add('active');
        // Re-using loadNotifications logic for dropdown content if needed, 
        // but current loadNotifications targets modal. 
        // Adopting simpler logic for now or reusing if structures allow.
        // For now, let's trigger the modal or update dropdown content if we had one.
        // The original code uses a modal for detailed notifications mainly.
    }
}

// ============== CHANGE EVENT LOGIC ==============
const changeEventBtn = document.getElementById('changeEventBtn');
if (changeEventBtn) {
    changeEventBtn.addEventListener('click', async () => {
        document.getElementById('changeEventModal').classList.add('active');
        await loadEventsForModal();
    });
}

const confirmChangeEventBtn = document.getElementById('confirmChangeEventBtn');
if (confirmChangeEventBtn) {
    confirmChangeEventBtn.addEventListener('click', async () => {
        const select = document.getElementById('changeEventSelect');
        const newEventId = select.value;
        if (!newEventId) {
            showAlert('Por favor selecciona un evento', 'warning');
            return;
        }

        const selectedOption = select.options[select.selectedIndex];
        const newEventName = selectedOption.text;

        // Save new event
        localStorage.setItem('eventId', newEventId);
        localStorage.setItem('eventName', newEventName);
        sessionStorage.setItem('eventId', newEventId);
        sessionStorage.setItem('eventName', newEventName);

        // Show success and reload
        const msgDiv = document.getElementById('eventChangeMsg');
        msgDiv.style.display = 'block';
        msgDiv.style.background = '#d1fae5';
        msgDiv.style.color = '#065f46';
        msgDiv.textContent = 'Evento cambiado. Recargando...';

        // Short delay to show feedback
        setTimeout(() => {
            window.location.reload();
        }, 800);
    });
}

async function loadEventsForModal() {
    const select = document.getElementById('changeEventSelect');
    try {
        select.innerHTML = '<option value="">Cargando...</option>';
        const res = await apiCall('/api/events');
        const data = await res.json();
        const events = Array.isArray(data) ? data : (data.data || []);

        if (events.length === 0) {
            select.innerHTML = '<option value="">No hay eventos disponibles</option>';
            return;
        }

        const currentId = currentEventId || localStorage.getItem('eventId');

        select.innerHTML = events.map(e => `
            <option value="${e._id}" ${e._id === currentId ? 'selected' : ''}>
                ${e.name} ${e.active ? '(Activo)' : ''}
            </option>
        `).join('');

    } catch (err) {
        console.error('Error loading events:', err);
        select.innerHTML = '<option value="">Error cargando eventos</option>';
    }
}
function closeNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.classList.remove('active');
}

function markNotificationRead(id) {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        // logic to refresh view
    }
}

// Close notifications dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationsDropdown');
    const btn = document.getElementById('notificationsBtn'); // Verify this ID exists in new layout
    if (dropdown && dropdown.classList.contains('active') && !dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
        closeNotificationsDropdown();
    }
});

// ============== HELP DRAWER ==============
// ... (Keeping helpContent object large, maybe simplify later if needed)
const helpContent = {
    dashboard: {
        title: 'Dashboard General',
        sections: [
            {
                title: 'Visión General',
                content: 'El Dashboard te muestra las métricas más importantes de tus eventos en tiempo real.',
                icon: 'speedometer2'
            },
            {
                title: '¿Qué puedes hacer aquí?',
                content: `
                    <ul>
                        <li>Ver el total de líderes activos y registros</li>
                        <li>Monitorear la tasa de confirmación</li>
                        <li>Analizar gráficos de estado de registros</li>
                        <li>Ver la actividad reciente</li>
                    </ul>
                `,
                icon: 'list-check'
            }
        ]
    },
    leaders: {
        title: 'Gestión de Líderes',
        sections: [{ title: 'Info', content: 'Administra tus líderes aquí.', icon: 'people-fill' }]
    },
    registrations: {
        title: 'Registros',
        sections: [{ title: 'Info', content: 'Visualiza y filtra registros.', icon: 'table' }]
    },
    analytics: {
        title: 'Análisis',
        sections: [{ title: 'Info', content: 'Analiza el rendimiento.', icon: 'bar-chart' }]
    },
    export: {
        title: 'Exportar',
        sections: [{ title: 'Info', content: 'Descarga tus datos.', icon: 'download' }]
    }
};

function toggleHelpDrawer() {
    const drawer = document.getElementById('helpDrawer');
    const overlay = document.getElementById('helpOverlay');
    const isActive = drawer.classList.contains('active');

    closeNotificationsDropdown();

    if (isActive) {
        closeHelpDrawer();
    } else {
        drawer.classList.add('active');
        overlay.classList.add('active');
        updateHelpContent();
    }
}

function closeHelpDrawer() {
    const drawer = document.getElementById('helpDrawer');
    const overlay = document.getElementById('helpOverlay');
    drawer.classList.remove('active');
    overlay.classList.remove('active');
}

function updateHelpContent() {
    const activeSection = document.querySelector('.nav-link.active');
    const sectionKey = activeSection ? activeSection.dataset.section : 'dashboard';
    const content = helpContent[sectionKey] || helpContent.dashboard;
    const body = document.getElementById('helpDrawerBody');

    if (body) {
        body.innerHTML = content.sections.map(section => `
            <div class="help-section">
                <div class="help-section-title"><i class="bi bi-${section.icon}"></i> ${section.title}</div>
                <div class="help-section-content">${section.content}</div>
            </div>
        `).join('');
    }
}

// Update help content when changing sections
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        setTimeout(updateHelpContent, 100);
    });
});

// Initialize notifications on page load
window.addEventListener('DOMContentLoaded', () => {
    // loadNotifications(); // Using simple alert/modal logic usually
    // Ensure badges update
});

// ============== SIDEBAR TOGGLE ==============
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (window.innerWidth <= 768) {
        // Mobile: Toggle active state
        sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    } else {
        // Desktop: Toggle collapsed state
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
    }
}

// Restore sidebar state on page load
(function initSidebarState() {
    if (window.innerWidth > 768) {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
        }
    }

    // Close sidebar on overlay click (mobile)
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
})();

// ============== DARK MODE ==============
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
}

function loadDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        const switchBtn = document.getElementById('darkModeSwitch');
        if (switchBtn) switchBtn.checked = true;
    }
}

loadDarkMode();

// BUTTONS & MODAL TRIGGERS
// Helper to safely add listeners if element exists
function addListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
}

// Listeners for Modal Closing (Keep these if not in HTML)
addListener('closeLeaderModal', 'click', () => document.getElementById('leaderModal').classList.remove('active'));
addListener('closeQrModal', 'click', () => document.getElementById('qrModal').classList.remove('active'));
addListener('closeSuccessModalBtn', 'click', () => {
    const modal = document.getElementById('successModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300); // Wait for transition
});

if (document.getElementById('newLeaderBtn')) {
    document.getElementById('newLeaderBtn').addEventListener('click', () => {
        document.getElementById('leaderModal').classList.add('active');
    });
}

// Show Success Modal Helper
// Show Success Modal Helper
function showSuccessModal(title, message) {
    document.getElementById('successTitle').textContent = title || '¡Éxito!';
    document.getElementById('successMessage').textContent = message || 'Operación completada correctamente.';

    const modal = document.getElementById('successModal');
    modal.style.display = 'flex';
    // Add active class after a brief delay to trigger transition
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function getDeleteLeaderModals() {
    // Defensive: there are duplicated IDs in dashboard.html
    return Array.from(document.querySelectorAll('#deleteConfirmModal'));
}

function closeDeleteLeaderModals() {
    getDeleteLeaderModals().forEach(modal => {
        modal.classList.remove('active');
        // Force-hide to avoid residual overlays blocking clicks
        modal.style.display = 'none';
    });
}

function openDeleteLeaderModal() {
    const modals = getDeleteLeaderModals();
    if (modals.length === 0) return;
    // Prefer the last modal (usually the most recent/visible in DOM)
    const modal = modals[modals.length - 1];
    modal.style.display = '';
    modal.classList.add('active');
}

let deleteLeaderInFlight = false;
async function handleConfirmDeleteLeader() {
    if (!leaderToDeleteId || deleteLeaderInFlight) return;
    deleteLeaderInFlight = true;
    try {
        const res = await apiCall(`/api/leaders/${leaderToDeleteId}`, { method: 'DELETE' });
        if (res.ok) {
            closeDeleteLeaderModals();
            await loadDashboard();
            showSuccessModal('¡Eliminado!', 'El líder ha sido eliminado permanentemente.');
        } else {
            const data = await res.json().catch(() => ({}));
            showAlert('Error: ' + (data.error || 'No se pudo eliminar'), 'error');
            closeDeleteLeaderModals();
        }
    } catch (error) {
        console.error('Error deleting leader:', error);
        showAlert('Error de conexión', 'error');
        closeDeleteLeaderModals();
    } finally {
        deleteLeaderInFlight = false;
        leaderToDeleteId = null;
    }
}

document.querySelectorAll('#cancelDeleteBtn').forEach(btn => {
    btn.addEventListener('click', closeDeleteLeaderModals);
});
document.querySelectorAll('#confirmDeleteBtn').forEach(btn => {
    btn.addEventListener('click', handleConfirmDeleteLeader);
});

// Create Leader
addListener('saveLiderBtn', 'click', async () => {
    const name = document.getElementById('leaderName').value;
    const email = document.getElementById('leaderEmail').value;
    const phone = document.getElementById('leaderPhone').value;
    const customUsername = document.getElementById('leaderUsername').value.trim();
    if (!name) return showAlert('Ingresa el nombre', 'warning');

    try {
        const res = await apiCall('/api/leaders', {
            method: 'POST',
            body: JSON.stringify({ name, email, phone, eventId: currentEventId, customUsername: customUsername || undefined })
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('leaderModal').classList.remove('active');
            document.getElementById('leaderName').value = '';
            document.getElementById('leaderEmail').value = '';
            document.getElementById('leaderPhone').value = '';
            document.getElementById('leaderUsername').value = '';
            loadDashboard();

            // Show credentials in the reset modal (read-only mode)
            if (data._username && data._tempPassword) {
                document.getElementById('resetPassLeaderId').value = '';
                document.getElementById('resetPassLeaderName').value = data.name || name;
                document.getElementById('resetPassUsername').value = data._username;
                document.getElementById('resetPassPassword').value = data._tempPassword;
                document.getElementById('resultUsername').textContent = data._username;
                document.getElementById('resultPassword').textContent = data._tempPassword;
                document.getElementById('resetPassResult').style.display = 'block';
                document.getElementById('confirmResetPassBtn').style.display = 'none';
                document.getElementById('resetPasswordModal').classList.add('active');
            } else {
                showSuccessModal('¡Creado!', 'Líder creado correctamente.');
            }
        } else {
            showAlert('Error: ' + (data.error || 'No se pudo crear el líder'), 'error');
        }
    } catch (error) {
        console.error(error);
        showAlert('Error creando líder', 'error');
    }
});

addListener('copyQrBtn', 'click', () => {
    document.getElementById('qrLink').select();
    document.execCommand('copy');
    showAlert('Link copiado al portapapeles', 'success');
});

// Search listeners
if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPageBogota = 1;
        currentPageResto = 1;
        filterRegistrations();
    });
}
if (document.getElementById('leaderFilter')) {
    document.getElementById('leaderFilter').addEventListener('change', () => {
        currentPageBogota = 1;
        currentPageResto = 1;
        filterRegistrations();
    });
}
if (document.getElementById('statusFilter')) {
    document.getElementById('statusFilter').addEventListener('change', () => {
        currentPageBogota = 1;
        currentPageResto = 1;
        filterRegistrations();
    });
}

// Event listeners para botones de paginación Bogotá
addListener('firstPageBogotaBtn', 'click', () => changePageBogota('first'));
addListener('prevPageBogotaBtn', 'click', () => changePageBogota('prev'));
addListener('nextPageBogotaBtn', 'click', () => changePageBogota('next'));

// Event listeners para botones de paginación Resto
addListener('firstPageRestoBtn', 'click', () => changePageResto('first'));
addListener('prevPageRestoBtn', 'click', () => changePageResto('prev'));
addListener('nextPageRestoBtn', 'click', () => changePageResto('next'));

// EXPORTS
function exportAllRegistrations() {
    const data = allRegistrations.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Localidad: r.localidad || '',
        Líder: r.leaderName || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

addListener('exportRegsBtn', 'click', exportAllRegistrations);
addListener('exportRegsMainBtn', 'click', exportAllRegistrations);

addListener('exportLeadersMainBtn', 'click', () => {
    try {
        console.log('Export Leaders Clicked');
        if (!allLeaders || allLeaders.length === 0) {
            showAlert('No hay líderes para exportar', 'warning');
            return;
        }

        const data = allLeaders.map(l => {
            const count = allRegistrations.filter(r => r.leaderId === l._id).length;
            return {
                Nombre: l.name,
                Email: l.email || '',
                Teléfono: l.phone || '',
                Registros: count,
                Activo: (l.active !== false) ? 'Sí' : 'No'
            };
        });

        console.log('Export Data Prepared:', data);
        exportToExcel(data, `lideres_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
        console.error('Error in exportLeadersMainBtn:', e);
        showAlert('Error al exportar: ' + e.message, 'error');
    }
});

addListener('exportByLeaderBtn', 'click', () => {
    const leaderId = document.getElementById('exportLeaderSelect').value;
    const leader = allLeaders.find(l => l._id === leaderId);
    const filtered = allRegistrations.filter(r => r.leaderId === leaderId);
    const data = filtered.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Localidad: r.localidad || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Teléfono: r.phone || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_${leader.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

addListener('exportLeaderStatsBtn', 'click', () => {
    if (!leaderAnalyticsData || leaderAnalyticsData.length === 0) return showAlert('No hay datos para exportar', 'warning');
    const data = leaderAnalyticsData.map(l => ({
        Líder: l.name,
        Total: l.total,
        Confirmados: l.confirmed,
        Pendientes: l.pending,
        'Tasa de Confirmación': l.rate + '%'
    }));
    exportToExcel(data, `detalles_lideres_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// Update Event
addListener('updateEventBtn', 'click', () => {
    loadDashboard();
    showAlert('Dashboard actualizado', 'success');
});

// Change Event
addListener('changeEventBtn', 'click', async () => {
    try {
        const evRes = await apiCall('/api/events');
        const events = await evRes.json();
        const evList = Array.isArray(events) ? events : (events.data || []);
        const select = document.getElementById('eventSelect');
        select.innerHTML = evList.map(e =>
            `<option value="${e._id}" ${e._id === currentEventId ? 'selected' : ''}>${e.name}${e.active ? ' (Activo)' : ''}</option>`
        ).join('');
        document.getElementById('changeEventModal').classList.add('active');
    } catch (err) {
        showAlert('Error cargando eventos: ' + err.message, 'error');
    }
});
addListener('closeChangeEventModal', 'click', () => document.getElementById('changeEventModal').classList.remove('active'));
addListener('confirmChangeEventBtn', 'click', () => {
    const select = document.getElementById('eventSelect');
    const selectedOption = select.options[select.selectedIndex];
    currentEventId = select.value;
    localStorage.setItem('eventId', currentEventId);
    localStorage.setItem('eventName', selectedOption.textContent.replace(' (Activo)', ''));
    document.getElementById('changeEventModal').classList.remove('active');
    loadDashboard();
});

// Logout
function confirmLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('eventId');
    localStorage.removeItem('username');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('eventId');
    sessionStorage.removeItem('username');
    window.location.href = '/';
}
// Attach to a global or use onclick in HTML, but here we prefer JS attachment if ID exists
// Note: original HTML has onclick="confirmLogout()". We should keep the function global.
window.confirmLogout = confirmLogout;
window.closeLogoutModal = function () { document.getElementById('logoutModal').classList.remove('active'); };

// SEPARACION DE REGISTROS BOGOTA VS RESTO DEL PAIS
const bogotaLocalidades = ['Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda', 'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'];

function isBogotaRegistration(reg) {
    return bogotaLocalidades.includes(reg.localidad);
}

function loadRegistrationsTabbed() {
    filterRegistrations();
}

// Global functions needed for HTML onclick attributes
window.showRegistrationTab = function (tab) {
    currentTab = tab;
    const bogotaTab = document.getElementById('bogotaTab');
    const restoTab = document.getElementById('restoTab');
    const bogotaRegs = document.getElementById('bogotaRegistrations');
    const restoRegs = document.getElementById('restoRegistrations');

    if (tab === 'bogota') {
        bogotaTab.style.background = '#667eea';
        bogotaTab.style.color = 'white';
        bogotaTab.style.borderBottom = '3px solid #667eea';
        restoTab.style.background = 'transparent';
        restoTab.style.color = '#999';
        restoTab.style.borderBottom = 'none';
        bogotaRegs.style.display = 'block';
        restoRegs.style.display = 'none';
    } else {
        restoTab.style.background = '#667eea';
        restoTab.style.color = 'white';
        restoTab.style.borderBottom = '3px solid #667eea';
        bogotaTab.style.background = 'transparent';
        bogotaTab.style.color = '#999';
        bogotaTab.style.borderBottom = 'none';
        bogotaRegs.style.display = 'none';
        restoRegs.style.display = 'block';
    }
};

addListener('exportBogotaBtn', 'click', () => {
    const bogota = allRegistrations.filter(r => bogotaLocalidades.includes(r.localidad));
    const data = bogota.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Localidad: r.localidad || '',
        Líder: r.leaderName || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_bogota_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

addListener('exportRestoBtn', 'click', () => {
    const resto = allRegistrations.filter(r => r.departamento && !r.localidad);
    const data = resto.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Departamento: r.departamento || '',
        Líder: r.leaderName || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_resto_${new Date().toISOString().slice(0, 10)}.xlsx`);
});



// Export Leader Stats
addListener('exportLeaderStatsBtn', 'click', () => {
    if (!leaderAnalyticsData || leaderAnalyticsData.length === 0) {
        // Try to generate on the fly if empty (e.g. analytics tab not visited yet)
        if (allLeaders.length > 0) {
            const { leaders, regs } = getAnalyticsFilteredData();
            leaderAnalyticsData = leaders.map(l => {
                const leaderRegs = regs.filter(r => r.leaderId === l._id);
                const leaderConfirmed = leaderRegs.filter(r => r.confirmed).length;
                return {
                    name: l.name,
                    total: leaderRegs.length,
                    confirmed: leaderConfirmed,
                    pending: leaderRegs.length - leaderConfirmed,
                    rate: leaderRegs.length > 0 ? ((leaderConfirmed / leaderRegs.length) * 100).toFixed(1) : 0
                };
            }).sort((a, b) => b.total - a.total);
        } else {
            return showAlert('No hay datos para exportar', 'warning');
        }
    }

    const data = leaderAnalyticsData.map(l => ({
        Líder: l.name,
        'Total Registros': l.total,
        Confirmados: l.confirmed,
        Pendientes: l.pending,
        'Tasa Confirmación (%)': l.rate + '%'
    }));

    exportToExcel(data, `estadisticas_lideres_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// Populate Export Leader Select
function populateExportLeader() {
    const select = document.getElementById('exportLeaderSelect');
    if (!select) return;

    // Sort leaders by name
    const sorted = [...allLeaders].sort((a, b) => a.name.localeCompare(b.name));

    select.innerHTML = '<option value="">Seleccione un líder...</option>' +
        sorted.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
}

// Export Specific Leader Registrations
addListener('exportByLeaderBtn', 'click', () => {
    const select = document.getElementById('exportLeaderSelect');
    const leaderId = select.value;

    if (!leaderId) return showAlert('Por favor seleccione un líder', 'warning');

    const leaderFn = allLeaders.find(l => l._id === leaderId);
    const leaderName = leaderFn ? leaderFn.name.replace(/ /g, '_') : 'lider';

    const regs = allRegistrations.filter(r => r.leaderId === leaderId);
    if (regs.length === 0) return showAlert('Este líder no tiene registros', 'info');

    const data = regs.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Ubicación: r.localidad || r.departamento || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));

    exportToExcel(data, `registros_${leaderName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// ============== LEADER ACTIONS ==============


let leaderToDeleteId = null;

function deleteLeader(leaderId) {
    leaderToDeleteId = leaderId;
    openDeleteLeaderModal();
}

function showEditLeader(leaderId) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Líder no encontrado', 'error');

    document.getElementById('editLeaderId').value = leaderId;
    document.getElementById('editLeaderName').value = leader.name;
    document.getElementById('editLeaderEmail').value = leader.email || '';
    document.getElementById('editLeaderPhone').value = leader.phone || '';

    // If username exists, maybe show it but usually not editable here or it's complex
    // For now just basic info

    document.getElementById('editLeaderModal').classList.add('active');
}

// Bind Edit Leader Save Button
if (document.getElementById('saveEditLeaderBtn')) {
    document.getElementById('saveEditLeaderBtn').addEventListener('click', async () => {
        const id = document.getElementById('editLeaderId').value;
        const name = document.getElementById('editLeaderName').value;
        const email = document.getElementById('editLeaderEmail').value;
        const phone = document.getElementById('editLeaderPhone').value;

        if (!name) return showAlert('El nombre es obligatorio', 'warning');

        try {
            const res = await apiCall(`/api/leaders/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, phone })
            });

            if (res.ok) {
                document.getElementById('editLeaderModal').classList.remove('active');
                loadDashboard();
                showSuccessModal('¡Actualizado!', 'La información del líder ha sido actualizada.');
            } else {
                const data = await res.json();
                showAlert('Error: ' + (data.error || 'No se pudo actualizar'), 'error');
            }
        } catch (err) {
            console.error(err);
            showAlert('Error de conexión', 'error');
        }
    });
}

function showQR(leaderId, leaderName) {
    const link = `${window.location.origin}/form.html?token=${leaderId}`; // Simple token usage for now
    // Actually find the exact token from leader object if possible, falling back to ID
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return;

    const token = leader.token || leader.leaderId || leader._id;
    const finalLink = `${window.location.origin}/form.html?token=${token}`;

    document.getElementById('qrCode').innerHTML = '';
    // Check if QRCode lib exists
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCode'), {
            text: finalLink,
            width: 200,
            height: 200
        });
    } else {
        document.getElementById('qrCode').textContent = 'Librería QRCode no cargada.';
    }

    const qrLinkInput = document.getElementById('qrLink');
    if (qrLinkInput) qrLinkInput.value = finalLink;

    document.getElementById('qrModal').classList.add('active');
}

// Close listeners for new modals if not already bound
if (document.getElementById('closeEditLeaderModal')) {
    document.getElementById('closeEditLeaderModal').addEventListener('click', () => {
        document.getElementById('editLeaderModal').classList.remove('active');
    });
}

// Initialization
(async function init() {
    console.log('[INIT] Iniciando dashboard. Token:', currentToken ? 'Presente' : 'FALTANTE', 'Event:', currentEventId);
    if (enforceSessionTimeout()) return;
    touchActivity();
    bindSessionActivity();
    const authed = await checkAuth();
    if (authed) {
        console.log('[INIT] Auth exitosa. Cargando dashboard...');
        loadDashboard();
    } else {
        console.error('[INIT] Auth falló. Redirigiendo a login.');
        // If we are here but didn't redirect (maybe loop), show error
        const body = document.querySelector('body');
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:red;color:white;text-align:center;padding:10px;z-index:9999;';
        errDiv.textContent = 'Error de autenticación. Redirigiendo...';
        body.appendChild(errDiv);
    }
})();
// ... CONTINUED replaced by END
