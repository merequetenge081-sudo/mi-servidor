// registrations.js - Manejo de registros, búsqueda, paginación
import { AuthManager } from './auth.js';
import { BOGOTA_LOCALIDADES, formatDate } from './utils.js';

export class RegistrationsManager {
    static myRegistrations = [];
    static filteredRegistrations = [];
    static currentPage = 1;
    static itemsPerPage = 10;
    static selectedIds = new Set();

    static async loadRegistrations(leaderId, keepPage = false) {
        try {
            const response = await AuthManager.apiCall(
                `/api/registrations?leaderId=${leaderId}&limit=1000`
            );

            if (!response.ok) throw new Error('Error al cargar registros');

            const allRegistrations = await response.json();
            const registrations = this.parseRegistrationsResponse(allRegistrations);

            this.myRegistrations = registrations.filter(r => r.leaderId === leaderId);
            
            // Reapply existing filters if present
            const searchInput = document.getElementById('searchInput');
            const unifiedFilter = document.getElementById('unifiedFilter');
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            const filterValue = unifiedFilter ? unifiedFilter.value : '';
            
            if (searchTerm || filterValue) {
                this.filteredRegistrations = this.myRegistrations.filter(reg => {
                    const matchSearch = !searchTerm ||
                        (reg.firstName && reg.firstName.toLowerCase().includes(searchTerm)) ||
                        (reg.lastName && reg.lastName.toLowerCase().includes(searchTerm)) ||
                        (reg.email && reg.email.toLowerCase().includes(searchTerm)) ||
                        (reg.cedula && reg.cedula.toLowerCase().includes(searchTerm));

                    let matchUnified = true;
                    if (filterValue === 'confirmed') matchUnified = reg.confirmed;
                    else if (filterValue === 'pending') matchUnified = !reg.confirmed;
                    else if (filterValue === 'needs_review') matchUnified = (reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta);
                    else if (filterValue === 'no_review') matchUnified = !(reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta);

                    return matchSearch && matchUnified;
                });
            } else {
                this.filteredRegistrations = [...this.myRegistrations];
            }
            
            if (!keepPage) {
                this.currentPage = 1;
            }

            return this.myRegistrations;
        } catch (error) {
            console.error('Error al cargar registros:', error);
            throw error;
        }
    }

    static parseRegistrationsResponse(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (data.registrations && Array.isArray(data.registrations)) return data.registrations;
        if (data.data && Array.isArray(data.data)) return data.data;
        return [];
    }

    static checkRevisionPendiente() {
        const conRevision = this.myRegistrations.filter(
            r => r.requiereRevisionPuesto && !r.revisionPuestoResuelta
        );
        const alertaDiv = document.getElementById('alertaRevision');

        if (conRevision.length > 0 && alertaDiv) {
            alertaDiv.style.display = 'flex';
        } else if (alertaDiv) {
            alertaDiv.style.display = 'none';
        }

        return conRevision;
    }

    static filtrarRegistrosRevision() {
        this.filteredRegistrations = this.myRegistrations.filter(
            r => r.requiereRevisionPuesto && !r.revisionPuestoResuelta
        );
        this.currentPage = 1;
        return this.filteredRegistrations;
    }

    static renderRegistrations() {
        const tbody = document.getElementById('registrationsTableBody');
        
        // Ensure currentPage is valid if array size decreased
        const totalPages = Math.ceil(this.filteredRegistrations.length / this.itemsPerPage) || 1;
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageData = this.filteredRegistrations.slice(start, end);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <i class="bi bi-inbox" style="font-size: 48px; color: var(--text-muted);"></i>
                        <p style="margin-top: 12px; color: var(--text-muted);">No hay registros para mostrar</p>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = pageData.map(reg => this.renderRow(reg)).join('');
        }

