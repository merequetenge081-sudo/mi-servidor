export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

export function showPageLoading(loadingIndicator, dashboardContent) {
    loadingIndicator?.classList.remove('hidden');
    dashboardContent?.classList.add('hidden');
    if (loadingIndicator) {
        loadingIndicator.innerHTML = `
            <div class="w-full max-w-3xl mx-auto">
                <div class="flex items-center justify-center mb-4 text-indigo-600">
                    <i class="fas fa-spinner fa-spin text-4xl"></i>
                </div>
                <p class="text-gray-600 font-medium text-center mb-6">Cargando datos analiticos...</p>
                <div class="space-y-3">
                    <div class="h-4 rounded bg-slate-200 animate-pulse"></div>
                    <div class="h-4 rounded bg-slate-200 animate-pulse w-11/12 mx-auto"></div>
                    <div class="h-4 rounded bg-slate-200 animate-pulse w-9/12 mx-auto"></div>
                </div>
            </div>
        `;
    }
}

export function showPageReady(loadingIndicator, dashboardContent) {
    loadingIndicator?.classList.add('hidden');
    dashboardContent?.classList.remove('hidden');
}

export function showPageError(loadingIndicator, message) {
    if (!loadingIndicator) return;
    loadingIndicator.classList.remove('hidden');
    loadingIndicator.innerHTML = `<div class="text-red-500"><i class="fas fa-exclamation-triangle text-4xl mb-4"></i><p>${escapeHtml(message || 'Error al cargar los datos.')}</p></div>`;
}

export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0`;
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

const MOJIBAKE_REPLACEMENTS = [
    ['ÃƒÂ¡', 'á'],
    ['ÃƒÂ©', 'é'],
    ['ÃƒÂ­', 'í'],
    ['ÃƒÂ³', 'ó'],
    ['ÃƒÂº', 'ú'],
    ['ÃƒÂ', 'Á'],
    ['Ãƒâ€°', 'É'],
    ['ÃƒÂ', 'Í'],
    ['Ãƒâ€œ', 'Ó'],
    ['ÃƒÅ¡', 'Ú'],
    ['ÃƒÂ±', 'ñ'],
    ['Ãƒâ€˜', 'Ñ'],
    ['ÃƒÂ¼', 'ü'],
    ['ÃƒÅ“', 'Ü'],
    ['Ã¢â‚¬Å“', '"'],
    ['Ã¢â‚¬Â', '"'],
    ['Ã¢â‚¬Ëœ', "'"],
    ['Ã¢â‚¬â„¢', "'"],
    ['Ã¢â‚¬â€œ', '-'],
    ['Ã¢â‚¬â€', '-'],
    ['\uFFFD', '']
];

export function repairDisplayText(value) {
    let text = String(value ?? '').trim();
    if (!text) return '';

    for (const [find, replacement] of MOJIBAKE_REPLACEMENTS) {
        text = text.split(find).join(replacement);
    }

    return text.replace(/\s+/g, ' ').trim();
}

export function resolvePreferredLabel(item, candidates = [], fallback = 'Desconocido') {
    for (const key of candidates) {
        const value = typeof key === 'function' ? key(item) : item?.[key];
        const repaired = repairDisplayText(value);
        if (repaired) return repaired;
    }
    return repairDisplayText(fallback) || 'Desconocido';
}

export function resolveChartLabel(item, scope = 'generic', fallback = 'Desconocido') {
    const candidates = scope === 'puesto'
        ? ['name', 'puestoNombre', 'puesto', 'label', '_id']
        : scope === 'localidad'
            ? ['name', 'localidadNombre', 'localidad', 'municipio', 'label', '_id']
            : ['name', 'label', '_id'];

    return resolvePreferredLabel(item, candidates, fallback);
}

export function truncateLabel(label, maxLength = 22) {
    const value = repairDisplayText(label);
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(1, maxLength - 3)).trim()}...`;
}

export function debounce(fn, wait = 200) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}
