/**
 * ================================================
 * PHASE 5: PURE MODULAR EVENT DELEGATION
 * ================================================
 * Sistema de delegaci├│n centralizado 100% modular.
 * - Sin typeof checks
 * - Sin fallback legacy
 * - Sin funciones globales
 * - Llamadas directas a m├│dulos
 */

const Events = (() => {
    'use strict';

    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        console.log('[Events] Ô£à Delegador modular inicializado');
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
                        Helpers.showAlert('Solo puedes generar una nueva contrase├▒a si el l├¡der la solicita.', 'warning');
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

            // Impersonate button
              const impersonateBtn = target.closest('.impersonate-btn');
              if (impersonateBtn) {
                  if (typeof closeAllActionMenus === 'function') closeAllActionMenus();
                  const leaderId = impersonateBtn.dataset.leaderId;
                  const leaderName = impersonateBtn.dataset.leaderName || 'el líder';

                  // Create modal overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'modal-overlay active';
                  overlay.style.zIndex = '99999';
                  overlay.style.display = 'flex';
                  overlay.style.alignItems = 'center';
                  overlay.style.justifyContent = 'center';
                  overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
                  overlay.style.backdropFilter = 'blur(4px)';

                  const modalBox = document.createElement('div');
                  modalBox.className = 'modal-card';
                  modalBox.style.maxWidth = '400px';
                  modalBox.style.width = '90%';
                  modalBox.style.padding = '0';
                  modalBox.style.overflow = 'hidden';
                  modalBox.style.animation = 'modalSlideIn 0.3s ease';

                  modalBox.innerHTML = `
                      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding: 20px; display: flex; justify-content: space-between; align-items: center; background: var(--surface);">
                          <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(99, 102, 241, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center;">
                                  <i class="bi bi-shield-lock"></i>
                              </div>
                              Ingresar al Perfil
                          </h3>
                          <button id="closeImpersonateX" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.2rem; padding: 5px;"><i class="bi bi-x-lg"></i></button>
                      </div>
                      <div class="modal-body" style="padding: 24px; background: var(--surface);">
                          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.95rem; line-height: 1.5;">
                              Por seguridad, ingresa tu <strong>contraseña de administrador</strong> para asumir la sesión de <strong style="color: var(--text-primary)">${leaderName}</strong>.
                          </p>
                          <div class="form-group" style="margin-bottom: 0;">
                              <input type="password" id="adminPassForImpersonate" class="form-control" placeholder="••••••••" style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-hover); color: var(--text-primary); transition: border-color 0.3s ease;" autocomplete="off" autofocus />
                          </div>
                      </div>
                      <div class="modal-footer" style="border-top: 1px solid var(--border); padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; background: var(--surface);">
                          <button id="cancelImpersonate" class="btn" style="background: transparent; color: var(--text-secondary); border: 1px solid var(--border); padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; font-weight: 500;">Cancelar</button>
                          <button id="confirmImpersonate" class="btn btn-primary" style="background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px; transition: opacity 0.2s ease;">
                              <i class="bi bi-box-arrow-in-right"></i> Acceder
                          </button>
                      </div>
                  `;

                  overlay.appendChild(modalBox);
                  document.body.appendChild(overlay);

                  // Focus input
                  const passInput = document.getElementById('adminPassForImpersonate');
                  passInput.focus();

                  // Handlers
                  const closeModal = () => {
                      if (document.body.contains(overlay)) {
                          document.body.removeChild(overlay);
                      }
                  };

                  document.getElementById('cancelImpersonate').addEventListener('click', closeModal);
                  document.getElementById('closeImpersonateX').addEventListener('click', closeModal);
                  
                  passInput.addEventListener('keydown', (ke) => {
                      if (ke.key === 'Enter') {
                          document.getElementById('confirmImpersonate').click();
                      }
                      if (ke.key === 'Escape') {
                          closeModal();
                      }
                  });

                  document.getElementById('confirmImpersonate').addEventListener('click', async () => {
                      const adminPassword = passInput.value;
                      if (!adminPassword) {
                          if (typeof Helpers !== 'undefined') Helpers.showAlert('La contraseña es obligatoria', 'error');
                          return;
                      }

                      const btn = document.getElementById('confirmImpersonate');
                      btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Verificando...';
                      btn.disabled = true;
                      btn.style.opacity = '0.7';

                      try {
                          const token = localStorage.getItem('token');
                          const response = await fetch('/api/v2/auth/impersonate', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({
                                  leaderId: leaderId,
                                  adminPassword: adminPassword
                              })
                          });

                          const data = await response.json();

                          if (!response.ok) {
                                throw new Error(data.message || 'Error de autenticación');
                            }

                            // Modificamos el modal para mostrar la redirección bonita
                              if (modalBox) {
                                  modalBox.innerHTML = `
                                      <div class="modal-header" style="border-bottom: 0; padding-bottom: 0;">
                                          <h3 class="modal-title" style="color: var(--success-color, #10b981); width: 100%; text-align: center;">
                                              <i class="bi bi-check-circle-fill"></i> ¡Acceso Concedido!
                                          </h3>
                                      </div>
                                      <div class="modal-body" style="text-align: center; padding: 2rem;">
                                          <div class="spinner" style="border: 4px solid var(--border-color, rgba(0,0,0,0.1)); width: 50px; height: 50px; border-radius: 50%; border-left-color: var(--success-color, #10b981); animation: spin 1s linear infinite; margin: 0 auto 1.5rem;"></div>
                                          <h4 style="color: var(--text-color, #333); font-weight: 500; margin-bottom: 0.5rem;">Cambiando contexto...</h4>
                                          <p style="color: var(--text-muted, #666); font-size: 0.95rem;">Redirigiendo al panel del líder.</p>
                                          <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                                      </div>
                                  `;
                              } else {
                                  closeModal();
                                  if (typeof Helpers !== 'undefined') Helpers.showAlert('Acceso concedido. Redirigiendo...', 'success');
                              }

                              // Limpiar cache anterior para evitar conflictos con sessionStorage
                              sessionStorage.clear();

                              // Configurar variables de sesión
                              localStorage.setItem('admin_token', token);
                              sessionStorage.setItem('admin_token', token);
                              
                              localStorage.setItem('token', data.data.token);
                              sessionStorage.setItem('token', data.data.token);

                              localStorage.setItem('role', 'leader'); /* SUPER IMPORTANTE */
                              sessionStorage.setItem('role', 'leader');

                              const leaderInfo = data.data.leader || data.data.user;
                              if (leaderInfo) {
                                  const name = leaderInfo.name;
                                  const id = leaderInfo.id || leaderInfo._id || leaderInfo.leaderId;
                                  
                                  localStorage.setItem('username', name);
                                  sessionStorage.setItem('username', name);
                                  
                                  localStorage.setItem('user', JSON.stringify(leaderInfo));
                                  sessionStorage.setItem('user', JSON.stringify(leaderInfo));
                                  
                                  localStorage.setItem('leaderId', id);
                                  sessionStorage.setItem('leaderId', id);
                              }

                              setTimeout(() => {
                                window.location.href = '/leader.html';
                            }, 1500);

                        } catch (err) {
                          console.error('Impersonation error:', err);
                          if (typeof Helpers !== 'undefined') Helpers.showAlert(err.message || 'Error al intentar acceder', 'error');
                          btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Acceder';
                          btn.disabled = false;
                          btn.style.opacity = '1';
                      }
                  });

                  return;
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
                            qrContainer.textContent = 'Error: Librer├¡a QR no cargada';
                        }
                        
                        const modal = document.getElementById('qrModal');
                        if (modal) modal.classList.add('active');
                    } else {
                        console.error('[Events] Cannot generate QR: missing dependencies');
                        alert('Error: No se puede generar el c├│digo QR');
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
                    const text = `Usuario: ${user}\nContrase├▒a: ${pass}`;
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
