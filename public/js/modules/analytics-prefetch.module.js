export function shouldPrefetchFirstBranch(state, puesto) {
    if (!puesto?.puestoId) return false;
    if (state.mesasByPuesto[puesto.puestoId]) return false;
    if (state.prefetchedPuestos.has(puesto.puestoId)) return false;
    return true;
}

export function markBranchPrefetched(state, puestoId) {
    state.prefetchedPuestos.add(puestoId);
}

