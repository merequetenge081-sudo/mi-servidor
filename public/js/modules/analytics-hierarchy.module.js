import { parseHierarchySortPreset } from './analytics-state.module.js';
import { escapeHtml } from './analytics-ui.module.js';

export function applyHierarchySortParams(params, presetValue) {
    const { sortBy, sortDir } = parseHierarchySortPreset(presetValue);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    return params;
}

export function getHierarchySortSelection(selectElement) {
    return parseHierarchySortPreset(selectElement?.value || 'totalVotes:desc');
}

export function bindHierarchyTableEvents(tbody, handlers = {}) {
    if (!tbody) return;
    tbody.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;

        const action = trigger.dataset.action;
        if (action === 'toggle-localidad') {
            handlers.onToggleLocalidad?.(trigger.dataset.localidadId);
            return;
        }

        if (action === 'retry-localidades') {
            handlers.onRetryLocalidades?.();
            return;
        }

        if (action === 'toggle-puesto') {
            handlers.onTogglePuesto?.(
                trigger.dataset.localidadId,
                trigger.dataset.puestoId,
                trigger.dataset.puestoCodigo || ''
            );
            return;
        }

        if (action === 'retry-localidad') {
            handlers.onRetryLocalidad?.(trigger.dataset.localidadId);
            return;
        }

        if (action === 'retry-puesto') {
            handlers.onRetryPuesto?.(
                trigger.dataset.localidadId,
                trigger.dataset.puestoId,
                trigger.dataset.puestoCodigo || ''
            );
        }
    });
}

function renderInlineMessage(kind, content) {
    const baseClass = kind === 'error'
        ? 'text-red-500'
        : 'text-gray-500';
    return `<tr><td colspan="2" class="px-6 py-4 text-center ${baseClass}">${content}</td></tr>`;
}

