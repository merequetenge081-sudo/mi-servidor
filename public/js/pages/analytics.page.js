import { createHierarchyState } from '../modules/analytics-state.module.js';
import { renderLazyHierarchyTable, bindHierarchyTableEvents } from '../modules/analytics-hierarchy.module.js';
import { initializeHierarchySortControls, readAnalyticsFilters, getHierarchySortParamsForLevel } from '../modules/analytics-filters.module.js';
import { createAbortableRequestManager, fetchJson, isAbortError } from '../modules/analytics-fetch.module.js';
import { buildAnalyticsDatasetSignature, buildHierarchyCacheKey, shouldInvalidateForFilterChange, clearAffectedCacheScopes } from '../modules/analytics-cache.module.js';
import { shouldPrefetchFirstBranch, markBranchPrefetched } from '../modules/analytics-prefetch.module.js';
import { debounce, escapeHtml, showPageLoading, showPageReady, showPageError, showToast } from '../modules/analytics-ui.module.js';
import { createAnalyticsChartsManager } from '../modules/analytics-charts.module.js';
import { createCampaignSimulationWorkspace } from '../modules/analytics-simulation.module.js';

let analyticsData = null;
let dashboardMetrics = null;
let analyticsChartsData = {
    all: { topPuestos: [], topLocalidades: [] },
    bogota: { topPuestos: [], topLocalidades: [] },
    nacional: { topPuestos: [], topLocalidades: [] }
};
let chartsLoaded = false;
let lastRenderedChartsSignature = '';
let analyticsSummary = {
    officialValid: 0,
    erroneousOrIncomplete: 0,
    totalRaw: 0,
    hiddenByCleanFilter: 0,
    officialCatalogVersion: '-'
};
let currentRegion = 'all';
const hierarchyState = createHierarchyState();
const requestManager = createAbortableRequestManager();
const debouncedDatasetRefresh = debounce(() => fetchAnalyticsData(), 180);
const chartsManager = createAnalyticsChartsManager();
const simulationWorkspace = createCampaignSimulationWorkspace({
    fetchJson,
    getToken,
    getSelectedEventId,
    getCurrentFilters
});

const shouldDebugTraces = () => {
    try {
        return window.APP_DEBUG_TRACES === true || localStorage.getItem('debugTraces') === '1';
    } catch (_) {
        return window.APP_DEBUG_TRACES === true;
    }
};

const trace = (...args) => {
    if (shouldDebugTraces()) console.debug(...args);
};

const toggleCheckbox = document.getElementById('region-toggle');
const labelNacional = document.getElementById('label-nacional');
const labelBogota = document.getElementById('label-bogota');
const loadingIndicator = document.getElementById('loading-indicator');
const dashboardContent = document.getElementById('dashboard-content');
const leaderFilter = document.getElementById('leader-filter');
const dataStatusFilter = document.getElementById('data-status-filter');
const invalidDataPageButton = document.getElementById('btn-invalid-data-page');
const reviewMissingPollingBtn = document.getElementById('btn-review-missing-polling');
const globalLeaderFilter = document.getElementById('global-leader-filter');
const hierarchyTableBody = document.getElementById('hierarchical-table-body');
const hierarchySortControls = {
    localidades: document.getElementById('hierarchy-sort-localidades'),
    puestos: document.getElementById('hierarchy-sort-puestos'),
    mesas: document.getElementById('hierarchy-sort-mesas')
};

