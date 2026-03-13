/**
 * REGISTRATIONS MODULE
 * Server-side pagination for registrations using /api/v2/registrations
 */

const RegistrationsModule = (() => {
    'use strict';

    let initialized = false;
    let eventsBound = false;
    const tabState = {
        bogota: { items: [], total: 0, page: 1, totalPages: 1 },
        resto: { items: [], total: 0, page: 1, totalPages: 1 }
    };

    function getFilters() {
        const search = document.getElementById('searchInput')?.value?.trim() || '';
        const leaderId = document.getElementById('leaderFilter')?.value || '';
        const unified = document.getElementById('unifiedFilter')?.value || '';
        return { search, leaderId, unified };
    }

    function buildQueryParams(tab) {
        const { search, leaderId, unified } = getFilters();
        const isBogota = tab === 'bogota';
        const page = isBogota ? (AppState.ui.currentPageBogota || 1) : (AppState.ui.currentPageResto || 1);
        const params = {
            page,
            limit: AppState.constants.ITEMS_PER_PAGE || 25,
            sort: 'createdAt',
            order: 'desc',
            search,
            leaderId: leaderId || undefined,
            regionScope: isBogota ? 'bogota' : 'resto'
        };

        if (unified === 'confirmed') params.confirmed = true;
        if (unified === 'pending') params.confirmed = false;
        if (unified === 'needs_review') params.dataIntegrityStatus = 'needs_review';
        if (unified === 'no_review') params.dataIntegrityStatus = 'valid';
        if (unified === 'with_phone') params.hasPhone = true;
        if (unified === 'without_phone') params.hasPhone = false;

        return params;
    }

    function updatePaginationUI(tab, page, totalPages) {
        const suffix = tab === 'bogota' ? 'Bogota' : 'Resto';
        const pageIndicator = document.getElementById(`pageIndicator${suffix}`);
        const prevPageBtn = document.getElementById(`prevPage${suffix}Btn`);
        const nextPageBtn = document.getElementById(`nextPage${suffix}Btn`);
        const firstPageBtn = document.getElementById(`firstPage${suffix}Btn`);

        if (pageIndicator) pageIndicator.textContent = `Pagina ${page} de ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = page <= 1;
        if (nextPageBtn) nextPageBtn.disabled = page >= totalPages;
        if (firstPageBtn) firstPageBtn.disabled = page <= 1;
    }

    function renderTable(tab, data, pagination) {
        const tableId = tab === 'bogota' ? 'bogotaTable' : 'restoTable';
        const tableEl = document.getElementById(tableId);
        if (!tableEl) return;

        const html = (data || []).map((reg) => {
            const requiresReview = (reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta) || reg.puestoMatchReviewRequired === true;
            const puestoDisplay = reg.puestoId?.nombre || reg.votingPlace || reg.puestoNombre || '-';
            const legacyPuesto = reg.legacyVotingPlace && reg.legacyVotingPlace !== puestoDisplay
                ? `<div style="font-size: 0.72rem; color: #92400e; margin-top: 2px;">Original: ${reg.legacyVotingPlace}</div>`
                : '';
            const createdAt = reg.date || reg.createdAt;
            const dateObj = createdAt ? new Date(createdAt) : null;
            const dateLabel = dateObj && !Number.isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('es-CO')
                : '-';
            const confirmed = reg.confirmed === true || reg.workflowStatus === 'confirmed';

            return `
        <tr>
            <td><strong>${reg.firstName || ''} ${reg.lastName || ''}</strong></td>
            <td>${reg.email || '-'}</td>
            <td>${reg.phone || '-'}</td>
            <td>${reg.cedula || '-'}</td>
            <td>${tab === 'bogota' ? (reg.localidad || '-') : (reg.departamento || reg.localidad || '-')}</td>
            <td>${puestoDisplay}${requiresReview ? ' <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.75rem; padding: 2px 8px;">Revisar</span>' : ''}${legacyPuesto}</td>
            <td>${reg.leaderName || '-'}</td>
            <td>${dateLabel}</td>
            <td><span class="badge ${confirmed ? 'badge-confirmed' : 'badge-pending'}">${confirmed ? 'Confirmado' : 'Pendiente'}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-secondary toggle-confirm-btn" data-reg-id="${reg._id}" data-confirmed="${confirmed}">
                    <i class="bi bi-check-circle"></i>
                </button>
            </td>
        </tr>
    `;
        }).join('');

        const empty = tab === 'bogota'
            ? '<tr><td colspan="10" class="text-center" style="padding: 40px; color: #999;">Sin registros en Bogota</td></tr>'
            : '<tr><td colspan="10" class="text-center" style="padding: 40px; color: #999;">Sin registros en Resto del Pais</td></tr>';

        tableEl.innerHTML = html || empty;
        updatePaginationUI(tab, pagination.page || 1, pagination.totalPages || 1);
    }

    async function loadTab(tab) {
        if (typeof DataService === 'undefined' || !DataService.getRegistrationsPaginated) {
            console.error('[RegistrationsModule] DataService.getRegistrationsPaginated no disponible');
            return;
        }

        const params = buildQueryParams(tab);
        console.debug('[V2 TRACE] registrations.table <- /api/v2/registrations', { tab, params });

        const result = await DataService.getRegistrationsPaginated(params);
        const state = {
            items: result.items || [],
            total: result.total || 0,
            page: result.page || params.page,
            totalPages: result.totalPages || 1
        };

        tabState[tab] = state;
        renderTable(tab, state.items, state);

        const currentRegs = [...(tabState.bogota.items || []), ...(tabState.resto.items || [])];
        AppState.setData('registrations', currentRegs);
    }

    async function load() {
        await Promise.all([loadTab('bogota'), loadTab('resto')]);
    }

    async function applyFilters() {
        AppState.setUI({ currentPageBogota: 1, currentPageResto: 1 });
        await load();
    }

    async function renderBogota() {
        await loadTab('bogota');
    }

    async function renderResto() {
        await loadTab('resto');
    }

    async function changePage(tab, direction) {
        const isBogota = tab === 'bogota';
        const key = isBogota ? 'currentPageBogota' : 'currentPageResto';
        const currentPage = AppState.ui[key] || 1;
        const totalPages = tabState[tab]?.totalPages || 1;
        let nextPage = currentPage;

        if (direction === 'first') nextPage = 1;
        if (direction === 'prev') nextPage = Math.max(1, currentPage - 1);
        if (direction === 'next') nextPage = Math.min(totalPages, currentPage + 1);

        if (nextPage !== currentPage) {
            AppState.setUI({ [key]: nextPage });
            await loadTab(tab);
        }
    }

    async function toggleConfirm(regId, isConfirmed) {
        try {
            await DataService.toggleRegistrationConfirmation(regId, isConfirmed);
            await load();
        } catch (err) {
            const status = Number(err?.status || err?.response?.status || 0);
            if (status) {
                console.error('[RegistrationsModule] Error actualizando confirmacion:', status);
            } else {
                console.error('[RegistrationsModule] Error en toggleConfirm:', err);
            }
        }
    }

    function bindEvents() {
        if (eventsBound) return;
        eventsBound = true;
        console.log('[RegistrationsModule] eventos delegados a core/events.js');
    }

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

    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
    }

    async function fixNames() {
        if (!confirm('Esta seguro de que desea estandarizar y corregir nombres?')) return;

        try {
            const btn = document.getElementById('fixNamesBtn');
            const originalText = btn?.innerHTML;
            if (btn) {
                btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Procesando...';
                btn.disabled = true;
            }

            const res = await fetch(`${AppState.constants.API_URL}/api/registrations/fix-names`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AppState.user.token}`
                },
                body: JSON.stringify({ eventId: AppState.data.currentEventId })
            });

            const data = await res.json();
            if (res.ok) {
                Helpers.showAlert(data.message || 'Correccion de nombres completada.', 'success');
                await load();
            } else {
                Helpers.showAlert(data.error || 'Error al corregir nombres', 'error');
            }

            if (btn) {
                btn.innerHTML = originalText || '<i class="bi bi-magic"></i> Corregir Nombres';
                btn.disabled = false;
            }
        } catch (e) {
            console.error('[RegistrationsModule] fixNames err:', e);
            Helpers.showAlert('Error de red al intentar corregir nombres', 'error');
            const btn = document.getElementById('fixNamesBtn');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-magic"></i> Corregir Nombres';
                btn.disabled = false;
            }
        }
    }

    return {
        init,
        load,
        applyFilters,
        renderBogota,
        renderResto,
        changePage,
        toggleConfirm,
        showTab,
        fixNames
    };
})();

window.RegistrationsModule = RegistrationsModule;