export function renderLazyHierarchyTable(tbody, state) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (state.loadingLocalidades) {
        tbody.innerHTML = renderInlineMessage(
            'loading',
            `
                <div class="space-y-3 py-2">
                    <div><i class="fas fa-spinner fa-spin mr-2"></i>Cargando localidades...</div>
                    <div class="h-3 rounded bg-slate-200 animate-pulse"></div>
                    <div class="h-3 rounded bg-slate-200 animate-pulse w-11/12 mx-auto"></div>
                    <div class="h-3 rounded bg-slate-200 animate-pulse w-10/12 mx-auto"></div>
                </div>
            `
        );
        return;
    }

    if (state.errorLocalidades) {
        tbody.innerHTML = renderInlineMessage(
            'error',
            `
                <div class="mb-2">${escapeHtml(state.errorLocalidades)}</div>
                <button data-action="retry-localidades" class="px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200 text-sm font-semibold">
                    Reintentar
                </button>
            `
        );
        return;
    }

    if (!state.localidades.length) {
        tbody.innerHTML = renderInlineMessage('empty', 'No hay localidades disponibles');
        return;
    }

    state.localidades.forEach((localidad) => {
        const localidadId = localidad.id || localidad.localidadId || localidad.name || localidad.localidadNombre;
        const localidadNombre = localidad.name || localidad.localidadNombre || 'Desconocida';
        const expandedLocalidad = state.expandedLocalidades.has(localidadId);

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="table-row-locality">
                <td class="px-6 py-3 whitespace-nowrap">
                    <button type="button" data-action="toggle-localidad" data-localidad-id="${escapeHtml(localidadId)}" class="inline-flex items-center text-left w-full">
                        <span class="chevron-icon ${expandedLocalidad ? 'expanded' : ''}" id="icon-${escapeHtml(localidadId)}"><i class="fas fa-chevron-right"></i></span>
                        <span><i class="fas fa-city text-blue-500 mr-2"></i>${escapeHtml(localidadNombre)}</span>
                    </button>
                    <div class="ml-8 mt-1 text-[11px] font-normal text-slate-500">
                        Puestos: ${Number(localidad.totalPuestos || 0).toLocaleString()} · Mesas: ${Number(localidad.totalMesas || 0).toLocaleString()} · Registros: ${Number(localidad.totalRegistros || 0).toLocaleString()}
                    </div>
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-right font-bold text-indigo-600">${Number(localidad.totalVotes || 0).toLocaleString()}</td>
            </tr>
        `);

        if (!expandedLocalidad) return;

        if (state.loadingPuestos[localidadId]) {
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="table-row-puesto" style="display: table-row;">
                    <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500" colspan="2">
                        <span class="ml-8"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando puestos...</span>
                    </td>
                </tr>
            `);
            return;
        }

        if (state.errorPuestos[localidadId]) {
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="table-row-puesto" style="display: table-row;">
                    <td class="px-6 py-2 whitespace-nowrap text-sm text-red-500" colspan="2">
                        <div class="ml-8 flex items-center gap-3">
                            <span>${escapeHtml(state.errorPuestos[localidadId])}</span>
                            <button data-action="retry-localidad" data-localidad-id="${escapeHtml(localidadId)}" class="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-semibold">
                                Reintentar
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            return;
        }

        const puestos = state.puestosByLocalidad[localidadId] || [];
        if (!puestos.length) {
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="table-row-puesto" style="display: table-row;">
                    <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500" colspan="2">
                        <span class="ml-8">Sin puestos para esta localidad.</span>
                    </td>
                </tr>
            `);
            return;
        }

        puestos.forEach((puesto) => {
            const puestoId = puesto.id || puesto.puestoId || puesto.name || puesto.puestoNombre;
            const puestoNombre = puesto.name || puesto.puestoNombre || 'Desconocido';
            const expandedPuesto = state.expandedPuestos.has(puestoId);

            tbody.insertAdjacentHTML('beforeend', `
                <tr class="table-row-puesto" style="display: table-row;">
                    <td class="px-6 py-2 whitespace-nowrap">
                        <button
                            type="button"
                            data-action="toggle-puesto"
                            data-localidad-id="${escapeHtml(localidadId)}"
                            data-puesto-id="${escapeHtml(puestoId)}"
                            data-puesto-codigo="${escapeHtml(puesto.puestoCodigo || '')}"
                            class="inline-flex items-center text-left w-full"
                        >
                            <span class="chevron-icon ${expandedPuesto ? 'expanded' : ''}" id="icon-${escapeHtml(puestoId)}"><i class="fas fa-chevron-right"></i></span>
                            <span><i class="fas fa-map-marker-alt text-red-400 mr-2"></i>${escapeHtml(puestoNombre)}</span>
                        </button>
                        <div class="ml-8 mt-1 text-[11px] text-slate-500">
                            Mesas: ${Number(puesto.totalMesas || 0).toLocaleString()} · Registros: ${Number(puesto.totalRegistros || 0).toLocaleString()}
                        </div>
                    </td>
                    <td class="px-6 py-2 whitespace-nowrap text-right font-semibold">${Number(puesto.totalVotes || 0).toLocaleString()}</td>
                </tr>
            `);

            if (!expandedPuesto) return;

            if (state.loadingMesas[puestoId]) {
                tbody.insertAdjacentHTML('beforeend', `
                    <tr class="table-row-mesa" style="display: table-row;">
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500" colspan="2">
                            <span class="ml-12"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando mesas...</span>
                        </td>
                    </tr>
                `);
                return;
            }

            if (state.errorMesas[puestoId]) {
                tbody.insertAdjacentHTML('beforeend', `
                    <tr class="table-row-mesa" style="display: table-row;">
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-red-500" colspan="2">
                            <div class="ml-12 flex items-center gap-3">
                                <span>${escapeHtml(state.errorMesas[puestoId])}</span>
                                <button
                                    data-action="retry-puesto"
                                    data-localidad-id="${escapeHtml(localidadId)}"
                                    data-puesto-id="${escapeHtml(puestoId)}"
                                    data-puesto-codigo="${escapeHtml(puesto.puestoCodigo || '')}"
                                    class="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-semibold"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </td>
                    </tr>
                `);
                return;
            }

            const mesas = state.mesasByPuesto[puestoId] || [];
            if (!mesas.length) {
                tbody.insertAdjacentHTML('beforeend', `
                    <tr class="table-row-mesa" style="display: table-row;">
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500" colspan="2">
                            <span class="ml-12">Sin mesas para este puesto.</span>
                        </td>
                    </tr>
                `);
                return;
            }

            mesas.forEach((mesa) => {
                const mesaNumero = mesa.numero ?? mesa.mesaNumero ?? 'N/A';
                tbody.insertAdjacentHTML('beforeend', `
                    <tr class="table-row-mesa" style="display: table-row;">
                        <td class="px-6 py-1 whitespace-nowrap">
                            <i class="fas fa-table text-indigo-400 mr-2 ml-4"></i>Mesa ${escapeHtml(String(mesaNumero))}
                            <div class="ml-8 mt-1 text-[11px] text-slate-500">Registros: ${Number(mesa.totalRegistros || 0).toLocaleString()}</div>
                        </td>
                        <td class="px-6 py-1 whitespace-nowrap text-right">
                            <span class="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">${Number(mesa.totalVotes || 0).toLocaleString()}</span>
                        </td>
                    </tr>
                `);
            });
        });
    });
}
