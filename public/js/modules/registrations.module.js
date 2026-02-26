/**
 * REGISTRATIONS MODULE
 * =====================================================
 * Encapsula TODA la lógica de gestión de registros
 * - Filtrado
 * - Renderizado por tabs (Bogotá / Resto)
 * - Paginación
 * - Confirmación de registros
 * - Event listeners
 * 
 * Estado centralizado en AppState:
 * - AppState.data.registrations (registros)
 * - AppState.ui.currentPageBogota (página actual Bogotá)
 * - AppState.ui.currentPageResto (página actual Resto)
 * - AppState.ui.currentTab (tab active)
 * 
 * ARQUITECTURA:
 * - IIFE para encapsulación
 * - Métodos privados para lógica interna
 * - API pública para external callers
 * - Flag para evitar binding duplicado
 */

const RegistrationsModule = (() => {
    'use strict';

    let initialized = false;
    let eventsBound = false;

    // ====== PRIVATE HELPERS ======

    /**
     * Obtiene las localidades de Bogotá desde AppState
     */
    function getBogotaLocalidades() {
        return AppState.constants.BOGOTA_LOCALIDADES || [];
    }

    /**
     * Determina si un registro es de Bogotá
     */
    function isBogotaRegistration(reg) {
        return getBogotaLocalidades().includes(reg.localidad);
    }

    /**
     * Aplica todos los filtros activos
     * Retorna { bogota: [], resto: [] }
     */
    function applyAllFilters() {
        const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const leaderId = document.getElementById('leaderFilter')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const revision = document.getElementById('revisionFilter')?.value || '';

        const registrations = AppState.data.registrations || [];

        // Filtrar por búsqueda, líder, estado y revisión
        const filtered = registrations.filter(r => {
            const matchSearch = !search ||
                `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
                (r.email && r.email.toLowerCase().includes(search)) ||
                r.cedula.includes(search);
            const matchLeader = !leaderId || r.leaderId === leaderId;
            const matchStatus = !status || (status === 'confirmed' ? r.confirmed : !r.confirmed);
            const matchRevision = !revision || (revision === 'true' ? (r.requiereRevisionPuesto && !r.revisionPuestoResuelta) : !(r.requiereRevisionPuesto && !r.revisionPuestoResuelta));
            return matchSearch && matchLeader && matchStatus && matchRevision;
        });

        // Separar por región
        const bogotaFiltered = filtered.filter(r => isBogotaRegistration(r));
        const restoFiltered = filtered.filter(r => !isBogotaRegistration(r) && r.departamento);

        return { bogota: bogotaFiltered, resto: restoFiltered };
    }

    /**
     * Renderiza tabla de registros para un tab
     */
    function renderTable(tab, data) {
        const itemsPerPage = AppState.constants.ITEMS_PER_PAGE || 5;
        let currentPage = tab === 'bogota' ? AppState.ui.currentPageBogota : AppState.ui.currentPageResto;
        const totalPages = Math.ceil(data.length / itemsPerPage) || 1;

        // Ajustar página si está fuera de rango
        if (currentPage > totalPages) {
            currentPage = 1;
            if (tab === 'bogota') {
                AppState.setUI({ currentPageBogota: 1 });
            } else {
                AppState.setUI({ currentPageResto: 1 });
            }
        }

        const start = (currentPage - 1) * itemsPerPage;
        const paginated = data.slice(start, start + itemsPerPage);

        // Generar HTML
        const tableId = tab === 'bogota' ? 'bogotaTable' : 'restoTable';
        const html = paginated.map(reg => {
            const requiereRevision = reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta;
            const puestoDisplay = reg.votingPlace || (reg.puestoId?.nombre || '-');
            return `
        <tr>
            <td><strong>${reg.firstName} ${reg.lastName}</strong></td>
            <td>${reg.email || '-'}</td>
            <td>${reg.cedula || '-'}</td>
            <td>${tab === 'bogota' ? (reg.localidad || '-') : (reg.departamento || '-')}</td>
            <td>${puestoDisplay}${requiereRevision ? ' <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.75rem; padding: 2px 8px;">⚠ Revisar</span>' : ''}</td>
            <td>${reg.leaderName || '-'}</td>
            <td>${new Date(reg.date).toLocaleDateString('es-CO')}</td>
            <td><span class="badge ${reg.confirmed ? 'badge-confirmed' : 'badge-pending'}">${reg.confirmed ? '✓ Confirmado' : '⏳ Pendiente'}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-secondary toggle-confirm-btn" data-reg-id="${reg._id}" data-confirmed="${reg.confirmed}">
                    <i class="bi bi-check-circle"></i>
                </button>
            </td>
        </tr>
    `;
        }).join('');

        const emptyMessage = tab === 'bogota'
            ? '<tr><td colspan="9" class="text-center" style="padding: 40px; color: #999;">Sin registros en Bogotá</td></tr>'
            : '<tr><td colspan="9" class="text-center" style="padding: 40px; color: #999;">Sin registros en Resto del País</td></tr>';

        const tableEl = document.getElementById(tableId);
        if (tableEl) {
            tableEl.innerHTML = html || emptyMessage;
        }

        // Actualizar controles de paginación
        updatePaginationUI(tab, currentPage, totalPages);

        // Eventos delegados desde core/events.js
    }

    /**
     * Actualiza UI de paginación
     */
    function updatePaginationUI(tab, currentPage, totalPages) {
        const suffix = tab === 'bogota' ? 'Bogota' : 'Resto';
        const pageIndicator = document.getElementById(`pageIndicator${suffix}`);
        const prevPageBtn = document.getElementById(`prevPage${suffix}Btn`);
        const nextPageBtn = document.getElementById(`nextPage${suffix}Btn`);
        const firstPageBtn = document.getElementById(`firstPage${suffix}Btn`);

        if (pageIndicator) pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        if (firstPageBtn) firstPageBtn.disabled = currentPage === 1;
    }

    /**
     * Maneja cambios de página para una región
     */
    function changePage(tab, direction) {
        const { bogota, resto } = applyAllFilters();
        const data = tab === 'bogota' ? bogota : resto;
        const itemsPerPage = AppState.constants.ITEMS_PER_PAGE || 5;
        const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
        const currentPageKey = tab === 'bogota' ? 'currentPageBogota' : 'currentPageResto';
        const currentPage = AppState.ui[currentPageKey];

        let newPage = currentPage;
        if (direction === 'first') {
            newPage = 1;
        } else if (direction === 'prev' && currentPage > 1) {
            newPage = currentPage - 1;
        } else if (direction === 'next' && currentPage < totalPages) {
            newPage = currentPage + 1;
        }

        if (newPage !== currentPage) {
            AppState.setUI({ [currentPageKey]: newPage });
        }

        // Renderizar tabla actualizada
        applyFilters();
    }

    /**
     * Alternar confirmación de registro
     */
    async function toggleConfirm(regId, isConfirmed) {
        try {
            const endpoint = isConfirmed ? `/api/registrations/${regId}/unconfirm` : `/api/registrations/${regId}/confirm`;
            const response = await fetch(`${AppState.constants.API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AppState.user.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Recargar datos
                console.log('✅ Registro actualizado');
                loadDashboard();
            } else {
                console.error('❌ Error actualizando registro:', response.status);
            }
        } catch (err) {
            console.error('Error en toggleConfirm:', err);
        }
    }

    /**
     * Bind event listeners
     * ✅ FASE 4: Todos los listeners removidos y delegados a core/events.js
     * Se ejecutaba UNA SOLA VEZ mediante flag eventsBound (ahora vacío)
     */
    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;

        // Los eventos del módulo ahora son manejados por delegación centralizada:
        // - Filtros (búsqueda, líder, estado, revisión)
        // - Tabs (Bogotá, Resto)
        // - Paginación
        // - Exportación
        // Ver: core/events.js > bindGlobalClicks()

        console.log('✅ RegistrationsModule events bound (delegated to Events.js)');
    }

    /**
     * Muestra un tab específico
     */
    function showTab(tab) {
        AppState.setUI({ currentTab: tab });

        const bogotaTab = document.getElementById('bogotaTab');
        const restoTab = document.getElementById('restoTab');
        const bogotaRegs = document.getElementById('bogotaRegistrations');
        const restoRegs = document.getElementById('restoRegistrations');

        if (tab === 'bogota') {
            if (bogotaTab) {
                bogotaTab.style.background = '#667eea';
                bogotaTab.style.color = 'white';
                bogotaTab.style.borderBottom = '3px solid #667eea';
            }
            if (restoTab) {
                restoTab.style.background = 'transparent';
                restoTab.style.color = '#999';
                restoTab.style.borderBottom = 'none';
            }
            if (bogotaRegs) bogotaRegs.style.display = 'block';
            if (restoRegs) restoRegs.style.display = 'none';
        } else {
            if (restoTab) {
                restoTab.style.background = '#667eea';
                restoTab.style.color = 'white';
                restoTab.style.borderBottom = '3px solid #667eea';
            }
            if (bogotaTab) {
                bogotaTab.style.background = 'transparent';
                bogotaTab.style.color = '#999';
                bogotaTab.style.borderBottom = 'none';
            }
            if (bogotaRegs) bogotaRegs.style.display = 'none';
            if (restoRegs) restoRegs.style.display = 'block';
        }
    }

    // ====== PUBLIC API ======

    function init() {
        if (initialized) return;
        initialized = true;
        console.log('🚀 RegistrationsModule.init()');
        bindEvents();
    }

    /**
     * Carga y renderiza registros en ambos tabs
     */
    function load() {
        const { bogota, resto } = applyAllFilters();
        renderTable('bogota', bogota);
        renderTable('resto', resto);
        console.log(`📊 Registrations loaded: ${bogota.length} Bogotá, ${resto.length} Resto`);
    }

    /**
     * Aplica filtros y re-renderiza
     */
    function applyFilters() {
        const { bogota, resto } = applyAllFilters();
        renderTable('bogota', bogota);
        renderTable('resto', resto);
        console.log(`🔍 Filters applied: ${bogota.length} Bogotá, ${resto.length} Resto`);
    }

    /**
     * Renderiza Bogotá
     */
    function renderBogota() {
        const { bogota } = applyAllFilters();
        renderTable('bogota', bogota);
    }

    /**
     * Renderiza Resto del País
     */
    function renderResto() {
        const { resto } = applyAllFilters();
        renderTable('resto', resto);
    }

    // ====== EXPOSED API ======

    return {
        init,
        load,
        applyFilters,
        renderBogota,
        renderResto,
        changePage,
        toggleConfirm,
        showTab
    };
})();

// Exponer globalmente
window.RegistrationsModule = RegistrationsModule;
