/**
 * EXPORTS MODULE
 * =====================================================
 * Encapsula TODA la lógica de exportación a Excel
 * - Exportar registros (todos, por región, por líder)
 * - Exportar líderes
 * - Exportar estadísticas
 * 
 * ARQUITECTURA:
 * - Métodos privados para lógica interna
 * - API pública para llamadas externas
 * - Event listeners binding automático
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

    // ====== PRIVATE HELPERS ======

    /**
     * Exporta datos a Excel usando XLSX
     */
    function exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') {
            showAlert('Error: Librería Excel (XLSX) no cargada. Recarga la página.', 'error');
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

    /**
     * Bind event listeners
     * ✅ FASE 4: Todos los listeners removidos y delegados a core/events.js
     */
    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;

        // Los eventos del módulo ahora son manejados por delegación centralizada:
        // - Exportar registrations (Bogotá, Resto, Todos)
        // - Exportar líderes
        // - Exportar por líder
        // - Exportar estadísticas
        // Ver: core/events.js > bindGlobalClicks()

        console.log('✅ ExportsModule events bound (delegated to Events.js)');
    }

    // ====== PUBLIC API ======

    /**
     * Inicializa el módulo
     */
    function init() {
        if (initialized) return;
        initialized = true;
        console.log('🚀 ExportsModule.init()');
        bindEvents();
    }

    /**
     * Exporta TODOS los registros
     */
    function exportAllRegistrations() {
        const registrations = AppState.data.registrations || [];
        const data = registrations.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            Cédula: r.cedula || '',
            Teléfono: r.phone || '',
            Localidad: r.localidad || '',
            Departamento: r.departamento || '',
            Líder: r.leaderName || '',
            Puesto: r.votingPlace || '',
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        }));
        exportToExcel(data, `registros_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Exporta registros de Bogotá
     */
    function exportBogota() {
        const registrations = AppState.data.registrations || [];
        const bogotaLocalidades = AppState.constants.BOGOTA_LOCALIDADES || [];
        const bogota = registrations.filter(r => bogotaLocalidades.includes(r.localidad));
        const data = bogota.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            Cédula: r.cedula || '',
            Teléfono: r.phone || '',
            Localidad: r.localidad || '',
            Líder: r.leaderName || '',
            Puesto: r.votingPlace || '',
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        }));
        exportToExcel(data, `registros_bogota_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Exporta registros del Resto del País
     */
    function exportResto() {
        const registrations = AppState.data.registrations || [];
        const bogotaLocalidades = AppState.constants.BOGOTA_LOCALIDADES || [];
        const resto = registrations.filter(r => !bogotaLocalidades.includes(r.localidad) && r.departamento);
        const data = resto.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            Cédula: r.cedula || '',
            Teléfono: r.phone || '',
            Departamento: r.departamento || '',
            Líder: r.leaderName || '',
            Puesto: r.votingPlace || '',
            Mesa: r.votingTable || '',
            Fecha: new Date(r.date).toLocaleDateString('es-CO'),
            Estado: r.confirmed ? 'Confirmado' : 'Pendiente'
        }));
        exportToExcel(data, `registros_resto_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Exporta TODOS los líderes
     */
    function exportAllLeaders() {
        try {
            const leaders = AppState.data.leaders || [];
            const registrations = AppState.data.registrations || [];

            if (leaders.length === 0) {
                showAlert('No hay líderes para exportar', 'warning');
                return;
            }

            const data = leaders.map(l => {
                const count = registrations.filter(r => r.leaderId === l._id).length;
                return {
                    Nombre: l.name,
                    Teléfono: l.phone || '',
                    Registros: count,
                    Activo: (l.active !== false) ? 'Sí' : 'No'
                };
            });

            exportToExcel(data, `lideres_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error('Error in exportAllLeaders:', e);
            showAlert('Error al exportar: ' + e.message, 'error');
        }
    }

    /**
     * Exporta registros de un líder específico
     */
    function exportByLeader() {
        try {
            const select = document.getElementById('exportLeaderSelect');
            const leaderId = select?.value;

            if (!leaderId) {
                showAlert('Por favor seleccione un líder', 'warning');
                return;
            }

            const leaders = AppState.data.leaders || [];
            const registrations = AppState.data.registrations || [];

            const leader = leaders.find(l => l._id === leaderId);
            if (!leader) {
                showAlert('Líder no encontrado', 'error');
                return;
            }

            const regs = registrations.filter(r => r.leaderId === leaderId);
            if (regs.length === 0) {
                showAlert('Este líder no tiene registros', 'info');
                return;
            }

            const data = regs.map(r => ({
                Nombre: `${r.firstName} ${r.lastName}`,
                Cédula: r.cedula || '',
                Teléfono: r.phone || '',
                Localidad: r.localidad || '',
                Departamento: r.departamento || '',
                Puesto: r.votingPlace || '',
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
     * Exporta estadísticas de líderes
     */
    function exportLeaderStats() {
        try {
            const leaders = AppState.data.leaders || [];
            const registrations = AppState.data.registrations || [];

            if (leaders.length === 0) {
                showAlert('No hay datos para exportar', 'warning');
                return;
            }

            const data = leaders.map(l => {
                const leaderRegs = registrations.filter(r => r.leaderId === l._id);
                const leaderConfirmed = leaderRegs.filter(r => r.confirmed).length;
                return {
                    Líder: l.name,
                    'Total Registros': leaderRegs.length,
                    Confirmados: leaderConfirmed,
                    Pendientes: leaderRegs.length - leaderConfirmed,
                    'Tasa Confirmación (%)': leaderRegs.length > 0 ? ((leaderConfirmed / leaderRegs.length) * 100).toFixed(1) : 0
                };
            }).sort((a, b) => b['Total Registros'] - a['Total Registros']);

            exportToExcel(data, `estadisticas_lideres_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (e) {
            console.error('Error in exportLeaderStats:', e);
            showAlert('Error al exportar: ' + e.message, 'error');
        }
    }

    /**
     * Export Specific Localidad Registrations
     */
    function exportByLocalidad() {
        try {
            const locSelect = document.getElementById('exportLocalidadSelect');
            if (!locSelect) return showAlert('Selector de localidad no encontrado', 'error');

            const localidad = locSelect.value;
            if (!localidad) return showAlert('Por favor seleccione una localidad', 'warning');

            const allRegistrations = AppState.data.registrations || [];
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
                    'Cédula': r.cedula || '',
                    'Teléfono': r.phone || '',
                    'Departamento': r.departamento || r.department || '',
                    'Municipio': r.capital || r.municipality || '',
                    'Localidad': r.localidad || '',
                    'Líder': r.leaderName || '',
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
