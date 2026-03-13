/**
 * DATA SERVICE
 * Centraliza acceso a datos y API calls
 */

const DataService = {
    shouldDebugTraces() {
        try {
            return window.APP_DEBUG_TRACES === true || localStorage.getItem('debugTraces') === '1';
        } catch (_) {
            return window.APP_DEBUG_TRACES === true;
        }
    },

    trace(...args) {
        if (this.shouldDebugTraces()) console.debug(...args);
    },

    traceWarn(...args) {
        if (this.shouldDebugTraces()) console.warn(...args);
    },

    async parseApiError(response, fallback = 'Error de API') {
        try {
            const raw = await response.text();
            let payload = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch (_) {
                payload = null;
            }
            const msg = payload?.error?.message
                || payload?.error
                || payload?.message
                || raw
                || fallback;
            return `(${response.status}) ${msg}`;
        } catch (_) {
            return `(${response.status}) ${fallback}`;
        }
    },

    extractErrorMessage(data, fallback = 'Error de API') {
        if (!data) return fallback;
        if (typeof data === 'string') return data;
        if (typeof data?.error === 'string') return data.error;
        if (typeof data?.error?.message === 'string') return data.error.message;
        if (typeof data?.message === 'string') return data.message;
        try {
            return JSON.stringify(data?.error || data?.message || data);
        } catch (_) {
            return fallback;
        }
    },

    buildQueryString(params = {}) {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            qs.set(key, String(value));
        });
        return qs.toString();
    },

    normalizePaginatedResponse(raw) {
        if (!raw) {
            return { items: [], total: 0, page: 1, limit: 25, totalPages: 0, source: null };
        }
        const items = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.data) ? raw.data : []);
        const pagination = raw.pagination || {};
        return {
            items,
            total: Number(raw.total ?? pagination.total ?? items.length ?? 0),
            page: Number(raw.page ?? pagination.page ?? 1),
            limit: Number(raw.limit ?? pagination.limit ?? pagination.pageSize ?? 25),
            totalPages: Number(raw.totalPages ?? pagination.totalPages ?? pagination.pages ?? 0),
            source: raw.source || null
        };
    },

    /**
     * Hace una llamada a la API con el token incluido
     */
    async apiCall(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AppState.user.token}`,
            ...options.headers
        };

        const response = await fetch(`${AppState.constants.API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            console.warn('[DataService] Token invalido (401). Limpiando sesion.');
            this.logout();
        }

        return response;
    },

    /**
     * Cierra sesion y redirige
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
     * DEPRECATED: obtiene lideres en memoria
     */
    async getLeaders() {
        const { eventId } = AppState.user;
        const result = await this.getLeadersPaginated({ eventId, page: 1, limit: 200, sort: 'name', order: 'asc' });
        const leaders = result.items || [];
        AppState.setData('leaders', leaders);
        return leaders;
    },

    /**
     * V2: lideres paginados
     */
    async getLeadersPaginated(params = {}) {
        const { eventId } = AppState.user;
        const query = this.buildQueryString({
            page: params.page || 1,
            limit: params.limit || 25,
            sort: params.sort || 'name',
            order: params.order || 'asc',
            search: params.search || '',
            active: params.active,
            includeMetrics: params.includeMetrics,
            eventId: params.eventId || eventId || null
        });
        const endpoint = `/api/v2/leaders${query ? `?${query}` : ''}`;

        console.debug('[V2 TRACE] leaders.table <- /api/v2/leaders', { endpoint });

        try {
            const response = await this.apiCall(endpoint);
            if (!response.ok) {
                const error = await response.text();
                console.error('[DataService] Error en leaders v2:', response.status, error);
                return this.normalizePaginatedResponse(null);
            }
            const data = await response.json();
            return this.normalizePaginatedResponse(data);
        } catch (err) {
            console.error('[DataService] Exception en leaders v2:', err);
            return this.normalizePaginatedResponse(null);
        }
    },

    /**
     * Obtiene lideres simples
     */
    async getLeadersSimple() {
        return AppState.getData('leaders');
    },

    /**
     * Obtiene un lider por ID (v2)
     */
    async getLeaderById(leaderId) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}`);
        const data = await response.json();
        return data.data || data;
    },

    async sendLeaderAccessEmail(leaderId, payload) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}/send-access`, {
            method: 'POST',
            body: JSON.stringify(payload || {})
        });
        return response.json();
    },

    /**
     * Crea o actualiza un lider
     */
    async saveLeader(leaderData) {
        const method = leaderData._id ? 'PUT' : 'POST';
        const endpoint = leaderData._id ? `/api/v2/leaders/${leaderData._id}` : '/api/v2/leaders';
        const response = await this.apiCall(endpoint, {
            method,
            body: JSON.stringify(leaderData)
        });
        const data = await response.json();
        return data.data || data;
    },

    async createLeaderV2(leaderData) {
        const response = await this.apiCall('/api/v2/leaders', {
            method: 'POST',
            body: JSON.stringify(leaderData)
        });
        return response.json();
    },

    async updateLeaderV2(leaderId, leaderData) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}`, {
            method: 'PUT',
            body: JSON.stringify(leaderData)
        });
        return response.json();
    },

    /**
     * Elimina un lider
     */
    async deleteLeader(leaderId) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    async deleteLeaderV2(leaderId) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    /**
     * DEPRECATED: obtiene registros en memoria
     */
    async getRegistrations() {
        const { eventId } = AppState.user;
        const result = await this.getRegistrationsPaginated({
            eventId,
            page: 1,
            limit: 200,
            sort: 'createdAt',
            order: 'desc'
        });
        const regs = result.items || [];
        AppState.setData('registrations', regs);
        return regs;
    },

    /**
     * V2: registros paginados
     */
    async getRegistrationsPaginated(params = {}) {
        const { eventId } = AppState.user;
        const query = this.buildQueryString({
            page: params.page || 1,
            limit: params.limit || 25,
            sort: params.sort || 'createdAt',
            order: params.order || 'desc',
            search: params.search || '',
            eventId: params.eventId || eventId || null,
            leaderId: params.leaderId || '',
            workflowStatus: params.workflowStatus || '',
            dataIntegrityStatus: params.dataIntegrityStatus || '',
            hasFlags: params.hasFlags,
            confirmed: params.confirmed,
            regionScope: params.regionScope || '',
            localidad: params.localidad || '',
            territory: params.territory || '',
            puestoId: params.puestoId || ''
        });
        const endpoint = `/api/v2/registrations${query ? `?${query}` : ''}`;

        console.debug('[V2 TRACE] registrations.table <- /api/v2/registrations', { endpoint });

        try {
            const response = await this.apiCall(endpoint);
            if (!response.ok) {
                const error = await response.text();
                console.error('[DataService] Error en registrations v2:', response.status, error);
                return this.normalizePaginatedResponse(null);
            }
            const data = await response.json();
            return this.normalizePaginatedResponse(data);
        } catch (err) {
            console.error('[DataService] Exception en registrations v2:', err);
            return this.normalizePaginatedResponse(null);
        }
    },

    async getRegistrationById(registrationId) {
        const response = await this.apiCall(`/api/v2/registrations/${registrationId}`);
        const data = await response.json();
        return data.data || data;
    },

    async getRegistrationLocalities({ maxPages = 40, limit = 500 } = {}) {
        const unique = new Set();
        let page = 1;
        let totalPages = 1;
        do {
            const result = await this.getRegistrationsPaginated({
                page,
                limit,
                sort: 'localidad',
                order: 'asc'
            });
            (result.items || []).forEach((reg) => {
                if (reg?.localidad && String(reg.localidad).trim()) {
                    unique.add(String(reg.localidad).trim());
                }
            });
            totalPages = result.totalPages || 1;
            page += 1;
        } while (page <= totalPages && page <= maxPages);
        return [...unique].sort((a, b) => a.localeCompare(b, 'es'));
    },

    /**
     * Obtiene registraciones simple
     */
    async getRegistrationsSimple() {
        return AppState.getData('registrations');
    },

    /**
     * Crea una registracion
     */
    async createRegistration(regData) {
        const response = await this.apiCall('/api/v2/registrations', {
            method: 'POST',
            body: JSON.stringify(regData)
        });
        return response.json();
    },

    /**
     * Actualiza una registracion
     */
    async updateRegistration(regId, regData) {
        const response = await this.apiCall(`/api/v2/registrations/${regId}`, {
            method: 'PUT',
            body: JSON.stringify(regData)
        });
        return response.json();
    },

    async toggleRegistrationConfirmation(regId, isConfirmed) {
        const endpoint = isConfirmed
            ? `/api/v2/registrations/${regId}/unconfirm`
            : `/api/v2/registrations/${regId}/confirm`;
        const response = await this.apiCall(endpoint, { method: 'POST' });
        return response.json();
    },

    async exportRegistrationsV2(filters = {}) {
        const response = await this.apiCall('/api/v2/registrations/export', {
            method: 'POST',
            body: JSON.stringify(filters)
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudo exportar registros v2');
        }
        return data;
    },

    async exportLeadersV2(filters = {}) {
        const response = await this.apiCall('/api/v2/leaders/export', {
            method: 'POST',
            body: JSON.stringify(filters)
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudo exportar líderes v2');
        }
        return data;
    },

    async exportLeaderSummaryV2(filters = {}) {
        const endpoint = '/api/v2/registrations/export/leader-summary';
        const requestUrl = `${AppState.constants.API_URL}${endpoint}`;
        console.info('[EXPORT REAL TRACE] requestUrl=' + requestUrl, { filters });
        const response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(filters)
        });
        console.info('[EXPORT REAL TRACE] responseStatus=' + response.status, { endpoint });
        const rawText = await response.text();
        let data = null;
        try {
            data = rawText ? JSON.parse(rawText) : null;
        } catch (_) {
            data = null;
        }
        if (!response.ok || !data?.success) {
            const backendMessage = data?.error?.message || data?.error || data?.message || rawText || 'Sin detalle';
            throw new Error(`Export leader summary fallo (${response.status}) ${endpoint}: ${backendMessage}`);
        }
        return data;
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
     * Obtiene estadisticas
     */
    async getStats() {
        const metrics = await this.getDashboardMetrics();
        const totals = metrics?.totals || {};
        return {
            totalLeaders: totals.totalLeaders || 0,
            totalRegistrations: totals.totalRegistrations || 0,
            confirmedCount: totals.confirmedCount || 0,
            confirmRate: totals.confirmRate || 0
        };
    },

    /**
     * Obtiene metricas limpias unificadas para dashboard/analytics
     */
    async getDashboardMetrics({ region = 'all', leaderId = null, includeDetails = true } = {}) {
        const storageEventId = window.AppCommon?.getSelectedEventId?.()
            || sessionStorage.getItem('eventId')
            || localStorage.getItem('eventId')
            || null;
        const normalizedEventId = [null, undefined, '', 'null', 'undefined'].includes(storageEventId)
            ? null
            : storageEventId;
        const eventId = AppState.user.eventId || normalizedEventId;
        if (eventId && AppState.user.eventId !== eventId) {
            AppState.setUser({ eventId });
        }
        const params = new URLSearchParams();
        if (eventId) params.set('eventId', eventId);
        if (region && region !== 'all') params.set('region', region);
        if (leaderId) params.set('leaderId', leaderId);
        if (includeDetails === false) params.set('includeDetails', '0');
        const endpoint = params.toString()
            ? `/api/v2/analytics/metrics?${params.toString()}`
            : '/api/v2/analytics/metrics';

        this.trace('[KPI TRACE] Dashboard request -> ' + endpoint, {
            eventId: eventId || null,
            region,
            leaderId: leaderId || null
        });
        if (!eventId) {
            this.traceWarn('[KPI TRACE] Dashboard request sin eventId, usando alcance global');
        }

        const response = await this.apiCall(endpoint);
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudieron obtener metricas limpias');
        }
        return data.data || {};
    },

    /**
     * Obtiene metricas materializadas (Daily/Campaign/Leader/Territory)
     */
    async getMaterializedAnalytics() {
        const { eventId } = AppState.user;
        const params = new URLSearchParams();
        if (eventId) params.set('eventId', eventId);
        const endpoint = params.toString()
            ? `/api/v2/analytics/materialized?${params.toString()}`
            : '/api/v2/analytics/materialized';
        const response = await this.apiCall(endpoint);
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudieron obtener metricas materializadas');
        }
        return data.data || {};
    },

    /**
     * Envia email de acceso a un lider
     */
    async sendAccessEmail(leaderId) {
        return this.sendLeaderAccessEmail(leaderId, {});
    },

    /**
     * Genera una nueva contrasena
     */
    async generatePassword(leaderId) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}/generate-password`, {
            method: 'POST'
        });
        return response.json();
    },

    /**
     * Obtiene credenciales de un lider
     */
    async getLeaderCredentials(leaderId) {
        const response = await this.apiCall(`/api/v2/leaders/${leaderId}/credentials`);
        return response.json();
    },

    /**
     * Obtiene puestos por localidad
     */
    async getPuestosByLocalidad(localidad) {
        try {
            const response = await this.apiCall(`/api/puestos?localidad=${encodeURIComponent(localidad)}`);
            const data = await response.json();
            return data.data || data || [];
        } catch (err) {
            console.error('Error obteniendo puestos:', err);
            return [];
        }
    },

    /**
     * Ejecuta un skill job en backend
     */
    async runSkillJob(skillName, payload = {}) {
        const body = {
            skillName,
            payload: {
                ...payload,
                eventId: payload.eventId || AppState.user.eventId || null
            }
        };
        const response = await this.apiCall('/api/v2/skills/run', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudo iniciar el job');
        }
        return data.data || data;
    },

    /**
     * Lista jobs de skills
     */
    async getSkillJobs(limit = 30) {
        const response = await this.apiCall(`/api/v2/skills/jobs?limit=${encodeURIComponent(limit)}`);
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudieron obtener jobs');
        }
        return data.data || [];
    },

    /**
     * Obtiene detalle de un job
     */
    async getSkillJob(jobId) {
        const response = await this.apiCall(`/api/v2/skills/jobs/${encodeURIComponent(jobId)}`);
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudo obtener el detalle del job');
        }
        return data.data || data;
    },

    /**
     * Obtiene snapshot de salud de datos para dashboard de skills
     */
    async getSkillsHealth() {
        const eventId = AppState.user.eventId || null;
        const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
        const response = await this.apiCall(`/api/v2/skills/health${qs}`);
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudo obtener salud de datos');
        }
        return data.data || {};
    },

    /**
     * Lista inconsistencias detectadas por skills
     */
    async getSkillsInconsistencies({ status = 'open', flagType = '', limit = 80 } = {}) {
        const params = new URLSearchParams();
        if (AppState.user.eventId) params.set('eventId', AppState.user.eventId);
        if (status) params.set('status', status);
        if (flagType) params.set('flagType', flagType);
        if (limit) params.set('limit', String(limit));
        const endpoint = `/api/v2/skills/inconsistencies?${params.toString()}`;
        const response = await this.apiCall(endpoint);
        const data = await response.json();
        if (!response.ok || !data?.success) {
            throw new Error(data?.error || data?.message || 'No se pudieron obtener inconsistencias');
        }
        return data.data || [];
    },

    async syncMesasBogota() {
        let endpoint = '/api/v2/admin/sync-mesas-bogota';
        let response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify({})
        });
        if (response.status === 404) {
            endpoint = '/api/admin/sync-mesas-bogota';
            response = await this.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify({})
            });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = data?.error || data?.message || await this.parseApiError(response, 'No se pudo sincronizar mesas oficiales de Bogotá');
            throw new Error(message);
        }
        return data;
    },

    async getRealDataValidation(params = {}) {
        const query = this.buildQueryString({
            eventId: params.eventId || AppState.user.eventId || '',
            leaderId: params.leaderId || '',
            regionScope: params.regionScope || '',
            localidad: params.localidad || '',
            puesto: params.puesto || '',
            mesa: params.mesa || '',
            estado: params.estado || params.estadoValidacion || '',
            sourceStatus: params.sourceStatus || '',
            search: params.search || '',
            page: params.page || 1,
            limit: params.limit || 25,
            includeInvalidItems: params.includeInvalidItems,
            invalidLimit: params.invalidLimit
        });
        let endpoint = `/api/v2/admin/e14-confirmation/by-mesa${query ? `?${query}` : ''}`;
        let response = await this.apiCall(endpoint, { signal: params.signal });
        if (response.status === 404) {
            endpoint = `/api/admin/e14-confirmation/by-mesa${query ? `?${query}` : ''}`;
            response = await this.apiCall(endpoint, { signal: params.signal });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo consultar validación de datos reales'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async getE14ConfirmationSummary(params = {}) {
        const query = this.buildQueryString({
            eventId: params.eventId || AppState.user.eventId || '',
            leaderId: params.leaderId || '',
            regionScope: params.regionScope || '',
            localidad: params.localidad || '',
            estado: params.estado || params.estadoValidacion || '',
            queue: params.queue || params.workQueue || '',
            ocr: params.ocr || params.sourceStatus || '',
            search: params.search || ''
        });
        let endpoint = `/api/v2/admin/e14-confirmation/summary${query ? `?${query}` : ''}`;
        let response = await this.apiCall(endpoint, { signal: params.signal });
        if (response.status === 404) {
            endpoint = `/api/admin/e14-confirmation/summary${query ? `?${query}` : ''}`;
            response = await this.apiCall(endpoint, { signal: params.signal });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo consultar el resumen E14'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async getE14ConfirmationProgressTree(params = {}) {
        const query = this.buildQueryString({
            eventId: params.eventId || AppState.user.eventId || '',
            leaderId: params.leaderId || '',
            regionScope: params.regionScope || '',
            localidad: params.localidad || '',
            estado: params.estado || '',
            queue: params.queue || '',
            ocr: params.ocr || params.sourceStatus || '',
            search: params.search || ''
        });
        let endpoint = `/api/v2/admin/e14-confirmation/progress-tree${query ? `?${query}` : ''}`;
        let response = await this.apiCall(endpoint, { signal: params.signal });
        if (response.status === 404) {
            endpoint = `/api/admin/e14-confirmation/progress-tree${query ? `?${query}` : ''}`;
            response = await this.apiCall(endpoint, { signal: params.signal });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo consultar el informe de conciliación'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async runRealDataValidation(payload = {}) {
        const body = {
            eventId: payload.eventId || AppState.user.eventId || null,
            leaderId: payload.leaderId || null,
            regionScope: payload.regionScope || '',
            localidad: payload.localidad || '',
            puesto: payload.puesto || '',
            mesa: payload.mesa || '',
            estado: payload.estado || '',
            search: payload.search || '',
            limit: payload.limit || null
        };
        let endpoint = '/api/v2/admin/validacion-datos-reales/run';
        let response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (response.status === 404) {
            endpoint = '/api/admin/validacion-datos-reales/run';
            response = await this.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo ejecutar validación masiva'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async saveE14ConfirmationManual(payload = {}) {
        const body = {
            registrationId: payload.registrationId || null,
            e14ZoneCode: payload.e14ZoneCode || null,
            e14VotesCandidate105: payload.e14VotesCandidate105,
            e14ListVotes: payload.e14ListVotes,
            notes: payload.notes || ''
        };
        let endpoint = '/api/v2/admin/e14-confirmation/manual-save';
        let response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (response.status === 404) {
            endpoint = '/api/admin/e14-confirmation/manual-save';
            response = await this.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo guardar confirmacion E14 manual'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async getE14Confirmation(params = {}) {
        return this.getRealDataValidation(params);
    },

    async getE14ConfirmationByMesa(params = {}) {
        const query = this.buildQueryString({
            eventId: params.eventId || AppState.user.eventId || '',
            leaderId: params.leaderId || '',
            regionScope: params.regionScope || '',
            localidad: params.localidad || '',
            puesto: params.puesto || '',
            mesa: params.mesa || '',
            estado: params.estado || params.estadoValidacion || '',
            queue: params.queue || params.workQueue || '',
            ocr: params.ocr || params.sourceStatus || '',
            search: params.search || '',
            page: params.page || 1,
            limit: params.limit || 25
        });
        let endpoint = `/api/v2/admin/e14-confirmation/by-mesa${query ? `?${query}` : ''}`;
        let response = await this.apiCall(endpoint, { signal: params.signal });
        if (response.status === 404) {
            endpoint = `/api/admin/e14-confirmation/by-mesa${query ? `?${query}` : ''}`;
            response = await this.apiCall(endpoint, { signal: params.signal });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo consultar comparativo E14 por mesa'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async getE14InvalidRows(params = {}) {
        const query = this.buildQueryString({
            eventId: params.eventId || AppState.user.eventId || '',
            regionScope: params.regionScope || '',
            localidad: params.localidad || '',
            search: params.search || '',
            reason: params.reason || '',
            reviewStatus: params.reviewStatus || '',
            page: params.page || 1,
            limit: params.limit || 25,
            countOnly: params.countOnly ? 1 : ''
        });
        let endpoint = `/api/v2/admin/e14-confirmation/invalid-rows${query ? `?${query}` : ''}`;
        let response = await this.apiCall(endpoint, { signal: params.signal });
        if (response.status === 404) {
            endpoint = `/api/admin/e14-confirmation/invalid-rows${query ? `?${query}` : ''}`;
            response = await this.apiCall(endpoint, { signal: params.signal });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo consultar registros excluidos'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async previewE14ExcelImport(payload = {}) {
        const { signal, ...body } = payload;
        let endpoint = '/api/v2/admin/e14-confirmation/import/preview';
        let response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            signal
        });
        if (response.status === 404) {
            endpoint = '/api/admin/e14-confirmation/import/preview';
            response = await this.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
                signal
            });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo generar la vista previa de importación E14'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async applyE14ExcelImport(payload = {}) {
        const { signal, ...body } = payload;
        let endpoint = '/api/v2/admin/e14-confirmation/import/apply';
        let response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            signal
        });
        if (response.status === 404) {
            endpoint = '/api/admin/e14-confirmation/import/apply';
            response = await this.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
                signal
            });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo aplicar la importación E14'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async getE14ImportHistory(params = {}) {
        const query = this.buildQueryString({
            eventId: params.eventId || AppState.user.eventId || '',
            search: params.search || '',
            page: params.page || 1,
            limit: params.limit || 10
        });
        let endpoint = `/api/v2/admin/e14-confirmation/import/history${query ? `?${query}` : ''}`;
        let response = await this.apiCall(endpoint, { signal: params.signal });
        if (response.status === 404) {
            endpoint = `/api/admin/e14-confirmation/import/history${query ? `?${query}` : ''}`;
            response = await this.apiCall(endpoint, { signal: params.signal });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo cargar el historial de importaciones E14'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async saveE14ConfirmationByMesaManual(payload = {}) {
        const body = {
            eventId: payload.eventId || AppState.user.eventId || null,
            localidad: payload.localidad || '',
            puesto: payload.puesto || '',
            mesa: payload.mesa,
            zoneCode: payload.zoneCode || null,
            votosE14Candidate105: payload.votosE14Candidate105,
            e14ListVotes: payload.e14ListVotes,
            notes: payload.notes || ''
        };
        let endpoint = '/api/v2/admin/e14-confirmation/by-mesa/manual-save';
        let response = await this.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        if (response.status === 404) {
            endpoint = '/api/admin/e14-confirmation/by-mesa/manual-save';
            response = await this.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(body)
            });
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo guardar confirmacion por mesa'));
            throw new Error(message);
        }
        return data.data || data || {};
    },

    async getOfficialCorrectionCatalog(params = {}) {
        const query = this.buildQueryString({
            localidad: params.localidad || ''
        });
        const response = await this.apiCall(`/api/v2/registrations/official-catalog/options${query ? `?${query}` : ''}`);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo cargar el catálogo oficial de corrección'));
            throw new Error(message);
        }
        return data.data || {};
    },

    async previewOfficialCorrection(registrationId, payload = {}) {
        const response = await this.apiCall(`/api/v2/registrations/${encodeURIComponent(registrationId)}/official-correction/preview`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo previsualizar la corrección'));
            throw new Error(message);
        }
        return data.data || {};
    },

    async applyOfficialCorrection(registrationId, payload = {}) {
        const response = await this.apiCall(`/api/v2/registrations/${encodeURIComponent(registrationId)}/official-correction/apply`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo aplicar la corrección'));
            throw new Error(message);
        }
        return data.data || {};
    },

    async getOfficialCorrectionHistory(registrationId) {
        const response = await this.apiCall(`/api/v2/registrations/${encodeURIComponent(registrationId)}/official-correction/history`);
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
            const message = this.extractErrorMessage(data, await this.parseApiError(response, 'No se pudo cargar el historial de correcciones'));
            throw new Error(message);
        }
        return data.data || [];
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataService;
}
