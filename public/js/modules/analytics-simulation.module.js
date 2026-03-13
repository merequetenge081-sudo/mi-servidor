import { escapeHtml, repairDisplayText, showToast } from './analytics-ui.module.js';

function buildOptions(options = [], selectedValues = []) {
    const selected = new Set((selectedValues || []).map(String));
    return (options || []).map((item) => `
        <option value="${escapeHtml(item.id || item.name)}" ${selected.has(String(item.id || item.name)) ? 'selected' : ''}>
            ${escapeHtml(repairDisplayText(item.name || item.id || 'Sin dato'))}${Number.isFinite(item.totalVotes) ? ` (${Number(item.totalVotes).toLocaleString()})` : ''}
        </option>
    `).join('');
}

function getSelectedValues(select) {
    if (!select) return [];
    return [...select.selectedOptions].map((option) => option.value).filter(Boolean);
}

function numberInputValue(id, fallback = 0) {
    const element = document.getElementById(id);
    const value = Number(element?.value);
    return Number.isFinite(value) ? value : fallback;
}

function renderScenarioCards(summary = {}) {
    return `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual oficial</div>
                <div class="mt-2 text-3xl font-black text-slate-900">${Number(summary.currentTotal || 0).toLocaleString()}</div>
            </div>
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Simulado</div>
                <div class="mt-2 text-3xl font-black text-emerald-700">${Number(summary.simulatedTotal || 0).toLocaleString()}</div>
            </div>
            <div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wide text-indigo-700">Delta</div>
                <div class="mt-2 text-3xl font-black text-indigo-700">${Number(summary.delta || 0).toLocaleString()}</div>
            </div>
            <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div class="text-xs font-semibold uppercase tracking-wide text-amber-700">Recuperables</div>
                <div class="mt-2 text-3xl font-black text-amber-700">${Number(summary.recoverableVotes || 0).toLocaleString()}</div>
            </div>
        </div>
    `;
}

