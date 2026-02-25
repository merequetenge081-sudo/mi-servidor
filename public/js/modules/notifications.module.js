/**
 * NOTIFICATIONS MODULE
 * Gestiona todo relacionado con notificaciones
 */

const NotificationsModule = {
    /**
     * Inicializa el módulo
     */
    init() {
        console.log('[NotificationsModule] Inicializando...');
        this.bindEvents();
    },

    /**
     * Vincula eventos
     */
    bindEvents() {
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notificationsDropdown');
            const btn = document.getElementById('notificationsBtn');

            if (!dropdown || !dropdown.classList.contains('active')) return;

            if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
                dropdown.classList.remove('active');
            }
        });
    },

    async toggleDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown) return;

        if (dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
            return;
        }

        dropdown.classList.add('active');
        if (typeof window.loadDeletionRequests === 'function') {
            await window.loadDeletionRequests();
        }
        await this.loadNotifications();
    },

    /**
     * Actualiza el badge de notificaciones
     */
    async updateBadge() {
        try {
            const leaders = AppState.getData('leaders');
            const leadersWithRequests = leaders.filter(l => l.passwordResetRequested);
            const pendingDeletion = this.getPendingDeletionRequests();
            const count = leadersWithRequests.length + pendingDeletion.length;

            this.setBadge(count);
        } catch (err) {
            console.error('[NotificationsModule] Error actualizando badge:', err);
        }
    },

    /**
     * Setea el valor del badge
     */
    setBadge(count) {
        const badge = document.getElementById('notificationsBadge');
        const badgeMenu = document.getElementById('notificationsBadgeMenu');

        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        if (badgeMenu) {
            if (count > 0) {
                badgeMenu.textContent = count;
                badgeMenu.style.display = 'flex';
            } else {
                badgeMenu.style.display = 'none';
            }
        }
    },

    /**
     * Carga y renderiza notificaciones
     */
    async loadNotifications() {
        try {
            const content = document.getElementById('notificationsContent');
            if (!content) return;

            const leaders = AppState.getData('leaders');
            const leadersWithRequests = leaders.filter(l => l.passwordResetRequested);
            const pendingDeletion = this.getPendingDeletionRequests();

            if (leadersWithRequests.length === 0 && pendingDeletion.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #999;">
                        <i class="bi bi-bell-slash" style="font-size: 60px; opacity: 0.3; margin-bottom: 15px;"></i>
                        <p style="font-size: 16px;">No hay solicitudes de restablecimiento</p>
                    </div>
                `;
                return;
            }

            let html = '';

            if (pendingDeletion.length > 0) {
                html += pendingDeletion.map(req => {
                    const leader = leaders.find(l => l._id === req.leaderId);
                    const leaderName = leader ? leader.name : 'Líder desconocido';
                    return `
                        <div style="padding: 15px; border-bottom: 1px solid #eee; background: #fef3f2;">
                            <div style="font-weight: 600; color: #dc2626; margin-bottom: 6px;">
                                <i class="bi bi-trash-fill"></i> Solicitud de Eliminación
                            </div>
                            <div style="font-size: 13px; color: #666;">
                                <i class="bi bi-person-fill"></i> ${leaderName}
                            </div>
                            <div style="font-size: 12px; color: #999; margin-top: 4px;">
                                <i class="bi bi-file-text"></i> ${req.registrationCount || 0} registros
                            </div>
                        </div>
                    `;
                }).join('');
            }

            html += leadersWithRequests.map(leader => `
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
                    <button class="btn btn-sm btn-danger" data-action="notif-gen-pass" data-leader-id="${leader._id}" style="white-space: nowrap;">
                        <i class="bi bi-key"></i> Generar Contraseña
                    </button>
                </div>
            `).join('');

            content.innerHTML = html;
        } catch (err) {
            console.error('[NotificationsModule] Error cargando notificaciones:', err);
            const content = document.getElementById('notificationsContent');
            if (content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #dc3545;">
                        <i class="bi bi-exclamation-circle"></i> Error al cargar notificaciones
                    </div>
                `;
            }
        }
    },

    getPendingDeletionRequests() {
        const requests = Array.isArray(window.deletionRequests) ? window.deletionRequests : [];
        return requests.filter(req => (req?.status || 'pending').toString().toLowerCase() === 'pending');
    }
};

// Auto-init si el DOM está listo
if (document.readyState !== 'loading') {
    NotificationsModule.init();
} else {
    document.addEventListener('DOMContentLoaded', () => NotificationsModule.init());
}

// Export to window
window.NotificationsModule = NotificationsModule;

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationsModule;
}
