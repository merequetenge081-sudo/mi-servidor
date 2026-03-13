/**
 * EXPORTS MODULE
 * =====================================================
 * Encapsula TODA la lÃ³gica de exportaciÃ³n a Excel
 * - Exportar registros (todos, por regiÃ³n, por lÃ­der)
 * - Exportar lÃ­deres
 * - Exportar estadÃ­sticas
 * 
 * ARQUITECTURA:
 * - MÃ©todos privados para lÃ³gica interna
 * - API pÃºblica para llamadas externas
 * - Event listeners binding automÃ¡tico
 */

const ExportsModule = (() => {
    'use strict';

    let initialized = false;
    let eventsBound = false;

    // ====== HELPER: showAlert ======
    function showAlert(message, type = 'info') {
        if (typeof ModalsModule !== 'undefined' && ModalsModule.showAlert) {
            return ModalsModule.showAlert(message, type);
        }
        // Fallback
        alert(message);
        return Promise.resolve(true);
    }

    function formatError(err) {
        if (!err) return 'Error desconocido';
        if (typeof err === 'string') return err;
        if (err instanceof Error) return err.message || 'Error desconocido';
        if (typeof err === 'object') {
            try {
                return err.message || err.error?.message || err.error || JSON.stringify(err);
            } catch (_) {
                return String(err);
            }
        }
        return String(err);
    }

    function resolveCurrentEventId() {
        return (window.AppCommon?.getSelectedEventId?.()
            || sessionStorage.getItem('eventId')
            || localStorage.getItem('eventId')
            || AppState?.user?.eventId
            || '');
    }

    function getCanonicalPuestoLabel(reg) {
        return reg?.puestoId?.nombre || reg?.votingPlace || reg?.legacyVotingPlace || '';
    }

    // ====== PRIVATE HELPERS ======

    /**
     * Exporta datos a Excel usando XLSX
     */
    function exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') {
            showAlert('Error: LibrerÃ­a Excel (XLSX) no cargada. Recarga la pÃ¡gina.', 'error');
            return false;
        }
        try {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Datos');
            XLSX.writeFile(wb, filename);
            showAlert('Archivo descargado correctamente', 'success');
            return true;
        } catch (e) {
            console.error('[ExportsModule] Error:', e);
            showAlert('Error generando Excel: ' + e.message, 'error');
            return false;
        }
    }

    function getActiveRegistrationFilters() {
        const search = document.getElementById('searchInput')?.value?.trim() || '';
        const leaderId = document.getElementById('leaderFilter')?.value || '';
        const unified = document.getElementById('unifiedFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const eventId = resolveCurrentEventId();
        const filters = {
            search,
            leaderId: leaderId || undefined,
            eventId: eventId || undefined,
            sort: 'createdAt',
            order: 'desc'
        };
        if (status === 'confirmed') filters.confirmed = true;
        if (status === 'pending') filters.confirmed = false;
        if (unified === 'confirmed') filters.confirmed = true;
        if (unified === 'pending') filters.confirmed = false;
        if (unified === 'needs_review') filters.dataIntegrityStatus = 'needs_review';
        if (unified === 'no_review') filters.dataIntegrityStatus = 'valid';
        if (unified === 'with_phone') filters.hasPhone = true;
        if (unified === 'without_phone') filters.hasPhone = false;
        if (unified === 'duplicate') filters.workflowStatus = 'duplicate';
        if (unified === 'flagged') filters.hasFlags = true;
        console.info('[EXPORT REAL TRACE] button -> function=getActiveRegistrationFilters -> endpoint=/api/v2/registrations/export', {
            eventId: filters.eventId || null,
            leaderId: filters.leaderId || null,
            status,
            unified
        });
        return filters;
    }

    function getLeaderSummaryBaseFilters() {
        const universe = document.getElementById('exportLeaderUniverse')?.value || 'global';
        const eventId = resolveCurrentEventId();
        const base = {
            universe,
            sort: 'createdAt',
            order: 'desc'
        };
        const filters = universe === 'global'
            ? base
            : {
                ...base,
                eventId: eventId || undefined
            };
        console.info('[EXPORT COUNT TRACE] leaderSummary base filters', filters);
        return filters;
    }

    async function fetchRegistrationsPaginatedForExport(extraFilters = {}) {
        const baseFilters = getActiveRegistrationFilters();
        const merged = { ...baseFilters, ...extraFilters };
        console.info('[EXPORT REAL TRACE] function=fetchRegistrationsPaginatedForExport -> DataService.exportRegistrationsV2 -> endpoint=/api/v2/registrations/export -> backend=registration.controller.exportRegistrations', {
            eventId: merged.eventId || null,
            regionScope: merged.regionScope || 'all',
            leaderId: merged.leaderId || null
        });
        const payload = await DataService.exportRegistrationsV2(merged);
        const items = payload.items || [];

        return items;
    }

    async function fetchLeadersForExport() {
        const payload = await DataService.exportLeadersV2({
            limit: 2000,
            sort: 'name',
            order: 'asc',
            includeMetrics: true
        });
        const items = payload.items || [];
        return items;
    }

    async function fetchLeaderSummaryForExport(extraFilters = {}) {
        const universe = extraFilters.universe || document.getElementById('exportLeaderUniverse')?.value || 'global';
        const baseFilters = universe === 'filtered'
            ? getActiveRegistrationFilters()
            : getLeaderSummaryBaseFilters();
        const merged = { ...baseFilters, ...extraFilters };
        merged.universe = universe;
        console.info('[EXPORT REAL TRACE] function=fetchLeaderSummaryForExport -> DataService.exportLeaderSummaryV2 -> endpoint=/api/v2/registrations/export/leader-summary -> backend=registration.controller.exportLeaderSummary', {
            eventId: merged.eventId || null,
            regionScope: merged.regionScope || 'all',
            leaderId: merged.leaderId || null,
            universe: merged.universe || 'event'
        });
        console.info('[EXPORT COUNT TRACE] filters=' + JSON.stringify(merged));
        const payload = await DataService.exportLeaderSummaryV2(merged);
        return payload.items || [];
    }

    /**
     * Bind event listeners
     * âœ… FASE 4: Todos los listeners removidos y delegados a core/events.js
     */
    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;

        // Los eventos del mÃ³dulo ahora son manejados por delegaciÃ³n centralizada:
        // - Exportar registrations (BogotÃ¡, Resto, Todos)
        // - Exportar lÃ­deres
        // - Exportar por lÃ­der
        // - Exportar estadÃ­sticas
        // Ver: core/events.js > bindGlobalClicks()

        console.log('âœ… ExportsModule events bound (delegated to Events.js)');
    }

    // ====== PUBLIC API ======

    /**
     * Inicializa el mÃ³dulo
     */
    function init() {
        if (initialized) return;
        initialized = true;
        console.log('ðŸš€ ExportsModule.init()');
        bindEvents();
    }

    /**
     * Exporta TODOS los registros
     */
    async function exportAllRegistrations() {
        const registrations = await fetchRegistrationsPaginatedForExport();
        const data = registrations.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            'Cedula': r.cedula || '',
            'Telefono': r.phone || '',
            Localidad: r.localidad || '',
            Departamento: r.departamento || '',
            'Lider': r.leaderName || '',
            Puesto: getCanonicalPuestoLabel(r),
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        }));
        exportToExcel(data, `registros_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Exporta registros de BogotÃ¡
     */
    async function exportBogota() {
        const bogota = await fetchRegistrationsPaginatedForExport({ regionScope: 'bogota' });
        const data = bogota.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            'Cedula': r.cedula || '',
            'Telefono': r.phone || '',
            Localidad: r.localidad || '',
            'Lider': r.leaderName || '',
            Puesto: getCanonicalPuestoLabel(r),
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        }));
        exportToExcel(data, `registros_bogota_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Exporta registros del Resto del PaÃ­s
     */
    async function exportResto() {
        const resto = await fetchRegistrationsPaginatedForExport({ regionScope: 'resto' });
        const data = resto.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            'Cedula': r.cedula || '',
            'Telefono': r.phone || '',
            Departamento: r.departamento || '',
            'Lider': r.leaderName || '',
            Puesto: getCanonicalPuestoLabel(r),
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        }));
        exportToExcel(data, `registros_resto_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Exporta TODOS los lÃ­deres
     */
    async function exportAllLeaders() {
        try {
            const summary = await fetchLeaderSummaryForExport();
            const universe = document.getElementById('exportLeaderUniverse')?.value || 'global';
            const universeLabel = universe === 'global' ? 'historico' : universe === 'filtered' ? 'filtrado' : 'evento';

            if (summary.length === 0) {
                showAlert('No hay lideres para exportar', 'warning');
                return;
            }

            const data = summary.map((row) => ({
                leaderId: row.leaderId || '',
                Nombre: row.displayName || 'Sin lider',
                Registros: Number(row.total || 0),
                Confirmados: Number(row.confirmed || 0),
                Pendientes: Number(row.pending || 0),
                Variantes: Array.isArray(row.rawNames) ? row.rawNames.join(' | ') : ''
            }));
            summary.slice(0, 40).forEach((row) => {
                console.info(`[EXPORT REAL TRACE] leaderId=${row.leaderId || 'unknown'} displayName=${row.displayName || 'Sin lider'} total=${Number(row.total || 0)}`);
                console.info('[EXPORT COUNT TRACE] leaderId=' + (row.leaderId || 'unknown') + ' totalRaw=' + Number(row?.comparison?.totalRaw || 0) + ' totalExport=' + Number(row?.comparison?.totalExport || row.total || 0) + ' difference=' + Number(row?.comparison?.difference || 0));
            });

            exportToExcel(data, `lideres_${universeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error('Error in exportAllLeaders:', e);
            showAlert('Error al exportar: ' + formatError(e), 'error');
        }
    }

    /**
     * Exporta registros de un lÃ­der especÃ­fico
     */
    async function exportByLeader() {
        try {
            const select = document.getElementById('exportLeaderSelect');
            const leaderId = select?.value;

            if (!leaderId) {
                showAlert('Por favor seleccione un lÃ­der', 'warning');
                return;
            }

            const leaders = await fetchLeadersForExport();
            const registrations = await fetchRegistrationsPaginatedForExport({ leaderId });

            const leader = leaders.find(l => l._id === leaderId);
            if (!leader) {
                showAlert('LÃ­der no encontrado', 'error');
                return;
            }

            const regs = registrations.filter(r =>
                String(r.leaderId) === String(leaderId) ||
                String(r.leaderId) === String(leader.leaderId || '')
            );
            if (regs.length === 0) {
                showAlert('Este lÃ­der no tiene registros', 'info');
                return;
            }

            const data = regs.map(r => ({
                Nombre: `${r.firstName} ${r.lastName}`,
                'Cedula': r.cedula || '',
                'Telefono': r.phone || '',
                Localidad: r.localidad || '',
                Departamento: r.departamento || '',
                Puesto: getCanonicalPuestoLabel(r),
                Mesa: r.votingTable || '',
                Fecha: new Date(r.date).toLocaleDateString('es-CO'),
                Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
            }));

            exportToExcel(data, `registros_${leader.name.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error('Error in exportByLeader:', e);
            showAlert('Error al exportar: ' + e.message, 'error');
        }
    }

    /**
     * Exporta estadÃ­sticas de lÃ­deres
     */
    async function exportLeaderStats() {
        try {
            const summary = await fetchLeaderSummaryForExport();
            const universe = document.getElementById('exportLeaderUniverse')?.value || 'global';
            const universeLabel = universe === 'global' ? 'historico' : universe === 'filtered' ? 'filtrado' : 'evento';

            if (summary.length === 0) {
                showAlert('No hay datos para exportar', 'warning');
                return;
            }

            const data = summary.map((row) => {
                const total = Number(row.total || 0);
                const confirmed = Number(row.confirmed || 0);
                return {
                    leaderId: row.leaderId || '',
                    Lider: row.displayName || 'Sin lider',
                    'Total Registros': total,
                    Confirmados: confirmed,
                    Pendientes: Number(row.pending || 0),
                    'Tasa Confirmacion (%)': total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0,
                    Variantes: Array.isArray(row.rawNames) ? row.rawNames.join(' | ') : ''
                };
            }).sort((a, b) => b['Total Registros'] - a['Total Registros']);
            summary.slice(0, 40).forEach((row) => {
                console.info(`[EXPORT REAL TRACE] leaderId=${row.leaderId || 'unknown'} displayName=${row.displayName || 'Sin lider'} total=${Number(row.total || 0)}`);
                console.info('[EXPORT COUNT TRACE] leaderId=' + (row.leaderId || 'unknown') + ' totalRaw=' + Number(row?.comparison?.totalRaw || 0) + ' totalExport=' + Number(row?.comparison?.totalExport || row.total || 0) + ' difference=' + Number(row?.comparison?.difference || 0));
            });

            exportToExcel(data, `estadisticas_lideres_${universeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error('Error in exportLeaderStats:', e);
            showAlert('Error al exportar: ' + formatError(e), 'error');
        }
    }

    /**
     * Export Specific Localidad Registrations
     */
    async function exportByLocalidad() {
        try {
            const locSelect = document.getElementById('exportLocalidadSelect');
            if (!locSelect) return showAlert('Selector de localidad no encontrado', 'error');

            const localidad = locSelect.value;
            if (!localidad) return showAlert('Por favor seleccione una localidad', 'warning');

            const allRegistrations = await fetchRegistrationsPaginatedForExport({ localidad });
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
                    'Email': r.email || '',
                    'CÃ©dula': r.cedula || '',
                    'TelÃ©fono': r.phone || '',
                    'Departamento': r.departamento || r.department || '',
                    'Municipio': r.capital || r.municipality || '',
                    'Localidad': r.localidad || '',
                    'LÃ­der': r.leaderName || '',
                    'Puesto': r.votingPlace || '',
                    'Mesa': r.votingTable || '',
                    'Fecha': new Date(r.date).toLocaleDateString('es-CO'),
                    'Estado': r.confirmed ? 'Confirmado' : 'Pendiente'
                };
            });

            const dateStr = new Date().toISOString().slice(0, 10);
            ExportService.downloadExcel(data, `registros_${localidad.replace(/ /g, '_')}_${dateStr}`, `Registros - ${localidad}`);
        } catch (e) {
            console.error('Error in exportByLocalidad:', e);
            showAlert('Error al exportar: ' + e.message, 'error');
        }
    }

    // ====== EXPOSED API ======

    return {
        init,
        exportAllRegistrations,
        exportBogota,
        exportResto,
        exportAllLeaders,
        exportByLeader,
        exportLeaderStats,
        exportByLocalidad
    };
})();

// Exponer globalmente
window.ExportsModule = ExportsModule;


