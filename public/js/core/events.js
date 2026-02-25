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
                    Helpers.showAlert('Solo puedes generar una nueva contraseña si el líder la solicita.', 'warning');
                    return;
                }
                LeadersModule.openResetPassModal(genPassBtn.dataset.leaderId);
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
            const qrBtn = target.closest('.qr-btn');
            if (qrBtn) {
                closeAllActionMenus();
                ModalsModule.showQR(qrBtn.dataset.leaderId, qrBtn.dataset.leaderName);
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
                ModalsModule.closeModal(closeModalBtn.dataset.closeModal);
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
                ModalsModule.toggleSidebar();
                return;
            }

            // Dark mode toggle - Prevenir bubbling
            if (target.closest('.theme-toggle')) {
                e.stopPropagation();
                e.preventDefault();
                ModalsModule.toggleDarkMode();
                return;
            }

            // Notifications dropdown
            if (target.closest('#notificationsBtn')) {
                e.stopPropagation();
                e.preventDefault();
                ModalsModule.toggleNotificationsDropdown();
                return;
            }

            // Help drawer - PRIMERO el toggle para prevenir bubbling
            if (target.closest('[data-action="help-toggle"]')) {
                e.stopPropagation();
                e.preventDefault();
                ModalsModule.toggleHelpDrawer();
                return;
            }

            if (target.closest('[data-action="help-close"]')) {
                e.stopPropagation();
                e.preventDefault();
                ModalsModule.closeHelpDrawer();
                return;
            }

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
                ModalsModule.openModal('logoutModal');
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

        if (searchInput) searchInput.addEventListener('change', applyRegistrationFilters);
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
