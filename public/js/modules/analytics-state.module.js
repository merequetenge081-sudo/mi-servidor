export function createHierarchyState() {
    return {
        localidades: [],
        puestosByLocalidad: {},
        mesasByPuesto: {},
        expandedLocalidades: new Set(),
        expandedPuestos: new Set(),
        loadingLocalidades: false,
        loadingPuestos: {},
        loadingMesas: {},
        errorLocalidades: '',
        errorPuestos: {},
        errorMesas: {},
        prefetchedPuestos: new Set(),
        cacheKeys: {
            localidades: '',
            puestosByLocalidad: {},
            mesasByPuesto: {}
        },
        lastDatasetSignature: '',
        sortPresets: {
            localidades: 'totalVotes:desc',
            puestos: 'totalVotes:desc',
            mesas: 'numero:asc'
        }
    };
}

export const HIERARCHY_SORT_PRESETS_BY_LEVEL = {
    localidades: [
        { value: 'totalVotes:desc', label: 'Mas votos' },
        { value: 'nombre:asc', label: 'Nombre A-Z' },
        { value: 'totalRegistros:desc', label: 'Mas registros' },
        { value: 'totalMesas:desc', label: 'Mas mesas' }
    ],
    puestos: [
        { value: 'totalVotes:desc', label: 'Mas votos' },
        { value: 'nombre:asc', label: 'Nombre A-Z' },
        { value: 'totalRegistros:desc', label: 'Mas registros' },
        { value: 'totalMesas:desc', label: 'Mas mesas' }
    ],
    mesas: [
        { value: 'numero:asc', label: 'Mesa ascendente' },
        { value: 'numero:desc', label: 'Mesa descendente' },
        { value: 'totalVotes:desc', label: 'Mas votos' },
        { value: 'totalRegistros:desc', label: 'Mas registros' }
    ]
};

export function parseHierarchySortPreset(value = 'totalVotes:desc') {
    const [sortBy, sortDir] = String(value || 'totalVotes:desc').split(':');
    return {
        sortBy: sortBy || 'totalVotes',
        sortDir: sortDir === 'asc' ? 'asc' : 'desc'
    };
}
