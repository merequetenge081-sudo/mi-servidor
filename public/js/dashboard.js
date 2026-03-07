const API_URL = window.location.origin;
// Intentar leer token de sessionStorage primero (más seguro), luego localStorage
let currentToken = sessionStorage.getItem('token') || localStorage.getItem('token');
let currentEventId = sessionStorage.getItem('eventId') || localStorage.getItem('eventId');
if (currentEventId === 'undefined' || currentEventId === 'null' || currentEventId === '') {
    currentEventId = null;
}
let allLeaders = [];
let allRegistrations = [];
let charts = {};
let dashboardMetrics = null;

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
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease-in;';

        const card = document.createElement('div');
        card.style.cssText = `background: ${isDarkMode ? '#1a2a3a' : '#ffffff'}; color: ${isDarkMode ? '#e0e0e0' : '#1f2937'}; border-radius: 16px; padding: 32px; width: 92%; max-width: 520px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 1px solid ${isDarkMode ? '#2d4050' : '#e5e7eb'}; animation: slideUp 0.3s ease-out;`;

        const header = document.createElement('div');
        header.style.cssText = 'font-weight: 700; margin-bottom: 4px; color: #dc2626; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;';
        header.innerHTML = '<i class="bi bi-exclamation-triangle-fill" style="font-size: 18px; margin-right: 8px;"></i>ADVERTENCIA';

        const subtitle = document.createElement('div');
        subtitle.style.cssText = 'font-size: 14px; color: #6b7280; margin-bottom: 20px;';
        subtitle.textContent = 'Por favor, confirma esta acción';

        const body = document.createElement('div');
        body.style.cssText = `font-size: 15px; line-height: 1.7; margin-bottom: 28px; white-space: pre-wrap; word-wrap: break-word; color: ${isDarkMode ? '#cbd5e1' : '#374151'}; background: ${isDarkMode ? '#0f1820' : '#f9fafb'}; padding: 20px; border-radius: 12px; border-left: 4px solid #dc2626;`;
        body.innerHTML = (message || '').replace(/\n/g, '<br>').replace(/⚠️/g, '').trim();

        const actions = document.createElement('div');
        actions.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.style.cssText = `border: 1px solid #d1d5db; border-radius: 10px; padding: 11px 24px; background: ${isDarkMode ? '#2d3d4d' : '#f3f4f6'}; color: ${isDarkMode ? '#e0e0e0' : '#374151'}; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 14px; min-width: 110px;`;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('mouseover', () => {
            cancelBtn.style.background = isDarkMode ? '#3d4d5d' : '#e5e7eb';
            cancelBtn.style.borderColor = isDarkMode ? '#4d5d6d' : '#9ca3af';
        });
        cancelBtn.addEventListener('mouseout', () => {
            cancelBtn.style.background = isDarkMode ? '#2d3d4d' : '#f3f4f6';
            cancelBtn.style.borderColor = '#d1d5db';
        });
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.style.cssText = 'border: none; border-radius: 10px; padding: 11px 28px; background: #dc2626; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 14px; min-width: 110px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);';
        okBtn.textContent = 'Aceptar';
        okBtn.addEventListener('mouseover', () => {
            okBtn.style.background = '#b91c1c';
            okBtn.style.transform = 'translateY(-2px)';
            okBtn.style.boxShadow = '0 8px 16px rgba(220, 38, 38, 0.3)';
        });
        okBtn.addEventListener('mouseout', () => {
            okBtn.style.background = '#dc2626';
            okBtn.style.transform = 'translateY(0)';
            okBtn.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
        });
        okBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        card.appendChild(header);
        card.appendChild(subtitle);
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
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `;
        document.head.appendChild(style);
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
            <td><strong style="color: inherit;">${leader.name}</strong></td>
            <td style="color: inherit;">${leader.email || '<span style="color: #666;">Sin correo</span>'}</td>
            <td style="color: inherit;">${leader.phone || '-'}</td>
            <td><span style="background: #e8f5e9; padding: 4px 12px; border-radius: 20px; color: #2e7d32; font-weight: 600; display: inline-block;">${leader.registrations || 0}</span></td>
            <td>${passwordStatus}</td>
            <td>
                ${leader.username ?
                `<button class="btn btn-sm btn-outline-info view-credentials-btn" data-leader-id="${leader._id}" title="Ver Credenciales (Usuario y Contraseña)" style="color: #1e40af; font-weight: 600;">
                        <i class="bi bi-eye"></i> Ver Credenciales
                    </button>`
                : '<span style="color: #666; font-size: 12px;">Sin usuario</span>'}
            </td>
            <td>
                <div class="action-menu-container">
                    <button class="action-menu-btn" data-leader-id="${leader._id}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <div class="action-menu-dropdown" data-leader-id="${leader._id}">
                        <button class="menu-item menu-scroll menu-scroll-up" data-scroll="up"><i class="bi bi-chevron-up"></i> Subir</button>
                        ${leader.email ? `<button class="menu-item send-email-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}" data-leader-email="${leader.email}"><i class=\"bi bi-envelope\"></i> Enviar Correo</button>` : ''}
                        <button class="menu-item qr-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}"><i class=\"bi bi-qr-code\"></i> Ver QR</button>
                        <a href="/form.html?token=${leader.token || leader.leaderId || leader._id}" target="_blank" class="menu-item" style="text-decoration: none;"><i class=\"bi bi-box-arrow-up-right\"></i> Ver Formulario</a>
                        <button class="menu-item edit-leader-btn" data-leader-id="${leader._id}"><i class=\"bi bi-pencil\"></i> Editar</button>
                        <button class="menu-item gen-pass-btn" data-leader-id="${leader._id}" style="color: #dc2626; font-weight: 600;"><i class=\"bi bi-key\"></i> Generar Contraseña</button>
                        <button class="menu-item delete-leader-btn" data-leader-id="${leader._id}" style="color: #dc2626; font-weight: 600;"><i class=\"bi bi-trash\"></i> Eliminar</button>
                        <button class="menu-item menu-scroll menu-scroll-down" data-scroll="down"><i class="bi bi-chevron-down"></i> Bajar</button>
                    </div>
                </div>
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
        btn.addEventListener('click', () => showCredentials(btn.dataset.leaderId));
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

