const SKILL_META = {
    validation: { label: 'Revalidar', icon: 'bi-shield-check' },
    deduplication: { label: 'Deduplicar', icon: 'bi-intersect' },
    verification: { label: 'Preparar llamadas', icon: 'bi-telephone-forward' },
    scoring: { label: 'Calcular scoring', icon: 'bi-speedometer2' },
    productivity: { label: 'Productividad lideres', icon: 'bi-people' },
    analytics: { label: 'Actualizar metricas', icon: 'bi-graph-up-arrow' },
    databaseOptimization: { label: 'Optimizar BD', icon: 'bi-database-gear' },
    uiTextQuality: { label: 'Calidad de textos UI', icon: 'bi-fonts' }
};

function formatDuration(start, end) {
    if (!start) return '-';
    const a = new Date(start).getTime();
    const b = end ? new Date(end).getTime() : Date.now();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return '-';
    const sec = Math.floor((b - a) / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
}

function summarizeSkillOutput(skillName, summary = {}, results = []) {
    if (skillName === 'validation') {
        const processed = summary.processed ?? 0;
        const updated = summary.updated ?? 0;
        const errors = Array.isArray(results) ? results.filter((r) => r.status === 'error').length : 0;
        return `Procesados: ${processed} | Actualizados: ${updated} | Invalidos: ${errors}`;
    }
    if (skillName === 'deduplication') {
        const byType = summary.byType || {};
        return `Flags: exact=${byType.exact_duplicate || 0}, probable=${byType.probable_duplicate || 0}, phone=${byType.repeated_phone || 0}, orphan=${byType.orphan_record || 0}, mismatch=${byType.puesto_localidad_mismatch || 0}`;
    }
    if (skillName === 'verification') return `Preparados: ${summary.queued || 0}`;
    if (skillName === 'scoring') {
        const high = results.filter((r) => (r.output?.priority || '') === 'high').length;
        const medium = results.filter((r) => (r.output?.priority || '') === 'medium').length;
        const low = results.filter((r) => (r.output?.priority || '') === 'low').length;
        return `Puntuados: ${results.length} | Alta: ${high} | Media: ${medium} | Baja: ${low}`;
    }
    if (skillName === 'productivity') {
        return `Lideres evaluados: ${summary.leaders || 0} | Actualizados: ${summary.upserted || 0}`;
    }
    if (skillName === 'analytics') {
        return `Raw: ${summary.totalRaw || 0} | Validos: ${summary.validRecords || 0} | Duplicados: ${summary.duplicateRecords || 0} | Confirmados: ${summary.confirmedRecords || 0}`;
    }
    if (skillName === 'databaseOptimization') {
        return `Cols: ${summary.collectionsAnalyzed || 0} | Dup grupos: ${summary.duplicateGroups || 0} | Indices faltantes: ${summary.indexesMissing || 0}`;
    }
    if (skillName === 'uiTextQuality') {
        return `Archivos: ${summary.filesAnalyzed || 0} | Encoding: ${summary.mojibakeIssues || 0} | Ortografia: ${summary.spellingIssues || 0} | Consistencia: ${summary.consistencyIssues || 0}`;
    }
    return '-';
}

const SkillsUIHelpers = {
    SKILL_META,
    formatDuration,
    summarizeSkillOutput
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkillsUIHelpers;
}

if (typeof window !== 'undefined') {
    window.SkillsUIHelpers = SkillsUIHelpers;
}