function renderTopTable(title, rows = [], type = 'localidad') {
    const columnsLabel = type === 'localidad' ? 'Localidad' : 'Lider';
    const body = rows.length
        ? rows.slice(0, 8).map((row) => `
            <tr class="border-b border-slate-100">
                <td class="px-3 py-2 font-medium text-slate-800">${escapeHtml(repairDisplayText(row.name || 'Sin dato'))}</td>
                <td class="px-3 py-2 text-right text-slate-600">${Number(row.currentVotes || 0).toLocaleString()}</td>
                <td class="px-3 py-2 text-right font-semibold text-emerald-700">${Number(row.simulatedVotes || 0).toLocaleString()}</td>
                <td class="px-3 py-2 text-right font-semibold text-indigo-700">+${Number(row.delta || 0).toLocaleString()}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="px-3 py-6 text-center text-slate-500">Sin datos para este escenario.</td></tr>';

    return `
        <div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div class="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 class="text-sm font-semibold text-slate-700">${escapeHtml(title)}</h4>
            </div>
            <table class="w-full text-sm">
                <thead class="bg-white text-slate-500">
                    <tr>
                        <th class="px-3 py-2 text-left">${columnsLabel}</th>
                        <th class="px-3 py-2 text-right">Actual</th>
                        <th class="px-3 py-2 text-right">Simulado</th>
                        <th class="px-3 py-2 text-right">Delta</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;
}

export function createCampaignSimulationWorkspace({
    fetchJson,
    getToken,
    getSelectedEventId,
    getCurrentFilters
}) {
    let baseController = null;
    let runController = null;
    let baseData = null;
    let isBound = false;
    let lastOpenNonce = 0;

    function getModal() {
        return document.getElementById('simulation-modal');
    }

    function setRunDisabled(disabled) {
        const button = document.getElementById('simulation-run-btn');
        if (button) button.disabled = disabled;
    }

    function abortInFlightRequests() {
        if (baseController) baseController.abort();
        if (runController) runController.abort();
        baseController = null;
        runController = null;
    }

    function resetResults() {
        document.getElementById('simulation-assumptions').innerHTML = '';
        document.getElementById('simulation-summary-cards').innerHTML = '';
        document.getElementById('simulation-ranking-localidades').innerHTML = '';
        document.getElementById('simulation-ranking-lideres').innerHTML = '';
        document.getElementById('simulation-results')?.classList.add('hidden');
    }

    function openModal() {
        const modal = getModal();
        if (modal) modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    }

    function closeModal() {
        lastOpenNonce += 1;
        abortInFlightRequests();
        baseData = null;
        const modal = getModal();
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        setRunDisabled(false);
    }

    function setSimulationLoading(message = 'Cargando simulador...') {
        const loading = document.getElementById('simulation-loading');
        const results = document.getElementById('simulation-results');
        if (loading) {
            loading.classList.remove('hidden');
            loading.innerHTML = `
                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                    <div class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-3">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <div class="font-medium">${escapeHtml(message)}</div>
                </div>
            `;
        }
        results?.classList.add('hidden');
        setRunDisabled(true);
    }

    function setSimulationError(message) {
        const loading = document.getElementById('simulation-loading');
        const results = document.getElementById('simulation-results');
        if (loading) {
            loading.classList.remove('hidden');
            loading.innerHTML = `
                <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
                    <div class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
                        <i class="fas fa-triangle-exclamation"></i>
                    </div>
                    <div class="font-semibold mb-1">No se pudo completar la simulacion</div>
                    <div class="text-sm">${escapeHtml(message || 'Error desconocido')}</div>
                </div>
            `;
        }
        results?.classList.add('hidden');
        setRunDisabled(false);
    }

    function setSimulationReady() {
        document.getElementById('simulation-loading')?.classList.add('hidden');
        document.getElementById('simulation-results')?.classList.remove('hidden');
        setRunDisabled(false);
    }

    function buildPayload() {
        const filters = getCurrentFilters();
        return {
            eventId: getSelectedEventId(),
            region: filters.region || 'all',
            leaderId: filters.leaderId || '',
            selectedLocalidades: getSelectedValues(document.getElementById('simulation-localidades')),
            selectedLeaderIds: getSelectedValues(document.getElementById('simulation-leaders')),
            scenarioType: document.getElementById('simulation-scenario-type')?.value || 'moderado',
            growthOfficialPercent: numberInputValue('simulation-growth-official'),
            recoveryPercent: numberInputValue('simulation-recovery-percent'),
            leaderMobilizationPercent: numberInputValue('simulation-leader-mobilization'),
            turnoutPercent: numberInputValue('simulation-turnout-percent'),
            includeInvalidRecovery: document.getElementById('simulation-include-invalid')?.checked === true,
            targetDate: document.getElementById('simulation-target-date')?.value || ''
        };
    }

    function renderBaseScenario(data) {
        baseData = data;
        const localitySelect = document.getElementById('simulation-localidades');
        const leaderSelect = document.getElementById('simulation-leaders');
        if (localitySelect) localitySelect.innerHTML = buildOptions(data?.options?.localidades || []);
        if (leaderSelect) leaderSelect.innerHTML = buildOptions(data?.options?.leaders || []);
        document.getElementById('simulation-base-summary').innerHTML = `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div class="font-semibold text-slate-900 mb-1">Base actual del escenario</div>
                <div>Votos oficiales: <strong>${Number(data?.summary?.officialValid || 0).toLocaleString()}</strong></div>
                <div>Registros recuperables: <strong>${Number(data?.summary?.recoverableInvalid || 0).toLocaleString()}</strong></div>
            </div>
        `;
    }

    function renderSimulationResult(data) {
        document.getElementById('simulation-assumptions').innerHTML = `
            <div class="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
                <div class="font-semibold mb-1">Supuestos del escenario</div>
                <div>${escapeHtml(data?.assumptions?.summaryText || 'Sin supuestos generados.')}</div>
            </div>
        `;
        document.getElementById('simulation-summary-cards').innerHTML = renderScenarioCards(data?.summary || {});
        document.getElementById('simulation-ranking-localidades').innerHTML = renderTopTable('Localidades con mayor lift proyectado', data?.byLocalidad || [], 'localidad');
        document.getElementById('simulation-ranking-lideres').innerHTML = renderTopTable('Lideres con mayor lift proyectado', data?.byLeader || [], 'lider');
        setSimulationReady();
    }

    function applyPresetToInputs(preset) {
        const presets = baseData?.presets || {};
        const config = presets?.[preset];
        if (!config) return;
        document.getElementById('simulation-growth-official').value = config.growthOfficialPercent;
        document.getElementById('simulation-recovery-percent').value = config.recoveryPercent;
        document.getElementById('simulation-leader-mobilization').value = config.leaderMobilizationPercent;
        document.getElementById('simulation-turnout-percent').value = config.turnoutPercent;
    }

    async function loadBaseScenario() {
        abortInFlightRequests();
        baseController = new AbortController();
        const openNonce = ++lastOpenNonce;
        baseData = null;
        resetResults();
        setSimulationLoading('Preparando simulador con datos oficiales...');

        try {
            const filters = getCurrentFilters();
            const params = new URLSearchParams({
                eventId: getSelectedEventId() || '',
                region: filters.region || 'all',
                leaderId: filters.leaderId || ''
            });
            const result = await fetchJson(`/api/v2/analytics/simulation/base?${params.toString()}`, {
                token: getToken(),
                signal: baseController.signal
            });
            if (openNonce !== lastOpenNonce) return;
            renderBaseScenario(result?.data || {});
            applyPresetToInputs(document.getElementById('simulation-scenario-type')?.value || 'moderado');
            await runScenario({ openNonce });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            setSimulationError(error.message || 'No se pudo cargar la base del escenario.');
        } finally {
            baseController = null;
        }
    }

    async function runScenario({ openNonce = lastOpenNonce } = {}) {
        if (!baseData) {
            setSimulationError('La base del escenario no esta disponible todavia.');
            return;
        }

        if (runController) runController.abort();
        runController = new AbortController();
        setSimulationLoading('Calculando escenario...');

        try {
            const payload = buildPayload();
            const result = await fetchJson('/api/v2/analytics/simulation/run', {
                method: 'POST',
                token: getToken(),
                signal: runController.signal,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (openNonce !== lastOpenNonce) return;
            renderSimulationResult(result?.data || {});
        } catch (error) {
            if (error?.name === 'AbortError') return;
            setSimulationError(error.message || 'No se pudo calcular la simulacion.');
            showToast('No se pudo ejecutar la simulacion.', 'error');
        } finally {
            runController = null;
        }
    }

    function bindEvents() {
        if (isBound) return;
        isBound = true;

        document.getElementById('btn-start-simulation')?.addEventListener('click', async (event) => {
            event.preventDefault();
            openModal();
            await loadBaseScenario();
        });

        document.getElementById('simulation-close-btn')?.addEventListener('click', closeModal);
        document.getElementById('simulation-cancel-btn')?.addEventListener('click', closeModal);
        document.getElementById('simulation-run-btn')?.addEventListener('click', () => runScenario());

        document.getElementById('simulation-scenario-type')?.addEventListener('change', (event) => {
            applyPresetToInputs(event.target.value);
            if (baseData) runScenario();
        });

        [
            'simulation-growth-official',
            'simulation-recovery-percent',
            'simulation-leader-mobilization',
            'simulation-turnout-percent',
            'simulation-include-invalid',
            'simulation-target-date',
            'simulation-localidades',
            'simulation-leaders'
        ].forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (baseData) runScenario();
            });
        });

        document.getElementById('simulation-modal')?.addEventListener('click', (event) => {
            if (event.target?.id === 'simulation-modal') closeModal();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !getModal()?.classList.contains('hidden')) {
                closeModal();
            }
        });
    }

    return {
        bindEvents
    };
}