function bindUiAction(label, binder) {
    try {
        binder();
    } catch (error) {
        console.error(`[analytics] No se pudo inicializar ${label}:`, error);
        trace(`[analytics] init failed for ${label}`, error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeHierarchySortControls(hierarchySortControls, hierarchyState.sortPresets);
    bindHierarchyTableEvents(hierarchyTableBody, {
        onToggleLocalidad: toggleHierarchyLocalidad,
        onTogglePuesto: toggleHierarchyPuesto,
        onRetryLocalidades: () => loadLocalidadesSummary(getCurrentFilters(), getToken(), { force: true }),
        onRetryLocalidad: (localidadId) => loadPuestosForLocalidad(localidadId, { force: true }),
        onRetryPuesto: (localidadId, puestoId, puestoCodigo) => loadMesasForPuesto(localidadId, puestoId, puestoCodigo, { force: true })
    });

    bindUiAction('simulación de campaña', () => simulationWorkspace.bindEvents());

    fetchAnalyticsData();
    loadGlobalLeaders();

    globalLeaderFilter?.addEventListener('change', handleDatasetFiltersChanged);
    toggleCheckbox?.addEventListener('change', (event) => {
        currentRegion = event.target.checked ? 'bogota' : 'all';
        updateToggleLabels();
        handleDatasetFiltersChanged();
    });
    dataStatusFilter?.addEventListener('change', handleDatasetFiltersChanged);
    hierarchySortControls.localidades?.addEventListener('change', () => handleSortChange('localidades'));
    hierarchySortControls.puestos?.addEventListener('change', () => handleSortChange('puestos'));
    hierarchySortControls.mesas?.addEventListener('change', () => handleSortChange('mesas'));
    leaderFilter?.addEventListener('input', (event) => renderLeadersTable(event.target.value));

    bindUiAction('verificación global', () => {
        document.getElementById('btn-verify-global')?.addEventListener('click', runGlobalVerification);
    });
    bindUiAction('exportación PDF', () => {
        document.getElementById('btn-export-pdf')?.addEventListener('click', exportToPDF);
    });
    bindUiAction('exportación de jerarquía', () => {
        document.getElementById('btn-export-jerarquia')?.addEventListener('click', exportHierarchicalVotingStructure);
    });
    bindUiAction('revisión de sin puesto', () => {
        reviewMissingPollingBtn?.addEventListener('click', runMissingPollingReview);
    });
});

function updateToggleLabels() {
    if (currentRegion === 'bogota') {
        labelBogota?.classList.remove('text-gray-400');
        labelBogota?.classList.add('text-indigo-600');
        labelNacional?.classList.remove('text-indigo-600');
        labelNacional?.classList.add('text-gray-400');
    } else {
        labelNacional?.classList.remove('text-gray-400');
        labelNacional?.classList.add('text-indigo-600');
        labelBogota?.classList.remove('text-indigo-600');
        labelBogota?.classList.add('text-gray-400');
    }
}

function getSelectedEventId() {
    return localStorage.getItem('eventId') || sessionStorage.getItem('eventId') || '';
}

function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function getCurrentFilters() {
    return readAnalyticsFilters({
        currentRegion,
        dataStatusFilter,
        globalLeaderFilter,
        eventId: getSelectedEventId()
    });
}

function buildApiParams(filters = {}, extra = {}) {
    const params = new URLSearchParams();
    Object.entries({ ...filters, ...extra }).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, value);
    });
    return params;
}

function buildHierarchyParams(level, extra = {}) {
    const filters = getCurrentFilters();
    const params = buildApiParams(filters, extra);
    const { sortBy, sortDir } = getHierarchySortParamsForLevel(level, hierarchyState.sortPresets);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    return params;
}

function resetHierarchyState(options = {}) {
    clearAffectedCacheScopes(hierarchyState, ['localidades', 'puestos', 'mesas', 'prefetch']);
    if (options.clearExpansion !== false) {
        hierarchyState.expandedLocalidades = new Set();
        hierarchyState.expandedPuestos = new Set();
    }
}

function handleDatasetFiltersChanged() {
    debouncedDatasetRefresh();
}

