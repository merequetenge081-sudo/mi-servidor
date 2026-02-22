/**
 * EXPORT SERVICE
 * Centraliza lógica de exportación a Excel
 */

const ExportService = {
    /**
     * Exporta datos a Excel
     * @param {array} data - Datos a exportar
     * @param {string} filename - Nombre del archivo
     * @param {string} sheetName - Nombre de la hoja
     */
    exportToExcel(data, filename = 'export.xlsx', sheetName = 'Datos') {
        try {
            if (!window.XLSX) {
                alert('Librería XLSX no cargada');
                return false;
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, filename);
            
            console.log(`[ExportService] Archivo exportado: ${filename}`);
            return true;
        } catch (err) {
            console.error('[ExportService] Error exportando:', err);
            return false;
        }
    },

    /**
     * Exporta líderes
     */
    exportLeaders() {
        const leaders = AppState.getData('leaders');
        const data = leaders.map(l => ({
            Nombre: l.name,
            Email: l.email || '',
            Teléfono: l.phone || '',
            Registros: l.registrations || 0,
            Usuario: l.username || '',
            Activo: l.isActive ? 'Sí' : 'No'
        }));

        return this.exportToExcel(data, 'Lideres.xlsx', 'Líderes');
    },

    /**
     * Exporta registraciones
     */
    exportRegistrations() {
        const regs = AppState.getData('registrations');
        const data = regs.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            Email: r.email || '',
            Cédula: r.cedula || '',
            Teléfono: r.phone || '',
            Localidad: r.localidad || r.departamento || '',
            Confirmado: r.confirmed ? 'Sí' : 'No',
            Fecha: new Date(r.createdAt).toLocaleDateString('es-CO')
        }));

        return this.exportToExcel(data, 'Registraciones.xlsx', 'Registraciones');
    },

    /**
     * Exporta estadísticas por líder
     */
    exportLeaderStats() {
        const leaders = AppState.getData('leaders');
        const regs = AppState.getData('registrations');

        const data = leaders.map(l => {
            const leaderRegs = regs.filter(r => r.leaderId === l._id);
            const confirmed = leaderRegs.filter(r => r.confirmed).length;
            const rate = leaderRegs.length > 0 ? ((confirmed / leaderRegs.length) * 100).toFixed(1) : 0;

            return {
                Líder: l.name,
                Total: leaderRegs.length,
                Confirmados: confirmed,
                Pendientes: leaderRegs.length - confirmed,
                'Tasa %': rate
            };
        }).sort((a, b) => b.Total - a.Total);

        return this.exportToExcel(data, 'Estadisticas.xlsx', 'Estadísticas');
    },

    /**
     * Exporta registraciones de un líder específico
     */
    exportLeaderRegistrations(leaderId) {
        const leaders = AppState.getData('leaders');
        const regs = AppState.getData('registrations');

        const leader = leaders.find(l => l._id === leaderId);
        if (!leader) {
            console.warn('[ExportService] Líder no encontrado');
            return false;
        }

        const leaderRegs = regs.filter(r => r.leaderId === leaderId);
        const data = leaderRegs.map(r => ({
            Nombre: `${r.firstName} ${r.lastName}`,
            Email: r.email || '',
            Cédula: r.cedula || '',
            Teléfono: r.phone || '',
            Localidad: r.localidad || r.departamento || '',
            Confirmado: r.confirmed ? 'Sí' : 'No',
            Fecha: new Date(r.createdAt).toLocaleDateString('es-CO')
        }));

        const filename = `Registraciones_${leader.name.replace(/\s+/g, '_')}.xlsx`;
        return this.exportToExcel(data, filename, leader.name.substring(0, 25));
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportService;
}
