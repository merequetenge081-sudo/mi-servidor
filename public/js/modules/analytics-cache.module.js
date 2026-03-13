function normalizeValue(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

export function buildAnalyticsDatasetSignature(filters = {}) {
    return JSON.stringify({
        region: normalizeValue(filters.region || 'all'),
        status: normalizeValue(filters.status || 'all'),
        leaderId: normalizeValue(filters.leaderId || ''),
        eventId: normalizeValue(filters.eventId || '')
    });
}

export function buildHierarchyCacheKey(level, filters = {}, options = {}) {
    return JSON.stringify({
        level,
        dataset: buildAnalyticsDatasetSignature(filters),
        sortBy: normalizeValue(options.sortBy || ''),
        sortDir: normalizeValue(options.sortDir || ''),
        localidadId: normalizeValue(options.localidadId || ''),
        puestoId: normalizeValue(options.puestoId || ''),
        puestoCodigo: normalizeValue(options.puestoCodigo || '')
    });
}

export function shouldInvalidateForFilterChange(previousSignature, nextSignature) {
    return normalizeValue(previousSignature) !== normalizeValue(nextSignature);
}

function clearMapObject(target) {
    Object.keys(target).forEach((key) => {
        delete target[key];
    });
}

export function clearAffectedCacheScopes(state, scopes = []) {
    const scopeSet = new Set(scopes);

    if (scopeSet.has('localidades')) {
        state.localidades = [];
        state.cacheKeys.localidades = '';
        state.loadingLocalidades = false;
        state.errorLocalidades = '';
    }

    if (scopeSet.has('puestos')) {
        clearMapObject(state.puestosByLocalidad);
        clearMapObject(state.loadingPuestos);
        clearMapObject(state.errorPuestos);
        clearMapObject(state.cacheKeys.puestosByLocalidad);
    }

    if (scopeSet.has('mesas')) {
        clearMapObject(state.mesasByPuesto);
        clearMapObject(state.loadingMesas);
        clearMapObject(state.errorMesas);
        clearMapObject(state.cacheKeys.mesasByPuesto);
    }

    if (scopeSet.has('prefetch')) {
        state.prefetchedPuestos = new Set();
    }
}

