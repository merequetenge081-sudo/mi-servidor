const RealDataValidationModule = (() => {
    'use strict';

    const E14_BASE_URL = 'https://divulgacione14congreso.registraduria.gov.co/departamento/16';
    const PAGE_SIZE = 25;
    const INVALID_PAGE_SIZE = 25;
    const IMPORT_HISTORY_PAGE_SIZE = 10;
    const VIEW_CONFIG = {
        summary: { queue: '', panel: 'summary' },
        pending: { queue: 'pending', panel: 'comparison' },
        compare: { queue: '', panel: 'compare' },
        differences: { queue: 'differences', panel: 'comparison' },
        invalid: { queue: '', panel: 'invalid' },
        imports: { queue: '', panel: 'imports' }
    };

    let mounted = false;
    let currentPage = 1;
    let activeView = 'summary';
    let currentRows = [];
    let currentRowMap = new Map();
    let currentDetailRow = null;
    let invalidPage = 1;
    let importsPage = 1;
    let invalidLoaded = false;
    let importsLoaded = false;
    let compareLoaded = false;
    let filterOptions = { localidadesDisponibles: [] };
    let officialController = null;
    let invalidController = null;
    let importsController = null;
    let importPreviewController = null;
    let importApplyController = null;
    let progressTreeController = null;
    let importProgressTimers = [];
    let searchTimer = null;
    let importRows = [];
    let importHeaders = [];
    let importPreview = null;
    let progressTreeData = null;
    let compareGapOnly = false;
    const IMPORT_STAGES = ['archivo', 'mapeo', 'preview', 'apply'];

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function text(value, fallback = '-') {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
    }

    function isAbortError(error) {
        return error?.name === 'AbortError' || error?.code === 20 || /abort/i.test(String(error?.message || ''));
    }

    function parseIntSafe(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number.parseInt(String(value).replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('es-CO');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('es-CO');
    }

    function formatDifference(value) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
        const numeric = Number(value);
        if (numeric > 0) return `+${numeric}`;
        return String(numeric);
    }

    function differenceClass(value) {
        const numeric = Number(value || 0);
        if (numeric > 0) return 'tw-text-emerald-700';
        if (numeric < 0) return 'tw-text-rose-700';
        return 'tw-text-slate-700';
    }

    function showBanner(kind, message) {
        const node = document.getElementById('rdvSyncResult');
        if (!node) return;
        node.className = 'tw-px-4 tw-py-3 tw-rounded-md tw-text-sm tw-font-medium';
        node.style.display = 'block';
        node.classList.remove('tw-hidden');
        if (kind === 'success') node.classList.add('tw-bg-emerald-50', 'tw-text-emerald-700');
        else if (kind === 'warning') node.classList.add('tw-bg-amber-50', 'tw-text-amber-700');
        else node.classList.add('tw-bg-rose-50', 'tw-text-rose-700');
        node.textContent = message;
    }

    function hideBanner() {
        const node = document.getElementById('rdvSyncResult');
        if (!node) return;
        node.style.display = 'none';
        node.className = 'tw-hidden tw-px-4 tw-py-3 tw-rounded-md tw-text-sm tw-font-medium';
        node.textContent = '';
    }

    function debounce(callback, wait = 300) {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(callback, wait);
    }

    function clearTimer(timerRef) {
        if (timerRef) window.clearTimeout(timerRef);
        return null;
    }

    function clearImportProgressTimers() {
        importProgressTimers.forEach((timer) => clearTimer(timer));
        importProgressTimers = [];
    }

    function getCurrentEventId() {
        return AppState?.user?.eventId || null;
    }

    function getCurrentScopeFilters() {
        return {
            eventId: getCurrentEventId(),
            regionScope: document.getElementById('rdvFilterRegionScope')?.value || '',
            localidad: document.getElementById('rdvFilterLocalidad')?.value || '',
            estado: document.getElementById('rdvFilterEstado')?.value || '',
            sourceStatus: document.getElementById('rdvFilterSourceStatus')?.value || '',
            search: document.getElementById('rdvFilterSearch')?.value?.trim() || ''
        };
    }

    function getOfficialFilters() {
        const base = getCurrentScopeFilters();
        return {
            ...base,
            queue: VIEW_CONFIG[activeView]?.queue || '',
            page: currentPage,
            limit: PAGE_SIZE
        };
    }

    function getInvalidFilters() {
        const base = getCurrentScopeFilters();
        return {
            ...base,
            page: invalidPage,
            limit: INVALID_PAGE_SIZE
        };
    }

    function getImportHistoryFilters() {
        return {
            eventId: getCurrentEventId(),
            page: importsPage,
            limit: IMPORT_HISTORY_PAGE_SIZE
        };
    }

    function setSelectOptions(selectId, options, placeholder) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;
        const rows = Array.isArray(options) ? options : [];
        select.innerHTML = [`<option value="">${escapeHtml(placeholder)}</option>`]
            .concat(rows.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`))
            .join('');
        select.value = rows.some((option) => option.value === currentValue) ? currentValue : '';
    }

    function statusBadge(status) {
        const normalized = String(status || '').toLowerCase();
        const map = {
            confirmado: ['Confirmada', 'tw-bg-emerald-50 tw-text-emerald-700'],
            confirmacion_alta: ['Confirmada', 'tw-bg-emerald-50 tw-text-emerald-700'],
            confirmacion_parcial: ['Pendiente', 'tw-bg-amber-50 tw-text-amber-700'],
            confirmacion_baja: ['Pendiente', 'tw-bg-amber-50 tw-text-amber-700'],
            pendiente_e14: ['Sin E14', 'tw-bg-slate-100 tw-text-slate-700'],
            sin_confirmacion: ['Inconsistente', 'tw-bg-rose-50 tw-text-rose-700'],
            sin_votos_reportados: ['Sin votos', 'tw-bg-slate-100 tw-text-slate-700']
        };
        const [label, classes] = map[normalized] || [text(status, 'Pendiente'), 'tw-bg-slate-100 tw-text-slate-700'];
        return `<span class="tw-inline-flex tw-items-center tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold ${classes}">${escapeHtml(label)}</span>`;
    }

    function sourceBadge(row) {
        if (row.source === 'excel_import') return '<span class="tw-inline-flex tw-items-center tw-rounded-full tw-bg-indigo-50 tw-text-indigo-700 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold">Excel</span>';
        if (row.source === 'manual') return '<span class="tw-inline-flex tw-items-center tw-rounded-full tw-bg-slate-100 tw-text-slate-700 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold">Manual</span>';
        if (row.sourceStatus === 'ok') return '<span class="tw-inline-flex tw-items-center tw-rounded-full tw-bg-emerald-50 tw-text-emerald-700 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold">OCR OK</span>';
        if (row.sourceStatus) return `<span class="tw-inline-flex tw-items-center tw-rounded-full tw-bg-amber-50 tw-text-amber-700 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold">${escapeHtml(row.sourceStatus)}</span>`;
        return '<span class="tw-inline-flex tw-items-center tw-rounded-full tw-bg-slate-100 tw-text-slate-700 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold">Sin fuente</span>';
    }

    function humanDifferenceStatus(row) {
        const diff = Number(row.diferencia ?? row.difference ?? 0);
        if (row.e14Votes === null || row.e14Votes === undefined) return 'Sin E14';
        if (!Number.isFinite(diff)) return 'Pendiente';
        if (diff === 0) return 'Confirmada';
        return 'Diferencia';
    }

    function renderOfficialSkeleton() {
        const tbody = document.getElementById('rdvTableBody');
        if (!tbody) return;
        tbody.innerHTML = Array.from({ length: 6 }).map(() => `<tr><td colspan="9" class="tw-px-4 tw-py-3"><div class="tw-h-10 tw-rounded-lg tw-bg-slate-100 tw-animate-pulse"></div></td></tr>`).join('');
    }

    function renderImportSummary(preview) {
        const node = document.getElementById('rdvImportPreviewSummary');
        if (!node) return;
        if (!preview) {
            node.innerHTML = '';
            return;
        }
        const cards = [
            ['Coinciden', preview.summaryByStatus?.confirmada || 0, 'tw-text-emerald-700'],
            ['Con diferencia', preview.summaryByStatus?.diferencia || 0, 'tw-text-rose-700'],
            ['No encontradas', preview.summaryByStatus?.no_encontrada || 0, 'tw-text-amber-700'],
            ['Incompletas', preview.summaryByStatus?.dato_incompleto || 0, 'tw-text-slate-700'],
            ['Duplicadas', preview.summaryByStatus?.duplicada || 0, 'tw-text-slate-700']
        ];
        node.innerHTML = cards.map(([label, value, color]) => `<article class="tw-rounded-3xl tw-border tw-border-slate-200 tw-bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] tw-p-4 tw-shadow-[0_10px_24px_rgba(15,23,42,0.05)]"><div class="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.16em] tw-text-slate-500">${escapeHtml(label)}</div><div class="tw-mt-3 tw-text-2xl tw-font-bold ${color}">${formatNumber(value)}</div></article>`).join('');
    }

    function getDifferenceTone(value) {
        const numeric = Number(value || 0);
        if (numeric > 0) return 'tw-text-emerald-700';
        if (numeric < 0) return 'tw-text-rose-700';
        return 'tw-text-slate-700';
    }

    function getMesaState(item) {
        if (!item?.hasE14) return 'Sin E14';
        if (Number(item.difference || 0) === 0) return 'Confirmada';
        return 'Diferencia';
    }

    function hasGap(item) {
        if (!item) return false;
        if (item.hasE14 === false) return true;
        return Number(item.difference || 0) !== 0;
    }

    function filterProgressTreeForGap(localidades = []) {
        return localidades
            .map((localidad) => {
                const puestos = Array.isArray(localidad.puestos) ? localidad.puestos : [];
                const filteredPuestos = puestos
                    .map((puesto) => {
                        const mesas = Array.isArray(puesto.mesas) ? puesto.mesas : [];
                        const filteredMesas = mesas.filter((mesa) => hasGap(mesa));
                        if (!filteredMesas.length && !hasGap(puesto)) return null;
                        return {
                            ...puesto,
                            mesas: filteredMesas.length ? filteredMesas : mesas
                        };
                    })
                    .filter(Boolean);
                if (!filteredPuestos.length && !hasGap(localidad)) return null;
                return {
                    ...localidad,
                    puestos: filteredPuestos.length ? filteredPuestos : puestos
                };
            })
            .filter(Boolean);
    }

    function setImportProgress(label, percent, processed, total) {
        const bar = document.getElementById('rdvImportProgressBar');
        const labelNode = document.getElementById('rdvImportProgressLabel');
        const countNode = document.getElementById('rdvImportProgressCount');
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(percent || 0)))}%`;
        if (labelNode) labelNode.textContent = label || 'Analizando archivo...';
        if (countNode) countNode.textContent = `${formatNumber(processed || 0)} / ${formatNumber(total || 0)} filas`;
    }

    function stopImportProgress() {
        clearImportProgressTimers();
        setImportProgress('Preparando archivo...', 0, 0, importRows.length || 0);
    }

    function setImportStage(stage) {
        IMPORT_STAGES.forEach((step) => {
            const node = document.getElementById(`rdvImportStage${step.charAt(0).toUpperCase()}${step.slice(1)}`);
            if (!node) return;
            const active = step === stage;
            const completed = IMPORT_STAGES.indexOf(step) < IMPORT_STAGES.indexOf(stage);
            node.className = 'tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-transition-colors';
            if (active) {
                node.classList.add('tw-bg-slate-900', 'tw-text-white');
            } else if (completed) {
                node.classList.add('tw-bg-emerald-100', 'tw-text-emerald-700');
            } else {
                node.classList.add('tw-bg-slate-100', 'tw-text-slate-500');
            }
        });
    }

    function humanImportStatus(status) {
        const normalized = String(status || '').trim().toLowerCase();
        const labels = {
            confirmada: 'Confirmada',
            diferencia: 'Con diferencia',
            no_encontrada: 'No encontrada',
            dato_incompleto: 'Dato incompleto',
            inconsistente: 'Inconsistente',
            duplicada: 'Duplicada'
        };
        return labels[normalized] || text(status, '-');
    }

    function startImportProgress(totalRows) {
        clearImportProgressTimers();
        const total = Math.max(Number(totalRows || 0), 1);
        const stages = [
            { delay: 0, label: 'Leyendo archivo...', percent: 12, processed: Math.min(total, Math.max(1, Math.round(total * 0.08))) },
            { delay: 220, label: 'Detectando columnas...', percent: 28, processed: Math.min(total, Math.max(1, Math.round(total * 0.16))) },
            { delay: 540, label: 'Conciliando filas con la referencia oficial...', percent: 64, processed: Math.min(total, Math.max(1, Math.round(total * 0.65))) },
            { delay: 920, label: 'Generando vista previa...', percent: 88, processed: Math.min(total, Math.max(1, Math.round(total * 0.92))) }
        ];
        stages.forEach((stage) => {
            const timer = window.setTimeout(() => {
                setImportProgress(stage.label, stage.percent, stage.processed, total);
            }, stage.delay);
            importProgressTimers.push(timer);
        });
    }

    function setMetricCardCopy() {
        const expectedLabel = document.getElementById('rdvKpiVerificadas')?.previousElementSibling;
        const expectedHelp = document.getElementById('rdvKpiVerificadas')?.nextElementSibling;
        const realLabel = document.getElementById('rdvKpiPendientes')?.previousElementSibling;
        const realHelp = document.getElementById('rdvKpiPendientes')?.nextElementSibling;
        const missingLabel = document.getElementById('rdvKpiDiferencias')?.previousElementSibling;
        const missingHelp = document.getElementById('rdvKpiDiferencias')?.nextElementSibling;
        if (expectedLabel) expectedLabel.textContent = 'Votos esperados';
        if (expectedHelp) expectedHelp.textContent = 'Votos internos que deberian existir segun lo capturado en el sistema.';
        if (realLabel) realLabel.textContent = 'Votos reales E14';
        if (realHelp) realHelp.textContent = 'Votos ya confirmados por formulario E14 o importación manual.';
        if (missingLabel) missingLabel.textContent = 'Votos faltantes';
        if (missingHelp) missingHelp.textContent = 'Brecha pendiente entre votos esperados y votos realmente confirmados.';
    }

    function applyStaticWorkspaceCopy() {
        const title = document.querySelector('#validacion-datos-reales h2.tw-text-2xl');
        if (title) title.textContent = 'Confirmación E14 por Mesa';
        const badge = document.querySelector('#validacion-datos-reales span.tw-inline-flex.tw-items-center.tw-gap-2');
        if (badge) badge.innerHTML = '<i class="bi bi-check2-square"></i> Conciliación mesa a mesa';
        const subtitle = document.querySelector('#validacion-datos-reales header p.tw-text-sm');
        if (subtitle) subtitle.textContent = 'Compara los votos esperados del sistema contra los votos reales del formulario E14 y detecta rápidamente dónde faltan votos.';
        const resultTitle = document.querySelector('#validacion-datos-reales article h3.tw-text-lg.tw-font-semibold.tw-text-slate-900.tw-m-0');
        if (resultTitle) resultTitle.textContent = 'Resultados hasta ahora';
        const compareHelp = document.querySelector('#rdvComparePanel .tw-text-sm.tw-text-slate-500');
        if (compareHelp) compareHelp.textContent = 'Explora la brecha entre votos esperados y votos reales. Usa "Revisar mesa" para abrir OCR/E14 y guardar la conciliación completa.';
        const summaryHintBlocks = document.querySelectorAll('#validacion-datos-reales .tw-space-y-3.tw-text-sm .tw-text-slate-600');
        if (summaryHintBlocks[0]) summaryHintBlocks[0].textContent = 'Cantidad de votos internos capturados en el sistema.';
        if (summaryHintBlocks[1]) summaryHintBlocks[1].textContent = 'Cantidad de mesas únicas donde esos registros están agrupados.';
        if (summaryHintBlocks[2]) summaryHintBlocks[2].textContent = 'Porcentaje de votos reales confirmados frente a los votos esperados del sistema.';
        const usageTitle = Array.from(document.querySelectorAll('#validacion-datos-reales h3')).find((node) => node.textContent?.includes('Cómo usar'));
        if (usageTitle) usageTitle.textContent = 'Qué hacer primero';
        const usageSubtitle = usageTitle?.parentElement?.querySelector('p');
        if (usageSubtitle) usageSubtitle.textContent = 'Empieza por Revisar mesas si quieres validar una mesa puntual. Usa Comparar votos para entender la brecha y Importar Excel cuando recibas verificación externa.';
        const importWorkflowCopy = document.querySelector('#rdvWorkflowImportBtn')?.previousElementSibling?.querySelector('p');
        if (importWorkflowCopy) importWorkflowCopy.textContent = 'Sube la verificación manual del equipo territorial, revisa el resultado y aplica solo filas seguras.';
        const pendingWorkflowCopy = document.querySelector('#rdvWorkflowPendingBtn')?.previousElementSibling?.querySelector('p');
        if (pendingWorkflowCopy) pendingWorkflowCopy.textContent = 'Este es el flujo principal de trabajo: abre una mesa, revisa OCR/E14 y guarda la conciliación desde el detalle.';
        const importHeading = document.querySelector('#rdvImportModal h3');
        if (importHeading) importHeading.textContent = 'Importar verificación Excel';
        const importSubheading = document.querySelector('#rdvImportModal h3 + p');
        if (importSubheading) importSubheading.textContent = 'Carga un archivo manual, revisa cómo concilia cada fila y aplica solo las coincidencias seguras.';
        const compareWorkflowCopy = document.querySelector('#rdvWorkflowCompareBtn')?.previousElementSibling?.querySelector('p');
        if (compareWorkflowCopy) compareWorkflowCopy.textContent = 'Explora faltantes por localidad, puesto y mesa, y salta directo a la revisión detallada cuando necesites validar con OCR o E14.';
        const compareHeading = document.querySelector('#rdvComparePanel h3');
        if (compareHeading) compareHeading.textContent = 'Comparar votos';
    }

    function updateSummaryCards(summary = {}) {
        const mesas = Number(summary.mesas || 0);
        const registros = Number(summary.totalRegistros ?? summary.votosReportados ?? 0);
        const expectedVotes = Number(summary.expectedVotes ?? summary.votosReportados ?? 0);
        const realVotes = Number(summary.realVotes ?? summary.votosE14 ?? 0);
        const missingVotes = Number(summary.missingVotes ?? Math.max(expectedVotes - realVotes, 0));
        const verificadas = Number(summary.mesasConciliadas ?? summary.verificadas ?? summary.confirmadas ?? 0);
        const pendientes = Number(summary.pendientes || 0);
        const diferencias = Number(summary.mesasConDiferencia || 0);
        const excluded = Number(summary.excludedTotal || 0);
        const porcentaje = Number(summary.porcentajeAvanceVotos ?? summary.porcentajeAvanceRevision ?? (expectedVotes > 0 ? (Math.min(realVotes, expectedVotes) / expectedVotes) * 100 : 0));
        const promedioMesa = Number(summary.promedioRegistrosPorMesa ?? (mesas > 0 ? registros / mesas : 0));
        const diferenciaAcumulada = Number(summary.diferenciaAcumulada ?? ((summary.votosE14 || 0) - (summary.votosReportados || 0)));
        const set = (id, value) => {
            const node = document.getElementById(id);
            if (node) node.textContent = value;
        };
        setMetricCardCopy();
        applyStaticWorkspaceCopy();
        set('rdvKpiRegistrosTotal', formatNumber(registros));
        set('rdvKpiMesasTotal', formatNumber(mesas));
        set('rdvKpiVerificadas', formatNumber(expectedVotes));
        set('rdvKpiPendientes', formatNumber(realVotes));
        set('rdvKpiDiferencias', formatNumber(missingVotes));
        set('rdvKpiVotosReportados', formatNumber(pendientes));
        set('rdvKpiVotosE14', formatNumber(diferencias));
        set('rdvKpiPromedioMesa', promedioMesa.toLocaleString('es-CO', { maximumFractionDigits: 2 }));
        set('rdvKpiExcluidos', formatNumber(excluded));
        set('rdvSummaryPendingCount', formatNumber(pendientes));
        set('rdvSummaryDifferenceCount', formatNumber(diferencias));
        set('rdvSummaryInvalidCount', formatNumber(excluded));
        set('rdvSummaryPendingCountInline', formatNumber(pendientes));
        set('rdvSummaryDifferenceCountInline', formatNumber(diferencias));
        set('rdvSummaryInvalidCountInline', formatNumber(excluded));
        set('rdvResultsRegistros', formatNumber(registros));
        set('rdvResultsMesas', formatNumber(mesas));
        set('rdvResultsAverage', promedioMesa.toLocaleString('es-CO', { maximumFractionDigits: 2 }));
        set('rdvResultsInternalVotes', formatNumber(expectedVotes));
        set('rdvResultsE14Votes', formatNumber(realVotes));
        set('rdvResultsDifference', formatDifference(diferenciaAcumulada));
        const progressLabel = document.getElementById('rdvProgressLabel');
        const progressBar = document.getElementById('rdvProgressBar');
        if (progressLabel) progressLabel.textContent = `${Math.round(porcentaje)}% de votos conciliados`;
        if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, porcentaje))}%`;
        const badge = document.getElementById('rdvInvalidCountBadge');
        if (badge) badge.textContent = formatNumber(excluded);
    }

    function updateFilterOptions(data = {}) {
        filterOptions = data || {};
        setSelectOptions('rdvFilterLocalidad', (filterOptions.localidadesDisponibles || []).map((item) => ({ value: item.value, label: item.label })), 'Todas');
    }
    function renderOfficialRows(response = {}) {
        currentRows = Array.isArray(response.rows) ? response.rows : [];
        currentRowMap = new Map(currentRows.map((row, index) => [String(index), row]));
        const tbody = document.getElementById('rdvTableBody');
        if (!tbody) return;
        if (!currentRows.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="tw-text-center tw-text-slate-500 tw-py-10">No hay mesas para los filtros actuales.</td></tr>';
        } else {
            tbody.innerHTML = currentRows.map((row, index) => {
                const e14Votes = row.e14Votes ?? row.votosE14Candidate105;
                const internalVotes = row.repVotes ?? row.votosReportadosTotales ?? 0;
                const difference = row.diferencia ?? (e14Votes === null || e14Votes === undefined ? null : Number(e14Votes) - Number(internalVotes));
                return `
                    <tr class="tw-border-b tw-border-slate-100 hover:tw-bg-slate-50">
                        <td class="tw-px-4 tw-py-3 tw-font-medium tw-text-slate-900">${escapeHtml(text(row.localidad, '-'))}</td>
                        <td class="tw-px-4 tw-py-3"><div class="tw-font-medium tw-text-slate-900">${escapeHtml(text(row.puesto, '-'))}</div><div class="tw-text-xs tw-text-slate-500">${escapeHtml(text(row.puestoCodigo, 'Sin código'))}</div></td>
                        <td class="tw-px-4 tw-py-3 tw-font-semibold tw-text-slate-700">${escapeHtml(text(row.mesa, '-'))}</td>
                        <td class="tw-px-4 tw-py-3 tw-text-right tw-font-medium tw-text-slate-900">${formatNumber(internalVotes)}</td>
                        <td class="tw-px-4 tw-py-3 tw-text-right tw-font-medium tw-text-slate-900">${e14Votes === null || e14Votes === undefined ? '-' : formatNumber(e14Votes)}</td>
                        <td class="tw-px-4 tw-py-3 tw-text-right tw-font-semibold ${differenceClass(difference)}">${formatDifference(difference)}</td>
                        <td class="tw-px-4 tw-py-3"><div class="tw-flex tw-flex-col tw-gap-2">${statusBadge(row.status)}<span class="tw-text-xs tw-text-slate-500">${escapeHtml(humanDifferenceStatus(row))}</span></div></td>
                        <td class="tw-px-4 tw-py-3">${sourceBadge(row)}</td>
                        <td class="tw-px-4 tw-py-3 tw-text-right"><button class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-md tw-bg-slate-900 tw-text-white tw-px-3 tw-py-2 tw-text-sm tw-font-medium" data-action="open-row" data-index="${index}" style="border:none;"><i class="bi bi-eye"></i> Revisar</button></td>
                    </tr>
                `;
            }).join('');
        }
        const total = Number(response.total || currentRows.length || 0);
        const page = Number(response.page || currentPage || 1);
        const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
        currentPage = page;
        const meta = document.getElementById('rdvOfficialMeta');
        if (meta) meta.textContent = `Resultados encontrados: ${formatNumber(total)}`;
        const pagination = document.getElementById('rdvPaginationInfo');
        if (pagination) pagination.textContent = `Página ${page} de ${totalPages}`;
        const prevBtn = document.getElementById('rdvPrevPageBtn');
        const nextBtn = document.getElementById('rdvNextPageBtn');
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    function renderInvalidRows(response = {}) {
        const tbody = document.getElementById('rdvInvalidTableBody');
        const meta = document.getElementById('rdvInvalidMeta');
        const reasons = document.getElementById('rdvInvalidReasons');
        if (!tbody || !meta || !reasons) return;
        const rows = Array.isArray(response.rows) ? response.rows : [];
        meta.textContent = `${formatNumber(response.total || rows.length || 0)} registros excluidos`;
        reasons.innerHTML = Object.entries(response.byReason || {}).map(([reason, total]) => `<span class="tw-inline-flex tw-items-center tw-rounded-full tw-bg-slate-100 tw-text-slate-700 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold">${escapeHtml(reason)} · ${formatNumber(total)}</span>`).join('');
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="tw-text-center tw-text-slate-500 tw-py-6">No hay inconsistencias para los filtros actuales.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map((row) => `
            <tr class="tw-border-b tw-border-slate-100">
                <td class="tw-px-4 tw-py-3">${escapeHtml(text(row.leaderName, '-'))}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml(text(row.registrationId, '-'))}</td>
                <td class="tw-px-4 tw-py-3"><div>${escapeHtml(text(row.rawLocalidad, '-'))}</div><div class="tw-text-xs tw-text-slate-500">${escapeHtml(text(row.rawPuesto, '-'))} · Mesa ${escapeHtml(text(row.rawMesa, '-'))}</div></td>
                <td class="tw-px-4 tw-py-3"><div>${escapeHtml(text(row.normalizedLocalidad, '-'))}</div><div class="tw-text-xs tw-text-slate-500">${escapeHtml(text(row.normalizedPuesto, '-'))}</div></td>
                <td class="tw-px-4 tw-py-3">${escapeHtml([row.suggestedOfficialLocalidad, row.suggestedOfficialPuesto].filter(Boolean).join(' · ') || '-')}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml(text(row.officialValidationReason || row.reason, '-'))}</td>
            </tr>
        `).join('');
    }

    function renderImportHistory(response = {}) {
        const tbody = document.getElementById('rdvImportHistoryBody');
        const meta = document.getElementById('rdvImportHistoryMeta');
        if (!tbody || !meta) return;
        const rows = Array.isArray(response.rows) ? response.rows : [];
        meta.textContent = rows.length ? `${formatNumber(response.total || rows.length)} importaciones registradas` : 'No hay importaciones cargadas todavía.';
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="tw-text-center tw-text-slate-500 tw-py-6">No hay historial para este evento.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map((row) => `
            <tr class="tw-border-b tw-border-slate-100">
                <td class="tw-px-4 tw-py-3 tw-font-medium tw-text-slate-900">${escapeHtml(text(row.fileName, '-'))}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml(text(row.importedBy, '-'))}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml(formatDate(row.createdAt))}</td>
                <td class="tw-px-4 tw-py-3 tw-text-right">${formatNumber(row.totalRows || 0)}</td>
                <td class="tw-px-4 tw-py-3 tw-text-right">${formatNumber(row.updatedRows || 0)}</td>
                <td class="tw-px-4 tw-py-3 tw-text-slate-600">Confirmadas: ${formatNumber(row.summaryByStatus?.confirmada || 0)} · Diferencias: ${formatNumber(row.summaryByStatus?.diferencia || 0)}</td>
            </tr>
        `).join('');
    }

    function setSectionVisibility() {
        const summaryPanel = document.getElementById('rdvSummaryPanel');
        const comparisonPanel = document.getElementById('rdvComparisonPanel');
        const comparePanel = document.getElementById('rdvComparePanel');
        const invalidPanel = document.getElementById('rdvInvalidPanel');
        const importsPanel = document.getElementById('rdvImportsPanel');
        const setPanelVisible = (node, visible) => {
            if (!node) return;
            node.style.display = visible ? '' : 'none';
            node.classList.toggle('hidden', !visible);
            node.classList.toggle('tw-hidden', !visible);
        };
        setPanelVisible(summaryPanel, activeView === 'summary');
        setPanelVisible(comparisonPanel, ['pending', 'differences'].includes(activeView));
        setPanelVisible(comparePanel, activeView === 'compare');
        setPanelVisible(invalidPanel, activeView === 'invalid');
        setPanelVisible(importsPanel, activeView === 'imports');
        const buttons = {
            summary: document.getElementById('rdvViewResumenBtn'),
            pending: document.getElementById('rdvViewPendingBtn'),
            compare: document.getElementById('rdvViewCompareBtn'),
            differences: document.getElementById('rdvViewDifferencesBtn'),
            invalid: document.getElementById('rdvViewInvalidBtn'),
            imports: document.getElementById('rdvViewImportsBtn')
        };
        Object.entries(buttons).forEach(([key, button]) => {
            if (!button) return;
            const active = key === activeView;
            button.classList.toggle('tw-bg-slate-900', active);
            button.classList.toggle('tw-text-white', active);
            button.classList.toggle('tw-border-slate-900', active);
            if (!active) button.classList.add('tw-bg-white', 'tw-text-slate-600', 'tw-border', 'tw-border-slate-300');
            else button.classList.remove('tw-bg-white', 'tw-text-slate-600', 'tw-border', 'tw-border-slate-300');
        });
    }

    function showOfficialLoading(loading) {
        const node = document.getElementById('rdvLoading');
        if (!node) return;
        node.style.display = loading ? 'flex' : 'none';
        if (loading) renderOfficialSkeleton();
    }

    function showInvalidLoading(loading) {
        const node = document.getElementById('rdvInvalidLoading');
        if (!node) return;
        node.style.display = loading ? 'flex' : 'none';
    }

    function showImportHistoryLoading(loading) {
        const node = document.getElementById('rdvImportHistoryLoading');
        if (!node) return;
        node.style.display = loading ? 'flex' : 'none';
    }

    function showCompareLoading(loading) {
        const modalNode = document.getElementById('rdvProgressTreeLoading');
        const panelNode = document.getElementById('rdvCompareLoading');
        if (modalNode) modalNode.style.display = loading ? 'flex' : 'none';
        if (panelNode) panelNode.style.display = loading ? 'flex' : 'none';
    }

    function setImportModalVisible(visible) {
        const modal = document.getElementById('rdvImportModal');
        if (!modal) return;
        modal.style.display = visible ? 'flex' : 'none';
        modal.classList.toggle('tw-hidden', !visible);
    }

    function setManualModalVisible(visible) {
        const modal = document.getElementById('rdvManualModal');
        if (!modal) return;
        modal.style.display = visible ? 'flex' : 'none';
        modal.classList.toggle('tw-hidden', !visible);
    }

    function setProgressTreeModalVisible(visible) {
        const modal = document.getElementById('rdvProgressTreeModal');
        if (!modal) return;
        modal.style.display = visible ? 'flex' : 'none';
        modal.classList.toggle('tw-hidden', !visible);
    }

    function showProgressTreeLoading(loading) {
        const node = document.getElementById('rdvProgressTreeLoading');
        if (!node) return;
        node.style.display = loading ? 'flex' : 'none';
    }

    function renderProgressTreeInto(targetIds, data = {}) {
        const body = document.getElementById(targetIds.body);
        const meta = document.getElementById(targetIds.meta);
        const error = document.getElementById(targetIds.error);
        const editable = Boolean(targetIds.editable);
        if (error) error.style.display = 'none';
        if (!body || !meta) return;
        const summary = data.summary || {};
        let localidades = Array.isArray(data.localidades) ? data.localidades : [];
        if (editable && compareGapOnly) {
            localidades = filterProgressTreeForGap(localidades);
        }
        const set = (key, value) => {
            const node = document.getElementById(targetIds[key]);
            if (node) node.textContent = value;
        };
        set('expected', formatNumber(summary.expectedVotes || 0));
        set('real', formatNumber(summary.realVotes || 0));
        set('missing', formatNumber(Math.max((summary.expectedVotes || 0) - (summary.realVotes || 0), 0)));
        set('localidadesCount', formatNumber(summary.localidades || localidades.length));
        set('puestosCount', formatNumber(summary.puestos || 0));
        set('mesasCount', formatNumber(summary.mesas || 0));
        meta.textContent = localidades.length
            ? (editable
                ? 'Abre una localidad, detecta la brecha y usa "Revisar mesa" para abrir OCR/E14. El guardado rápido queda disponible para ajustes puntuales.'
                : 'Abre una localidad para ver dónde faltan votos por puesto y por mesa.')
            : 'No hay información conciliable para los filtros actuales.';

        if (!localidades.length) {
            body.innerHTML = '<div class="tw-rounded-3xl tw-border tw-border-dashed tw-border-slate-300 tw-bg-slate-50 tw-p-8 tw-text-center tw-text-slate-500 tw-shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">No hay localidades disponibles para este informe.</div>';
            return;
        }

        body.innerHTML = localidades.map((localidad, locIndex) => `
            <article class="tw-rounded-3xl tw-border tw-border-slate-200 tw-bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] tw-shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                <button type="button" class="tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-4 tw-px-5 tw-py-5 tw-text-left hover:tw-bg-slate-50/60" data-tree-toggle="localidad" data-tree-target="${targetIds.prefix}-localidad-${locIndex}" style="border:none;background:none;">
                    <div>
                        <div class="tw-flex tw-items-center tw-gap-3">
                            <span class="tw-inline-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-2xl tw-bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] tw-text-white tw-shadow-lg tw-shadow-indigo-950/20"><i class="bi bi-building"></i></span>
                            <div>
                                <div class="tw-text-lg tw-font-semibold tw-text-slate-900">${escapeHtml(text(localidad.name, '-'))}</div>
                                <div class="tw-text-sm tw-text-slate-500">${formatNumber(localidad.expectedVotes || 0)} esperados · ${formatNumber(localidad.realVotes || 0)} reales</div>
                                <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mt-2">
                                    <span class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-slate-100 tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-600">
                                        <i class="bi bi-diagram-2 tw-text-indigo-500"></i>
                                        ${editable ? 'Ver puestos y abrir revisión de mesa' : 'Ver puestos'}
                                    </span>
                                    <span class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-white tw-border tw-border-slate-200 tw-px-3 tw-py-1 tw-text-[11px] tw-font-semibold tw-text-slate-600">${formatNumber((localidad.puestos || []).length)} puestos</span>
                                    <span class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-white tw-border tw-border-slate-200 tw-px-3 tw-py-1 tw-text-[11px] tw-font-semibold tw-text-slate-600">${formatNumber((localidad.puestos || []).reduce((sum, puesto) => sum + ((puesto.mesas || []).length), 0))} mesas</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tw-flex tw-items-center tw-gap-6">
                        <div class="tw-text-right"><div class="tw-text-xs tw-uppercase tw-tracking-[0.18em] tw-text-slate-500">Faltan</div><div class="tw-text-xl tw-font-bold ${getDifferenceTone((localidad.realVotes || 0) - (localidad.expectedVotes || 0))}">${formatNumber(Math.max((localidad.expectedVotes || 0) - (localidad.realVotes || 0), 0))}</div></div>
                        <i class="bi bi-chevron-down tw-text-slate-400 tw-transition-transform tw-duration-200"></i>
                    </div>
                </button>
                <div id="${targetIds.prefix}-localidad-${locIndex}" class="tw-hidden tw-border-t tw-border-slate-200 tw-bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] tw-p-4 tw-space-y-3">
                    ${(localidad.puestos || []).map((puesto, puestoIndex) => `
                        <div class="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                            <button type="button" class="tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-4 tw-px-4 tw-py-3.5 tw-text-left hover:tw-bg-slate-50/60" data-tree-toggle="puesto" data-tree-target="${targetIds.prefix}-puesto-${locIndex}-${puestoIndex}" style="border:none;background:none;">
                                <div>
                                    <div class="tw-font-semibold tw-text-slate-900">${escapeHtml(text(puesto.name, '-'))}</div>
                                    <div class="tw-text-xs tw-text-slate-500">${formatNumber(puesto.expectedVotes || 0)} esperados · ${formatNumber(puesto.realVotes || 0)} reales</div>
                                    <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mt-2">
                                        <span class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-medium tw-text-slate-600">
                                            <i class="bi bi-list-ul tw-text-slate-500"></i>
                                            ${editable ? 'Ver mesas y editar votos' : 'Ver mesas'}
                                        </span>
                                        <span class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-white tw-border tw-border-slate-200 tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold tw-text-slate-600">${formatNumber((puesto.mesas || []).length)} mesas</span>
                                    </div>
                                </div>
                                <div class="tw-flex tw-items-center tw-gap-4">
                                    <div class="tw-text-right"><div class="tw-text-xs tw-uppercase tw-text-slate-500">Dif.</div><div class="tw-font-bold ${getDifferenceTone(puesto.difference)}">${formatDifference(puesto.difference)}</div></div>
                                    <i class="bi bi-chevron-down tw-text-slate-400 tw-transition-transform tw-duration-200"></i>
                                </div>
                            </button>
                            <div id="${targetIds.prefix}-puesto-${locIndex}-${puestoIndex}" class="tw-hidden tw-border-t tw-border-slate-100 tw-bg-slate-50/80">
                                ${(puesto.mesas || []).map((mesa) => `
                                    <div class="tw-border-b tw-border-slate-100 tw-px-4 tw-py-4 hover:tw-bg-white/70">
                                        <div class="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                                            <div class="tw-flex tw-flex-col md:tw-flex-row md:tw-items-start md:tw-justify-between tw-gap-4">
                                                <div class="tw-space-y-2">
                                                    <div class="tw-flex tw-items-center tw-gap-3">
                                                        <span class="tw-inline-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-900 tw-text-white tw-shadow-sm"><i class="bi bi-grid-3x3-gap"></i></span>
                                                        <div>
                                                            <div class="tw-font-semibold tw-text-slate-900">Mesa ${escapeHtml(text(mesa.numero, '-'))}</div>
                                                            <div class="tw-text-sm tw-text-slate-500">${escapeHtml(text(puesto.name, '-'))}</div>
                                                        </div>
                                                    </div>
                                                    <div class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-slate-100 tw-border tw-border-slate-200 tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-600">${escapeHtml(getMesaState(mesa))}</div>
                                                </div>
                                                <div class="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-3 tw-w-full md:tw-max-w-xl">
                                                    <div class="tw-rounded-xl tw-bg-slate-50 tw-border tw-border-slate-200 tw-p-3">
                                                        <div class="tw-text-[11px] tw-uppercase tw-tracking-[0.16em] tw-text-slate-400">Esperados</div>
                                                        <div class="tw-mt-1 tw-font-semibold tw-text-slate-900">${formatNumber(mesa.expectedVotes || 0)}</div>
                                                    </div>
                                                    <div class="tw-rounded-xl tw-bg-slate-50 tw-border tw-border-slate-200 tw-p-3">
                                                        <div class="tw-text-[11px] tw-uppercase tw-tracking-[0.16em] tw-text-slate-400">Reales</div>
                                                        ${editable
                                                            ? `<div class="tw-mt-2"><input type="number" min="0" value="${escapeHtml(text(mesa.realVotes ?? '', ''))}" class="tw-w-full tw-rounded-xl tw-border tw-border-indigo-200 tw-bg-white tw-px-3 tw-py-2 tw-text-right tw-font-semibold tw-text-slate-900 tw-shadow-sm" data-compare-input="real-votes" data-localidad="${escapeHtml(text(localidad.name, ''))}" data-puesto="${escapeHtml(text(puesto.name, ''))}" data-mesa="${escapeHtml(text(mesa.numero, ''))}"></div>`
                                                            : `<div class="tw-mt-1 tw-font-semibold tw-text-slate-900">${formatNumber(mesa.realVotes || 0)}</div>`}
                                                    </div>
                                                    <div class="tw-rounded-xl tw-bg-slate-50 tw-border tw-border-slate-200 tw-p-3">
                                                        <div class="tw-text-[11px] tw-uppercase tw-tracking-[0.16em] tw-text-slate-400">Diferencia</div>
                                                        <div class="tw-mt-1 tw-font-semibold ${getDifferenceTone(mesa.difference)}">${formatDifference(mesa.difference)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="tw-mt-4 tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center sm:tw-justify-between tw-gap-3">
                                                <div class="tw-text-xs tw-text-slate-500">${mesa.hasE14 ? 'Conciliada con E14' : 'Todavía sin dato E14'}</div>
                                                ${editable
                                                    ? `<div class="tw-flex tw-flex-wrap tw-gap-2 sm:tw-justify-end">
                                                            <button type="button" class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-border-slate-300 tw-bg-white tw-text-slate-700 tw-px-3.5 tw-py-2 tw-text-xs tw-font-semibold tw-shadow-sm" data-action="open-compare-row" data-localidad="${escapeHtml(text(localidad.name, ''))}" data-puesto="${escapeHtml(text(puesto.name, ''))}" data-mesa="${escapeHtml(text(mesa.numero, ''))}" data-expected-votes="${escapeHtml(text(mesa.expectedVotes, '0'))}" data-real-votes="${escapeHtml(text(mesa.realVotes ?? '', ''))}" data-difference="${escapeHtml(text(mesa.difference, '0'))}" data-status="${escapeHtml(getMesaState(mesa))}">
                                                                <i class="bi bi-eye"></i> Revisar mesa
                                                            </button>
                                                            <button type="button" class="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-[linear-gradient(90deg,#0f172a_0%,#1d4ed8_100%)] tw-text-white tw-px-3.5 tw-py-2 tw-text-xs tw-font-semibold tw-shadow-md tw-shadow-indigo-950/20" data-action="save-compare-row" data-localidad="${escapeHtml(text(localidad.name, ''))}" data-puesto="${escapeHtml(text(puesto.name, ''))}" data-mesa="${escapeHtml(text(mesa.numero, ''))}"><i class="bi bi-check2-circle"></i> Guardar rápido</button>
                                                        </div>`
                                                    : ''}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </article>
        `).join('');
    }

    function renderProgressTree(data = {}) {
        progressTreeData = data;
        renderProgressTreeInto({
            prefix: 'rdvTree',
            body: 'rdvProgressTreeBody',
            meta: 'rdvProgressTreeMeta',
            error: 'rdvProgressTreeError',
            expected: 'rdvTreeExpectedVotes',
            real: 'rdvTreeRealVotes',
            missing: 'rdvTreeMissingVotes',
            localidadesCount: 'rdvTreeLocalidadesCount',
            puestosCount: 'rdvTreePuestosCount',
            mesasCount: 'rdvTreeMesasCount'
        }, data);
        renderProgressTreeInto({
            prefix: 'rdvCompare',
            body: 'rdvCompareTreeBody',
            meta: 'rdvCompareMeta',
            error: 'rdvCompareError',
            expected: 'rdvCompareExpectedVotes',
            real: 'rdvCompareRealVotes',
            missing: 'rdvCompareMissingVotes',
            localidadesCount: 'rdvCompareLocalidadesCount',
            puestosCount: 'rdvComparePuestosCount',
            mesasCount: 'rdvCompareMesasCount',
            editable: true
        }, data);
    }

    async function saveCompareTreeRow(button) {
        const localidad = button?.dataset?.localidad || '';
        const puesto = button?.dataset?.puesto || '';
        const mesa = parseIntSafe(button?.dataset?.mesa);
        const rowNode = button?.closest('.tw-grid');
        const input = rowNode?.querySelector('[data-compare-input="real-votes"]');
        const votosE14 = parseIntSafe(input?.value);
        if (!localidad || !puesto || mesa === null) {
            showBanner('warning', 'No se pudo identificar la mesa a actualizar.');
            return;
        }
        if (votosE14 === null || votosE14 < 0) {
            showBanner('warning', 'Ingresa un valor válido para los votos reales E14.');
            input?.focus();
            return;
        }
        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando';
        try {
            await DataService.saveE14ConfirmationByMesaManual({
                eventId: getCurrentEventId(),
                localidad,
                puesto,
                mesa,
                votosE14Candidate105: votosE14,
                notes: 'Actualización rápida desde Comparar votos'
            });
            showBanner('success', `Mesa ${mesa} actualizada correctamente.`);
            compareLoaded = false;
            await Promise.all([loadSummaryAndRows(), loadCompareView(true)]);
        } catch (error) {
            showBanner('error', error.message || 'No se pudo guardar la actualización de esta mesa.');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }

    function openCompareTreeDetail(button) {
        const localidad = button?.dataset?.localidad || '';
        const puesto = button?.dataset?.puesto || '';
        const mesa = parseIntSafe(button?.dataset?.mesa);
        if (!localidad || !puesto || mesa === null) {
            showBanner('warning', 'No se pudo abrir la revisión detallada de esta mesa.');
            return;
        }
        openDetail({
            localidad,
            puesto,
            mesa,
            repVotes: parseIntSafe(button?.dataset?.expectedVotes) || 0,
            e14Votes: parseIntSafe(button?.dataset?.realVotes),
            diferencia: parseIntSafe(button?.dataset?.difference),
            status: button?.dataset?.status || '',
            notes: '',
            sourceStatus: ''
        });
    }

    async function openProgressTreeModal() {
        if (progressTreeController) progressTreeController.abort();
        progressTreeController = new AbortController();
        setProgressTreeModalVisible(true);
        showCompareLoading(true);
        const error = document.getElementById('rdvProgressTreeError');
        const body = document.getElementById('rdvProgressTreeBody');
        if (error) {
            error.style.display = 'none';
            error.textContent = '';
        }
        if (body) body.innerHTML = '';
        try {
            const data = await DataService.getE14ConfirmationProgressTree({
                ...getCurrentScopeFilters(),
                queue: VIEW_CONFIG[activeView]?.queue || '',
                signal: progressTreeController.signal
            });
            if (progressTreeController.signal.aborted) return;
            renderProgressTree(data);
        } catch (errorObj) {
            if (isAbortError(errorObj)) return;
            if (error) {
                error.style.display = 'block';
                error.textContent = errorObj.message || 'No se pudo generar el informe hasta ahora.';
            }
            const panelError = document.getElementById('rdvCompareError');
            if (panelError) {
                panelError.style.display = 'block';
                panelError.textContent = errorObj.message || 'No se pudo generar la comparación de votos.';
            }
            if (body) body.innerHTML = '<div class="tw-rounded-2xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-p-6 tw-text-sm tw-text-rose-700">No se pudo generar el informe de conciliación. Intenta de nuevo.</div>';
        } finally {
            showCompareLoading(false);
            progressTreeController = null;
        }
    }

    async function loadCompareView(force = false) {
        if (compareLoaded && !force && progressTreeData) return;
        if (progressTreeController) progressTreeController.abort();
        progressTreeController = new AbortController();
        showCompareLoading(true);
        const panelError = document.getElementById('rdvCompareError');
        const panelBody = document.getElementById('rdvCompareTreeBody');
        if (panelError) {
            panelError.style.display = 'none';
            panelError.textContent = '';
        }
        if (panelBody) panelBody.innerHTML = '';
        try {
            const data = await DataService.getE14ConfirmationProgressTree({
                ...getCurrentScopeFilters(),
                queue: VIEW_CONFIG[activeView]?.queue || '',
                signal: progressTreeController.signal
            });
            if (progressTreeController.signal.aborted) return;
            compareLoaded = true;
            renderProgressTree(data);
        } catch (error) {
            if (isAbortError(error)) return;
            if (panelError) {
                panelError.style.display = 'block';
                panelError.textContent = error.message || 'No se pudo cargar la comparación de votos.';
            }
            if (panelBody) panelBody.innerHTML = '<div class="tw-rounded-2xl tw-border tw-border-rose-200 tw-bg-rose-50 tw-p-6 tw-text-sm tw-text-rose-700">No se pudo cargar la comparación directa de votos.</div>';
        } finally {
            showCompareLoading(false);
            progressTreeController = null;
        }
    }

    function closeProgressTreeModal() {
        if (progressTreeController) {
            progressTreeController.abort();
            progressTreeController = null;
        }
        setProgressTreeModalVisible(false);
    }
    async function loadSummaryAndRows() {
        if (officialController) officialController.abort();
        officialController = new AbortController();
        const signal = officialController.signal;
        showOfficialLoading(true);
        hideBanner();
        try {
            const [summary, rows] = await Promise.all([
                DataService.getE14ConfirmationSummary({ ...getCurrentScopeFilters(), signal }),
                DataService.getE14ConfirmationByMesa({ ...getOfficialFilters(), signal })
            ]);
            if (signal.aborted) return;
            updateSummaryCards(summary);
            updateFilterOptions(rows);
            renderOfficialRows(rows);
        } catch (error) {
            if (isAbortError(error)) return;
            showBanner('error', error.message || 'No se pudo cargar el comparativo E14.');
            const tbody = document.getElementById('rdvTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="tw-text-center tw-text-rose-600 tw-py-8">No se pudo cargar la conciliación. Intenta de nuevo.</td></tr>';
        } finally {
            showOfficialLoading(false);
            officialController = null;
        }
    }

    async function loadInvalidRows(force = false) {
        if (invalidLoaded && !force) return;
        if (invalidController) invalidController.abort();
        invalidController = new AbortController();
        const signal = invalidController.signal;
        showInvalidLoading(true);
        try {
            const data = await DataService.getE14InvalidRows({ ...getInvalidFilters(), signal });
            if (signal.aborted) return;
            invalidLoaded = true;
            renderInvalidRows(data);
        } catch (error) {
            if (isAbortError(error)) return;
            const tbody = document.getElementById('rdvInvalidTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="tw-text-center tw-text-rose-600 tw-py-6">No se pudieron cargar las inconsistencias.</td></tr>';
        } finally {
            showInvalidLoading(false);
            invalidController = null;
        }
    }

    async function loadImportHistory(force = false) {
        if (importsLoaded && !force) return;
        if (importsController) importsController.abort();
        importsController = new AbortController();
        const signal = importsController.signal;
        showImportHistoryLoading(true);
        try {
            const data = await DataService.getE14ImportHistory({ ...getImportHistoryFilters(), signal });
            if (signal.aborted) return;
            importsLoaded = true;
            renderImportHistory(data);
        } catch (error) {
            if (isAbortError(error)) return;
            const tbody = document.getElementById('rdvImportHistoryBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="tw-text-center tw-text-rose-600 tw-py-6">No se pudo cargar el historial.</td></tr>';
        } finally {
            showImportHistoryLoading(false);
            importsController = null;
        }
    }

    function setActiveView(view) {
        activeView = VIEW_CONFIG[view] ? view : 'summary';
        setSectionVisibility();
        if (activeView === 'invalid') loadInvalidRows();
        else if (activeView === 'compare') loadCompareView();
        else if (activeView === 'imports') loadImportHistory();
        else if (activeView === 'pending' || activeView === 'differences') {
            currentPage = 1;
            loadSummaryAndRows();
        }
    }

    function getHint(row) {
        const helper = window.BogotaZoneUtils?.buildE14NavigationHint;
        if (typeof helper === 'function') return helper(row || {});
        return { copyText: `${row?.localidad || ''} | ${row?.puesto || ''} | Mesa ${row?.mesa || ''}` };
    }

    function openDetail(row) {
        currentDetailRow = row;
        const hint = getHint(row);
        const e14Votes = row.e14Votes ?? row.votosE14Candidate105 ?? '';
        const diff = row.diferencia ?? ((e14Votes === null || e14Votes === undefined || e14Votes === '') ? null : Number(e14Votes) - Number(row.repVotes || 0));
        document.getElementById('rdvManualMesaKey').value = row.mesaKey || row.id || '';
        document.getElementById('rdvManualLocalidad').value = row.localidad || '';
        document.getElementById('rdvManualPuesto').value = row.puesto || '';
        document.getElementById('rdvManualMesa').value = row.mesa ?? '';
        document.getElementById('rdvManualReportedVotes').value = row.repVotes ?? 0;
        document.getElementById('rdvManualE14Votes').value = e14Votes ?? '';
        document.getElementById('rdvManualLocationSummary').textContent = `${text(row.localidad, '-')} · ${text(row.puesto, '-')} · Mesa ${text(row.mesa, '-')}`;
        document.getElementById('rdvManualLocalidadLabel').textContent = text(row.localidad, '-');
        document.getElementById('rdvManualPuestoLabel').textContent = text(row.puesto, '-');
        document.getElementById('rdvManualMesaLabel').textContent = text(row.mesa, '-');
        document.getElementById('rdvManualReportedVotesDisplay').textContent = formatNumber(row.repVotes ?? 0);
        const diffNode = document.getElementById('rdvManualDifferenceDisplay');
        diffNode.textContent = formatDifference(diff);
        diffNode.className = `tw-text-2xl tw-font-bold tw-mt-2 ${differenceClass(diff)}`;
        const diffCard = document.getElementById('rdvManualDifferenceCard');
        if (diffCard) {
            diffCard.className = `tw-rounded-3xl tw-border tw-p-4 tw-shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
                diff === 0
                    ? 'tw-border-emerald-200 tw-bg-emerald-50'
                    : Number(diff || 0) > 0
                        ? 'tw-border-emerald-200 tw-bg-emerald-50'
                        : 'tw-border-rose-200 tw-bg-rose-50'
            }`;
        }
        const statusBadge = document.getElementById('rdvManualStatusBadge');
        if (statusBadge) {
            const state = text(row.status || getMesaState(row), 'Sin estado');
            statusBadge.textContent = state;
            statusBadge.className = `tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold ${
                state === 'Confirmada'
                    ? 'tw-bg-emerald-50 tw-border-emerald-200 tw-text-emerald-700'
                    : state === 'Sin E14'
                        ? 'tw-bg-amber-50 tw-border-amber-200 tw-text-amber-700'
                        : 'tw-bg-rose-50 tw-border-rose-200 tw-text-rose-700'
            }`;
        }
        const evidenceBadge = document.getElementById('rdvManualEvidenceBadge');
        if (evidenceBadge) {
            const hasEvidence = Boolean(row.sourceArchivo || row.sourceDocumento || row.sourceFile || row.ocrEvidence || row.sourceStatus);
            evidenceBadge.textContent = hasEvidence ? 'OCR / evidencia disponible' : 'Sin evidencia OCR';
            evidenceBadge.className = `tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold ${
                hasEvidence
                    ? 'tw-bg-indigo-50 tw-border-indigo-200 tw-text-indigo-700'
                    : 'tw-bg-slate-100 tw-border-slate-200 tw-text-slate-700'
            }`;
        }
        document.getElementById('rdvManualHint').value = text(hint.copyText, '-');
        document.getElementById('rdvManualSourceNotes').value = text(row.notes || row.reviewReason || row.sourceStatus, '');
        document.getElementById('rdvManualNotes').value = row.notes || '';
        setManualModalVisible(true);
    }

    function closeDetail() {
        currentDetailRow = null;
        setManualModalVisible(false);
    }

    async function saveManualValidation() {
        if (!currentDetailRow) return;
        const votosE14 = parseIntSafe(document.getElementById('rdvManualE14Votes')?.value);
        if (votosE14 === null || votosE14 < 0) {
            showBanner('warning', 'Ingresa un número válido de votos E14.');
            return;
        }
        const payload = {
            eventId: getCurrentEventId(),
            localidad: document.getElementById('rdvManualLocalidad')?.value || '',
            puesto: document.getElementById('rdvManualPuesto')?.value || '',
            mesa: parseIntSafe(document.getElementById('rdvManualMesa')?.value),
            votosE14Candidate105: votosE14,
            notes: document.getElementById('rdvManualNotes')?.value || '',
            zoneCode: currentDetailRow.zoneCode || null
        };
        const button = document.getElementById('rdvManualSaveBtn');
        const original = button?.textContent || 'Guardar validación';
        if (button) {
            button.disabled = true;
            button.textContent = 'Guardando...';
        }
        try {
            await DataService.saveE14ConfirmationByMesaManual(payload);
            closeDetail();
            showBanner('success', 'Validación guardada correctamente.');
            invalidLoaded = false;
            importsLoaded = false;
            compareLoaded = false;
            await loadSummaryAndRows();
            if (activeView === 'compare') {
                await loadCompareView(true);
            }
        } catch (error) {
            showBanner('error', error.message || 'No se pudo guardar la validación.');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = original;
            }
        }
    }

    async function recalc() {
        const button = document.getElementById('rdvRunValidationBtn');
        const original = button?.textContent || 'Recalcular';
        if (button) {
            button.disabled = true;
            button.textContent = 'Recalculando...';
        }
        try {
            await loadSummaryAndRows();
            showBanner('success', 'Comparativo recalculado.');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = original;
            }
        }
    }

    async function syncReference() {
        const progress = document.getElementById('rdvSyncProgress');
        const button = document.getElementById('rdvSyncBtn');
        const original = button?.textContent || 'Integrar E14';
        if (progress) progress.style.display = 'flex';
        if (button) {
            button.disabled = true;
            button.textContent = 'Integrando...';
        }
        try {
            await DataService.syncMesasBogota();
            await loadSummaryAndRows();
            showBanner('success', 'Referencia E14 actualizada correctamente.');
        } catch (error) {
            showBanner('error', error.message || 'No se pudo integrar el E14.');
        } finally {
            if (progress) progress.style.display = 'none';
            if (button) {
                button.disabled = false;
                button.textContent = original;
            }
        }
    }
    function autoMapColumns(headers) {
        const normalized = headers.map((header) => ({ raw: header, normalized: String(header || '').trim().toLowerCase() }));
        const pick = (...terms) => normalized.find((entry) => terms.some((term) => entry.normalized.includes(term)))?.raw || '';
        return {
            localidad: pick('localidad', 'municipio', 'zona', 'territorio'),
            puesto: pick('puesto', 'puesto de votacion', 'puesto votacion', 'sitio', 'lugar'),
            mesa: pick('mesa'),
            votosE14: pick('votos e14', 'votos e-14', 'voto e14', 'voto e-14', 'votos', 'e14'),
            observacion: pick('observacion', 'observación', 'comentario', 'nota', 'observ')
        };
    }

    function populateImportMapSelects(headers) {
        importHeaders = headers;
        const options = headers.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join('');
        ['rdvImportMapLocalidad', 'rdvImportMapPuesto', 'rdvImportMapMesa', 'rdvImportMapVotes', 'rdvImportMapObservation'].forEach((id) => {
            const select = document.getElementById(id);
            if (!select) return;
            const label = select.options[0]?.textContent || '';
            select.innerHTML = `<option value="">${escapeHtml(label)}</option>${options}`;
        });
        const suggestion = autoMapColumns(headers);
        document.getElementById('rdvImportMapLocalidad').value = suggestion.localidad || '';
        document.getElementById('rdvImportMapPuesto').value = suggestion.puesto || '';
        document.getElementById('rdvImportMapMesa').value = suggestion.mesa || '';
        document.getElementById('rdvImportMapVotes').value = suggestion.votosE14 || '';
        document.getElementById('rdvImportMapObservation').value = suggestion.observacion || '';
    }

    function resetImportState() {
        importRows = [];
        importHeaders = [];
        importPreview = null;
        stopImportProgress();
        setImportStage('archivo');
        renderImportSummary(null);
        const status = document.getElementById('rdvImportStatus');
        const meta = document.getElementById('rdvImportPreviewMeta');
        const tbody = document.getElementById('rdvImportPreviewBody');
        const fileMeta = document.getElementById('rdvImportFileMeta');
        if (status) status.textContent = 'Sin archivo cargado';
        if (meta) meta.textContent = 'Carga un archivo y genera la vista previa para ver el impacto en la conciliación.';
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="tw-text-center tw-text-slate-500 tw-py-8">Todavía no hay vista previa para este archivo.</td></tr>';
        if (fileMeta) fileMeta.textContent = 'Selecciona un archivo con columnas de Localidad, Puesto, Mesa y Votos E14.';
        const applyBtn = document.getElementById('rdvImportApplyBtn');
        if (applyBtn) applyBtn.disabled = true;
        const loading = document.getElementById('rdvImportPreviewLoading');
        if (loading) loading.style.display = 'none';
    }

    function openImportModal() {
        resetImportState();
        setImportModalVisible(true);
    }

    function closeImportModal() {
        if (importPreviewController) importPreviewController.abort();
        if (importApplyController) importApplyController.abort();
        importPreviewController = null;
        importApplyController = null;
        stopImportProgress();
        setImportModalVisible(false);
    }

    function readImportFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const workbook = XLSX.read(event.target.result, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                    const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })[0] || [];
                    resolve({ rows, headers });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async function handleImportFileSelected(event) {
        const file = event.target.files?.[0];
        resetImportState();
        if (!file) return;
        try {
            const { rows, headers } = await readImportFile(file);
            importRows = rows;
            populateImportMapSelects(headers);
            setImportStage(rows.length ? 'mapeo' : 'archivo');
            const meta = document.getElementById('rdvImportFileMeta');
            if (meta) meta.textContent = `${file.name} · ${formatNumber(rows.length)} filas detectadas`;
            const status = document.getElementById('rdvImportStatus');
            if (status) status.textContent = rows.length
                ? `Archivo leído correctamente: ${file.name}`
                : `El archivo ${file.name} no contiene filas utilizables`;
        } catch (error) {
            showBanner('error', 'No se pudo leer el archivo Excel.');
            const status = document.getElementById('rdvImportStatus');
            if (status) status.textContent = 'No se pudo analizar el archivo seleccionado';
        }
    }

    function getMissingImportMappings(payload) {
        const labels = {
            localidad: 'Localidad',
            puesto: 'Puesto',
            mesa: 'Mesa',
            votosE14: 'Votos E14'
        };
        return ['localidad', 'puesto', 'mesa', 'votosE14']
            .filter((key) => !payload.columnMap?.[key])
            .map((key) => labels[key]);
    }

    function getImportPayload() {
        return {
            fileName: document.getElementById('rdvImportFileInput')?.files?.[0]?.name || 'verificacion.xlsx',
            eventId: getCurrentEventId(),
            notes: document.getElementById('rdvImportNotes')?.value || '',
            rows: importRows,
            columnMap: {
                localidad: document.getElementById('rdvImportMapLocalidad')?.value || '',
                puesto: document.getElementById('rdvImportMapPuesto')?.value || '',
                mesa: document.getElementById('rdvImportMapMesa')?.value || '',
                votosE14: document.getElementById('rdvImportMapVotes')?.value || '',
                observacion: document.getElementById('rdvImportMapObservation')?.value || ''
            }
        };
    }

    function renderImportPreview(preview) {
        importPreview = preview;
        renderImportSummary(preview);
        const tbody = document.getElementById('rdvImportPreviewBody');
        const meta = document.getElementById('rdvImportPreviewMeta');
        const status = document.getElementById('rdvImportStatus');
        const applyBtn = document.getElementById('rdvImportApplyBtn');
        if (meta) meta.textContent = `${formatNumber(preview.totalRows || 0)} filas analizadas. Coincidencias seguras: ${formatNumber(preview.counts?.matched || 0)}.`;
        if (status) status.textContent = `Vista previa lista · ${formatNumber(preview.totalRows || 0)} filas`;
        if (applyBtn) applyBtn.disabled = !(preview.rows || []).some((row) => ['confirmada', 'diferencia'].includes(row.status));
        if (!tbody) return;
        if (!preview.rows?.length) {
            if (status) status.textContent = 'No se encontraron filas válidas';
            tbody.innerHTML = '<tr><td colspan="8" class="tw-text-center tw-text-slate-500 tw-py-8">El archivo no contiene filas utilizables.</td></tr>';
            return;
        }
        tbody.innerHTML = preview.rows.map((row) => `
            <tr class="tw-border-b tw-border-slate-100">
                <td class="tw-px-4 tw-py-3 tw-font-medium">${formatNumber(row.rowNumber || 0)}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml([row.rawLocalidad, row.rawPuesto, row.rawMesa].filter(Boolean).join(' · ') || '-')}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml([row.matchedLocalidad, row.matchedPuesto, row.matchedMesa ? `Mesa ${row.matchedMesa}` : ''].filter(Boolean).join(' · ') || '-')}</td>
                <td class="tw-px-4 tw-py-3 tw-text-right">${formatNumber(row.internalVotes || 0)}</td>
                <td class="tw-px-4 tw-py-3 tw-text-right">${row.e14Votes === null || row.e14Votes === undefined ? '-' : formatNumber(row.e14Votes)}</td>
                <td class="tw-px-4 tw-py-3 tw-text-right ${differenceClass(row.difference)}">${formatDifference(row.difference)}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml(humanImportStatus(row.status))}</td>
                <td class="tw-px-4 tw-py-3">${escapeHtml((row.messages || []).join(' · ') || '-')}</td>
            </tr>
        `).join('');
    }

    async function previewImport() {
        if (!importRows.length) {
            showBanner('warning', 'Selecciona un archivo antes de generar la vista previa.');
            const status = document.getElementById('rdvImportStatus');
            if (status) status.textContent = 'Primero selecciona un archivo válido';
            return;
        }
        const payload = getImportPayload();
        const missingMappings = getMissingImportMappings(payload);
        if (missingMappings.length) {
            showBanner('warning', `Faltan columnas necesarias: ${missingMappings.join(', ')}.`);
            const status = document.getElementById('rdvImportStatus');
            const meta = document.getElementById('rdvImportPreviewMeta');
            if (status) status.textContent = 'Faltan columnas necesarias para la vista previa';
            if (meta) meta.textContent = `Completa el mapeo de: ${missingMappings.join(', ')}.`;
            return;
        }
        if (importPreviewController) importPreviewController.abort();
        importPreviewController = new AbortController();
        const loading = document.getElementById('rdvImportPreviewLoading');
        const previewBtn = document.getElementById('rdvImportPreviewBtn');
        const status = document.getElementById('rdvImportStatus');
        const meta = document.getElementById('rdvImportPreviewMeta');
        if (loading) loading.style.display = 'flex';
        if (previewBtn) previewBtn.disabled = true;
        setImportStage('preview');
        if (status) status.textContent = 'Analizando archivo...';
        if (meta) meta.textContent = `Estamos conciliando ${formatNumber(importRows.length)} filas contra la referencia oficial.`;
        startImportProgress(importRows.length);
        try {
            const preview = await DataService.previewE14ExcelImport({
                ...payload,
                signal: importPreviewController.signal
            });
            setImportProgress('Vista previa generada', 100, importRows.length, importRows.length);
            renderImportPreview(preview);
            setImportStage('preview');
            if (status) status.textContent = 'Vista previa generada';
        } catch (error) {
            if (isAbortError(error)) return;
            showBanner('error', error.message || 'No se pudo generar la vista previa.');
            if (status) status.textContent = 'No se pudo generar la vista previa';
            if (meta) meta.textContent = error.message || 'Corrige el archivo o el mapeo y vuelve a intentar.';
        } finally {
            if (loading) loading.style.display = 'none';
            if (previewBtn) previewBtn.disabled = false;
            stopImportProgress();
            importPreviewController = null;
        }
    }

    async function applyImport() {
        if (!importPreview) {
            showBanner('warning', 'Primero genera la vista previa del archivo.');
            return;
        }
        if (importApplyController) importApplyController.abort();
        importApplyController = new AbortController();
        const applyBtn = document.getElementById('rdvImportApplyBtn');
        const original = applyBtn?.textContent || 'Aplicar importación';
        const status = document.getElementById('rdvImportStatus');
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.textContent = 'Aplicando...';
        }
        setImportStage('apply');
        if (status) status.textContent = 'Aplicando conciliación del archivo...';
        try {
            const result = await DataService.applyE14ExcelImport({
                ...getImportPayload(),
                signal: importApplyController.signal
            });
            showBanner('success', `Importación aplicada. Filas actualizadas: ${formatNumber(result.updatedRows || 0)}.`);
            if (status) status.textContent = 'Importación aplicada correctamente';
            closeImportModal();
            invalidLoaded = false;
            importsLoaded = false;
            await loadSummaryAndRows();
            if (activeView === 'imports') loadImportHistory(true);
        } catch (error) {
            if (!isAbortError(error)) {
                showBanner('error', error.message || 'No se pudo aplicar la importación.');
                if (status) status.textContent = 'No se pudo aplicar la importación';
            }
        } finally {
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.textContent = original;
            }
            importApplyController = null;
        }
    }

    function openSourceEvidence() {
        if (!currentDetailRow) return;
        const path = currentDetailRow.sourceArchivo || currentDetailRow.sourceDocumento || currentDetailRow.sourceFile || '';
        if (path) {
            window.open(path, '_blank', 'noopener');
            return;
        }
        showBanner('warning', 'Esta mesa no tiene una fuente OCR asociada.');
    }

    function openOfficialE14() {
        if (!currentDetailRow) return;
        const zoneCode = currentDetailRow.zoneCode || getBogotaZoneCode(currentDetailRow.localidad);
        const query = zoneCode ? `#zona-${encodeURIComponent(zoneCode)}` : '';
        window.open(`${E14_BASE_URL}${query}`, '_blank', 'noopener');
    }

    async function copyReference() {
        const value = document.getElementById('rdvManualHint')?.value || '';
        if (!value) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                const input = document.getElementById('rdvManualHint');
                input?.focus();
                input?.select();
                document.execCommand('copy');
            }
            showBanner('success', 'Referencia copiada al portapapeles.');
        } catch (_error) {
            showBanner('warning', 'No se pudo copiar la referencia automáticamente.');
        }
    }

    function bindUiAction(id, handler, eventName = 'click') {
        const node = document.getElementById(id);
        if (!node || node.dataset.boundRdv === '1') return;
        node.addEventListener(eventName, handler);
        node.dataset.boundRdv = '1';
    }

    function resetFilters() {
        ['rdvFilterSearch', 'rdvFilterLocalidad', 'rdvFilterEstado', 'rdvFilterSourceStatus', 'rdvFilterRegionScope'].forEach((id) => {
            const node = document.getElementById(id);
            if (node) node.value = '';
        });
        currentPage = 1;
        invalidPage = 1;
        importsPage = 1;
        invalidLoaded = false;
        importsLoaded = false;
        compareLoaded = false;
        loadSummaryAndRows();
        if (activeView === 'invalid') loadInvalidRows(true);
        if (activeView === 'imports') loadImportHistory(true);
        if (activeView === 'compare') loadCompareView(true);
    }

    function bindEvents() {
        bindUiAction('rdvOpenE14BaseBtn', () => window.open(E14_BASE_URL, '_blank', 'noopener'));
        bindUiAction('rdvRunValidationBtn', recalc);
        bindUiAction('rdvSyncBtn', syncReference);
        bindUiAction('rdvOpenImportBtn', openImportModal);
        bindUiAction('rdvCompareGapOnlyToggle', () => {
            compareGapOnly = !compareGapOnly;
            const node = document.getElementById('rdvCompareGapOnlyToggle');
            if (node) {
                node.classList.toggle('tw-bg-slate-900', compareGapOnly);
                node.classList.toggle('tw-text-white', compareGapOnly);
                node.classList.toggle('tw-border-slate-900', compareGapOnly);
                node.classList.toggle('tw-bg-white', !compareGapOnly);
                node.classList.toggle('tw-text-slate-600', !compareGapOnly);
                node.classList.toggle('tw-border-slate-300', !compareGapOnly);
            }
            if (activeView === 'compare') {
                renderProgressTree(progressTreeData || {});
            }
        });
        bindUiAction('rdvToggleAdvancedFiltersBtn', () => {
            const panel = document.getElementById('rdvAdvancedFiltersPanel');
            if (!panel) return;
            const isVisible = panel.style.display !== 'none' && !panel.classList.contains('tw-hidden') && !panel.classList.contains('hidden');
            panel.style.display = isVisible ? 'none' : '';
            panel.classList.toggle('tw-hidden', isVisible);
            panel.classList.toggle('hidden', isVisible);
        });
        bindUiAction('rdvOpenProgressTreeBtn', openProgressTreeModal);
        bindUiAction('rdvWorkflowPendingBtn', () => setActiveView('pending'));
        bindUiAction('rdvWorkflowCompareBtn', () => setActiveView('compare'));
        bindUiAction('rdvWorkflowImportBtn', openImportModal);
        bindUiAction('rdvOpenImportFromPanelBtn', openImportModal);
        bindUiAction('rdvApplyFiltersBtn', () => {
            currentPage = 1;
            invalidPage = 1;
            compareLoaded = false;
            loadSummaryAndRows();
            if (activeView === 'invalid') loadInvalidRows(true);
            if (activeView === 'compare') loadCompareView(true);
        });
        bindUiAction('rdvResetFiltersBtn', resetFilters);
        bindUiAction('rdvViewResumenBtn', () => setActiveView('summary'));
        bindUiAction('rdvViewPendingBtn', () => setActiveView('pending'));
        bindUiAction('rdvViewCompareBtn', () => {
            compareLoaded = false;
            setActiveView('compare');
        });
        bindUiAction('rdvViewDifferencesBtn', () => setActiveView('differences'));
        bindUiAction('rdvViewInvalidBtn', () => {
            invalidPage = 1;
            invalidLoaded = false;
            setActiveView('invalid');
        });
        bindUiAction('rdvViewImportsBtn', () => {
            importsPage = 1;
            importsLoaded = false;
            setActiveView('imports');
        });
        bindUiAction('rdvPrevPageBtn', () => {
            if (currentPage <= 1) return;
            currentPage -= 1;
            loadSummaryAndRows();
        });
        bindUiAction('rdvNextPageBtn', () => {
            currentPage += 1;
            loadSummaryAndRows();
        });
        bindUiAction('rdvManualCloseBtn', closeDetail);
        bindUiAction('rdvManualCloseBackdropBtn', closeDetail);
        bindUiAction('rdvManualSaveBtn', saveManualValidation);
        bindUiAction('rdvManualOpenSourceBtn', openSourceEvidence);
        bindUiAction('rdvManualOpenE14Btn', openOfficialE14);
        bindUiAction('rdvManualCopyRefBtn', copyReference);
        bindUiAction('rdvImportCloseBtn', closeImportModal);
        bindUiAction('rdvImportCloseBackdropBtn', closeImportModal);
        bindUiAction('rdvProgressTreeCloseBtn', closeProgressTreeModal);
        bindUiAction('rdvProgressTreeCloseBackdropBtn', closeProgressTreeModal);
        bindUiAction('rdvImportPreviewBtn', previewImport);
        bindUiAction('rdvImportApplyBtn', applyImport);
        bindUiAction('rdvImportFileInput', handleImportFileSelected, 'change');

        const search = document.getElementById('rdvFilterSearch');
        if (search && search.dataset.boundRdv !== '1') {
            search.addEventListener('input', () => debounce(() => {
                currentPage = 1;
                invalidPage = 1;
                compareLoaded = false;
                loadSummaryAndRows();
                if (activeView === 'invalid') loadInvalidRows(true);
                if (activeView === 'compare') loadCompareView(true);
            }, 350));
            search.dataset.boundRdv = '1';
        }

        const tableBody = document.getElementById('rdvTableBody');
        if (tableBody && tableBody.dataset.boundRdv !== '1') {
            tableBody.addEventListener('click', (event) => {
                const trigger = event.target.closest('[data-action="open-row"]');
                if (!trigger) return;
                const row = currentRowMap.get(String(trigger.dataset.index || ''));
                if (row) openDetail(row);
            });
            tableBody.dataset.boundRdv = '1';
        }

        const progressTreeBody = document.getElementById('rdvProgressTreeBody');
        if (progressTreeBody && progressTreeBody.dataset.boundRdv !== '1') {
            progressTreeBody.addEventListener('click', (event) => {
                const trigger = event.target.closest('[data-tree-toggle]');
                if (!trigger) return;
                const targetId = trigger.dataset.treeTarget;
                const target = targetId ? document.getElementById(targetId) : null;
                if (!target) return;
                target.classList.toggle('tw-hidden');
                const icon = trigger.querySelector('.bi-chevron-down');
                if (icon) {
                    icon.classList.toggle('tw-rotate-180', !target.classList.contains('tw-hidden'));
                }
            });
            progressTreeBody.dataset.boundRdv = '1';
        }

        const compareTreeBody = document.getElementById('rdvCompareTreeBody');
        if (compareTreeBody && compareTreeBody.dataset.boundRdv !== '1') {
            compareTreeBody.addEventListener('click', (event) => {
                const openTrigger = event.target.closest('[data-action="open-compare-row"]');
                if (openTrigger) {
                    event.preventDefault();
                    openCompareTreeDetail(openTrigger);
                    return;
                }
                const saveTrigger = event.target.closest('[data-action="save-compare-row"]');
                if (saveTrigger) {
                    event.preventDefault();
                    saveCompareTreeRow(saveTrigger);
                    return;
                }
                const trigger = event.target.closest('[data-tree-toggle]');
                if (!trigger) return;
                const targetId = trigger.dataset.treeTarget;
                const target = targetId ? document.getElementById(targetId) : null;
                if (!target) return;
                target.classList.toggle('tw-hidden');
                const icon = trigger.querySelector('.bi-chevron-down');
                if (icon) {
                    icon.classList.toggle('tw-rotate-180', !target.classList.contains('tw-hidden'));
                }
            });
            compareTreeBody.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                const input = event.target.closest('[data-compare-input="real-votes"]');
                if (!input) return;
                const saveTrigger = input.closest('.tw-grid')?.querySelector('[data-action="save-compare-row"]');
                if (!saveTrigger) return;
                event.preventDefault();
                saveCompareTreeRow(saveTrigger);
            });
            compareTreeBody.dataset.boundRdv = '1';
        }
    }

    async function mount() {
        if (!mounted) {
            bindEvents();
            mounted = true;
        }
        setSectionVisibility();
        await loadSummaryAndRows();
        if (activeView === 'invalid') await loadInvalidRows(true);
        if (activeView === 'imports') await loadImportHistory(true);
    }

    return {
        mount,
        load: loadSummaryAndRows,
        openImportModal,
        openDetail
    };
})();

window.RealDataValidationModule = RealDataValidationModule;
