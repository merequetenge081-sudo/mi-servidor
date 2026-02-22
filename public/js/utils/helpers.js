/**
 * HELPER UTILITIES
 * Funciones helper generales y reutilizables
 */

const Helpers = {
    /**
     * Obtiene localidades de Bogotá
     */
    getBogotaLocalidades() {
        return AppState.constants.BOGOTA_LOCALIDADES;
    },

    /**
     * Verifica si una registración es de Bogotá
     */
    isBogotaRegistration(registration) {
        const bogota = this.getBogotaLocalidades();
        return bogota.includes(registration.localidad);
    },

    /**
     * Touch de actividad para session timeout
     */
    touchActivity() {
        localStorage.setItem('lastActivity', Date.now().toString());
    },

    /**
     * Verifica si la sesión expiró
     */
    isSessionExpired() {
        const last = parseInt(localStorage.getItem('lastActivity') || '0', 10);
        if (!last) return false;
        return Date.now() - last > AppState.constants.SESSION_TIMEOUT_MS;
    },

    /**
     * Valida que el usuario esté autenticado
     */
    async checkAuth() {
        if (!AppState.user.token) {
            window.location.href = '/';
            return false;
        }

        if (!AppState.user.eventId) {
            try {
                const events = await DataService.getEvents();
                const active = events.find(e => e.active) || events[0];
                if (active) {
                    AppState.setUser({
                        eventId: active._id,
                        eventName: active.name
                    });
                    localStorage.setItem('eventId', active._id);
                    localStorage.setItem('eventName', active.name);
                    sessionStorage.setItem('eventId', active._id);
                    sessionStorage.setItem('eventName', active.name);
                }
            } catch (err) {
                console.error('Error verificando auth:', err);
                this.showAuthError(err.message);
            }
        }

        return true;
    },

    /**
     * Muestra error de autenticación
     */
    showAuthError(message) {
        const body = document.querySelector('body');
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'position:fixed;top:50px;left:0;width:100%;background:#f59e0b;color:black;text-align:center;padding:10px;z-index:9999;';
        errDiv.textContent = `Error: ${message}. Verifica que el backend esté corriendo.`;
        body.appendChild(errDiv);
    },

    /**
     * Debounce para funciones
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle para funciones
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Copia texto al portapapeles
     */
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Error copiando:', err);
            });
        } else {
            // Fallback para navegadores antiguos
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    },

    /**
     * Pausa la ejecución
     */
    sleep(ms = 1000) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Obtiene el tema actual (light/dark)
     */
    isDarkMode() {
        return document.body.classList.contains('dark-mode');
    },

    /**
     * Genera un ID único
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Parse URL params
     */
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    /**
     * Enforce session timeout
     */
    enforceSessionTimeout() {
        if (!AppState.user.token) return false;
        if (this.isSessionExpired()) {
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
    },

    /**
     * Bind session activity listeners
     */
    bindSessionActivity() {
        const self = this;
        ['mousemove', 'keydown', 'click', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, () => self.touchActivity(), { passive: true });
        });
    },

    /**
     * Confirm logout and clear session
     */
    async confirmLogout() {
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
            console.log('[Helpers] Logout server error (ignored):', e);
        }

        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('eventId');
        localStorage.removeItem('username');
        localStorage.removeItem('leaderId');
        localStorage.removeItem('lastActivity');
        localStorage.removeItem('darkMode');
        localStorage.removeItem('sidebarCollapsed');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('eventId');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('darkMode');
        window.location.href = '/';
    },

    /**
     * Show Alert - Compatibility wrapper
     */
    showAlert(message, type = 'info') {
        return ModalsModule.showAlert(message, type);
    },

    /**
     * Show dark mode status
     */
    isDarkMode() {
        return document.body.classList.contains('dark-mode');
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Helpers;
}
