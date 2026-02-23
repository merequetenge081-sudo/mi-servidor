/**
 * DATA SERVICE
 * Centraliza acceso a datos y API calls
 * Evita duplicación de lógica de fetch
 */

const DataService = {
    /**
     * Hace una llamada a la API con el token incluido
     */
    async apiCall(endpoint, options = {}) {
        const { user } = AppState.getUser();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AppState.user.token}`,
            ...options.headers
        };

        const response = await fetch(`${AppState.constants.API_URL}${endpoint}`, {
            ...options,
            headers
        });

        // Si token inválido, limpiar sesión
        if (response.status === 401) {
            console.warn('[DataService] Token inválido (401). Limpiando sesión.');
            this.logout();
        }

        return response;
    },

    /**
     * Cierra sesión y redirige
     */
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('eventId');
        localStorage.removeItem('username');
        localStorage.removeItem('eventName');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('eventId');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('eventName');
        window.location.href = '/';
    },

    /**
     * Obtiene todos los líderes
     */
    async getLeaders() {
        const { eventId } = AppState.user;
        const endpoint = `/api/leaders${eventId ? '?eventId=' + eventId : ''}`;
        console.log('[DataService] Llamando getLeaders:', endpoint);
        
        try {
            const response = await this.apiCall(endpoint);
            console.log('[DataService] Response status:', response.status, response.ok);
            
            if (!response.ok) {
                const error = await response.text();
                console.error('[DataService] Error en API:', response.status, error);
                console.warn('[DataService] Retornando array vacío');
                return [];
            }
            
            const data = await response.json();
            console.log('[DataService] Raw leaders data:', data);
            
            const leaders = Array.isArray(data) ? data : (data.data || []);
            console.log('[DataService] Leaders cargados:', leaders.length);
            AppState.setData('leaders', leaders);
            return leaders;
        } catch (err) {
            console.error('[DataService] Exception en getLeaders:', err);
            return [];
        }
    },

    /**
     * Obtiene líderes simples
     */
    async getLeadersSimple() {
        return AppState.getData('leaders');
    },

    /**
     * Obtiene un líder por ID
     */
    async getLeaderById(leaderId) {
        const response = await this.apiCall(`/api/leaders/${leaderId}`);
        const data = await response.json();
        return data.data || data;
    },

    /**
     * Crea o actualiza un líder
     */
    async saveLeader(leaderData) {
        const method = leaderData._id ? 'PUT' : 'POST';
        const endpoint = leaderData._id ? `/api/leaders/${leaderData._id}` : '/api/leaders';
        const response = await this.apiCall(endpoint, {
            method,
            body: JSON.stringify(leaderData)
        });
        const data = await response.json();
        return data.data || data;
    },

    /**
     * Elimina un líder
     */
    async deleteLeader(leaderId) {
        const response = await this.apiCall(`/api/leaders/${leaderId}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    /**
     * Obtiene todas las registraciones
     */
    async getRegistrations() {
        const { eventId } = AppState.user;
        const endpoint = `/api/registrations${eventId ? '?eventId=' + eventId + '&' : '?'}limit=2000`;
        console.log('[DataService] Llamando getRegistrations:', endpoint);
        
        try {
            const response = await this.apiCall(endpoint);
            console.log('[DataService] Response status:', response.status, response.ok);
            
            if (!response.ok) {
                const error = await response.text();
                console.error('[DataService] Error en API:', response.status, error);
                console.warn('[DataService] Retornando array vacío');
                return [];
            }
            
            const data = await response.json();
            console.log('[DataService] Raw data:', data);
            
            const regs = Array.isArray(data) ? data : (data.data || []);
            console.log('[DataService] Registrations cargadas:', regs.length);
            AppState.setData('registrations', regs);
            return regs;
        } catch (err) {
            console.error('[DataService] Exception en getRegistrations:', err);
            return [];
        }
    },

    /**
     * Obtiene registraciones simple
     */
    async getRegistrationsSimple() {
        return AppState.getData('registrations');
    },

    /**
     * Crea una registración
     */
    async createRegistration(regData) {
        const response = await this.apiCall('/api/registrations', {
            method: 'POST',
            body: JSON.stringify(regData)
        });
        return response.json();
    },

    /**
     * Actualiza una registración
     */
    async updateRegistration(regId, regData) {
        const response = await this.apiCall(`/api/registrations/${regId}`, {
            method: 'PUT',
            body: JSON.stringify(regData)
        });
        return response.json();
    },

    /**
     * Obtiene eventos
     */
    async getEvents() {
        const response = await this.apiCall('/api/events');
        const data = await response.json();
        const events = Array.isArray(data) ? data : (data.data || []);
        AppState.setData('events', events);
        return events;
    },

    /**
     * Obtiene estadísticas
     */
    async getStats() {
        const leaders = AppState.getData('leaders');
        const registrations = AppState.getData('registrations');

        const confirmed = registrations.filter(r => r.confirmed).length;
        const rate = registrations.length > 0 ? ((confirmed / registrations.length) * 100).toFixed(1) : 0;

        return {
            totalLeaders: leaders.length,
            totalRegistrations: registrations.length,
            confirmedCount: confirmed,
            confirmRate: rate
        };
    },

    /**
     * Envía email de acceso a un líder
     */
    async sendAccessEmail(leaderId) {
        const response = await this.apiCall(`/api/leaders/${leaderId}/send-access-email`, {
            method: 'POST'
        });
        return response.json();
    },

    /**
     * Genera una nueva contraseña
     */
    async generatePassword(leaderId) {
        const response = await this.apiCall(`/api/leaders/${leaderId}/generate-password`, {
            method: 'POST'
        });
        return response.json();
    },

    /**
     * Obtiene credenciales de un líder
     */
    async getLeaderCredentials(leaderId) {
        const response = await this.apiCall(`/api/leaders/${leaderId}/credentials`);
        return response.json();
    },

    /**
     * Obtiene puestos por localidad
     */
    async getPuestosByLocalidad(localidad) {
        try {
            const response = await this.apiCall(`/api/puestos/${localidad}`);
            const data = await response.json();
            return data.data || data || [];
        } catch (err) {
            console.error('Error obteniendo puestos:', err);
            return [];
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataService;
}