        this.updatePagination();
    }

    
    static getSelectedIds() {
        if (!this.selectedIds) this.selectedIds = new Set();
        return Array.from(this.selectedIds);
    }
    
    static toggleSelection(id) {
        if (!this.selectedIds) this.selectedIds = new Set();
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
        this.updateBulkButtons();
    }
    
    static toggleSelectAll(checkbox) {
        if (!this.selectedIds) this.selectedIds = new Set();
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        
        if (checkbox.checked) {
            this.filteredRegistrations.slice(start, end).forEach(reg => this.selectedIds.add(reg._id));
        } else {
            this.filteredRegistrations.slice(start, end).forEach(reg => this.selectedIds.delete(reg._id));
        }
        this.renderRegistrations();
        this.updateBulkButtons();
    }
    
    static updateBulkButtons() {
        if (!this.selectedIds) this.selectedIds = new Set();
        const hasSelection = this.selectedIds.size > 0;
        const btnDelete = document.getElementById('bulkSelectedDeleteBtn');
        const btnConfirm = document.getElementById('bulkSelectedConfirmBtn');
        
        if (btnDelete) btnDelete.style.display = hasSelection ? 'inline-block' : 'none';
        if (btnConfirm) btnConfirm.style.display = hasSelection ? 'inline-block' : 'none';
        
        if (hasSelection) {
            if (btnDelete) btnDelete.innerHTML = `<i class="bi bi-trash"></i> Eliminar (${this.selectedIds.size})`;
            if (btnConfirm) btnConfirm.innerHTML = `<i class="bi bi-check-all"></i> Confirmar (${this.selectedIds.size})`;
        }
    }
    
    static async bulkConfirmCurrent() {
        const ids = this.getSelectedIds();
        if (ids.length === 0) return;
        
        if (!confirm(`¿Estás seguro de confirmar ${ids.length} registros?`)) return;
        
        try {
            let successCount = 0;
            for (const id of ids) {
                const res = await AuthManager.apiCall(`/api/registrations/${id}/confirm`, { method: 'POST' });
                if (res.ok) successCount++;
            }
            this.selectedIds.clear();
            this.updateBulkButtons();
            if (window.refreshRegistrations) await window.refreshRegistrations(true);
            alert(`${successCount} registros confirmados exitosamente.`);
        } catch (e) {
            console.error(e);
            alert('Error al confirmar registros');
        }
    }
    
    static async bulkDeleteCurrent() {
        const ids = this.getSelectedIds();
        if (ids.length === 0) return;
        
        if (!confirm(`¿Estás seguro de ELIMINAR ${ids.length} registros permanentemente?`)) return;
        
        try {
            let successCount = 0;
            for (const id of ids) {
                const res = await AuthManager.apiCall(`/api/registrations/${id}`, { method: 'DELETE' });
                if (res.ok) successCount++;
            }
            this.selectedIds.clear();
            this.updateBulkButtons();
            if (window.refreshRegistrations) await window.refreshRegistrations(true);
            alert(`${successCount} registros eliminados exitosamente.`);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar registros');
        }
    }

    static toggleRowMenu(event, id) {
        event.stopPropagation();
        
        // Close other open menus first
        document.querySelectorAll('.row-action-menu').forEach(menu => {
            if (menu.id !== `rowMenu-${id}`) menu.style.display = 'none';
        });
        
        const menu = document.getElementById(`rowMenu-${id}`);
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    }

    static renderRow(reg) {
        const statusBadge = reg.confirmed 
            ? '<span class="badge badge-success">✓ Confirmado</span>'
            : '<span class="badge badge-warning">⏱ Pendiente</span>';

        const revisionBadge = (reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta)
            ? '<span class="badge badge-revision">⚠ Revisar puesto</span>'
            : '';

        const isChecked = this.selectedIds && this.selectedIds.has(reg._id) ? 'checked' : '';
        return `
            <tr>
                <td style="width: 40px; text-align: center;">
                    <input type="checkbox" onchange="window.registrationsManager.toggleSelection('${reg._id}')" ${isChecked} class="form-check-input">
                </td>
                <td>${reg.firstName} ${reg.lastName}</td>
                <td>${reg.email || ''}</td>
                <td>${reg.cedula || ''}</td>
                <td>${reg.localidad || ''}</td>
                <td>${reg.votingPlace || ''}</td>
                <td>${reg.votingTable || ''}</td>
                <td>${formatDate(reg.date)}</td>
                <td>${statusBadge} ${revisionBadge}</td>
                <td style="position: relative; text-align: center;">
                    <button class="btn-icon" onclick="window.registrationsManager.toggleRowMenu(event, '${reg._id}')" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-secondary); padding: 5px;">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <div id="rowMenu-${reg._id}" class="row-action-menu" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 160px; z-index: 100; text-align: left; overflow: hidden; padding: 0;">
                        <button style="width: 100%; padding: 10px 16px; background: none; border: none; border-bottom: 1px solid var(--border); text-align: left; cursor: pointer; color: ${reg.confirmed ? 'var(--warning)' : 'var(--success)'}; font-weight: 500; display: flex; gap: 8px; align-items: center;" onclick="window.registrationsManager.toggleConfirm('${reg._id}', ${reg.confirmed}).then(() => window.refreshRegistrations()); document.getElementById('rowMenu-${reg._id}').style.display = 'none';">
                            <i class="${reg.confirmed ? 'bi bi-clock-history' : 'bi bi-check-circle'}"></i> ${reg.confirmed ? 'Marcar Pendiente' : 'Confirmar'}
                        </button>
                        <button style="width: 100%; padding: 10px 16px; background: none; border: none; border-bottom: 1px solid var(--border); text-align: left; cursor: pointer; color: var(--primary); font-weight: 500; display: flex; gap: 8px; align-items: center;" onclick="window.formManager.openEditModal(window.registrationsManager.myRegistrations, '${reg._id}'); document.getElementById('rowMenu-${reg._id}').style.display = 'none';">
                            <i class="bi bi-pencil"></i> Editar
                        </button>
                        <button style="width: 100%; padding: 10px 16px; background: none; border: none; text-align: left; cursor: pointer; color: var(--danger); font-weight: 500; display: flex; gap: 8px; align-items: center;" onclick="window.deleteManager.confirmDelete('${reg._id}'); document.getElementById('rowMenu-${reg._id}').style.display = 'none';">
                            <i class="bi bi-trash"></i> Eliminar
                        </button>
                    </div>
                </td>
              </tr>
        `;
    }

    static updatePagination() {
        const totalPages = Math.ceil(this.filteredRegistrations.length / this.itemsPerPage);
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = totalPages || 1;
        document.getElementById('prevPageBtn').disabled = this.currentPage === 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage >= totalPages || totalPages === 0;
    }

    static previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderRegistrations();
        }
    }

    static nextPage() {
        const totalPages = Math.ceil(this.filteredRegistrations.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderRegistrations();
        }
    }

    static changePage(delta) {
        const totalPages = Math.ceil(this.filteredRegistrations.length / this.itemsPerPage);
        const nextPage = this.currentPage + delta;

        if (nextPage < 1 || nextPage > totalPages) return;

        this.currentPage = nextPage;
        this.renderRegistrations();
    }

    static async toggleConfirm(id, currentStatus) {
        try {
            const endpoint = currentStatus 
                ? `/api/registrations/${id}/unconfirm` 
                : `/api/registrations/${id}/confirm`;
            const res = await AuthManager.apiCall(endpoint, { method: 'POST' });

            if (res.ok) {
                return res.json();
            }
        } catch (err) {
            console.error('Error:', err);
            throw err;
        }
    }

    static async autoVerifyRegistrations(leaderId, threshold = 0.85) {
        try {
            const res = await AuthManager.apiCall(
                `/api/registrations/leader/${leaderId}/verify`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ threshold })
                }
            );

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Error al verificar registros');
            }

            return data;
        } catch (error) {
            console.error('Error en verificacion automatica:', error);
            throw error;
        }
    }

    static applyFilters(searchTerm, unifiedFilter) {
        const lowerSearch = searchTerm ? searchTerm.toLowerCase() : '';
        this.filteredRegistrations = this.myRegistrations.filter(reg => {
            const matchSearch = !lowerSearch ||
                (reg.firstName && reg.firstName.toLowerCase().includes(lowerSearch)) ||
                (reg.lastName && reg.lastName.toLowerCase().includes(lowerSearch)) ||
                (reg.email && reg.email.toLowerCase().includes(lowerSearch)) ||
                (reg.cedula && reg.cedula.toLowerCase().includes(lowerSearch));

            let matchUnified = true;
            if (unifiedFilter === 'confirmed') matchUnified = reg.confirmed;
            else if (unifiedFilter === 'pending') matchUnified = !reg.confirmed;
            else if (unifiedFilter === 'needs_review') matchUnified = (reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta);
            else if (unifiedFilter === 'no_review') matchUnified = !(reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta);

            return matchSearch && matchUnified;
        });

        this.currentPage = 1;
        this.renderRegistrations();
    }
}
