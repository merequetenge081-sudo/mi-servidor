import { parseHierarchySortPreset, HIERARCHY_SORT_PRESETS_BY_LEVEL } from './analytics-state.module.js';

export function populateSortSelect(select, presets, selectedValue) {
    if (!select) return;
    select.innerHTML = presets.map((preset) => `<option value="${preset.value}">${preset.label}</option>`).join('');
    select.value = selectedValue;
}

export function initializeHierarchySortControls(elements, sortState) {
    populateSortSelect(elements.localidades, HIERARCHY_SORT_PRESETS_BY_LEVEL.localidades, sortState.localidades);
    populateSortSelect(elements.puestos, HIERARCHY_SORT_PRESETS_BY_LEVEL.puestos, sortState.puestos);
    populateSortSelect(elements.mesas, HIERARCHY_SORT_PRESETS_BY_LEVEL.mesas, sortState.mesas);
}

export function readAnalyticsFilters({ currentRegion, dataStatusFilter, globalLeaderFilter, eventId }) {
    return {
        region: currentRegion || 'all',
        status: dataStatusFilter?.value || 'all',
        leaderId: globalLeaderFilter?.value || '',
        eventId: eventId || ''
    };
}

export function readHierarchySortState(elements) {
    return {
        localidades: elements.localidades?.value || 'totalVotes:desc',
        puestos: elements.puestos?.value || 'totalVotes:desc',
        mesas: elements.mesas?.value || 'numero:asc'
    };
}

export function getHierarchySortParamsForLevel(level, sortState) {
    return parseHierarchySortPreset(sortState?.[level] || 'totalVotes:desc');
}