async function loadGlobalLeaders() {
    if (!globalLeaderFilter) return;
    try {
        const token = getToken();
        const eventId = getSelectedEventId();
        const params = new URLSearchParams({ limit: '1000' });
        if (eventId) params.set('eventId', eventId);
        const result = await fetchJson('/api/v2/leaders?' + params.toString(), { token });
        const leaders = (result && result.success && result.data) ? result.data : (Array.isArray(result) ? result : []);
        leaders.forEach((leader) => {
            const option = document.createElement('option');
            option.value = leader.leaderId || leader._id || leader.id || '';
            option.textContent = leader.name || leader.leaderName || 'Lider';
            globalLeaderFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching leaders', error);
    }
}

async function fetchAnalyticsData() {
    const filters = getCurrentFilters();
    const datasetSignature = buildAnalyticsDatasetSignature(filters);
    const datasetChanged = shouldInvalidateForFilterChange(hierarchyState.lastDatasetSignature, datasetSignature);

    requestManager.abortAllPageRequests();
    requestManager.abortAllHierarchyRequests();

    if (datasetChanged) {
        resetHierarchyState({ clearExpansion: true });
        hierarchyState.lastDatasetSignature = datasetSignature;
    }

    showPageLoading(loadingIndicator, dashboardContent);
    updateToggleLabels();

    analyticsData = {
        summary: {
            officialValid: analyticsSummary.officialValid || 0,
            erroneousOrIncomplete: analyticsSummary.erroneousOrIncomplete || 0,
            totalRaw: analyticsSummary.totalRaw || 0,
            hiddenByCleanFilter: analyticsSummary.hiddenByCleanFilter || 0
        },
        catalogs: {
            officialCatalogVersion: analyticsSummary.officialCatalogVersion || '-'
        },
        all: { topPuestos: [], topLocalidades: [], topLideres: [], jerarquia: [], totalVotos: 0, localityBreakdownTotal: 0, excluded: { noLocality: 0, noPollingPlace: 0, inconsistent: 0 }, missingPollingPlace: { count: 0, leaders: [] } },
        bogota: { topPuestos: [], topLocalidades: [], topLideres: [], jerarquia: [], totalVotos: 0, localityBreakdownTotal: 0, excluded: { noLocality: 0, noPollingPlace: 0, inconsistent: 0 }, missingPollingPlace: { count: 0, leaders: [] } },
        nacional: { topPuestos: [], topLocalidades: [], topLideres: [], jerarquia: [], totalVotos: 0, localityBreakdownTotal: 0, excluded: { noLocality: 0, noPollingPlace: 0, inconsistent: 0 }, missingPollingPlace: { count: 0, leaders: [] } }
    };
    analyticsChartsData = {
        all: { topPuestos: [], topLocalidades: [] },
        bogota: { topPuestos: [], topLocalidades: [] },
        nacional: { topPuestos: [], topLocalidades: [] }
    };
    chartsLoaded = false;
    lastRenderedChartsSignature = '';

    const token = getToken();
    chartsManager.setChartsLoading();

    try {
        const metricsPromise = loadDashboardMetrics(filters, token);

        await metricsPromise;
        showPageReady(loadingIndicator, dashboardContent);
        renderDashboard();

        const chartsPromise = loadChartsData(filters, token);
        const overviewPromise = loadAnalyticsOverviewData(filters, token);
        const localidadesPromise = loadLocalidadesSummary(filters, token, { force: datasetChanged || !hierarchyState.localidades.length });
        const invalidPromise = loadInvalidSummary(filters, token);

        chartsPromise.catch(() => {});
        overviewPromise.catch(() => {});
        localidadesPromise.catch(() => {});
        invalidPromise.catch(() => {});
    } catch (error) {
        if (isAbortError(error)) return;
        console.error('Error:', error);
        showPageError(loadingIndicator, 'Error al cargar los datos.');
    }
}

async function loadDashboardMetrics(filters, token) {
    const controller = requestManager.beginPageRequest('metrics');
    try {
        const params = buildApiParams(filters, { includeDetails: 0 });
        const result = await fetchJson('/api/v2/analytics/metrics?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error('Error fetching metrics');
        dashboardMetrics = result.data;
    } finally {
        requestManager.completePageRequest('metrics', controller);
    }
}

async function loadAnalyticsOverviewData(filters, token) {
    const controller = requestManager.beginPageRequest('overview');
    try {
        const params = buildApiParams(filters, { includeCharts: 0 });
        const result = await fetchJson('/api/v2/analytics/advanced-summary?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error(result?.message || 'Error fetching overview');
        analyticsData = {
            ...analyticsData,
            ...result.data,
            summary: {
                ...(analyticsData?.summary || {}),
                ...(result.data?.summary || {})
            },
            catalogs: {
                ...(analyticsData?.catalogs || {}),
                ...(result.data?.catalogs || {})
            }
        };
        renderDashboard();
    } catch (error) {
        if (!isAbortError(error)) console.error('Overview load error:', error);
    } finally {
        requestManager.completePageRequest('overview', controller);
    }
}

async function loadChartsData(filters, token) {
    const controller = requestManager.beginPageRequest('charts');
    try {
        const params = buildApiParams(filters);
        const result = await fetchJson('/api/v2/analytics/advanced-charts?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error(result?.message || 'Error fetching charts');

        analyticsChartsData = {
            all: result.data?.all || { topPuestos: [], topLocalidades: [] },
            bogota: result.data?.bogota || { topPuestos: [], topLocalidades: [] },
            nacional: result.data?.nacional || { topPuestos: [], topLocalidades: [] }
        };
        chartsLoaded = true;
        renderDashboard();
    } catch (error) {
        if (!isAbortError(error)) {
            console.error('Charts load error:', error);
            chartsManager.setChartsError('No se pudieron cargar los graficos.');
        }
    } finally {
        requestManager.completePageRequest('charts', controller);
    }
}

async function loadLocalidadesSummary(filters, token, { force = false } = {}) {
    const sortParams = getHierarchySortParamsForLevel('localidades', hierarchyState.sortPresets);
    const cacheKey = buildHierarchyCacheKey('localidades', filters, sortParams);

    if (!force && hierarchyState.cacheKeys.localidades === cacheKey && hierarchyState.localidades.length) {
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        return hierarchyState.localidades;
    }

    const controller = requestManager.beginPageRequest('localidades');
    hierarchyState.loadingLocalidades = true;
    hierarchyState.errorLocalidades = '';
    renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);

    try {
        const params = buildHierarchyParams('localidades');
        const result = await fetchJson('/api/v2/analytics/hierarchy/localidades?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error(result?.message || 'Error fetching localidades');
        hierarchyState.localidades = Array.isArray(result.data) ? result.data : [];
        hierarchyState.cacheKeys.localidades = cacheKey;
        analyticsSummary.officialValid = hierarchyState.localidades.reduce((sum, row) => sum + Number(row.totalVotes || 0), 0);
        analyticsSummary.totalRaw = analyticsSummary.officialValid + Number(analyticsSummary.erroneousOrIncomplete || 0);
        analyticsSummary.hiddenByCleanFilter = Number(analyticsSummary.erroneousOrIncomplete || 0);
        hierarchyState.loadingLocalidades = false;
        renderDashboard();
        return hierarchyState.localidades;
    } catch (error) {
        hierarchyState.loadingLocalidades = false;
        if (!isAbortError(error)) {
            hierarchyState.errorLocalidades = error.message || 'No se pudo cargar la jerarquia';
            renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        }
        return [];
    } finally {
        requestManager.completePageRequest('localidades', controller);
    }
}

async function loadInvalidSummary(filters, token) {
    const controller = requestManager.beginPageRequest('invalid-summary');
    try {
        const params = buildApiParams(filters, { regionScope: currentRegion || 'all', countOnly: 1 });
        const result = await fetchJson('/api/v2/analytics/invalid-rows?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error(result?.message || 'Error fetching invalid summary');
        analyticsSummary.erroneousOrIncomplete = Number(result?.data?.total || 0);
        analyticsSummary.officialCatalogVersion = result?.data?.context?.officialCatalogVersion || analyticsSummary.officialCatalogVersion || '-';
        analyticsSummary.totalRaw = Number(analyticsSummary.officialValid || 0) + analyticsSummary.erroneousOrIncomplete;
        analyticsSummary.hiddenByCleanFilter = analyticsSummary.erroneousOrIncomplete;
        analyticsData.catalogs = {
            ...(analyticsData.catalogs || {}),
            officialCatalogVersion: analyticsSummary.officialCatalogVersion
        };
        renderDashboard();
    } catch (error) {
        if (!isAbortError(error)) console.error('Invalid summary load error:', error);
    } finally {
        requestManager.completePageRequest('invalid-summary', controller);
    }
}

function renderDashboard() {
    if (!analyticsData) return;

    const data = analyticsData[currentRegion] || analyticsData.all || { topPuestos: [], topLocalidades: [], topLideres: [], jerarquia: [], totalVotos: 0 };
    const chartData = analyticsChartsData[currentRegion] || analyticsChartsData.all || { topPuestos: [], topLocalidades: [] };
    const totals = dashboardMetrics?.totals || {};
    const operational = dashboardMetrics?.operationalTotals || {};
    const eventId = dashboardMetrics?.source?.filter?.eventId || getSelectedEventId() || null;
    const totalBruto = Number(operational.totalRegistrations || 0);
    const confirmedBruto = Number(operational.confirmedCount || 0);
    const leadersEvento = Number(operational.totalLeaders || totals.totalLeaders || totals.leadersCount || 0);
    const localityBreakdownTotal = Number(data.localityBreakdownTotal || 0);
    const localityBuckets = Array.isArray(hierarchyState.localidades) ? hierarchyState.localidades.length : 0;

    document.getElementById('stat-total-votos').textContent = totalBruto.toLocaleString();
    document.getElementById('stat-total-puestos').textContent = confirmedBruto.toLocaleString();
    document.getElementById('stat-total-lideres').textContent = leadersEvento.toLocaleString();
    document.getElementById('stat-official-valid').textContent = Number(analyticsSummary.officialValid || analyticsData?.summary?.officialValid || 0).toLocaleString();
    document.getElementById('stat-invalid-total').textContent = Number(analyticsSummary.erroneousOrIncomplete || analyticsData?.summary?.erroneousOrIncomplete || 0).toLocaleString();
    if (invalidDataPageButton) {
        invalidDataPageButton.textContent = 'Ver datos erróneos o incompletos (' + Number(analyticsSummary.erroneousOrIncomplete || 0).toLocaleString() + ')';
    }
    document.getElementById('coverage-total-region').textContent = Number(data.totalVotos || 0).toLocaleString();
    document.getElementById('coverage-locality-total').textContent = localityBuckets.toLocaleString();
    document.getElementById('coverage-no-locality').textContent = Number(data?.excluded?.noLocality || 0).toLocaleString();
    document.getElementById('coverage-no-polling').textContent = Number(data?.excluded?.noPollingPlace || 0).toLocaleString();
    document.getElementById('coverage-inconsistent').textContent = Number(data?.excluded?.inconsistent || 0).toLocaleString();
    document.getElementById('coverage-hidden-clean').textContent = Number(analyticsSummary.hiddenByCleanFilter || 0).toLocaleString();

    renderMissingPollingSection(data, eventId);
    if (chartsLoaded) {
        const chartSignature = JSON.stringify({
            region: currentRegion,
            topPuestos: (chartData.topPuestos || []).map((item) => [item?.id || item?.name, item?.name || item?.puestoNombre || item?.puesto, item?.totalVotes ?? item?.totalVotos ?? item?.totalRegistros ?? 0]),
            topLocalidades: (chartData.topLocalidades || []).map((item) => [item?.id || item?.name, item?.name || item?.localidadNombre || item?.localidad, item?.totalVotes ?? item?.totalVotos ?? item?.totalRegistros ?? 0])
        });
        if (chartSignature !== lastRenderedChartsSignature) {
            chartsManager.renderCharts(chartData);
            lastRenderedChartsSignature = chartSignature;
        }
    }
    renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
    renderLeadersTable();

    trace('[ADV TRACE] localityBreakdown total=' + localityBreakdownTotal, {
        eventId,
        region: currentRegion || 'all',
        totalVotosRegion: Number(data.totalVotos || 0),
        localityBreakdownTotal
    });
}

function findPuestoContext(puestoId) {
    for (const [localidadId, puestos] of Object.entries(hierarchyState.puestosByLocalidad)) {
        const match = (puestos || []).find((item) => String(item.puestoId || item.puestoNombre) === String(puestoId));
        if (match) {
            return {
                localidadId,
                puestoCodigo: match.puestoCodigo || ''
            };
        }
    }
    return null;
}

async function handleSortChange(level) {
    hierarchyState.sortPresets.localidades = hierarchySortControls.localidades?.value || hierarchyState.sortPresets.localidades;
    hierarchyState.sortPresets.puestos = hierarchySortControls.puestos?.value || hierarchyState.sortPresets.puestos;
    hierarchyState.sortPresets.mesas = hierarchySortControls.mesas?.value || hierarchyState.sortPresets.mesas;

    const filters = getCurrentFilters();
    const token = getToken();

    if (level === 'localidades') {
        requestManager.abortPageRequest('localidades');
        clearAffectedCacheScopes(hierarchyState, ['localidades']);
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        await loadLocalidadesSummary(filters, token, { force: true });
        return;
    }

    if (level === 'puestos') {
        requestManager.abortAllLocalidadRequests();
        requestManager.abortAllPrefetchRequests();
        clearAffectedCacheScopes(hierarchyState, ['puestos', 'prefetch']);
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        await Promise.allSettled([...hierarchyState.expandedLocalidades].map((localidadId) => loadPuestosForLocalidad(localidadId, { force: true })));
        return;
    }

    requestManager.abortAllPuestoRequests();
    requestManager.abortAllPrefetchRequests();
    clearAffectedCacheScopes(hierarchyState, ['mesas', 'prefetch']);
    renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
    await Promise.allSettled([...hierarchyState.expandedPuestos].map((puestoId) => {
        const context = findPuestoContext(puestoId);
        if (!context) return Promise.resolve();
        return loadMesasForPuesto(context.localidadId, puestoId, context.puestoCodigo, { force: true });
    }));
}

async function loadPuestosForLocalidad(localidadId, { force = false } = {}) {
    if (!localidadId) return [];
    const filters = getCurrentFilters();
    const token = getToken();
    const requestDatasetSignature = hierarchyState.lastDatasetSignature;
    const sortParams = getHierarchySortParamsForLevel('puestos', hierarchyState.sortPresets);
    const cacheKey = buildHierarchyCacheKey('puestos', filters, { ...sortParams, localidadId });

    if (!force && hierarchyState.cacheKeys.puestosByLocalidad[localidadId] === cacheKey && hierarchyState.puestosByLocalidad[localidadId]) {
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        return hierarchyState.puestosByLocalidad[localidadId];
    }

    if (hierarchyState.loadingPuestos[localidadId]) return [];

    const controller = requestManager.beginLocalidadRequest(localidadId);
    hierarchyState.loadingPuestos[localidadId] = true;
    hierarchyState.errorPuestos[localidadId] = '';
    renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);

    try {
        const params = buildHierarchyParams('puestos');
        const result = await fetchJson('/api/v2/analytics/hierarchy/localidades/' + encodeURIComponent(localidadId) + '/puestos?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error(result?.message || 'No se pudieron cargar los puestos');
        if (requestDatasetSignature !== hierarchyState.lastDatasetSignature || !hierarchyState.expandedLocalidades.has(localidadId)) return [];
        hierarchyState.puestosByLocalidad[localidadId] = Array.isArray(result.data) ? result.data : [];
        hierarchyState.cacheKeys.puestosByLocalidad[localidadId] = cacheKey;

        const firstPuesto = hierarchyState.puestosByLocalidad[localidadId]?.[0];
        if (firstPuesto && shouldPrefetchFirstBranch(hierarchyState, firstPuesto)) {
            markBranchPrefetched(hierarchyState, firstPuesto.puestoId);
            prefetchMesasForPuesto(localidadId, firstPuesto.puestoId, firstPuesto.puestoCodigo || '');
        }

        return hierarchyState.puestosByLocalidad[localidadId];
    } catch (error) {
        if (!isAbortError(error)) {
            hierarchyState.errorPuestos[localidadId] = error.message || 'No se pudieron cargar los puestos';
        }
        return [];
    } finally {
        hierarchyState.loadingPuestos[localidadId] = false;
        requestManager.completeLocalidadRequest(localidadId, controller);
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
    }
}

async function loadMesasForPuesto(localidadId, puestoId, puestoCodigo = '', options = {}) {
    if (!puestoId) return [];
    const filters = getCurrentFilters();
    const token = getToken();
    const requestDatasetSignature = hierarchyState.lastDatasetSignature;
    const sortParams = getHierarchySortParamsForLevel('mesas', hierarchyState.sortPresets);
    const cacheKey = buildHierarchyCacheKey('mesas', filters, { ...sortParams, localidadId, puestoId, puestoCodigo });

    if (!options.force && hierarchyState.cacheKeys.mesasByPuesto[puestoId] === cacheKey && hierarchyState.mesasByPuesto[puestoId]) {
        if (!options.silent) renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        return hierarchyState.mesasByPuesto[puestoId];
    }

    if (hierarchyState.loadingMesas[puestoId]) return [];

    const controller = options.prefetch
        ? requestManager.beginPrefetchRequest(puestoId)
        : requestManager.beginPuestoRequest(puestoId);

    hierarchyState.loadingMesas[puestoId] = true;
    hierarchyState.errorMesas[puestoId] = '';
    if (!options.silent) renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);

    try {
        const params = buildHierarchyParams('mesas', { localidadId, puestoCodigo });
        const result = await fetchJson('/api/v2/analytics/hierarchy/puestos/' + encodeURIComponent(puestoId) + '/mesas?' + params.toString(), {
            token,
            signal: controller.signal
        });
        if (!result?.success) throw new Error(result?.message || 'No se pudieron cargar las mesas');
        if (requestDatasetSignature !== hierarchyState.lastDatasetSignature) return [];
        if (options.prefetch && !hierarchyState.expandedLocalidades.has(localidadId)) return [];
        if (!options.prefetch && !hierarchyState.expandedPuestos.has(puestoId) && !options.force) return [];
        hierarchyState.mesasByPuesto[puestoId] = Array.isArray(result.data) ? result.data : [];
        hierarchyState.cacheKeys.mesasByPuesto[puestoId] = cacheKey;
        return hierarchyState.mesasByPuesto[puestoId];
    } catch (error) {
        if (!isAbortError(error)) {
            hierarchyState.errorMesas[puestoId] = error.message || 'No se pudieron cargar las mesas';
        }
        return [];
    } finally {
        hierarchyState.loadingMesas[puestoId] = false;
        if (options.prefetch) {
            requestManager.completePrefetchRequest(puestoId, controller);
        } else {
            requestManager.completePuestoRequest(puestoId, controller);
        }
        if (!options.silent || hierarchyState.expandedPuestos.has(puestoId)) {
            renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        }
    }
}

function prefetchMesasForPuesto(localidadId, puestoId, puestoCodigo = '') {
    if (!hierarchyState.expandedLocalidades.has(localidadId)) return;
    loadMesasForPuesto(localidadId, puestoId, puestoCodigo, { silent: true, prefetch: true }).catch(() => {});
}

async function toggleHierarchyLocalidad(localidadId) {
    if (!localidadId) return;
    if (hierarchyState.expandedLocalidades.has(localidadId)) {
        hierarchyState.expandedLocalidades.delete(localidadId);
        requestManager.abortLocalidadRequest(localidadId);
        const puestos = hierarchyState.puestosByLocalidad[localidadId] || [];
        puestos.forEach((puesto) => {
            const puestoId = puesto.puestoId || puesto.puestoNombre;
            hierarchyState.expandedPuestos.delete(puestoId);
            requestManager.abortPuestoRequest(puestoId);
            requestManager.abortPrefetchRequest(puestoId);
        });
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        return;
    }

    hierarchyState.expandedLocalidades.add(localidadId);
    if (!hierarchyState.puestosByLocalidad[localidadId]) {
        await loadPuestosForLocalidad(localidadId);
        return;
    }
    renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
}

async function toggleHierarchyPuesto(localidadId, puestoId, puestoCodigo = '') {
    if (!puestoId) return;
    if (hierarchyState.expandedPuestos.has(puestoId)) {
        hierarchyState.expandedPuestos.delete(puestoId);
        requestManager.abortPuestoRequest(puestoId);
        requestManager.abortPrefetchRequest(puestoId);
        renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
        return;
    }

    hierarchyState.expandedPuestos.add(puestoId);
    if (!hierarchyState.mesasByPuesto[puestoId]) {
        await loadMesasForPuesto(localidadId, puestoId, puestoCodigo);
        return;
    }
    renderLazyHierarchyTable(hierarchyTableBody, hierarchyState);
}


        function renderMissingPollingSection(data, eventId) {
            const missing = data?.missingPollingPlace || { count: 0, leaders: [] };
            const total = Number(missing?.count || 0);
            const leaders = Array.isArray(missing?.leaders) ? missing.leaders : [];
            const tbody = document.getElementById('missing-polling-leaders-body');
            document.getElementById('missing-polling-total').textContent = total.toLocaleString();
            document.getElementById('missing-polling-leaders-total').textContent = leaders.length.toLocaleString();

            if (tbody) {
                if (!leaders.length) {
                    tbody.innerHTML = '<tr><td colspan="2" class="px-4 py-3 text-center text-gray-500">Sin datos</td></tr>';
                } else {
                    tbody.innerHTML = leaders.slice(0, 25).map((item) => `
                        <tr>
                            <td class="px-4 py-2 text-sm text-gray-700">${item.leaderName || 'Sin lider'}</td>
                            <td class="px-4 py-2 text-sm text-gray-700 text-right font-semibold">${Number(item.count || 0).toLocaleString()}</td>
                        </tr>
                    `).join('');
                }
            }

            leaders.slice(0, 50).forEach((item) => {
                console.info(`[MISSING POLLING TRACE] leaderId=${item.leaderId || 'unknown'} count=${Number(item.count || 0)}`);
            });
            console.info('[MISSING POLLING TRACE] block rendered with count=' + total, {
                eventId: eventId || null,
                leaders: leaders.length
            });
        }

        async function runMissingPollingReview() {
            try {
                const token = localStorage.getItem('token');
                const eventId = getSelectedEventId();
                const payload = {
                    skillName: 'missingPollingPlaceReview',
                    payload: {
                        eventId: eventId || undefined,
                        limit: 20000
                    }
                };
                console.info('[MISSING POLLING TRACE] launching skill missingPollingPlaceReview', payload);
                const response = await fetch('/api/v2/skills/run', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (!response.ok || !result?.success) {
                    throw new Error(result?.error || result?.message || 'No se pudo ejecutar revisión de sin puesto');
                }
                alert('Revisión lanzada. Job: ' + (result?.data?.jobId || 'N/A'));
                fetchAnalyticsData();
            } catch (err) {
                console.error('Error runMissingPollingReview:', err);
                alert('No se pudo lanzar la revisión: ' + err.message);
            }
        }
        
        function renderLeadersTable(searchTerm = '') {
            const tbody = document.getElementById('leaders-table-body');
            const meta = document.getElementById('leaders-table-meta');
            const emptyState = document.getElementById('leaders-empty-state');
            if (!tbody) return;

            const bucket = analyticsData?.[currentRegion] || analyticsData?.all || {};
            const leaders = Array.isArray(bucket.topLideres) ? bucket.topLideres : [];
            const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
            const filtered = normalizedSearch
                ? leaders.filter((item) => String(item?.liderNombre || '').toLowerCase().includes(normalizedSearch))
                : leaders;

            const regionTotal = Number(bucket.totalVotos || 0);
            if (!filtered.length) {
                tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-gray-500">Sin datos disponibles</td></tr>';
                if (meta) meta.textContent = '0 lideres';
                if (emptyState) emptyState.classList.remove('hidden');
                return;
            }

            if (emptyState) emptyState.classList.add('hidden');
            tbody.innerHTML = filtered.slice(0, 50).map((item) => {
                const total = Number(item?.totalVotos || 0);
                const rate = regionTotal > 0 ? ((total / regionTotal) * 100).toFixed(1) : '0.0';
                const leaderName = item?.liderNombre || 'Sin lider';
                return `
                    <tr>
                        <td class="px-4 py-2 text-sm text-gray-700">${leaderName}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 text-right font-semibold">${total.toLocaleString()}</td>
                        <td class="px-4 py-2 text-sm text-gray-700 text-right">${rate}%</td>
                    </tr>
                `;
            }).join('');
            if (meta) meta.textContent = `${filtered.length.toLocaleString()} lideres`;
        }
        
        // --- Global Verification ---
async function runGlobalVerification() {
            const btn = document.getElementById('btn-verify-global');
            const originalHtml = btn.innerHTML;
            
            try {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Verificando...';
                btn.disabled = true;
                
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const eventId = localStorage.getItem('eventId') || sessionStorage.getItem('eventId');
                const url = eventId ? `/api/v2/analytics/verify-global?eventId=${eventId}` : '/api/v2/analytics/verify-global';
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (result.success || result.assigned !== undefined) {
                    const d = result.data || result; // Fallback in case data is directly returned
                    const msg = `Verificación completada.<br>Asignados: ${d.assigned || 0}<br>Autocorregidos: ${d.autoCorrected || 0}<br>Para revisión: ${d.needsReview || 0}<br>Inconsistencias: ${d.severeInconsistency || 0}`;
                    showToast(msg, 'success');
                    // Reload data to reflect changes
                    fetchAnalyticsData();
                } else {
                    const errorMsg = result.error?.message || result.error || result.message || 'Error desconocido';
                    showToast('Error en la verificación: ' + errorMsg, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error de conexión al verificar datos.', 'error');
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
        
        function exportHierarchicalVotingStructure() {
            if (!Array.isArray(hierarchyState.localidades) || hierarchyState.localidades.length === 0) {
                showToast('No hay jerarquía cargada para exportar todavía.', 'info');
                return;
            }

            const rows = [['nivel', 'localidad', 'puesto', 'mesa', 'votos', 'registros', 'puestos', 'mesas']];

            hierarchyState.localidades.forEach((localidad) => {
                const localidadId = localidad.id || localidad.localidadId || localidad.name || localidad.localidadNombre;
                const localidadNombre = localidad.name || localidad.localidadNombre || 'Desconocida';
                rows.push([
                    'localidad',
                    localidadNombre,
                    '',
                    '',
                    Number(localidad.totalVotes || 0),
                    Number(localidad.totalRegistros || 0),
                    Number(localidad.totalPuestos || 0),
                    Number(localidad.totalMesas || 0)
                ]);

                const puestos = hierarchyState.puestosByLocalidad[localidadId] || [];
                puestos.forEach((puesto) => {
                    const puestoId = puesto.id || puesto.puestoId || puesto.name || puesto.puestoNombre;
                    const puestoNombre = puesto.name || puesto.puestoNombre || 'Desconocido';
                    rows.push([
                        'puesto',
                        localidadNombre,
                        puestoNombre,
                        '',
                        Number(puesto.totalVotes || 0),
                        Number(puesto.totalRegistros || 0),
                        '',
                        Number(puesto.totalMesas || 0)
                    ]);

                    const mesas = hierarchyState.mesasByPuesto[puestoId] || [];
                    mesas.forEach((mesa) => {
                        const mesaNumero = mesa.numero ?? mesa.mesaNumero ?? '';
                        rows.push([
                            'mesa',
                            localidadNombre,
                            puestoNombre,
                            mesaNumero,
                            Number(mesa.totalVotes || 0),
                            Number(mesa.totalRegistros || 0),
                            '',
                            ''
                        ]);
                    });
                });
            });

            const csv = rows
                .map((row) => row.map((value) => {
                    const safe = String(value ?? '').replace(/"/g, '""');
                    return `"${safe}"`;
                }).join(','))
                .join('\n');

            const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `jerarquia_oficial_${currentRegion}_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('Jerarquía exportada correctamente.', 'success');
        }

        function openVotersModal(title, voters) {
            document.getElementById('voters-modal-title').textContent = title;
            const tbody = document.getElementById('voters-modal-body');
            tbody.innerHTML = '';
            
            if (!voters || voters.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-gray-500">No hay detalles disponibles</td></tr>';
            } else {
                voters.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-2 text-left font-medium text-gray-900">${v.nombre || '-'}</td>
                        <td class="px-4 py-2 text-left text-gray-500">${v.cedula || '-'}</td>
                        <td class="px-4 py-2 text-left text-blue-600"><i class="fas fa-user-tie mr-1 text-xs"></i>${v.lider || '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            
            document.getElementById('voters-modal').classList.remove('hidden');
        }

        function closeVotersModal() {
            document.getElementById('voters-modal').classList.add('hidden');
        }

        // --- PDF Export ---
        async function exportToPDF() {
            const btn = document.getElementById('btn-export-pdf');
            const originalHtml = btn.innerHTML;

            try {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando Informe...';
                btn.disabled = true;
                const token = localStorage.getItem('token');
                const status = document.getElementById('data-status-filter')?.value || 'all';
                const leaderId = document.getElementById('global-leader-filter')?.value || '';
                const eventId = getSelectedEventId();
                const targetDate = document.getElementById('simulation-target-date')?.value || '';

                const params = new URLSearchParams();
                if (eventId) params.set('eventId', eventId);
                if (status) params.set('status', status);
                if (leaderId) params.set('leaderId', leaderId);
                if (targetDate) params.set('targetDate', targetDate);
                params.set('region', currentRegion || 'all');

                const response = await fetch(`/api/v2/exports/pdf/report?${params.toString()}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Error al generar el PDF en el servidor');
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Informe_Analitico_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();

                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                showToast('Informe analítico descargado exitosamente', 'success');
            } catch (error) {
                console.error("Error generando PDF:", error);
                alert("Ocurrió un error al generar el PDF: " + error.message);
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
        window.openVotersModal = openVotersModal;
        window.closeVotersModal = closeVotersModal;
        window.exportToPDF = exportToPDF;

