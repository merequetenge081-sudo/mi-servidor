/**
 * MODALS MODULE
 * Gestiona todos los modales de forma centralizada
 */

const ModalsModule = {
    /**
     * Init - bind all event listeners
     */
    init() {
        console.log('[ModalsModule] Inicializando...');
        this.bindCloseButtons();
        this.bindOverlayClose();
        this.bindHelpDrawerClose();
    },

    /**
     * Bind help drawer close on overlay click
     */
    bindHelpDrawerClose() {
        const overlay = document.getElementById('helpOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeHelpDrawer();
                }
            });
        }

        // Also bind close button in help drawer
        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('[data-action="help-close"]');
            if (closeBtn && (closeBtn.closest('#helpDrawer') || closeBtn.id === 'helpOverlay')) {
                e.preventDefault();
                e.stopPropagation();
                this.closeHelpDrawer();
            }
        });
    },

    /**
     * Abre un modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            AppState.addModal(modalId);
            console.log(`[ModalsModule] Modal abierto: ${modalId}`);
        }
    },

    /**
     * Cierra un modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            AppState.removeModal(modalId);
            console.log(`[ModalsModule] Modal cerrado: ${modalId}`);
        }
    },

    /**
     * Cierra todos los modales
     */
    closeAllModals() {
        AppState.clearAllModals();
        console.log('[ModalsModule] Todos los modales cerrados');
    },

    /**
     * Vincula botones de cierre
     */
    bindCloseButtons() {
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = btn.closest('.modal-overlay');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    },

    /**
     * Cierra modal al hacer click fuera
     */
    bindOverlayClose() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    },

    /**
     * Muestra una alerta
     */
    async showAlert(message, type = 'info') {
        return new Promise(resolve => {
            const isDarkMode = Helpers.isDarkMode();
            const palette = {
                info: { bg: '#667eea', text: 'Información' },
                success: { bg: '#28a745', text: 'Listo' },
                warning: { bg: '#f0ad4e', text: 'Atención' },
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
    },

    /**
     * Muestra una confirmación
     */
    async showConfirm(message) {
        return new Promise(resolve => {
            const isDarkMode = Helpers.isDarkMode();
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
            cancelBtn.addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });

            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.style.cssText = 'border: none; border-radius: 10px; padding: 11px 28px; background: #dc2626; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 14px; min-width: 110px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);';
            okBtn.textContent = 'Aceptar';
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
        });
    },

    /**
     * Muestra QR code de líder
     */
    showQR(leaderId, leaderName) {
        const qrContainer = document.getElementById('qrCode');
        if (!qrContainer) {
            console.error('[ModalsModule] qrCode container not found');
            return;
        }

        qrContainer.innerHTML = '';

        // Find leader to get token
        const leader = AppState.data.leaders.find(l => l._id === leaderId);
        const token = leader ? (leader.token || leader.leaderId || leaderId) : leaderId;

        const API_URL = window.location.origin;
        const link = `${API_URL}/form.html?token=${token}`;
        const linkInput = document.getElementById('qrLink');
        if (linkInput) linkInput.value = link;

        // Check if QRCode library is loaded
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, { text: link, width: 250, height: 250 });
        } else {
            console.error('[ModalsModule] QRCode library not loaded');
            qrContainer.textContent = 'Error: Librería QR no cargada';
        }

        this.openModal('qrModal');
    },

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
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
    },

    /**
     * Toggle dark mode (con debounce para evitar múltiples toggles rápidos)
     */
    toggleDarkMode() {
        // Prevenir múltiples toggles en mismo frame
        if (this._darkModeToggling) return;
        this._darkModeToggling = true;
        
        const clearFlag = () => {
            this._darkModeToggling = false;
        };
        
        try {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
            console.log('[ModalsModule] Dark mode toggled:', isDark ? 'ON' : 'OFF');
            
            // Apply smooth transition
            document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            setTimeout(() => { document.body.style.transition = ''; }, 300);
        } catch (e) {
            console.error('[ModalsModule] Error toggling dark mode:', e);
        } finally {
            setTimeout(clearFlag, 100);
        }
    }

    /**
     * Toggle notifications dropdown
     */
    toggleNotificationsDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');

        if (!dropdown) {
            Helpers.showAlert('Las notificaciones estarán disponibles próximamente', 'info');
            return;
        }

        const isActive = dropdown.classList.contains('active');

        // Close help drawer if open
        this.closeHelpDrawer();

        if (isActive) {
            dropdown.classList.remove('active');
        } else {
            dropdown.classList.add('active');
        }
    },

    /**
     * Toggle help drawer
     */
    toggleHelpDrawer() {
        try {
            const drawer = document.getElementById('helpDrawer');
            const overlay = document.getElementById('helpOverlay');

            if (!drawer || !overlay) {
                console.warn('[ModalsModule] Help drawer elements not found');
                if (typeof Helpers !== 'undefined' && Helpers.showAlert) {
                    Helpers.showAlert('La ayuda está en construcción', 'info');
                }
                return;
            }

            console.log('[ModalsModule] Toggling help drawer');
            const isActive = drawer.classList.contains('active');

            this.closeNotificationsDropdown();

            if (isActive) {
                this.closeHelpDrawer();
            } else {
                // Cierra otros dropdowns primero
                this.closeNotificationsDropdown();
                
                drawer.classList.add('active');
                overlay.classList.add('active');
                drawer.setAttribute('aria-hidden', 'false');
                overlay.setAttribute('aria-hidden', 'false');
                
                // Prevenir bubbling inmediato
                setTimeout(() => {
                    this.updateHelpContent();
                }, 50);
                
                console.log('[ModalsModule] Help drawer opened');
            }
        } catch (e) {
            console.error('[ModalsModule] Error toggling help drawer:', e);
        }
    }

    /**
     * Close help drawer
     */
    closeHelpDrawer() {
        try {
            const drawer = document.getElementById('helpDrawer');
            const overlay = document.getElementById('helpOverlay');
            
            // Prevenir cierre múltiple
            if (drawer && !drawer.classList.contains('active')) {
                return; // Ya está cerrado
            }
            
            if (drawer) {
                drawer.classList.remove('active');
                drawer.setAttribute('aria-hidden', 'true');
            }
            if (overlay) {
                overlay.classList.remove('active');
                overlay.setAttribute('aria-hidden', 'true');
            }
            console.log('[ModalsModule] Help drawer closed');
        } catch (e) {
            console.error('[ModalsModule] Error closing help drawer:', e);
        }
    },

    /**
     * Close notifications dropdown
     */
    closeNotificationsDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (dropdown) dropdown.classList.remove('active');
    },

    /**
     * Update help content based on active section
     */
    updateHelpContent() {
        const activeSection = document.querySelector('.nav-link.active');
        const sectionKey = activeSection ? activeSection.dataset.section : 'dashboard';
        const helpContent = window.helpContent || {};
        const content = helpContent[sectionKey] || helpContent.dashboard || { sections: [] };
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
};

// Auto-init
if (document.readyState !== 'loading') {
    ModalsModule.init();
} else {
    document.addEventListener('DOMContentLoaded', () => ModalsModule.init());
}

// Export to window
window.ModalsModule = ModalsModule;

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalsModule;
}
