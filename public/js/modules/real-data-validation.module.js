const RealDataValidationModule = (() => {
    'use strict';

    const E14_BASE_URL = 'https://divulgacione14congreso.registraduria.gov.co/departamento/16';
    let initialized = false;
    let currentPage = 1;
    const pageSize = 25;
    let rowsByKey = new Map();
    let currentRows = [];
    let currentModalRow = null;
    let filterOptions = {
        localidadesDisponibles: [],
        puestosDisponibles: []
    };

    function toReadableText(value, fallback = '-') {
        if (value === null || value === undefined || value === '') return fallback;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return value.map((v) => toReadableText(v, '')).filter(Boolean).join(', ') || fallback;
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch (_) {
                return fallback;
            }
        }
        return fallback;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function toInt(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number.parseInt(String(value).trim(), 10);
        if (!Number.isFinite(parsed)) return null;
        return parsed;
    }

    function showResult(kind, message) {
        const resultBox = document.getElementById('rdvSyncResult');
        if (!resultBox) return;
        resultBox.style.display = 'block';
        resultBox.className = `alert ${kind}`;
        resultBox.textContent = toReadableText(message, 'Operacion completada');
    }

    function getFilters() {
        return {
            eventId: AppState?.user?.eventId || null,
            localidad: document.getElementById('rdvFilterLocalidad')?.value || '',
            puesto: document.getElementById('rdvFilterPuesto')?.value || '',
            mesa: document.getElementById('rdvFilterMesa')?.value || '',
            estado: document.getElementById('rdvFilterEstado')?.value || '',
            sourceStatus: document.getElementById('rdvFilterSourceStatus')?.value || '',
            search: document.getElementById('rdvFilterSearch')?.value || '',
            page: currentPage,
            limit: pageSize
        };
    }

    function populateSelect(selectId, options = [], placeholder) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;
        const normalizedOptions = Array.isArray(options) ? options : [];
        select.innerHTML = [
            `<option value="">${placeholder}</option>`,
            ...normalizedOptions.map((item) => `<option value="${escapeHtml(toReadableText(item.value, ''))}">${escapeHtml(toReadableText(item.label, item.value))}</option>`)
        ].join('');
        const hasCurrent = normalizedOptions.some((item) => item.value === currentValue);
        select.value = hasCurrent ? currentValue : '';
    }

    function applyFilterOptions(payload = {}) {
        filterOptions = payload || { localidadesDisponibles: [], puestosDisponibles: [] };
        populateSelect('rdvFilterLocalidad', filterOptions.localidadesDisponibles || [], 'Todas las localidades');
        populateSelect('rdvFilterPuesto', filterOptions.puestosDisponibles || [], 'Todos los puestos');
    }

    function statusBadge(status) {
        const map = {
            confirmado: '<span class="badge badge-success">Confirmado</span>',
            confirmacion_alta: '<span class="badge badge-info">Confirmacion alta</span>',
            confirmacion_parcial: '<span class="badge badge-warning">Confirmacion parcial</span>',
            confirmacion_baja: '<span class="badge badge-warning">Confirmacion baja</span>',
            sin_confirmacion: '<span class="badge badge-danger">Sin confirmacion</span>',
            pendiente_e14: '<span class="badge badge-secondary">Pendiente E14</span>',
            sin_votos_reportados: '<span class="badge badge-pending">Sin votos reportados</span>',
            datos_incompletos: '<span class="badge badge-pending">Datos incompletos</span>'
        };
        return map[status] || `<span class="badge">${escapeHtml(toReadableText(status, '-'))}</span>`;
    }

    function reviewBadge(row) {
        if (!row?.reviewRequired) return '';
        const reason = toReadableText(row.reviewReason || row.sourceEstadoRevision || 'Revision visual sugerida', 'Revision visual sugerida');
        return `<span class="badge badge-warning" title="${escapeHtml(reason)}">Revision visual</span>`;
    }

    function formatPercentage(value) {
        return Number.isFinite(value) ? `${value}%` : '-';
    }

    function formatDifference(value) {
        if (!Number.isFinite(value)) return '-';
        return value > 0 ? `+${value}` : String(value);
    }

    function formatConfidence(value) {
        if (!Number.isFinite(value)) return '-';
        const normalized = value <= 1 ? value * 100 : value;
        return `${Number(normalized.toFixed(2))}%`;
    }

    function formatSourceStatus(status) {
        const map = {
            ok: 'OCR OK',
            empty_cell: 'Celda vacia',
            low_confidence: 'Baja confianza',
            ocr_low_confidence: 'OCR baja confianza',
            needs_manual_review: 'Revision manual',
            page_not_found: 'Pagina no encontrada',
            download_error: 'Error descargando acta',
            candidate_not_found: 'Candidato no encontrado',
            parse_error: 'Error parseando',
            layout_not_valid: 'Layout invalido',
            grid_not_found: 'Grid no encontrado',
            row_not_found: 'Fila no encontrada',
            cell_not_found: 'Celda no encontrada',
            ambiguous_digit: 'Digito ambiguo'
        };
        return map[status] || toReadableText(status, 'Sin estado OCR');
    }

    function sourceBadge(status) {
        const normalized = toReadableText(status, '').toLowerCase();
        const classes = {
            ok: 'badge badge-success',
            empty_cell: 'badge badge-secondary',
            low_confidence: 'badge badge-warning',
            ocr_low_confidence: 'badge badge-warning',
            needs_manual_review: 'badge badge-warning',
            page_not_found: 'badge badge-danger',
            download_error: 'badge badge-danger',
            candidate_not_found: 'badge badge-danger',
            parse_error: 'badge badge-danger',
            layout_not_valid: 'badge badge-warning',
            grid_not_found: 'badge badge-warning',
            row_not_found: 'badge badge-warning',
            cell_not_found: 'badge badge-warning',
            ambiguous_digit: 'badge badge-warning'
        };
        const cssClass = classes[normalized] || 'badge';
        return `<span class="${cssClass}">${escapeHtml(formatSourceStatus(status))}</span>`;
    }

    function formatPriority(rank) {
        if (!Number.isFinite(rank)) return 'Sin prioridad';
        if (rank <= 1) return `Alta (#${rank})`;
        if (rank <= 3) return `Media (#${rank})`;
        return `Baja (#${rank})`;
    }

    function priorityBadge(rank) {
        if (!Number.isFinite(rank)) return '';
        const cssClass = rank <= 1 ? 'badge badge-danger' : rank <= 3 ? 'badge badge-warning' : 'badge badge-secondary';
        return `<span class="${cssClass}">${escapeHtml(formatPriority(rank))}</span>`;
    }

    function getSourceNotes(row) {
        return toReadableText(row?.reviewReason || row?.notes || row?.sourceEstadoRevision || '-', '-');
    }

    function getHint(row) {
        if (row?.e14Reference) return row.e14Reference;
        const utils = window.BogotaZoneUtils;
        if (utils?.buildE14NavigationHint) return utils.buildE14NavigationHint(row || {});
        return {
            zoneLabel: row?.zoneCode ? `Zona ${row.zoneCode}` : 'Zona sin mapear',
            copyText: `CAMARA | BOGOTA | ${row?.zoneCode ? `Zona ${row.zoneCode}` : 'Zona sin mapear'} | ${row?.puesto || '-'} | Mesa ${row?.mesa ?? '-'} | Candidata 105`
        };
    }

    async function copyReference(row) {
        const hint = getHint(row);
        const text = hint.copyText || '';
        try {
            await navigator.clipboard.writeText(text);
            showResult('alert-success', `Referencia copiada: ${text}`);
        } catch (_) {
            showResult('alert-warning', 'No se pudo copiar la referencia');
        }
    }

    function openE14(row) {
        const target = row?.sourceDocumento || E14_BASE_URL;
        window.open(target, '_blank', 'noopener,noreferrer');
        const hint = getHint(row);
        showResult('alert-info', `Documento E14 abierto. ${hint.copyText || ''}`);
    }

    function openSourceDocument(row) {
        if (!row?.sourceDocumento) {
            showResult('alert-warning', 'Esta mesa no tiene URL de documento fuente sincronizada');
            return;
        }
        window.open(row.sourceDocumento, '_blank', 'noopener,noreferrer');
    }

    async function copySourceDocument(row) {
        if (!row?.sourceDocumento) {
            showResult('alert-warning', 'Esta mesa no tiene URL de documento fuente');
            return;
        }
        try {
            await navigator.clipboard.writeText(row.sourceDocumento);
            showResult('alert-success', 'URL del documento fuente copiada');
        } catch (_) {
            showResult('alert-warning', 'No se pudo copiar la URL del documento fuente');
        }
    }

    function renderRows(items = []) {
        const tbody = document.getElementById('rdvTableBody');
        if (!tbody) return;
        rowsByKey = new Map();
        currentRows = Array.isArray(items) ? [...items] : [];

        if (!Array.isArray(items) || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No hay mesas para los filtros actuales</td></tr>';
            return;
        }

        items.forEach((row) => {
            rowsByKey.set(String(row.mesaKey), row);
        });

        tbody.innerHTML = items.map((row, index) => {
            const hint = getHint(row);
            const detail = `Corp: CAMARA | Mpio: BOGOTA | ${toReadableText(hint.zoneLabel, 'Zona sin mapear')} | Cand: 105`;
            const sourceFile = toReadableText(row.sourceArchivo, 'Sin archivo');
            const sourceMethod = toReadableText(row.sourceMetodoDigito, 'Sin metodo');
            const sourceNotes = getSourceNotes(row);
            const sourceUrl = row?.sourceDocumento ? escapeHtml(row.sourceDocumento) : '';
            const captureLabel = row?.sourceCaptureAvailable ? 'Si' : 'No';

            return `
                <tr>
                    <td>${escapeHtml(toReadableText(row.localidad, '-'))}</td>
                    <td>${escapeHtml(toReadableText(row.puesto, '-'))}</td>
                    <td>${escapeHtml(toReadableText(row.mesa, '-'))}</td>
                    <td>${escapeHtml(toReadableText(row.groupCount, 0))}</td>
                    <td>${escapeHtml(toReadableText(row.votosReportadosTotales, 0))}</td>
                    <td>${escapeHtml(toReadableText(row.votosE14Candidate105 ?? row.votosE14SuggestedCandidate105, '-'))}</td>
                    <td>${formatPercentage(row.confirmacionPorcentaje)}</td>
                    <td>${formatDifference(row.diferencia)}</td>
                    <td>${statusBadge(row.estado)} ${reviewBadge(row)}</td>
                    <td>
                        <div><strong>${escapeHtml(toReadableText(hint.zoneLabel, 'Zona sin mapear'))}</strong></div>
                        <div><small>${escapeHtml(detail)}</small></div>
                        <div style="margin-top:4px;">${priorityBadge(row.reviewPriorityRank)}</div>
                        <div style="margin-top:4px;">${sourceBadge(row.sourceEstadoRevision)}</div>
                        <div><small>Confianza OCR: ${escapeHtml(formatConfidence(row.sourceConfidence))}</small></div>
                        <div><small>Metodo: ${escapeHtml(sourceMethod)}</small></div>
                        <div><small>Captura: ${escapeHtml(captureLabel)}</small></div>
                        <div><small>Archivo: ${escapeHtml(sourceFile)}</small></div>
                        <div><small>${escapeHtml(sourceNotes)}</small></div>
                    </td>
                    <td>
                        <div class="btn-group">
                            ${row?.sourceDocumento
                                ? `<a class="btn btn-sm btn-outline" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Abrir PDF</a>`
                                : '<button class="btn btn-sm btn-outline" data-action="open-e14" data-index="' + index + '">Abrir E14</button>'}
                            <button class="btn btn-sm btn-outline" data-action="copy-source" data-index="${index}">Copiar URL</button>
                            <button class="btn btn-sm btn-outline" data-action="copy-ref" data-index="${index}">Copiar referencia</button>
                            <button class="btn btn-sm btn-primary" data-action="confirm-mesa" data-index="${index}">Ver detalle</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderPagination(pagination = {}) {
        const info = document.getElementById('rdvPaginationInfo');
        if (info) info.textContent = `Pagina ${pagination.page || 1} de ${pagination.totalPages || 1} · ${pagination.total || 0} mesas`;
        const prevBtn = document.getElementById('rdvPrevPageBtn');
        const nextBtn = document.getElementById('rdvNextPageBtn');
        if (prevBtn) prevBtn.disabled = (pagination.page || 1) <= 1;
        if (nextBtn) nextBtn.disabled = (pagination.page || 1) >= (pagination.totalPages || 1);
    }

    function setKpis(kpis = {}) {
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(value ?? 0);
        };
        set('rdvKpiAnalizados', kpis.mesasAnalizadas || 0);
        set('rdvKpiPendientes', kpis.mesasPendientesE14 || 0);
        set('rdvKpiConfirmados', kpis.mesasConfirmadas || 0);
        set('rdvKpiPromedio', `${kpis.confirmacionPromedio || 0}%`);
        set('rdvKpiVotosReportados', kpis.votosReportadosTotales || 0);
        set('rdvKpiVotosE14', kpis.votosE14Totales || 0);
    }

    async function load() {
        const loading = document.getElementById('rdvLoading');
        if (loading) loading.style.display = 'block';
        try {
            const data = await DataService.getE14ConfirmationByMesa(getFilters());
            applyFilterOptions(data.filters || {});
            setKpis(data.kpis || {});
            renderRows(data.items || []);
            renderPagination(data.pagination || {});
            if (data.debug) {
                console.info('[E14 GROUP DEBUG]', data.debug);
            }
        } catch (error) {
            const tbody = document.getElementById('rdvTableBody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="text-center text-danger">${escapeHtml(toReadableText(error?.message || error, 'Error cargando mesas'))}</td></tr>`;
            showResult('alert-danger', toReadableText(error?.message || error, 'No se pudo cargar confirmacion por mesa'));
        } finally {
            if (loading) loading.style.display = 'none';
        }
    }

    function openModal(row) {
        currentModalRow = row;
        const hint = getHint(row);
        document.getElementById('rdvManualMesaKey').value = row.mesaKey || '';
        document.getElementById('rdvManualLocalidad').value = row.localidad || '';
        document.getElementById('rdvManualZone').value = hint.zoneLabel || '';
        document.getElementById('rdvManualPuesto').value = row.puesto || '';
        document.getElementById('rdvManualMesa').value = row.mesa ?? '';
        document.getElementById('rdvManualGroupCount').value = row.groupCount || 0;
        document.getElementById('rdvManualHint').value = hint.copyText || '';
        document.getElementById('rdvManualReportedVotes').value = row.votosReportadosTotales ?? 0;
        document.getElementById('rdvManualE14Votes').value = row.votosE14Candidate105 ?? row.votosE14SuggestedCandidate105 ?? '';
        document.getElementById('rdvManualPriority').value = formatPriority(row.reviewPriorityRank);
        document.getElementById('rdvManualTaskId').value = toReadableText(row.taskId, '-');
        document.getElementById('rdvManualSourceStatus').value = formatSourceStatus(row.sourceEstadoRevision);
        document.getElementById('rdvManualSourceConfidence').value = formatConfidence(row.sourceConfidence);
        document.getElementById('rdvManualSourceMethod').value = toReadableText(row.sourceMetodoDigito, '-');
        document.getElementById('rdvManualSourceFile').value = toReadableText(row.sourceArchivo, '-');
        document.getElementById('rdvManualSourceDocument').value = toReadableText(row.sourceDocumento, '-');
        document.getElementById('rdvManualSourceLocalFile').value = toReadableText(row.sourceLocalFileUri, '-');
        document.getElementById('rdvManualSourceDebug').value = toReadableText(row.sourceDebugDir, '-');
        document.getElementById('rdvManualSourceCapture').value = row.sourceCaptureAvailable ? 'Si' : 'No';
        document.getElementById('rdvManualOverlayPath').value = toReadableText(row.sourceOverlayPath, '-');
        document.getElementById('rdvManualCellPath').value = toReadableText(row.sourceCellPath, '-');
        document.getElementById('rdvManualMaskPath').value = toReadableText(row.sourceMaskPath, '-');
        document.getElementById('rdvManualPartyBlockPath').value = toReadableText(row.sourcePartyBlockPath, '-');
        document.getElementById('rdvManualSourceNotes').value = getSourceNotes(row);
        const reviewContext = row.reviewRequired ? `\n[REVISION VISUAL]\n${toReadableText(row.reviewReason || row.sourceEstadoRevision, '')}` : '';
        document.getElementById('rdvManualNotes').value = `${row.notes || ''}${reviewContext}`.trim();
        updatePreview();
        const modal = document.getElementById('rdvManualModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('rdvManualModal');
        if (modal) modal.style.display = 'none';
        currentModalRow = null;
    }

    function updatePreview() {
        const reportados = toInt(document.getElementById('rdvManualReportedVotes')?.value);
        const e14 = toInt(document.getElementById('rdvManualE14Votes')?.value);
        const hasLoc = Boolean(String(document.getElementById('rdvManualLocalidad')?.value || '').trim());
        const hasPuesto = Boolean(String(document.getElementById('rdvManualPuesto')?.value || '').trim());
        const hasMesa = Boolean(String(document.getElementById('rdvManualMesa')?.value || '').trim());
        const hasMissingLocation = !(hasLoc && hasPuesto && hasMesa);

        const calc = hasMissingLocation
            ? { porcentaje: null, diferencia: null, estado: 'datos_incompletos' }
            : (() => {
                if (reportados === null || reportados <= 0) return { porcentaje: null, diferencia: null, estado: 'sin_votos_reportados' };
                if (e14 === null || e14 < 0) return { porcentaje: null, diferencia: null, estado: 'pendiente_e14' };
                const porcentaje = Math.min(Number(((e14 / reportados) * 100).toFixed(2)), 100);
                const diferencia = e14 - reportados;
                let estado = 'sin_confirmacion';
                if (porcentaje >= 100) estado = 'confirmado';
                else if (porcentaje >= 60) estado = 'confirmacion_alta';
                else if (porcentaje >= 30) estado = 'confirmacion_parcial';
                else if (porcentaje >= 1) estado = 'confirmacion_baja';
                return { porcentaje, diferencia, estado };
            })();

        const percentage = document.getElementById('rdvManualPreviewPercentage');
        const difference = document.getElementById('rdvManualPreviewDifference');
        if (percentage) percentage.value = calc.porcentaje === null ? `- (${calc.estado})` : `${calc.porcentaje}% (${calc.estado})`;
        if (difference) difference.value = calc.diferencia === null ? '-' : formatDifference(calc.diferencia);
    }

    async function saveByMesa() {
        if (!currentModalRow) return;
        const votosE14 = toInt(document.getElementById('rdvManualE14Votes')?.value);
        if (votosE14 === null || votosE14 < 0) {
            showResult('alert-warning', 'Ingresa un valor valido para votos E14 candidata 105');
            return;
        }
        try {
            await DataService.saveE14ConfirmationByMesaManual({
                eventId: AppState?.user?.eventId || null,
                localidad: document.getElementById('rdvManualLocalidad')?.value || '',
                puesto: document.getElementById('rdvManualPuesto')?.value || '',
                mesa: toInt(document.getElementById('rdvManualMesa')?.value),
                zoneCode: (document.getElementById('rdvManualZone')?.value || '').match(/(\d{2})/)?.[1] || currentModalRow.zoneCode || null,
                votosE14Candidate105: votosE14,
                e14ListVotes: null,
                notes: document.getElementById('rdvManualNotes')?.value || ''
            });
            closeModal();
            showResult('alert-success', 'Confirmacion por mesa guardada');
            await load();
        } catch (error) {
            showResult('alert-danger', toReadableText(error?.message || error, 'No se pudo guardar confirmacion por mesa'));
        }
    }

    async function recalc() {
        const btn = document.getElementById('rdvRunValidationBtn');
        if (btn) btn.disabled = true;
        try {
            const result = await DataService.runRealDataValidation(getFilters());
            showResult('alert-info', `Recalculo completado. Procesadas=${result.processed || 0}, Confirmadas=${result.confirmed || 0}`);
            await load();
        } catch (error) {
            showResult('alert-danger', toReadableText(error?.message || error, 'No se pudo recalcular'));
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function syncReference() {
        const btn = document.getElementById('rdvSyncBtn');
        const progress = document.getElementById('rdvSyncProgress');
        if (btn) btn.disabled = true;
        if (progress) progress.style.display = 'block';
        try {
            const data = await DataService.syncMesasBogota();
            showResult('alert-info', `Sync referencia finalizado. Puestos=${data.puestosProcesados ?? data.puestos_procesados ?? 0}, Mesas=${data.mesasEncontradas ?? data.mesas_encontradas ?? 0}`);
        } catch (error) {
            showResult('alert-danger', toReadableText(error?.message || error, 'No se pudo sincronizar referencia'));
        } finally {
            if (btn) btn.disabled = false;
            if (progress) progress.style.display = 'none';
        }
    }

    function bindTableActions() {
        const tbody = document.getElementById('rdvTableBody');
        if (!tbody) return;
        tbody.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const index = Number.parseInt(btn.dataset.index || '-1', 10);
            const row = Number.isInteger(index) && index >= 0 ? currentRows[index] : null;
            if (!row) return;
            if (action === 'open-e14') openE14(row);
            if (action === 'open-source') openSourceDocument(row);
            if (action === 'copy-source') copySourceDocument(row);
            if (action === 'copy-ref') copyReference(row);
            if (action === 'confirm-mesa') openModal(row);
        });
    }

    function bindEvents() {
        document.getElementById('rdvOpenE14BaseBtn')?.addEventListener('click', () => window.open(E14_BASE_URL, '_blank', 'noopener,noreferrer'));
        document.getElementById('rdvRunValidationBtn')?.addEventListener('click', recalc);
        document.getElementById('rdvSyncBtn')?.addEventListener('click', syncReference);
        document.getElementById('rdvApplyFiltersBtn')?.addEventListener('click', () => { currentPage = 1; load(); });
        document.getElementById('rdvResetFiltersBtn')?.addEventListener('click', () => {
            ['rdvFilterLocalidad', 'rdvFilterPuesto', 'rdvFilterMesa', 'rdvFilterEstado', 'rdvFilterSourceStatus', 'rdvFilterSearch']
                .forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
            currentPage = 1;
            load();
        });
        document.getElementById('rdvFilterLocalidad')?.addEventListener('change', () => {
            const puestoSelect = document.getElementById('rdvFilterPuesto');
            if (puestoSelect) puestoSelect.value = '';
            currentPage = 1;
            load();
        });
        document.getElementById('rdvPrevPageBtn')?.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); load(); });
        document.getElementById('rdvNextPageBtn')?.addEventListener('click', () => { currentPage += 1; load(); });

        document.getElementById('rdvManualCloseBtn')?.addEventListener('click', closeModal);
        document.getElementById('rdvManualSaveBtn')?.addEventListener('click', saveByMesa);
        document.getElementById('rdvManualOpenSourceBtn')?.addEventListener('click', () => currentModalRow && openSourceDocument(currentModalRow));
        document.getElementById('rdvManualOpenE14Btn')?.addEventListener('click', () => currentModalRow && openE14(currentModalRow));
        document.getElementById('rdvManualCopyRefBtn')?.addEventListener('click', () => currentModalRow && copyReference(currentModalRow));
        document.getElementById('rdvManualE14Votes')?.addEventListener('input', updatePreview);

        bindTableActions();
    }

    async function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
    }

    async function mount() {
        if (!initialized) await init();
        await load();
    }

    return {
        init,
        mount,
        load
    };
})();

window.RealDataValidationModule = RealDataValidationModule;
