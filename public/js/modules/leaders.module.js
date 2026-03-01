/**
 * ============================================
 * LEADERS MODULE - Gestión completa de Líderes
 * ============================================
 * Encapsula TODA la lógica de líderes:
 * - Renderizado de tabla con menú contextual
 * - Filtrado por nombre
 * - Envío de correos de acceso
 * - Generación de contraseñas temporales
 * - Visualización de credenciales
 * - Edición y eliminación de líderes
 * - Población de filtros de líderes
 * ============================================
 */

const LeadersModule = (() => {
    'use strict';

    // ====== PRIVATE STATE ======
    let initialized = false;
    let eventsBound = false;
    let pendingEmailData = null;
    let leaderToDeleteId = null;

    // ====== HELPERS ======
    function showAlert(message, type = 'info') {
        if (typeof ModalsModule !== 'undefined' && ModalsModule.showAlert) {
            return ModalsModule.showAlert(message, type);
        }
        // Fallback to simple alert
        alert(message);
        return Promise.resolve(true);
    }

    function showConfirm(message) {
        if (typeof ModalsModule !== 'undefined' && ModalsModule.showConfirm) {
            return ModalsModule.showConfirm(message);
        }
        // Fallback to confirm
        return Promise.resolve(confirm(message));
    }

    // ====== INITIALIZATION ======
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        console.log('✅ LeadersModule initialized');
    }

    // ====== EVENT BINDING (ONCE) ======
    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;

        // ✅ FASE 4: Todos los listeners removidos y delegados a core/events.js
        // Los eventos del módulo ahora son manejados por delegación centralizada:
        // - Modal closes, open, confirmations
        // - Send email
        // - Password generation
        // Ver: core/events.js > bindGlobalClicks()

        console.log('✅ LeadersModule events bound (delegated to Events.js)');
    }

    // ====== LOAD LEADERS TABLE ======
    function loadTable() {
        const allLeaders = window.AppState.data.leaders;
        
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
                            <button class="menu-item impersonate-btn" data-leader-id="${leader._id}" style="color: #10b981; font-weight: 600;">
                                <i class="bi bi-box-arrow-in-right"></i> Ingresar al perfil
                            </button>
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
        console.log('📌 Eventos delegados desde core/events.js');
    }

    // ====== FILTER LEADERS BY NAME ======
    function filterByName(searchTerm) {
        const allLeaders = window.AppState.data.leaders;
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
                            <button class="menu-item impersonate-btn" data-leader-id="${leader._id}" style="color: #10b981; font-weight: 600;">
                                <i class="bi bi-box-arrow-in-right"></i> Ingresar al perfil
                            </button>
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

        console.log('📌 Eventos delegados desde core/events.js');
    }

    // ====== SEND ACCESS EMAIL ======
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

            const res = await DataService.apiCall(`/api/leaders/${leaderId}/send-access`, {
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

            // VALIDACIÓN: Verificar success===true o que al menos un email fue enviado
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
                // Error: result.success es false
                const errorMsg = result.message || result.error || 'Error al enviar correos';
                if (resultDiv) {
                    resultDiv.style.background = '#fee2e2';
                    resultDiv.style.color = '#991b1b';
                    resultDiv.style.border = '1px solid #ef4444';
                    resultDiv.textContent = `❌ ${errorMsg}`;
                }
                showAlert(errorMsg, 'error');
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
        const allLeaders = window.AppState.data.leaders;
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

    function validatePassword(password) {
        const errors = [];
        if (password.length < 8) errors.push('mínimo 8 caracteres');
        if (!/[A-Z]/.test(password)) errors.push('una mayúscula');
        if (!/[a-z]/.test(password)) errors.push('una minúscula');
        if (!/[0-9]/.test(password)) errors.push('un número');
        return { isValid: errors.length === 0, errors };
    }

    async function handleConfirmResetPassword() {
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
            const res = await DataService.apiCall('/api/auth/admin-reset-password', {
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
                if (typeof window.loadDashboard === 'function') {
                    window.loadDashboard(); // Refresh table to show updated username
                }
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
    }

    // ====== SHOW CREDENTIALS ======
    async function showCredentials(leaderId) {
        const allLeaders = window.AppState.data.leaders;
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
            const res = await DataService.apiCall(`/api/leaders/${leaderId}/credentials`);

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

    // ====== POPULATE FILTERS ======
    function populateLeaderFilter() {
        const allLeaders = window.AppState.data.leaders;
        const select = document.getElementById('leaderFilter');
        select.innerHTML = '<option value="">-- Todos los Líderes --</option>' +
            allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
    }

    function populateExportLeader() {
        const allLeaders = window.AppState.data.leaders;
        const select = document.getElementById('exportLeaderSelect');
        select.innerHTML = allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
    }

    function populateAnalyticsLeaderFilter() {
        const allLeaders = window.AppState.data.leaders;
        const select = document.getElementById('analyticsLeaderFilter');
        if (!select) return;
        select.innerHTML = '<option value="all">Todos los líderes</option>' +
            allLeaders.map(l => `<option value="${l._id}">${l.name}</option>`).join('');
    }

    // ====== DELETE LEADER ======
    function deleteLeader(leaderId) {
        leaderToDeleteId = leaderId;
        openDeleteLeaderModal();
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
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }
    }

    function handleConfirmDeleteLeader() {
        const allLeaders = window.AppState.data.leaders;
        const leader = allLeaders.find(l => l._id === leaderToDeleteId);
        if (!leader) {
            showAlert('Líder no encontrado', 'error');
            closeDeleteLeaderModals();
            return;
        }

        const leader2 = document.getElementById('deleteLeaderInput')?.value || '';
        const leader3 = document.getElementById('deleteLeaderNameConfirm')?.value || '';

        if (leader2 !== leader.name && leader3 !== leader.name) {
            showAlert('El nombre del líder no coincide', 'warning');
            return;
        }

        (async () => {
            try {
                const res = await DataService.apiCall(`/api/leaders/${leaderToDeleteId}`, {
                    method: 'DELETE'
                });

                if (!res.ok) {
                    const data = await res.json();
                    showAlert('Error al eliminar: ' + (data.error || 'desconocido'), 'error');
                    return;
                }

                // Éxito: Actualizar datos
                const leadersRes = await DataService.apiCall('/api/leaders');
                const leadersData = await leadersRes.json();
                
                if (leadersData.data) {
                    AppState.updateData({ leaders: leadersData.data });
                }
                
                // Cerrar modal y recargar tabla
                closeDeleteLeaderModals();
                populateLeadersTable();
                showAlert('¡Líder eliminado correctamente!', 'success');
                
            } catch (err) {
                console.error('[LeadersModule] Error eliminando líder:', err);
                showAlert('Error de conexión', 'error');
            }
        })();
    }

    // ====== EDIT LEADER ======
    function showEditLeader(leaderId) {
        const allLeaders = window.AppState.data.leaders;
        const leader = allLeaders.find(l => l._id === leaderId);
        if (!leader) return showAlert('Líder no encontrado', 'error');

        document.getElementById('editLeaderId').value = leaderId;
        document.getElementById('editLeaderName').value = leader.name;
        document.getElementById('editLeaderEmail').value = leader.email || '';
        document.getElementById('editLeaderPhone').value = leader.phone || '';

        document.getElementById('editLeaderModal').classList.add('active');
    }

    async function handleSaveEditLeader() {
        const id = document.getElementById('editLeaderId').value;
        const name = document.getElementById('editLeaderName').value;
        const email = document.getElementById('editLeaderEmail').value;
        const phone = document.getElementById('editLeaderPhone').value;

        if (!name) return showAlert('El nombre es obligatorio', 'warning');

        try {
            const res = await DataService.apiCall(`/api/leaders/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, phone })
            });

            if (res.ok) {
                document.getElementById('editLeaderModal').classList.remove('active');
                if (typeof window.loadDashboard === 'function') {
                    window.loadDashboard();
                } else {
                    location.reload();
                }
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal('¡Actualizado!', 'La información del líder ha sido actualizada.');
                }
            } else {
                const data = await res.json();
                showAlert('Error: ' + (data.error || 'No se pudo actualizar'), 'error');
            }
        } catch (err) {
            console.error(err);
            showAlert('Error de conexión', 'error');
        }
    }

    // ====== SAVE NEW LEADER ======
    async function handleSaveLeader() {
        const name = document.getElementById('leaderName')?.value;
        const email = document.getElementById('leaderEmail')?.value;
        const phone = document.getElementById('leaderPhone')?.value;
        const customUsername = document.getElementById('leaderUsername')?.value.trim();

        if (!name) return showAlert('Ingresa el nombre', 'warning');

        try {
            const eventId = AppState.user.eventId;
            const body = {
                name,
                email: email || undefined,
                phone: phone || undefined,
                eventId,
                customUsername: customUsername || undefined
            };

            const res = await DataService.apiCall('/api/leaders', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                // Cerrar modal y limpiar formulario
                document.getElementById('leaderModal').classList.remove('active');
                document.getElementById('leaderName').value = '';
                document.getElementById('leaderEmail').value = '';
                document.getElementById('leaderPhone').value = '';
                document.getElementById('leaderUsername').value = '';

                // Recargar datos
                loadTable();

                // Mostrar credenciales si se generaron
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
                    showAlert('¡Líder creado correctamente!', 'success');
                }
            } else {
                showAlert('Error: ' + (data.error || 'No se pudo crear'), 'error');
            }
        } catch (err) {
            console.error('[LeadersModule] Error creando líder:', err);
            showAlert('Error de conexión', 'error');
        }
    }

    // ====== PUBLIC API ======
    return {
        init,
        loadTable,
        filterByName,
        sendAccessEmail,
        closeSendEmailModal,
        confirmSendAccessEmail,
        openResetPassModal,
        handleConfirmResetPassword,
        handleSaveLeader,
        handleSaveEditLeader,
        showCredentials,
        populateLeaderFilter,
        populateExportLeader,
        populateAnalyticsLeaderFilter,
        deleteLeader,
        showEditLeader,
        closeDeleteLeaderModals,
        handleConfirmDeleteLeader
    };
})();

// Export to window
window.LeadersModule = LeadersModule;

// Assign generateNewPassword for backward compatibility
window.generateNewPassword = LeadersModule.openResetPassModal;