async function fetchDashboardMetrics(region = 'all', leaderId = null) {
    const params = new URLSearchParams();
    if (currentEventId) params.set('eventId', currentEventId);
    if (region && region !== 'all') params.set('region', region);
    if (leaderId && leaderId !== 'all') params.set('leaderId', leaderId);

    const query = params.toString();
    const endpoint = query ? `/api/v2/analytics/metrics?${query}` : '/api/v2/analytics/metrics';
    const response = await apiCall(endpoint);
    if (!response.ok) {
        throw new Error(`Error obteniendo metrics: ${response.status}`);
    }
    const payload = await response.json();
    if (!payload || !payload.success) {
        throw new Error('Respuesta inválida de metrics');
    }

    dashboardMetrics = payload.data;
    return dashboardMetrics;
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

        const regsRes = await apiCall(`/api/registrations${currentEventId ? '?eventId=' + currentEventId + '&' : '?'}limit=10000`);
        const regsData = await regsRes.json();
        allRegistrations = Array.isArray(regsData) ? regsData : (regsData.data || []);

        await fetchDashboardMetrics();
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
        
        // Cargar deletion requests para el badge de notificaciones
        loadDeletionRequests().then(() => {
            updateNotificationsBadge();
        });

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
function isPendingDeletionRequest(request) {
    const status = (request?.status || 'pending').toString().toLowerCase();
    return status === 'pending';
}

async function updateNotificationsBadge() {
    try {
        const leadersWithRequests = allLeaders.filter(l => l.passwordResetRequested);
        const pendingDeletionRequests = deletionRequests.filter(isPendingDeletionRequest);
        const count = leadersWithRequests.length + pendingDeletionRequests.length;

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
        
        // Actualizar badge de solicitudes de eliminación
        const deletionBadge = document.getElementById('deletionRequestsBadge');
        if (deletionBadge) {
            if (pendingDeletionRequests.length > 0) {
                deletionBadge.textContent = pendingDeletionRequests.length;
                deletionBadge.style.display = 'flex';
            } else {
                deletionBadge.style.display = 'none';
            }
        }
        
        // Actualizar contador en la sección
        const pendingCountElement = document.getElementById('pendingRequestsCount');
        if (pendingCountElement) {
            pendingCountElement.textContent = pendingDeletionRequests.length;
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
        const pendingDeletionRequests = deletionRequests.filter(isPendingDeletionRequest);

        if (leadersWithRequests.length === 0 && pendingDeletionRequests.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-bell-slash"></i>
                    <p>Sin novedades</p>
                </div>
            `;
            return;
        }

        let html = '';

        // Solicitudes de eliminación primero (más urgentes)
        if (pendingDeletionRequests.length > 0) {
            html += pendingDeletionRequests.map(request => {
                const leader = allLeaders.find(l => l._id === request.leaderId);
                const leaderName = leader ? leader.name : 'Líder desconocido';
                return `
                    <div style="padding: 15px; border-bottom: 1px solid #eee; background: #fef3f2;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #dc2626; margin-bottom: 5px;">
                                    <i class="bi bi-trash-fill"></i> Solicitud de Eliminación
                                </div>
                                <div style="font-size: 13px; color: #666; margin-bottom: 3px;">
                                    <i class="bi bi-person-fill"></i> <strong>${leaderName}</strong>
                                </div>
                                <div style="font-size: 13px; color: #666; margin-bottom: 3px;">
                                    <i class="bi bi-file-text"></i> ${request.registrationCount} registros
                                </div>
                                ${request.reason ? `<div style="font-size: 12px; color: #999; font-style: italic; margin-top: 5px;">"${request.reason}"</div>` : ''}
                            </div>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="navigateToSection('deletion-requests'); closeNotificationsDropdown();" style="width: 100%; margin-top: 8px;">
                            <i class="bi bi-eye"></i> Revisar Solicitud
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Solicitudes de restablecimiento de contraseña
        if (leadersWithRequests.length > 0) {
            html += leadersWithRequests.map(leader => `
                <div style="padding: 15px; border-bottom: 1px solid #eee;">
                    <div>
                        <div style="font-weight: 600; color: #333; margin-bottom: 5px;">
                            <i class="bi bi-key-fill" style="color: #667eea;"></i> Restablecimiento de Contraseña
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            <i class="bi bi-person-fill"></i> ${leader.name}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            Usuario: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${leader.username || '-'}</code>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="generateNewPassword('${leader._id}'); closeNotificationsDropdown();" style="width: 100%; margin-top: 8px;">
                        <i class="bi bi-key"></i> Generar Contraseña
                    </button>
                </div>
            `).join('');
        }

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
    const totals = dashboardMetrics?.totals;
    if (!totals) return;

    document.getElementById('totalLeaders').textContent = totals.totalLeaders || 0;
    document.getElementById('totalRegistrations').textContent = totals.totalRegistrations || 0;
    document.getElementById('confirmedCount').textContent = totals.confirmedCount || 0;
    document.getElementById('confirmRate').textContent = `${totals.confirmRate || 0}%`;
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
        console.log('📊 Renderizando líder:', leader.name, '| ID:', leader._id, '| Password status: passwordResetRequested=', leader.passwordResetRequested, 'isTemporaryPassword=', leader.isTemporaryPassword, 'username=', leader.username);
        
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
            <td><strong style="color: inherit;">${leader.name}</strong></td>
            <td style="color: inherit;">${leader.email || '<span style="color: #666;">Sin correo</span>'}</td>
            <td style="color: inherit;">${leader.phone || '-'}</td>
            <td><span style="background: #e8f5e9; padding: 4px 12px; border-radius: 20px; color: #2e7d32; font-weight: 600; display: inline-block;">${leader.registrations || 0}</span></td>
            <td>${passwordStatus}</td>
            <td>
                ${leader.username ?
                `<button class="btn btn-sm btn-outline-info view-credentials-btn" data-leader-id="${leader._id}" title="Ver Credenciales (Usuario y Contraseña)" style="color: #1e40af; font-weight: 600;">
                        <i class="bi bi-eye"></i> Ver Credenciales
                    </button>`
                : '<span style="color: #666; font-size: 12px;">Sin usuario</span>'}
            </td>
            <td>
                <div class="action-menu-container">
                    <button class="action-menu-btn" data-leader-id="${leader._id}">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <div class="action-menu-dropdown" data-leader-id="${leader._id}">
                        <button class="menu-item menu-scroll menu-scroll-up" data-scroll="up"><i class="bi bi-chevron-up"></i> Subir</button>
                        ${leader.email ? `<button class="menu-item send-email-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}" data-leader-email="${leader.email}"><i class=\"bi bi-envelope\"></i> Enviar Correo</button>` : ''}
                        <button class="menu-item qr-btn" data-leader-id="${leader._id}" data-leader-name="${leader.name}"><i class=\"bi bi-qr-code\"></i> Ver QR</button>
                        <a href="/form.html?token=${leader.token || leader.leaderId || leader._id}" target="_blank" class="menu-item" style="text-decoration: none;"><i class=\"bi bi-box-arrow-up-right\"></i> Ver Formulario</a>
                        <button class="menu-item edit-leader-btn" data-leader-id="${leader._id}"><i class=\"bi bi-pencil\"></i> Editar</button>
                        <button class="menu-item gen-pass-btn" data-leader-id="${leader._id}" style="color: #dc2626; font-weight: 600;\"><i class=\"bi bi-key\"></i> Generar Contraseña</button>
                        <button class="menu-item delete-leader-btn" data-leader-id="${leader._id}" style="color: #dc2626; font-weight: 600;\"><i class=\"bi bi-trash\"></i> Eliminar</button>
                        <button class="menu-item menu-scroll menu-scroll-down" data-scroll="down"><i class="bi bi-chevron-down"></i> Bajar</button>
                    </div>
                </div>
            </td>
        </tr>
    `;
    }).join('');
    document.getElementById('leadersTable').innerHTML = html || '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #999;">Sin líderes</td></tr>';

    console.log('✅ Tabla de líderes renderizada. Total líderes:', allLeaders.length);
    console.log('📌 Asignando event listeners...');

    // Action menu toggle
    document.querySelectorAll('.action-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const leaderId = btn.dataset.leaderId;
            const menu = document.querySelector(`.action-menu-dropdown[data-leader-id="${leaderId}"]`);
            const container = btn.closest('.action-menu-container');
            const allMenus = document.querySelectorAll('.action-menu-dropdown');
            allMenus.forEach(m => {
                if (m !== menu) {
                    m.style.display = 'none';
                    m.style.maxHeight = '';
                    m.classList.remove('open-up', 'open-down');
                    const otherContainer = m.closest('.action-menu-container');
                    if (otherContainer) {
                        otherContainer.classList.remove('is-open');
                    }
                }
            });
            const willShow = menu.style.display === 'none' || menu.style.display === '';
            menu.style.display = willShow ? 'block' : 'none';

            if (container) {
                container.classList.toggle('is-open', willShow);
            }

            if (willShow) {
                const scrollContainer = document.querySelector('.main-scrollable-content');
                const containerRect = scrollContainer
                    ? scrollContainer.getBoundingClientRect()
                    : { top: 0, bottom: window.innerHeight };
                const btnRect = btn.getBoundingClientRect();
                const menuHeight = menu.scrollHeight;
                const spaceBelow = containerRect.bottom - btnRect.bottom;
                const spaceAbove = btnRect.top - containerRect.top;
                const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
                const available = Math.max(0, openUp ? spaceAbove : spaceBelow);

                menu.classList.toggle('open-up', openUp);
                menu.classList.toggle('open-down', !openUp);
                if (available > 0) {
                    menu.style.maxHeight = `${Math.max(160, available - 12)}px`;
                } else {
                    menu.style.maxHeight = '';
                }
            }
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-menu-container')) {
            document.querySelectorAll('.action-menu-dropdown').forEach(menu => {
                menu.style.display = 'none';
                menu.style.maxHeight = '';
                menu.classList.remove('open-up', 'open-down');
                const container = menu.closest('.action-menu-container');
                if (container) {
                    container.classList.remove('is-open');
                }
            });
        }
    });

    const scrollContainer = document.querySelector('.main-scrollable-content');
    document.querySelectorAll('.menu-scroll-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (scrollContainer) {
                scrollContainer.scrollBy({ top: -220, behavior: 'smooth' });
            }
        });
    });

    document.querySelectorAll('.menu-scroll-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (scrollContainer) {
                scrollContainer.scrollBy({ top: 220, behavior: 'smooth' });
            }
        });
    });

    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.action-menu-dropdown').forEach(menu => menu.style.display = 'none');
            showQR(btn.dataset.leaderId, btn.dataset.leaderName);
        });
    });
    document.querySelectorAll('.delete-leader-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.action-menu-dropdown').forEach(menu => menu.style.display = 'none');
            deleteLeader(btn.dataset.leaderId);
        });
    });
    document.querySelectorAll('.edit-leader-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.action-menu-dropdown').forEach(menu => menu.style.display = 'none');
            showEditLeader(btn.dataset.leaderId);
        });
    });
    document.querySelectorAll('.gen-pass-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.action-menu-dropdown').forEach(menu => menu.style.display = 'none');
            console.log('🔴 gen-pass-btn clicked for leaderId:', btn.dataset.leaderId);
            e.stopPropagation();
            e.preventDefault();
            generateNewPassword(btn.dataset.leaderId);
        });
    });
    console.log('✅ Event listeners asignados:', document.querySelectorAll('.gen-pass-btn').length, 'botones gen-pass-btn encontrados');
    
    document.querySelectorAll('.view-credentials-btn').forEach(btn => {
        btn.addEventListener('click', () => showCredentials(btn.dataset.leaderId));
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
    
    // Reset checkboxes - verificar que existan antes de acceder
    const welcomeCheck = document.getElementById('dashboard-send-welcome-check');
    const credentialsCheck = document.getElementById('dashboard-send-credentials-check');
    const qrCheck = document.getElementById('dashboard-send-qr-check');
    const warningCheck = document.getElementById('dashboard-send-warning-check');
    
    if (welcomeCheck) welcomeCheck.checked = false;
    if (credentialsCheck) credentialsCheck.checked = false;
    if (qrCheck) qrCheck.checked = true;
    if (warningCheck) warningCheck.checked = false;
    
    // Hide result message
    const resultDiv = document.getElementById('dashboard-send-emails-result');
    if (resultDiv) resultDiv.style.display = 'none';
}

async function confirmSendAccessEmail() {
    if (!pendingEmailData) return;

    const { leaderId, leaderName, leaderEmail } = pendingEmailData;
    
    const sendWelcome = document.getElementById('dashboard-send-welcome-check')?.checked || false;
    const sendCredentials = document.getElementById('dashboard-send-credentials-check')?.checked || false;
    const sendQR = document.getElementById('dashboard-send-qr-check')?.checked || false;
    const sendWarning = document.getElementById('dashboard-send-warning-check')?.checked || false;

    const resultDiv = document.getElementById('dashboard-send-emails-result');
    const sendBtn = document.getElementById('dashboard-send-emails-btn');

    // Validate at least one checkbox
    if (!sendWelcome && !sendCredentials && !sendQR && !sendWarning) {
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#fef3c7';
            resultDiv.style.color = '#92400e';
            resultDiv.style.border = '1px solid #fbbf24';
            resultDiv.textContent = '⚠️ Debes seleccionar al menos un correo';
        }
        return;
    }

    try {
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="bi bi-hourglass-split" style="margin-right: 6px;"></i> Enviando...';
        }
        
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#dbeafe';
            resultDiv.style.color = '#1e40af';
            resultDiv.style.border = '1px solid #3b82f6';
            resultDiv.textContent = '📧 Enviando correos...';
        }

        const res = await apiCall(`/api/leaders/${leaderId}/send-access`, {
            method: 'POST',
            body: JSON.stringify({
                sendWelcomeEmail: sendWelcome,
                sendCredentialsEmail: sendCredentials,
                sendQRCodeEmail: sendQR,
                sendWarningEmail: sendWarning
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Error al enviar correo');
        }

        const result = await res.json();

        // Verificar success===true o que al menos un email fue enviado
        const anyEmailSent = result.emailResults && Object.values(result.emailResults).some(r => r && r.success === true);
        
        if (result.success === true || anyEmailSent) {
            if (resultDiv) {
                resultDiv.style.background = '#d1fae5';
                resultDiv.style.color = '#065f46';
                resultDiv.style.border = '1px solid #10b981';
                resultDiv.textContent = '✅ Correos enviados exitosamente';
            }
            showAlert('Correos enviados correctamente', 'success');
            
            setTimeout(() => {
                closeSendEmailModal();
            }, 2000);
        } else {
            if (resultDiv) {
                resultDiv.style.background = '#fee2e2';
                resultDiv.style.color = '#991b1b';
                resultDiv.style.border = '1px solid #ef4444';
                resultDiv.textContent = `❌ ${result.message || 'Error al enviar correos'}`;
            }
            showAlert(result.message || 'Error al enviar correos', 'error');
        }

    } catch (error) {
        console.error('Error al enviar correo:', error);
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#fee2e2';
            resultDiv.style.color = '#991b1b';
            resultDiv.style.border = '1px solid #ef4444';
            resultDiv.textContent = '❌ Error de conexión';
        }
        showAlert(`❌ Error al enviar correo: ${error.message}`, 'error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="bi bi-send-fill" style="margin-right: 6px;"></i> Enviar';
        }
    }
}

// ====== RESET PASSWORD MODAL ======
async function openResetPassModal(leaderId) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Líder no encontrado', 'error');

    // ⚠️ VERIFICAR SI CONTRASEÑA ESTÁ FIJA y mostrar advertencia bonita
    const isPasswordFixed = !leader.isTemporaryPassword && !leader.passwordResetRequested && leader.username;
    
    if (isPasswordFixed) {
        const proceed = await showConfirm(
            '⚠️ ADVERTENCIA IMPORTANTE\n\n' +
            leader.name + ' ya cuenta con una contraseña FIJA.\n\n' +
            '¿Está SEGURO de generar una NUEVA contraseña temporal?\n\n' +
            'Esto SOBRESCRIBIRÁ su contraseña actual.'
        );
        
        if (!proceed) {
            return; // Usuario canceló
        }
    }

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

// Asignar la función a generateNewPassword para compatibilidad
window.generateNewPassword = openResetPassModal;

document.getElementById('closeResetPassModal').addEventListener('click', () => {
    document.getElementById('resetPasswordModal').classList.remove('active');
});

document.getElementById('generatePassBtn').addEventListener('click', () => {
    document.getElementById('resetPassPassword').value = Math.random().toString(36).slice(-8) + 'Aa1!';
});

    function validatePassword(password) {
        const errors = [];
        if (password.length < 8) errors.push('mínimo 8 caracteres');
        if (!/[A-Z]/.test(password)) errors.push('una mayúscula');
        if (!/[a-z]/.test(password)) errors.push('una minúscula');
        if (!/[0-9]/.test(password)) errors.push('un número');
        return { isValid: errors.length === 0, errors };
    }

document.getElementById('confirmResetPassBtn').addEventListener('click', async () => {
    const leaderId = document.getElementById('resetPassLeaderId').value;
    const newUsername = document.getElementById('resetPassUsername').value.trim();
    const newPassword = document.getElementById('resetPassPassword').value.trim();
    const btn = document.getElementById('confirmResetPassBtn');

    const validation = validatePassword(newPassword);
    if (!newPassword || !validation.isValid) {
        return showAlert(`La contraseña debe tener: ${validation.errors.join(', ')}`, 'warning');
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

// ====== MOSTRAR CREDENCIALES ======
async function showCredentials(leaderId) {
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Líder no encontrado', 'error');

    const isDarkMode = document.body.classList.contains('dark-mode');
    const bgColor = isDarkMode ? '#16213e' : 'white';
    const textColor = isDarkMode ? '#e0e0e0' : '#333';
    const labelColor = isDarkMode ? '#cbd5e0' : '#555';
    const codeBg = isDarkMode ? '#2d3748' : '#e7f3ff';
    const codeColor = isDarkMode ? '#ffd700' : '#333';
    const btnBg = isDarkMode ? '#4a5568' : '#6c757d';

    try {
        const res = await apiCall(`/api/leaders/${leaderId}/credentials`);
        
        if (!res.ok) {
            const errorData = await res.json();
            return showAlert(errorData.error || 'Error al obtener credenciales', 'error');
        }
        
        const data = await res.json();

        if (!data.hasCredentials) {
            return showAlert('Este líder no tiene credenciales configuradas', 'warning');
        }

        const username = data.username;
        const password = data.tempPassword || 'No disponible';
        const passwordFixed = data.passwordFixed;
        const message = data.message;

        let passwordSection = '';
        let infoText = '';
        let copyBtn = '';

        if (passwordFixed) {
            passwordSection = `<p style="margin: 5px 0; color: #f59e0b; font-size: 14px; margin-top: 10px;"><i class="bi bi-exclamation-triangle"></i> ${message}</p>`;
            infoText = '';
            copyBtn = `<button onclick="navigator.clipboard.writeText('Usuario: ${username}'); this.innerHTML='<i class=\\'bi bi-check\\'></i> ¡Copiado!'; this.style.background='#28a745'; this.style.color='white';" class="btn btn-primary" style="flex: 1; background: #667eea; color: white; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: 600;">
                <i class="bi bi-clipboard"></i> Copiar Usuario
            </button>`;
        } else {
            passwordSection = `<p style="margin: 5px 0; color: ${textColor};"><strong style="color: ${labelColor};">Contraseña Temporal:</strong> <code style="background: ${codeBg}; color: ${codeColor}; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 600;">${password}</code></p>`;
            infoText = `<p style="color: ${labelColor}; font-size: 13px; margin-bottom: 20px;">
                <i class="bi bi-info-circle"></i> Esta es la última contraseña temporal generada por el administrador.
            </p>`;
            copyBtn = `<button onclick="navigator.clipboard.writeText('Usuario: ${username}\\nContraseña: ${password}'); this.innerHTML='<i class=\\'bi bi-check\\'></i> ¡Copiado!'; this.style.background='#28a745'; this.style.color='white';" class="btn btn-primary" style="flex: 1; background: #667eea; color: white; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: 600;">
                <i class="bi bi-clipboard"></i> Copiar
            </button>`;
        }

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        modal.innerHTML = `
            <div style="background: ${bgColor}; padding: 30px; border-radius: 12px; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid ${isDarkMode ? '#2d3748' : '#ddd'};">
                <h4 style="color: #667eea; margin-bottom: 20px;"><i class="bi bi-person-badge"></i> Credenciales del Líder</h4>
                <div style="background: ${isDarkMode ? '#2d3748' : '#f8f9fa'}; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid ${isDarkMode ? '#4a5568' : '#ddd'};">
                    <p style="margin: 5px 0; color: ${textColor};"><strong style="color: ${labelColor};">Líder:</strong> ${leader.name}</p>
                    <p style="margin: 5px 0; color: ${textColor};"><strong style="color: ${labelColor};">Usuario:</strong> <code style="background: ${codeBg}; color: ${codeColor}; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${username}</code></p>
                    ${passwordSection}
                </div>
                ${infoText}
                <div style="display: flex; gap: 10px;">
                    ${copyBtn}
                    <button onclick="this.closest('div[style*=\\'position: fixed\\']').remove();" class="btn btn-secondary" style="flex: 1; background: ${btnBg}; color: white; border: none; border-radius: 6px; padding: 8px; cursor: pointer; font-weight: 600;">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    } catch (err) {
        console.error(err);
        showAlert('Error al obtener credenciales', 'error');
    }
}

function populateLeaderFilter() {
    const select = document.getElementById('leaderFilter');
    select.innerHTML = '<option value="">-- Todos los Líderes --</option>' +
        allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
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
    const revision = document.getElementById('revisionFilter')?.value || '';

    // Filtrar registros por búsqueda, líder, estado y revisión
    const filtered = allRegistrations.filter(r => {
        const matchSearch = !search ||
            `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
            (r.email && r.email.toLowerCase().includes(search)) ||
            r.cedula.includes(search);
        const matchLeader = !leaderId || r.leaderId === leaderId;
        const matchStatus = !status || (status === 'confirmed' ? r.confirmed : !r.confirmed);
        const matchRevision = !revision || (revision === 'true' ? (r.requiereRevisionPuesto && !r.revisionPuestoResuelta) : !(r.requiereRevisionPuesto && !r.revisionPuestoResuelta));
        return matchSearch && matchLeader && matchStatus && matchRevision;
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
    const html = paginated.map(reg => {
        const requiereRevision = reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta;
        const puestoDisplay = reg.votingPlace || (reg.puestoId?.nombre || '-');
        return `
        <tr>
            <td><strong>${reg.firstName} ${reg.lastName}</strong></td>
            <td>${reg.email || '-'}</td>
            <td>${reg.cedula || '-'}</td>
            <td>${tab === 'bogota' ? (reg.localidad || '-') : (reg.departamento || '-')}</td>
            <td>${puestoDisplay}${requiereRevision ? ' <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.75rem; padding: 2px 8px;">⚠ Revisar</span>' : ''}</td>
            <td>${reg.leaderName || '-'}</td>
            <td>${new Date(reg.date).toLocaleDateString('es-CO')}</td>
            <td><span class="badge ${reg.confirmed ? 'badge-confirmed' : 'badge-pending'}">${reg.confirmed ? '✓ Confirmado' : '⏳ Pendiente'}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-secondary toggle-confirm-btn" data-reg-id="${reg._id}" data-confirmed="${reg.confirmed}">
                    <i class="bi bi-check-circle"></i>
                </button>
            </td>
        </tr>
    `;
    }).join('');

    const emptyMessage = tab === 'bogota'
        ? '<tr><td colspan="9" class="text-center" style="padding: 40px; color: #999;">Sin registros en Bogotá</td></tr>'
        : '<tr><td colspan="9" class="text-center" style="padding: 40px; color: #999;">Sin registros en Resto del País</td></tr>';

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
    return { region, leaderId };
}

async function loadAnalytics() {
    try {
        const { region, leaderId } = getAnalyticsFilteredData();
        const metrics = await fetchDashboardMetrics(region, leaderId);
        const totals = metrics?.totals;
        if (!totals) return;

        document.getElementById('avgConfirmRate').textContent = `${totals.confirmRate || 0}%`;
        document.getElementById('avgRegsPerLeader').textContent = totals.avgRegsPerLeader || 0;
        document.getElementById('bogotaCount').textContent = totals.bogotaCount || 0;
        document.getElementById('restoCount').textContent = totals.restoCount || 0;

        // Leader Registrations Chart
        const leaderStats = (metrics.leaders || [])
            .map(l => ({
                name: (l.name || 'Sin lider').split(' ')[0],
                registros: l.total,
                bogota: l.bogota,
                resto: l.resto
            }))
            .sort((a, b) => b.registros - a.registros)
            .slice(0, 10);

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
        const topLocalities = (metrics.locality || []).slice(0, 10);

        if (charts.locality) charts.locality.destroy();
        const ctxLocality = document.getElementById('localityChart').getContext('2d');
        charts.locality = new Chart(ctxLocality, {
            type: 'doughnut',
            data: {
                labels: topLocalities.map(l => l.name),
                datasets: [{
                    data: topLocalities.map(l => l.count),
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
        leaderAnalyticsData = (metrics.leaders || []).map(l => ({
            name: l.name,
            total: l.total,
            confirmed: l.confirmed,
            pending: l.pending,
            rate: l.rate
        }));

        // Render first page
        currentAnalyticsPage = 1;
        renderLeaderAnalyticsTable();
    } catch (err) {
        console.error('Error cargando analytics:', err);
        showAlert('Error cargando analíticas. Intenta de nuevo.', 'error');
    }
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

function exportToExcel(data, filename, title = 'Reporte') {
    if (typeof XLSX === 'undefined') {
        showAlert('Error: Librería Excel (XLSX) no cargada. Recarga la página.', 'error');
        return;
    }
    try {
        if (!data || data.length === 0) {
            showAlert('No hay datos para exportar.', 'warning');
            return;
        }

        const headers = Object.keys(data[0] || {});
        
        // Crear matriz con título, espacio en blanco encabezados y datos
        const wsData = [
            [title],
            [],
            headers
        ];

        data.forEach(item => {
            const rowData = headers.map(key => {
                const val = item[key];
                return val !== null && val !== undefined ? String(val) : '';
            });
            wsData.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Combinar celdas para el título y centrar
        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, headers.length - 1) } });

        // Dar formato simple (negrita) asumiendo compatibilidad (Style options in basic js-xlsx might be ignored but won't crash)
        if(!ws['A1'].s) ws['A1'].s = {};
        ws['A1'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };

        // Ajustar ancho de las columnas
        const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
        data.forEach(row => {
            headers.forEach((header, i) => {
                const val = String(row[header] || '');
                if (val.length > colWidths[i].wch) {
                    colWidths[i].wch = Math.min(val.length + 2, 50); // Límite de 50 caracteres
                }
            });
        });
        ws['!cols'] = colWidths;

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

// ============== SPA ROUTING (History API) ==============
function navigateToSection(section, updateHistory = true) {
    if (!section) section = 'dashboard';
    
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
    const navLink = document.querySelector(`[data-section="${section}"]`);
    const sectionEl = document.getElementById(section);
    
    if (navLink) navLink.classList.add('active');
    if (sectionEl) sectionEl.classList.add('active');
    
    if (updateHistory) {
        const url = section === 'dashboard' ? '/dashboard.html' : `/dashboard.html/${section}`;
        window.history.pushState({ section }, '', url);
    }
    
    document.title = section === 'dashboard' ? 'Dashboard' : `${section.charAt(0).toUpperCase() + section.slice(1)} - Dashboard`;
    
    requestAnimationFrame(() => {
        if (section === 'registrations') filterRegistrations();
        if (section === 'dashboard' && !chartsLoaded) { loadCharts(); chartsLoaded = true; }
        if (section === 'analytics') {
            populateAnalyticsLeaderFilter();
            bindAnalyticsFilters();
            if (!analyticsLoaded) { loadAnalytics(); analyticsLoaded = true; }
        }
        if (section === 'deletion-requests') {
            loadDeletionRequests();
        }
        const leaderSearchInput = document.getElementById('leaderSearchInput');
        if (leaderSearchInput && section === 'leaders' && !leaderSearchInput.hasListener) {
            leaderSearchInput.addEventListener('input', (e) => filterLeadersByName(e.target.value));
            leaderSearchInput.hasListener = true;
        }
    });
}

function getSectionFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/dashboard\.html\/(.+)$/);
    return match ? match[1] : 'dashboard';
}

window.addEventListener('popstate', (e) => {
    const section = e.state?.section || getSectionFromUrl();
    navigateToSection(section, false);
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
    
    if (!dropdown) {
        showAlert('Las notificaciones estarán disponibles próximamente', 'info');
        return;
    }
    
    const isActive = dropdown.classList.contains('active');

    // Close help drawer if open
    closeHelpDrawer();

    if (isActive) {
        dropdown.classList.remove('active');
    } else {
        dropdown.classList.add('active');
        // Cargar notificaciones actualizadas
        loadNotifications();
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
                content: 'El Dashboard te muestra las métricas más importantes de tus eventos en tiempo real. Aquí puedes ver el resumen de tu actividad, incluyendo líderes activos, total de registros y tasa de confirmación.',
                icon: 'speedometer2'
            },
            {
                title: 'Tarjetas de Estadísticas',
                content: `
                    <ul>
                        <li><strong>Líderes Activos:</strong> Cantidad total de líderes registrados en el sistema</li>
                        <li><strong>Total Registros:</strong> Número de registros ingresados por los participantes</li>
                        <li><strong>Confirmados:</strong> Participantes que confirmaron su asistencia</li>
                        <li><strong>Tasa Confirmación:</strong> Porcentaje de registros confirmados</li>
                    </ul>
                `,
                icon: 'list-check'
            },
            {
                title: 'Gráficos de Datos',
                content: 'Los gráficos te muestran visualizaciones de tu data en tiempo real: Estado de asistencia, distribución por áreas, actividad reciente y más datos analíticos útiles.',
                icon: 'bar-chart'
            }
        ]
    },
    leaders: {
        title: 'Gestión de Líderes',
        sections: [
            {
                title: 'Tabla de Líderes',
                content: 'Aquí puedes ver todos tus líderes registrados con información completa: nombre, correo, teléfono, área y estado.',
                icon: 'people-fill'
            },
            {
                title: 'Acciones Disponibles',
                content: `
                    <ul>
                        <li><strong>Ver Detalles:</strong> Haz clic en un líder para ver su información completa</li>
                        <li><strong>Editar:</strong> Modifica datos del líder (nombre, email, teléfono, área)</li>
                        <li><strong>Enviar Emails:</strong> Envía bienvenida, credenciales, código QR o alertas</li>
                        <li><strong>Generar Código QR:</strong> Crea un código QR único para el líder</li>
                        <li><strong>Eliminar:</strong> Borra un líder del sistema</li>
                    </ul>
                `,
                icon: 'gear-fill'
            },
            {
                title: 'Solicitudes de Reseteo',
                content: 'Si aparece un banner amarillo, indica que hay líderes que solicitaron un restablecimiento de contraseña. Puedes generar una contraseña temporal para ellos.',
                icon: 'exclamation-triangle'
            }
        ]
    },
    registrations: {
        title: 'Gestión de Registros',
        sections: [
            {
                title: 'Tabla de Registros',
                content: 'Visualiza todos los registros de participantes con información detallada: nombre, identificación, contacto, área, estado de confirmación y datos del evento.',
                icon: 'table'
            },
            {
                title: 'Filtros y Búsqueda',
                content: 'Utiliza la barra de búsqueda para encontrar registros específicos por nombre, email o identificación. Los filtros te ayudan a organizar la información.',
                icon: 'funnel'
            },
            {
                title: 'Acciones en Registros',
                content: `
                    <ul>
                        <li><strong>Ver Detalles:</strong> Abre el registro completo de un participante</li>
                        <li><strong>Confirmar Asistencia:</strong> Marca un participante como confirmado</li>
                        <li><strong>Enviar Confirmación:</strong> Envía email de confirmación al participante</li>
                        <li><strong>Descargar QR:</strong> Obtén el código QR del participante</li>
                    </ul>
                `,
                icon: 'check-circle'
            }
        ]
    },
    analytics: {
        title: 'Análisis y Reportes',
        sections: [
            {
                title: 'Gráficos Analíticos',
                content: 'Accede a gráficos detallados sobre el rendimiento de tus eventos: confirmaciones, registros por área, evolución temporal y datos demográficos.',
                icon: 'bar-chart'
            },
            {
                title: 'Métricas Principales',
                content: 'Analiza KPIs importantes como: tasa de confirmación, distribución geográfica, horarios pico de registro y participación por área.',
                icon: 'pie-chart'
            },
            {
                title: 'Exportar Datos',
                content: 'Exporta datos en formato Excel para análisis adicionales o reportes internos.',
                icon: 'download'
            }
        ]
    },
    export: {
        title: 'Exportación de Datos',
        sections: [
            {
                title: 'Exportar Registros',
                content: 'Descarga todos los registros en formato Excel. Útil para análisis adicionales, reportes en Word, PowerPoint o cualquier otra herramienta.',
                icon: 'file-earmark-excel'
            },
            {
                title: 'Exportar Líderes',
                content: 'Obtén lista completa de líderes con todos sus datos en un archivo Excel para gestión interna.',
                icon: 'file-earmark-excel'
            },
            {
                title: 'Formatos Disponibles',
                content: `
                    <ul>
                        <li><strong>Excel (.xlsx):</strong> Compatible con Excel, Google Sheets, etc.</li>
                        <li><strong>CSV:</strong> Formato de texto plano, importable en cualquier base de datos</li>
                        <li>Los datos se exportan sin información sensible como contraseñas</li>
                    </ul>
                `,
                icon: 'download'
            }
        ]
    }
};

function toggleHelpDrawer() {
    const drawer = document.getElementById('helpDrawer');
    const overlay = document.getElementById('helpOverlay');
    
    // Si los elementos no existen, mostrar alerta simple
    if (!drawer || !overlay) {
        showAlert('La ayuda estará disponible próximamente', 'info');
        return;
    }
    
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
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
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
if (document.getElementById('revisionFilter')) {
    document.getElementById('revisionFilter').addEventListener('change', () => {
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
        Teléfono: r.phone || '',
        Departamento: r.departamento || r.department || '',
        Municipio: r.capital || r.municipality || '',
        Localidad: r.localidad || '',
        Líder: r.leaderName || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_completo_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Reporte General de Registros');
}

addListener('exportRegsBtn', 'click', exportAllRegistrations);
addListener('exportRegsMainBtn', 'click', exportAllRegistrations);

addListener('fixNamesBtn', 'click', async () => {
    if (!confirm('¿Estás seguro de que deseas estandarizar y corregir los nombres de todos los registros del evento actual? Esta acción no se puede deshacer.')) return;
    
    try {
        const btn = document.getElementById('fixNamesBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Procesando...';
        btn.disabled = true;
        
        const res = await apiCall('/api/registrations/fix-names', {
            method: 'POST',
            body: JSON.stringify({ eventId: currentEventId })
        });
        
        const data = await res.json();
        if (res.ok) {
            showAlert(data.message || `Se corrigieron ${data.updated} registros con éxito.`, 'success');
            loadDashboard(); // Recargar datos
        } else {
            showAlert(data.error || 'Error al corregir nombres', 'error');
        }
        
        // Timeout para visual fluid behavior
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 1000);
    } catch (e) {
        console.error(e);
        showAlert('Error de red al intentar corregir nombres', 'error');
        document.getElementById('fixNamesBtn').innerHTML = '<i class="bi bi-magic"></i> Corregir Nombres';
        document.getElementById('fixNamesBtn').disabled = false;
    }
});

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
        exportToExcel(data, `lideres_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Reporte de Líderes');
    } catch (e) {
        console.error('Error in exportLeadersMainBtn:', e);
        showAlert('Error al exportar: ' + e.message, 'error');
    }
});

addListener('exportByLeaderBtn', 'click', () => {
    const leaderId = document.getElementById('exportLeaderSelect').value;
    const leader = allLeaders.find(l => l._id === leaderId);
    if (!leader) return showAlert('Por favor seleccione un líder', 'warning');

    const filtered = allRegistrations.filter(r => r.leaderId === leaderId);
    const data = filtered.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Teléfono: r.phone || '',
        Departamento: r.departamento || r.department || '',
        Municipio: r.capital || r.municipality || '',
        Localidad: r.localidad || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_${leader.name.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`, `Reporte de Registros - ${leader.name}`);
});

addListener('exportByLocalidadBtn', 'click', () => {
    const localidad = document.getElementById('exportLocalidadSelect').value;
    if (!localidad) return showAlert('Por favor seleccione una localidad', 'warning');

    const filtered = allRegistrations.filter(r => r.localidad === localidad);
    if (filtered.length === 0) return showAlert('Esta localidad no tiene registros', 'info');

    const data = filtered.map(r => {
        let nombre = (r.firstName || '').trim();
        let apellido = (r.lastName || '').trim();
        let nombreCompleto = nombre;
        if (apellido && !nombre.toLowerCase().includes(apellido.toLowerCase())) {
            nombreCompleto = `${nombre} ${apellido}`.trim();
        } else if (!nombre && apellido) {
            nombreCompleto = apellido;
        }

        return {
            'Nombres y Apellidos': nombreCompleto,
            Email: r.email || '',
            Cédula: r.cedula || '',
            Teléfono: r.phone || '',
            Departamento: r.departamento || r.department || '',
            Municipio: r.capital || r.municipality || '',
            Localidad: r.localidad || '',
            Líder: r.leaderName || '',
            Puesto: r.votingPlace || '',
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        };
    });
    exportToExcel(data, `registros_${localidad.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`, `Reporte de Registros - ${localidad}`);
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
    exportToExcel(data, `detalles_lideres_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Estadísticas por Líder');
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
async function confirmLogout() {
    try {
        const token = localStorage.getItem('token');
        if (token) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                }
            });
        }
    } catch (e) {
        console.log('Logout server error (ignored):', e);
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('eventId');
    localStorage.removeItem('username');
    localStorage.removeItem('leaderId');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('admin_token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('eventId');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('admin_token');
    window.location.href = '/';
}
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
        Teléfono: r.phone || '',
        Localidad: r.localidad || '',
        Líder: r.leaderName || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_bogota_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Reporte de Registros - Bogotá');
});

addListener('exportRestoBtn', 'click', () => {
    const resto = allRegistrations.filter(r => r.departamento && !r.localidad);
    const data = resto.map(r => ({
        Nombre: `${r.firstName} ${r.lastName}`,
        Email: r.email || '',
        Cédula: r.cedula || '',
        Teléfono: r.phone || '',
        Departamento: r.departamento || r.department || '',
        Municipio: r.capital || r.municipality || '',
        Líder: r.leaderName || '',
        Puesto: r.votingPlace || '',
        Mesa: r.votingTable || '',
        Fecha: new Date(r.date).toLocaleDateString('es-CO'),
        Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
    }));
    exportToExcel(data, `registros_resto_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Reporte de Registros - Resto del País');
});



// Export Leader Stats
addListener('exportLeaderStatsBtn', 'click', async () => {
    if (!leaderAnalyticsData || leaderAnalyticsData.length === 0) {
        await loadAnalytics();
    }
    if (!leaderAnalyticsData || leaderAnalyticsData.length === 0) {
        return showAlert('No hay datos para exportar', 'warning');
    }

    const data = leaderAnalyticsData.map(l => ({
        Líder: l.name,
        'Total Registros': l.total,
        Confirmados: l.confirmed,
        Pendientes: l.pending,
        'Tasa Confirmación (%)': l.rate + '%'
    }));

    exportToExcel(data, `estadisticas_lideres_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Estadísticas de Líderes Detallada');
});

// Populate Export Leader Select
function populateExportLeader() {
    const select = document.getElementById('exportLeaderSelect');
    if (select) {
        // Sort leaders by name
        const sorted = [...allLeaders].sort((a, b) => a.name.localeCompare(b.name));

        select.innerHTML = '<option value="">Seleccione un líder...</option>' +     
            sorted.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
    }

    const locSelect = document.getElementById('exportLocalidadSelect');
    if (locSelect) {
        const uniqueLocalidades = [...new Set(allRegistrations.map(r => r.localidad).filter(l => l && l.trim() !== ''))].sort();
        locSelect.innerHTML = '<option value="">Seleccione una localidad...</option>' +
            uniqueLocalidades.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    }
}

// ============== DELETION REQUESTS ==============

let deletionRequests = [];
window.deletionRequests = deletionRequests;

async function loadDeletionRequests() {
    try {
        const response = await fetch(`${API_URL}/api/deletion-requests`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });

        if (!response.ok) throw new Error('Error al cargar solicitudes');

        const data = await response.json();
        deletionRequests = data.requests || [];
        window.deletionRequests = deletionRequests;
        renderDeletionRequests();
        
        // Cargar estadísticas de archivos
        await loadArchivedStats();
        
        // Actualizar badge de notificaciones
        updateNotificationsBadge();
    } catch (error) {
        console.error('Error loading deletion requests:', error);
        const container = document.getElementById('deletionRequestsContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="bi bi-exclamation-triangle" style="font-size: 48px; color: var(--danger);"></i>
                    <p style="color: var(--text-muted); margin-top: 16px;">Error al cargar solicitudes</p>
                </div>
            `;
        }
    }
}

async function loadArchivedStats() {
    try {
        const response = await fetch(`${API_URL}/api/archived-registrations/stats`, {
            headers: { Authorization: `Bearer ${currentToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            const countElement = document.getElementById('archivedCount');
            const personsElement = document.getElementById('archivedPersons');
            
            if (countElement) countElement.textContent = data.totalArchived || 0;
            if (personsElement) personsElement.textContent = data.uniquePersons || 0;
        }
    } catch (error) {
        console.error('Error loading archived stats:', error);
    }
}

function filterDeletionRequests() {
    const statusFilter = document.getElementById('deletionStatusFilter').value;
    const filtered = statusFilter 
        ? deletionRequests.filter(req => req.status === statusFilter)
        : deletionRequests;
    renderDeletionRequests(filtered);
}

function renderDeletionRequests(requests = deletionRequests) {
    const container = document.getElementById('deletionRequestsContainer');
    
    if (!container) return;

    if (requests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 80px 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #f1f5f9; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                    <i class="bi bi-inbox" style="font-size: 40px; color: #94a3b8;"></i>
                </div>
                <h3 style="color: #0f172a; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">No hay solicitudes</h3>
                <p style="color: #64748b; margin: 0; font-size: 14px;">No hay solicitudes de eliminación en este momento</p>
            </div>
        `;
        return;
    }

    const html = requests.map(req => {
        const statusColors = {
            pending: { 
                border: '#f59e0b', 
                text: '#92400e', 
                icon: 'clock-history', 
                label: 'Pendiente',
                badgeBg: '#fef3c7',
                badgeBorder: '#fed7aa'
            },
            approved: { 
                border: '#22c55e', 
                text: '#065f46', 
                icon: 'check-circle-fill', 
                label: 'Aprobada',
                badgeBg: '#d1fae5',
                badgeBorder: '#a7f3d0'
            },
            rejected: { 
                border: '#dc2626', 
                text: '#991b1b', 
                icon: 'x-circle-fill', 
                label: 'Rechazada',
                badgeBg: '#fee2e2',
                badgeBorder: '#fecaca'
            }
        };
        
        const statusKey = (req.status || 'pending').toString().toLowerCase();
        const status = statusColors[statusKey] || statusColors.pending;
        const createdDate = new Date(req.createdAt).toLocaleString('es-CO', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
        const reviewedDate = req.reviewedAt ? new Date(req.reviewedAt).toLocaleString('es-CO', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : '-';

        return `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.2s;" onmouseover="this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.borderColor='#e2e8f0';">
                
                <!-- Header: Leader info and status -->
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: #f1f5f9; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-person-fill" style="font-size: 20px; color: #64748b;"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 600;">${req.leaderName}</h4>
                            <p style="color: #64748b; font-size: 13px; margin: 0;">
                                <i class="bi bi-hash"></i> ${req.leaderId.slice(-8)}
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: ${status.badgeBg}; color: ${status.text}; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid ${status.badgeBorder};">
                            <i class="bi bi-${status.icon}"></i> ${status.label}
                        </div>
                        <div style="text-align: center; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1;">${req.registrationCount}</div>
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Registros</div>
                        </div>
                    </div>
                </div>
                <!-- Reason -->
                ${req.reason ? `
                    <div style="background: #f8fafc; border-left: 3px solid #3b82f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #0f172a; font-size: 14px; line-height: 1.6;">
                            <span style="text-transform: uppercase; font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">
                                <i class="bi bi-chat-left-quote" style="color: #3b82f6;"></i> Razón
                            </span><br>
                            <span style="color: #334155; margin-top: 6px; display: inline-block;">${req.reason}</span>
                        </p>
                    </div>
                ` : ''}

                <!-- Metadata Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                        <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                            <i class="bi bi-calendar-event"></i> Solicitado
                        </div>
                        <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${createdDate}</div>
                    </div>
                    ${req.reviewedAt ? `
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                                <i class="bi bi-calendar-check"></i> Revisado
                            </div>
                            <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${reviewedDate}</div>
                        </div>
                    ` : ''}
                    ${req.reviewedBy ? `
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                                <i class="bi bi-person-check"></i> Revisado por
                            </div>
                            <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${req.reviewedBy}</div>
                        </div>
                    ` : ''}
                    ${req.reviewNotes ? `
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9; grid-column: 1 / -1;">
                            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">
                                <i class="bi bi-sticky"></i> Notas de revisión
                            </div>
                            <div style="color: #0f172a; font-size: 13px; font-weight: 500;">${req.reviewNotes}</div>
                        </div>
                    ` : ''}
                </div>

                <!-- Action Buttons for Pending Requests -->
                ${req.status === 'pending' ? `
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
                        <div style="display: flex; gap: 10px; align-items: start;">
                            <i class="bi bi-lightbulb" style="font-size: 16px; color: #f59e0b; flex-shrink: 0; margin-top: 2px;"></i>
                            <div style="color: #92400e; font-size: 13px; line-height: 1.5;">
                                <strong style="display: block; margin-bottom: 6px; color: #78350f;">Opciones de aprobación:</strong>
                                <div style="color: #92400e;">
                                    <div style="margin-bottom: 3px;">• <strong>Aprobar y Archivar:</strong> Guarda copias para reutilización futura</div>
                                    <div>• <strong>Aprobar y Eliminar:</strong> Eliminación permanente sin respaldo</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn" onclick="reviewDeletionRequest('${req._id}', 'reject')" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0';">
                            <i class="bi bi-x-circle"></i> Rechazar
                        </button>
                        <button class="btn" onclick="reviewDeletionRequest('${req._id}', 'approve-and-archive')" style="background: white; color: #2563eb; border: 1px solid #2563eb; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; transition: all 0.2s;" onmouseover="this.style.background='#eff6ff';" onmouseout="this.style.background='white';">
                            <i class="bi bi-archive-fill"></i> Archivar
                        </button>
                        <button class="btn" onclick="reviewDeletionRequest('${req._id}', 'approve')" style="background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 500; font-size: 14px; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.3); transition: all 0.2s;" onmouseover="this.style.background='#b91c1c'; this.style.boxShadow='0 4px 12px rgba(220, 38, 38, 0.4)';" onmouseout="this.style.background='#dc2626'; this.style.boxShadow='0 1px 3px rgba(220, 38, 38, 0.3)';">
                            <i class="bi bi-trash-fill"></i> Eliminar
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

async function reviewDeletionRequest(requestId, action) {
    const actionTexts = {
        'approve': 'aprobar',
        'approve-and-archive': 'aprobar y archivar',
        'reject': 'rechazar'
    };
    const actionText = actionTexts[action] || action;
    
    const confirmTexts = {
        'approve': '⚠️ ADVERTENCIA: Esta acción ELIMINARÁ PERMANENTEMENTE todos los registros del líder SIN RESPALDO. ¿Estás seguro?',
        'approve-and-archive': '✅ Esta acción eliminará los registros del líder actual PERO guardará copias en la base de datos de archivo para uso futuro (auto-rellenar en próximos eventos). ¿Continuar?',
        'reject': '¿Estás seguro de rechazar esta solicitud?'
    };
    const confirmText = confirmTexts[action] || '¿Estás seguro?';

    if (!confirm(confirmText)) return;

    let notes = '';
    if (action === 'reject') {
        notes = prompt('Razón del rechazo (opcional):') || '';
    } else if (action === 'approve-and-archive') {
        notes = 'Aprobado con archivo para reutilización futura';
    }

    try {
        const response = await fetch(`${API_URL}/api/deletion-requests/${requestId}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${currentToken}`
            },
            body: JSON.stringify({ action, notes })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al procesar solicitud');
        }

        showAlert(data.message || `Solicitud ${actionText}da exitosamente`, 'success');
        await loadDeletionRequests();
        
        // Si se aprobó (con o sin archivo), recargar registros y líderes
        if (action === 'approve' || action === 'approve-and-archive') {
            await loadAllLeaders();
            await loadAllRegistrations();
        }
    } catch (error) {
        console.error('Error reviewing deletion request:', error);
        showAlert('Error: ' + error.message, 'error');
    }
}

window.refreshDeletionRequests = loadDeletionRequests;
window.loadDeletionRequests = loadDeletionRequests;
window.filterDeletionRequests = filterDeletionRequests;
window.reviewDeletionRequest = reviewDeletionRequest;

// ============== EVENT LISTENERS INITIALIZATION ==============
// Ejecutar cuando el DOM esté completamente listo
function initializeEventListeners() {
    console.log('[LISTENERS] Inicializando event listeners...');
    const hasModalsModule = typeof ModalsModule !== 'undefined';
    
    // Close listeners for modals
    const closeEditLeaderModal = document.getElementById('closeEditLeaderModal');
    if (closeEditLeaderModal) {
        closeEditLeaderModal.addEventListener('click', () => {
            document.getElementById('editLeaderModal').classList.remove('active');
        });
        console.log('[LISTENERS] ✅ closeEditLeaderModal');
    }

    // Event listener para botón de notificaciones
    if (!hasModalsModule) {
        const notificationsBtn = document.getElementById('notificationsBtn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('[LISTENERS] Notificaciones btn clicked');
                toggleNotificationsDropdown();
            });
            console.log('[LISTENERS] ✅ notificationsBtn');
        } else {
            console.warn('[LISTENERS] ❌ notificationsBtn NOT FOUND');
        }
    }

    // Event delegation para data-action (ayuda, tema, etc.)
    // NOTA: help-toggle y help-close son manejados en core/events.js, así que los ignoramos aquí
    document.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            
            // Skip help drawer actions (handled by core/events.js)
            if (action === 'help-toggle' || action === 'help-close') {
                return;
            }
            
            console.log('[LISTENERS] data-action clicked:', action);
            e.stopPropagation();

            if (hasModalsModule && (action === 'close-modal' || action === 'notifications-mark-read')) {
                return;
            }
            
            switch (action) {
                case 'notifications-mark-read':
                    // Implementar marcar como leídas si es necesario
                    break;
                case 'close-modal':
                    const modalId = actionBtn.dataset.closeModal;
                    if (modalId) {
                        document.getElementById(modalId)?.classList.remove('active');
                    }
                    break;
            }
        }
    });
    console.log('[LISTENERS] ✅ data-action delegation');
    
    // Event listener para botón de tema
    if (!hasModalsModule) {
        const themeToggleBtn = document.querySelector('.theme-toggle');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', toggleDarkMode);
            console.log('[LISTENERS] ✅ themeToggleBtn');
        } else {
            console.warn('[LISTENERS] ❌ themeToggleBtn NOT FOUND');
        }
    }

    // Event listener para botón de toggle sidebar
    if (!hasModalsModule) {
        const sidebarToggleBtn = document.querySelector('.sidebar-toggle-main');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', toggleSidebar);
            console.log('[LISTENERS] ✅ sidebarToggleBtn');
        } else {
            console.warn('[LISTENERS] ❌ sidebarToggleBtn NOT FOUND');
        }
    }
    
    // Event listener para botón de solicitudes de eliminación
    const deletionRequestsBtn = document.getElementById('deletionRequestsBtn');
    if (deletionRequestsBtn) {
        deletionRequestsBtn.addEventListener('click', () => {
            console.log('[LISTENERS] DeletionRequests btn clicked');
            navigateToSection('deletion-requests');
        });
        console.log('[LISTENERS] ✅ deletionRequestsBtn');
    } else {
        console.warn('[LISTENERS] ❌ deletionRequestsBtn NOT FOUND');
    }
    
    // NAV LINKS - Event listeners para navegación
    const navLinks = document.querySelectorAll('.nav-link');
    if (navLinks.length > 0) {
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                console.log('[LISTENERS] Navegando a sección:', section);
                navigateToSection(section);
            });
        });
        console.log(`[LISTENERS] ✅ ${navLinks.length} nav-links`);
    } else {
        console.warn('[LISTENERS] ❌ nav-links NOT FOUND');
    }
    
    // Initial route on page load
    const initialSection = getSectionFromUrl();
    if (initialSection !== 'dashboard') {
        console.log('[LISTENERS] Navegando a sección inicial:', initialSection);
        navigateToSection(initialSection, false);
    }
    
    console.log('[LISTENERS] Todos los event listeners inicializados');
}

// Initialization
(async function init() {
    console.log('[INIT] Iniciando dashboard. Token:', currentToken ? 'Presente' : 'FALTANTE', 'Event:', currentEventId);
    
    // Esperar a que el DOM esté completamente listo
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }
    
    // Inicializar event listeners
    initializeEventListeners();
    
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
