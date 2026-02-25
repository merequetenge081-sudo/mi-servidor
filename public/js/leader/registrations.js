// registrations.js - Manejo de registros, búsqueda, paginación
import { AuthManager } from './auth.js';
import { BOGOTA_LOCALIDADES, formatDate } from './utils.js';

export class RegistrationsManager {
    static myRegistrations = [];
    static filteredRegistrations = [];
    static currentPage = 1;
    static itemsPerPage = 10;

    static async loadRegistrations(leaderId) {
        try {
            const response = await AuthManager.apiCall(
                `/api/registrations?leaderId=${leaderId}&limit=1000`
            );

            if (!response.ok) throw new Error('Error al cargar registros');

            const allRegistrations = await response.json();
            const registrations = this.parseRegistrationsResponse(allRegistrations);

            this.myRegistrations = registrations.filter(r => r.leaderId === leaderId);
            this.filteredRegistrations = [...this.myRegistrations];
            this.currentPage = 1;

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

    static renderRow(reg) {
        const statusBadge = reg.confirmed 
            ? '<span class="badge badge-success">✓ Confirmado</span>'
            : '<span class="badge badge-warning">⏱ Pendiente</span>';

        const revisionBadge = (reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta)
            ? '<span class="badge badge-revision">⚠ Revisar puesto</span>'
            : '';

        return `
            <tr>
                <td>${reg.firstName} ${reg.lastName}</td>
                <td>${reg.email || ''}</td>
                <td>${reg.cedula || ''}</td>
                <td>${reg.localidad || ''}</td>
                <td>${reg.votingPlace || ''}</td>
                <td>${reg.votingTable || ''}</td>
                <td>${formatDate(reg.date)}</td>
                <td>${statusBadge} ${revisionBadge}</td>
                <td>
                    <button class="action-btn action-btn-confirm" onclick="window.registrationsManager.toggleConfirm('${reg._id}', ${reg.confirmed}).then(() => window.refreshRegistrations())" title="${reg.confirmed ? 'Marcar como pendiente' : 'Confirmar'}">
                        <i class="bi bi-check-circle"></i>
                    </button>
                    <button class="action-btn action-btn-edit" onclick="window.formManager.openEditModal(window.registrationsManager.myRegistrations, '${reg._id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="action-btn action-btn-delete" onclick="window.deleteManager.confirmDelete('${reg._id}')">
                        <i class="bi bi-trash"></i>
                    </button>
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

    static applyFilters(searchTerm, statusFilter) {
        this.filteredRegistrations = this.myRegistrations.filter(reg => {
            const matchSearch = !searchTerm ||
                (reg.firstName && reg.firstName.toLowerCase().includes(searchTerm)) ||
                (reg.lastName && reg.lastName.toLowerCase().includes(searchTerm)) ||
                (reg.email && reg.email.toLowerCase().includes(searchTerm)) ||
                (reg.cedula && reg.cedula.toLowerCase().includes(searchTerm));

            const matchStatus = !statusFilter || 
                (statusFilter === 'confirmed' ? reg.confirmed : !reg.confirmed);

            return matchSearch && matchStatus;
        });

        this.currentPage = 1;
    }
}
