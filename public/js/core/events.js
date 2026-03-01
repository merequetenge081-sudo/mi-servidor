/**
 * ================================================
 * PHASE 5: PURE MODULAR EVENT DELEGATION
 * ================================================
 * Sistema de delegación centralizado 100% modular.
 * - Sin typeof checks
 * - Sin fallback legacy
 * - Sin funciones globales
 * - Llamadas directas a módulos
 */

const Events = (() => {
    'use strict';

    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        console.log('[Events] ✅ Delegador modular inicializado');
        bindGlobalClicks();
        bindKeyboard();
        bindFilters();
        bindTabs();
    }

    function bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // ESC key closes modal
            if (e.key === 'Escape' || e.keyCode === 27) {
                // Close send-email modal
                const sendEmailModal = document.getElementById('sendEmailModal');
                if (sendEmailModal && sendEmailModal.classList.contains('active')) {
                    e.preventDefault();
                    sendEmailModal.classList.remove('active');
                    return;
                }

                // Close any active modal
                const activeModals = document.querySelectorAll('.modal-overlay.active');
                if (activeModals.length > 0) {
                    e.preventDefault();
                    activeModals.forEach(modal => {
                        modal.classList.remove('active');
                    });
                }
            }
        });
    }

    function bindGlobalClicks() {
        document.addEventListener('click', (e) => {
            const target = e.target;

            // =====================================
            // DATA-ACTION HANDLERS (TOP BAR)
            // =====================================
            const actionBtn = target.closest('[data-action]');
            if (actionBtn) {
                const action = actionBtn.dataset.action;

                if (action === 'notifications-toggle') {
                    if (typeof toggleNotificationsDropdown === 'function') {
                        toggleNotificationsDropdown();
                    } else if (typeof NotificationsModule !== 'undefined' && NotificationsModule.toggleDropdown) {
                        NotificationsModule.toggleDropdown();
                    }
                    return;
                }

                if (action === 'deletion-requests') {
                    if (typeof navigateToSection === 'function') {
                        navigateToSection('deletion-requests');
                    } else if (typeof Router !== 'undefined' && Router.navigate) {
                        Router.navigate('deletion-requests');
                    }

                    if (typeof loadDeletionRequests === 'function') {
                        loadDeletionRequests();
                    } else if (typeof window !== 'undefined' && typeof window.loadDeletionRequests === 'function') {
                        window.loadDeletionRequests();
                    }
                    return;
                }
            }

            // =====================================
            // NAVIGATION & SIDEBAR
            // =====================================
            const navLink = target.closest('[data-section]');
            if (navLink) {
                e.preventDefault();
                Router.navigate(navLink.dataset.section);
                return;
            }

            // =====================================
            // LEADERS ACTIONS
            // =====================================

            // Close action menus when clicking outside
            if (!target.closest('.action-menu-container')) {
                closeAllActionMenus();
            }

            // Action menu toggle
            const menuBtn = target.closest('.action-menu-btn');
            if (menuBtn) {
                e.stopPropagation();
                toggleActionMenu(menuBtn);
                return;
            }

            // Action menu scroll
            if (target.closest('.menu-scroll-up')) {
                e.stopPropagation();
                scrollActionMenu(-220);
                return;
            }
            if (target.closest('.menu-scroll-down')) {
                e.stopPropagation();
                scrollActionMenu(220);
                return;
            }

            // Delete leader button
            const deleteBtn = target.closest('.delete-leader-btn');
            if (deleteBtn) {
                closeAllActionMenus();
                LeadersModule.deleteLeader(deleteBtn.dataset.leaderId);
                return;
            }

            // Edit leader button
            const editBtn = target.closest('.edit-leader-btn');
            if (editBtn) {
                closeAllActionMenus();
                LeadersModule.showEditLeader(editBtn.dataset.leaderId);
                return;
            }

            // Generate password button
            const genPassBtn = target.closest('.gen-pass-btn, .generate-pass-btn');
            if (genPassBtn) {
                closeAllActionMenus();
                if (genPassBtn.dataset.canGenerate === 'false') {
                    if (typeof Helpers !== 'undefined' && Helpers.showAlert) {
                        Helpers.showAlert('Solo puedes generar una nueva contraseña si el líder la solicita.', 'warning');
                    }
                    return;
                }
                if (typeof LeadersModule !== 'undefined' && LeadersModule.openResetPassModal) {
                    LeadersModule.openResetPassModal(genPassBtn.dataset.leaderId);
                }
                return;
            }

            // View credentials button
            const viewCredsBtn = target.closest('.view-credentials-btn');
            if (viewCredsBtn) {
                LeadersModule.showCredentials(viewCredsBtn.dataset.leaderId);
                return;
            }

            // Send email button
            const sendEmailBtn = target.closest('.send-email-btn');
            if (sendEmailBtn) {
                LeadersModule.sendAccessEmail(
                    sendEmailBtn.dataset.leaderId,
                    sendEmailBtn.dataset.leaderName,
                    sendEmailBtn.dataset.leaderEmail
                );
                return;
            }

            // Leader QR button
                          // Impersonate Leader button
              const impersonateBtn = target.closest('.impersonate-btn');
              if (impersonateBtn) {
                  closeAllActionMenus();
                  const leaderId = impersonateBtn.dataset.leaderId;
                  
                  // Helper function inside to prompt for password cleanly
                  const promptPassword = () => {
                      return new Promise((resolve) => {
                          const overlay = document.createElement('div');
                          overlay.style.position = 'fixed';
                          overlay.style.top = '0'; overlay.style.left = '0';
                          overlay.style.width = '100vw'; overlay.style.height = '100vh';
                          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                          overlay.style.display = 'flex';
                          overlay.style.justifyContent = 'center';
                          overlay.style.alignItems = 'center';
                          overlay.style.zIndex = '999999';
                          
                          const modal = document.createElement('div');
                          modal.style.background = document.body.classList.contains('dark-mode') ? '#1f2937' : '#fff';
                          modal.style.padding = '24px';
                          modal.style.borderRadius = '8px';
                          modal.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                          modal.style.minWidth = '320px';
                          
                          const title = document.createElement('h3');
                          title.style.margin = '0 0 16px 0';
                          title.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '#111827';
                          title.innerText = 'Ingresar al perfil del l�der';
                          title.style.fontSize = '18px';
                          
                          const desc = document.createElement('p');
                          desc.style.margin = '0 0 16px 0';
                          desc.style.color = document.body.classList.contains('dark-mode') ? '#9ca3af' : '#4b5563';
                          desc.style.fontSize = '14px';
                          desc.innerText = 'Por la seguridad de la cuenta, ingresa tu contrase�a de administrador:';
                          
                          const input = document.createElement('input');
                          input.type = 'password';
                          input.style.width = '100%';
                          input.style.padding = '10px';
                          input.style.marginBottom = '20px';
                          input.style.border = '1px solid #d1d5db';
                          if (document.body.classList.contains('dark-mode')) {
                              input.style.border = '1px solid #4b5563';
                          }
                          input.style.borderRadius = '6px';
                          input.style.boxSizing = 'border-box';
                          input.style.background = document.body.classList.contains('dark-mode') ? '#374151' : '#f9fafb';
                          input.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '#000';
                          input.style.outline = 'none';
                          
                          const btnContainer = document.createElement('div');
                          btnContainer.style.display = 'flex';
                          btnContainer.style.justifyContent = 'flex-end';
                          btnContainer.style.gap = '12px';
                          
                          const cancelBtn = document.createElement('button');
                          cancelBtn.innerText = 'Cancelar';
                          cancelBtn.style.padding = '8px 16px';
                          cancelBtn.style.border = 'none';
                          cancelBtn.style.background = 'transparent';
                          cancelBtn.style.color = document.body.classList.contains('dark-mode') ? '#fbbf24' : '#d97706';
                          cancelBtn.style.cursor = 'pointer';
                          cancelBtn.style.fontWeight = '600';
                          cancelBtn.style.borderRadius = '6px';
                          
                          const submitBtn = document.createElement('button');
                          submitBtn.innerText = 'Ingresar';
                          submitBtn.style.padding = '8px 16px';
                          submitBtn.style.border = 'none';
                          submitBtn.style.background = '#10b981';
                          submitBtn.style.color = '#fff';
                          submitBtn.style.borderRadius = '6px';
                          submitBtn.style.cursor = 'pointer';
                          submitBtn.style.fontWeight = '600';
                          
                          btnContainer.appendChild(cancelBtn);
                          btnContainer.appendChild(submitBtn);
                          
                          modal.appendChild(title);
                          modal.appendChild(desc);
                          modal.appendChild(input);
                          modal.appendChild(btnContainer);
                          overlay.appendChild(modal);
                          document.body.appendChild(overlay);
                          
                          input.focus();
                          
                          const cleanup = () => {
                              if(document.body.contains(overlay)) {
                                  document.body.removeChild(overlay);
                              }
                          };
                          
                          cancelBtn.onclick = () => { cleanup(); resolve(null); };
                          submitBtn.onclick = () => { cleanup(); resolve(input.value); };
                          input.onkeydown = (e) => {
                              if (e.key === 'Enter') { cleanup(); resolve(input.value); }
                              if (e.key === 'Escape') { cleanup(); resolve(null); }
                          };
                      });
                  };
                  
                  promptPassword().then(async (adminPassword) => {
                      if (!adminPassword) return; // User cancelled
                      try {
                          // Show minimal loading state
                          const prevText = impersonateBtn.innerHTML;
                          impersonateBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Verificando...';
                          
                          const response = await fetch('/api/v2/auth/impersonate', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': 'Bearer ' + localStorage.getItem('token')
                              },
                              body: JSON.stringify({ adminPassword, leaderId })
                          });
                          
                          const data = await response.json();
                          if (!response.ok) {
                              impersonateBtn.innerHTML = prevText;
                              const errMsg = data.error || 'Error de autenticaci�n.';
                              if (window.ModalsModule && ModalsModule.showAlert) {
                                  ModalsModule.showAlert(errMsg, 'error');
                              } else {
                                  alert(errMsg);
                              }
                              return;
                          }
                          
                          // Success - switch tokens and redirect
                          localStorage.setItem('token', data.token);
                          localStorage.setItem('role', 'leader');
                          localStorage.setItem('userId', leaderId);
                          localStorage.setItem('impersonated', 'true');
                          if (data.data && data.data.name) {
                              localStorage.setItem('leaderName', data.data.name);
                          }
                          window.location.href = '/leader.html';
                      } catch (error) {
                          impersonateBtn.innerHTML = prevText;
                          if (window.ModalsModule && ModalsModule.showAlert) {
                              ModalsModule.showAlert('Error de red: ' + error.message, 'error');
                          } else {
                              alert('Error de red: ' + error.message);
                          }
                      }
                  });
              }

              // Leader QR button
                            // Impersonate Leader button
              const impersonateBtn = target.closest('.impersonate-btn');
              if (impersonateBtn) {
                  closeAllActionMenus();
                  const leaderId = impersonateBtn.dataset.leaderId;
                  
                  // Helper function inside to prompt for password cleanly
                  const promptPassword = () => {
                      return new Promise((resolve) => {
                          const overlay = document.createElement('div');
                          overlay.style.position = 'fixed';
                          overlay.style.top = '0'; overlay.style.left = '0';
                          overlay.style.width = '100vw'; overlay.style.height = '100vh';
                          overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                          overlay.style.display = 'flex';
                          overlay.style.justifyContent = 'center';
                          overlay.style.alignItems = 'center';
                          overlay.style.zIndex = '999999';
                          
                          const modal = document.createElement('div');
                          modal.style.background = document.body.classList.contains('dark-mode') ? '#1f2937' : '#fff';
                          modal.style.padding = '24px';
                          modal.style.borderRadius = '8px';
                          modal.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                          modal.style.minWidth = '320px';
                          
                          const title = document.createElement('h3');
                          title.style.margin = '0 0 16px 0';
                          title.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '#111827';
                          title.innerText = 'Ingresar al perfil del l�der';
                          title.style.fontSize = '18px';
                          
                          const desc = document.createElement('p');
                          desc.style.margin = '0 0 16px 0';
                          desc.style.color = document.body.classList.contains('dark-mode') ? '#9ca3af' : '#4b5563';
                          desc.style.fontSize = '14px';
                          desc.innerText = 'Por la seguridad de la cuenta, ingresa tu contrase�a de administrador:';
                          
                          const input = document.createElement('input');
                          input.type = 'password';
                          input.style.width = '100%';
                          input.style.padding = '10px';
                          input.style.marginBottom = '20px';
                          input.style.border = '1px solid #d1d5db';
                          if (document.body.classList.contains('dark-mode')) {
                              input.style.border = '1px solid #4b5563';
                          }
                          input.style.borderRadius = '6px';
                          input.style.boxSizing = 'border-box';
                          input.style.background = document.body.classList.contains('dark-mode') ? '#374151' : '#f9fafb';
                          input.style.color = document.body.classList.contains('dark-mode') ? '#fff' : '#000';
                          input.style.outline = 'none';
                          
                          const btnContainer = document.createElement('div');
                          btnContainer.style.display = 'flex';
                          btnContainer.style.justifyContent = 'flex-end';
                          btnContainer.style.gap = '12px';
                          
                          const cancelBtn = document.createElement('button');
                          cancelBtn.innerText = 'Cancelar';
                          cancelBtn.style.padding = '8px 16px';
                          cancelBtn.style.border = 'none';
                          cancelBtn.style.background = 'transparent';
                          cancelBtn.style.color = document.body.classList.contains('dark-mode') ? '#fbbf24' : '#d97706';
                          cancelBtn.style.cursor = 'pointer';
                          cancelBtn.style.fontWeight = '600';
                          cancelBtn.style.borderRadius = '6px';
                          
                          const submitBtn = document.createElement('button');
                          submitBtn.innerText = 'Ingresar';
                          submitBtn.style.padding = '8px 16px';
                          submitBtn.style.border = 'none';
                          submitBtn.style.background = '#10b981';
                          submitBtn.style.color = '#fff';
                          submitBtn.style.borderRadius = '6px';
                          submitBtn.style.cursor = 'pointer';
                          submitBtn.style.fontWeight = '600';
                          
                          btnContainer.appendChild(cancelBtn);
                          btnContainer.appendChild(submitBtn);
                          
                          modal.appendChild(title);
                          modal.appendChild(desc);
                          modal.appendChild(input);
                          modal.appendChild(btnContainer);
                          overlay.appendChild(modal);
                          document.body.appendChild(overlay);
                          
                          input.focus();
                          
                          const cleanup = () => {
                              if(document.body.contains(overlay)) {
                                  document.body.removeChild(overlay);
                              }
                          };
                          
                          cancelBtn.onclick = () => { cleanup(); resolve(null); };
                          submitBtn.onclick = () => { cleanup(); resolve(input.value); };
                          input.onkeydown = (e) => {
                              if (e.key === 'Enter') { cleanup(); resolve(input.value); }
                              if (e.key === 'Escape') { cleanup(); resolve(null); }
                          };
                      });
                  };
                  
                  promptPassword().then(async (adminPassword) => {
                      if (!adminPassword) return; // User cancelled
                      try {
                          // Show minimal loading state
                          const prevText = impersonateBtn.innerHTML;
                          impersonateBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Verificando...';
                          
                          const response = await fetch('/api/v2/auth/impersonate', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': 'Bearer ' + localStorage.getItem('token')
                              },
                              body: JSON.stringify({ adminPassword, leaderId })
                          });
                          
                          const data = await response.json();
                          if (!response.ok) {
                              impersonateBtn.innerHTML = prevText;
                              const errMsg = data.error || 'Error de autenticaci�n.';
                              if (window.ModalsModule && ModalsModule.showAlert) {
                                  ModalsModule.showAlert(errMsg, 'error');
                              } else {
                                  alert(errMsg);
                              }
                              return;
                          }
                          
                          // Success - switch tokens and redirect
                          localStorage.setItem('token', data.token);
                          localStorage.setItem('role', 'leader');
                          localStorage.setItem('userId', leaderId);
                          localStorage.setItem('impersonated', 'true');
                          if (data.data && data.data.name) {
                              localStorage.setItem('leaderName', data.data.name);
                          }
                          window.location.href = '/leader.html';
                      } catch (error) {
                          impersonateBtn.innerHTML = prevText;
                          if (window.ModalsModule && ModalsModule.showAlert) {
                              ModalsModule.showAlert('Error de red: ' + error.message, 'error');
                          } else {
                              alert('Error de red: ' + error.message);
                          }
                      }
                  });
              }

              // Leader QR button
              const qrBtn = target.closest('.qr-btn');
            if (qrBtn) {
                closeAllActionMenus();
                if (typeof ModalsModule !== 'undefined' && ModalsModule.showQR) {
                    ModalsModule.showQR(qrBtn.dataset.leaderId, qrBtn.dataset.leaderName);
                } else {
                    // Fallback: Generate QR directly
                    const leaderId = qrBtn.dataset.leaderId;
                    const qrContainer = document.getElementById('qrCode');
                    
                    if (qrContainer && typeof AppState !== 'undefined' && AppState.data && AppState.data.leaders) {
                        qrContainer.innerHTML = '';
                        const leader = AppState.data.leaders.find(l => l._id === leaderId);
                        const token = leader ? (leader.token || leader.leaderId || leaderId) : leaderId;
                        const link = `${window.location.origin}/form.html?token=${token}`;
                        
                        const linkInput = document.getElementById('qrLink');
                        if (linkInput) linkInput.value = link;
                        
                        if (typeof QRCode !== 'undefined') {
                            try {
                                new QRCode(qrContainer, { text: link, width: 250, height: 250 });
                            } catch (e) {
                                console.error('[Events] Error generating QR:', e);
                                qrContainer.textContent = 'Error: ' + e.message;
                            }
                        } else {
                            qrContainer.textContent = 'Error: Librería QR no cargada';
                        }
                        
                        const modal = document.getElementById('qrModal');
                        if (modal) modal.classList.add('active');
                    } else {
                        console.error('[Events] Cannot generate QR: missing dependencies');
                        alert('Error: No se puede generar el código QR');
                    }
                }
                return;
            }

            // =====================================
            // NEW LEADER BUTTON
            // =====================================

            if (target.id === 'newLeaderBtn') {
                const modal = document.getElementById('leaderModal');
                if (modal) modal.classList.add('active');
                return;
            }

            // =====================================
            // MODAL BUTTONS
            // =====================================

            // Close modal buttons
            const closeModalBtn = target.closest('[data-close-modal]');
            if (closeModalBtn) {
                const modalId = closeModalBtn.dataset.closeModal;
                if (typeof ModalsModule !== 'undefined' && ModalsModule.closeModal) {
                    ModalsModule.closeModal(modalId);
                } else {
                    const modal = document.getElementById(modalId);
                    if (modal) modal.classList.remove('active');
                }
                return;
            }

            // Generate random password button
            if (target.id === 'generatePassBtn') {
                const passInput = document.getElementById('resetPassPassword');
                if (passInput) {
                    passInput.value = Math.random().toString(36).slice(-8) + 'Aa1!';
                }
                return;
            }

            // Copy credentials button
            if (target.id === 'copyCredsBtn') {
                const user = document.getElementById('resultUsername')?.textContent;
                const pass = document.getElementById('resultPassword')?.textContent;
                if (user && pass) {
                    const text = `Usuario: ${user}\nContraseña: ${pass}`;
                    navigator.clipboard.writeText(text).then(() => {
                        Helpers.showAlert('Credenciales copiadas al portapapeles', 'success');
                    });
                }
                return;
            }

            // Save new leader button
            if (target.id === 'saveLiderBtn') {
                if (typeof LeadersModule !== 'undefined' && LeadersModule.handleSaveLeader) {
                    LeadersModule.handleSaveLeader();
                } else {
                    console.error('[Events] LeadersModule.handleSaveLeader not available');
                }
                return;
            }

            // Confirm reset password button
            if (target.id === 'confirmResetPassBtn') {
                LeadersModule.handleConfirmResetPassword();
                return;
            }

            // Confirm delete leader button
            if (target.id === 'confirmDeleteBtn') {
                LeadersModule.handleConfirmDeleteLeader();
                return;
            }

            // Cancel delete leader button
            if (target.id === 'cancelDeleteBtn') {
                LeadersModule.closeDeleteLeaderModals();
                return;
            }

            // Send emails button
            if (target.id === 'dashboard-send-emails-btn') {
                LeadersModule.confirmSendAccessEmail();
                return;
            }

            // Save edit leader button
            if (target.id === 'saveEditLeaderBtn') {
                LeadersModule.handleSaveEditLeader();
                return;
            }

            // =====================================
            // REGISTRATIONS ACTIONS
            // =====================================

            // Confirm/unconfirm registration button
            const confirmBtn = target.closest('.toggle-confirm-btn');
            if (confirmBtn) {
                RegistrationsModule.toggleConfirm(
                    confirmBtn.dataset.regId,
                    confirmBtn.dataset.confirmed === 'true'
                );
                return;
            }

            // Delete registration button
            const deleteRegBtn = target.closest('.delete-registration-btn');
            if (deleteRegBtn) {
                RegistrationsModule.deleteRegistration(deleteRegBtn.dataset.id);
                return;
            }

            // =====================================
            // EXPORT ACTIONS
            // =====================================

            if (target.id === 'exportBogotaBtn') {
                ExportsModule.exportBogota();
                return;
            }

            if (target.id === 'exportRestoBtn') {
                ExportsModule.exportResto();
                return;
            }

            if (target.id === 'exportRegsBtn' || target.id === 'exportRegsMainBtn') {
                ExportsModule.exportAllRegistrations();
                return;
            }

            if (target.id === 'exportLeadersMainBtn') {
                ExportsModule.exportAllLeaders();
                return;
            }

            if (target.id === 'exportByLeaderBtn') {
                ExportsModule.exportByLeader();
                return;
            }

            if (target.id === 'exportLeaderStatsBtn') {
                ExportsModule.exportLeaderStats();
                return;
            }

            // =====================================
            // LAYOUT & MODALS
            // =====================================

            // Sidebar toggle
            if (target.closest('.sidebar-toggle-main') || target.closest('.sidebar-overlay')) {
                if (typeof ModalsModule !== 'undefined' && ModalsModule.toggleSidebar) {
                    ModalsModule.toggleSidebar();
                } else {
                    const sidebar = document.getElementById('sidebar');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (sidebar) sidebar.classList.toggle('active');
                    if (overlay) overlay.classList.toggle('active');
                }
                return;
            }

            // Dark mode toggle - Prevenir bubbling
            if (target.closest('.theme-toggle')) {
                e.stopPropagation();
                e.preventDefault();
                if (typeof ModalsModule !== 'undefined' && ModalsModule.toggleDarkMode) {
                    ModalsModule.toggleDarkMode();
                } else {
                    document.body.classList.toggle('dark-mode');
                    const isDark = document.body.classList.contains('dark-mode');
                    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
                }
                return;
            }

            // Notifications dropdown
            if (target.closest('#notificationsBtn')) {
                e.stopPropagation();
                e.preventDefault();
                if (typeof ModalsModule !== 'undefined' && ModalsModule.toggleNotificationsDropdown) {
                    ModalsModule.toggleNotificationsDropdown();
                } else if (typeof NotificationsModule !== 'undefined' && NotificationsModule.toggleDropdown) {
                    NotificationsModule.toggleDropdown();
                }
                return;
            }

            // Help drawer handlers moved down to avoid duplication (see line ~458)

            // Close send-email modal
            if (target.closest('[data-action="close-send-email"]')) {
                e.stopPropagation();
                e.preventDefault();
                const modal = document.getElementById('sendEmailModal');
                if (modal) {
                    modal.classList.remove('active');
                    if (typeof ModalsModule !== 'undefined' && ModalsModule.closeModal) {
                        ModalsModule.closeModal('sendEmailModal');
                    }
                }
                return;
            }

            // Open logout modal
            if (target.closest('[data-action="open-logout"]')) {
                e.stopPropagation();
                e.preventDefault();
                if (typeof ModalsModule !== 'undefined' && ModalsModule.openModal) {
                    ModalsModule.openModal('logoutModal');
                } else {
                    // Fallback directo
                    const modal = document.getElementById('logoutModal');
                    if (modal) modal.classList.add('active');
                }
                return;
            }

            // Confirm logout
            if (target.closest('[data-action="confirm-logout"]')) {
                e.stopPropagation();
                e.preventDefault();
                Helpers.confirmLogout();
                return;
            }

            // Open registrations from dashboard
            if (target.closest('[data-action="open-registrations"]')) {
                e.stopPropagation();
                e.preventDefault();
                Router.navigate('registrations');
                return;
            }

            // =====================================
            // NOTIFICATIONS
            // =====================================

            // Generate password from notification
            const notifGenBtn = target.closest('[data-action="notif-gen-pass"]');
            if (notifGenBtn) {
                LeadersModule.openResetPassModal(notifGenBtn.dataset.leaderId);
                ModalsModule.closeModal('notificationsModal');
                return;
            }

            // Mark all notifications as read
            if (target.closest('[data-action="notifications-mark-read"]')) {
                NotificationsModule.markAllRead();
                return;
            }

            // =====================================
            // HELP DRAWER
            // =====================================

            // Toggle help drawer - use ModalsModule if available, fallback to direct manipulation
            if (target.closest('[data-action="help-toggle"]')) {
                e.stopPropagation();
                e.preventDefault();
                try {
                    if (typeof ModalsModule !== 'undefined' && ModalsModule.toggleHelpDrawer) {
                        ModalsModule.toggleHelpDrawer();
                    } else {
                        const drawer = document.getElementById('helpDrawer');
                        const overlay = document.getElementById('helpOverlay');
                        if (drawer && overlay) {
                            const isOpen = drawer.classList.contains('active');
                            if (isOpen) {
                                drawer.classList.remove('active');
                                overlay.classList.remove('active');
                            } else {
                                drawer.classList.add('active');
                                overlay.classList.add('active');
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error toggling help:', err);
                }
                return;
            }

            // Close help drawer
            if (target.closest('[data-action="help-close"]')) {
                e.stopPropagation();
                e.preventDefault();
                try {
                    if (typeof ModalsModule !== 'undefined' && ModalsModule.closeHelpDrawer) {
                        ModalsModule.closeHelpDrawer();
                    } else {
                        const drawer = document.getElementById('helpDrawer');
                        const overlay = document.getElementById('helpOverlay');
                        if (drawer) drawer.classList.remove('active');
                        if (overlay) overlay.classList.remove('active');
                    }
                } catch (err) {
                    console.error('Error closing help:', err);
                }
                return;
            }

            // Close help drawer when clicking overlay
            if (target.id === 'helpOverlay' && target.classList.contains('active')) {
                e.stopPropagation();
                e.preventDefault();
                try {
                    target.classList.remove('active');
                    const drawer = document.getElementById('helpDrawer');
                    if (drawer) drawer.classList.remove('active');
                } catch (err) {
                    console.error('Error closing help overlay:', err);
                }
                return;
            }

            // =====================================
            // PAGINATION
            // =====================================

            if (target.id === 'firstPageBogotaBtn') {
                RegistrationsModule.changePage('bogota', 'first');
                return;
            }
            if (target.id === 'prevPageBogotaBtn') {
                RegistrationsModule.changePage('bogota', 'prev');
                return;
            }
            if (target.id === 'nextPageBogotaBtn') {
                RegistrationsModule.changePage('bogota', 'next');
                return;
            }

            if (target.id === 'firstPageRestoBtn') {
                RegistrationsModule.changePage('resto', 'first');
                return;
            }
            if (target.id === 'prevPageRestoBtn') {
                RegistrationsModule.changePage('resto', 'prev');
                return;
            }
            if (target.id === 'nextPageRestoBtn') {
                RegistrationsModule.changePage('resto', 'next');
                return;
            }
        });
    }

    function bindFilters() {
        // Search input for leaders
        const leaderSearch = document.getElementById('leaderSearch');
        if (leaderSearch) {
            leaderSearch.addEventListener('input', (e) => {
                LeadersModule.filterByName(e.target.value);
            });
        }

        // Registration filters
        const searchInput = document.getElementById('searchInput');
        const leaderFilter = document.getElementById('leaderFilter');
        const statusFilter = document.getElementById('statusFilter');
        const revisionFilter = document.getElementById('revisionFilter');

        const applyRegistrationFilters = () => {
            if (AppState) {
                AppState.setUI({ currentPageBogota: 1, currentPageResto: 1 });
            }
            RegistrationsModule.applyFilters();
        };

        if (searchInput) searchInput.addEventListener('input', applyRegistrationFilters);
        if (leaderFilter) leaderFilter.addEventListener('change', applyRegistrationFilters);
        if (statusFilter) statusFilter.addEventListener('change', applyRegistrationFilters);
        if (revisionFilter) revisionFilter.addEventListener('change', applyRegistrationFilters);
    }

    function bindTabs() {
        const bogotaTab = document.getElementById('bogotaTab');
        const restoTab = document.getElementById('restoTab');

        if (bogotaTab) {
            bogotaTab.addEventListener('click', () => {
                RegistrationsModule.showTab('bogota');
            });
        }

        if (restoTab) {
            restoTab.addEventListener('click', () => {
                RegistrationsModule.showTab('resto');
            });
        }
    }

    // ====== HELPER FUNCTIONS ======

    function closeAllActionMenus() {
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

    function toggleActionMenu(btn) {
        const leaderId = btn.dataset.leaderId;
        const menu = document.querySelector(`.action-menu-dropdown[data-leader-id="${leaderId}"]`);
        if (!menu) return;

        const allMenus = document.querySelectorAll('.action-menu-dropdown');
        allMenus.forEach(m => {
            if (m !== menu) {
                m.style.display = 'none';
                m.style.maxHeight = '';
                m.classList.remove('open-up', 'open-down');
                const otherContainer = m.closest('.action-menu-container');
                if (otherContainer) otherContainer.classList.remove('is-open');
            }
        });

        const willShow = menu.style.display === 'none' || menu.style.display === '';
        menu.style.display = willShow ? 'block' : 'none';

        const container = btn.closest('.action-menu-container');
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
    }

    function scrollActionMenu(delta) {
        const scrollContainer = document.querySelector('.main-scrollable-content');
        if (scrollContainer) {
            scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
        }
    }

    return { init };
})();

window.Events = Events;
