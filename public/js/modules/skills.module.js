/**
 * SKILLS MODULE
 * UI de orquestación/monitoreo de skills con backend como fuente de verdad.
 */

const SkillsModule = (() => {
    'use strict';

    const POLL_MS = 4000;
    const JOBS_LIMIT = 60;
    const RUNNING = new Set();
    const JOB_CACHE = new Map();
    let pollTimer = null;
    let initialized = false;
    let allJobs = [];
    const UI_HELPERS = (typeof window !== 'undefined' && window.SkillsUIHelpers) ? window.SkillsUIHelpers : null;

    const SKILLS = (UI_HELPERS && UI_HELPERS.SKILL_META) || {
        validation: { label: 'Revalidar', icon: 'bi-shield-check' },
        deduplication: { label: 'Deduplicar', icon: 'bi-intersect' },
        verification: { label: 'Preparar llamadas', icon: 'bi-telephone-forward' },
        scoring: { label: 'Calcular scoring', icon: 'bi-speedometer2' },
        productivity: { label: 'Productividad líderes', icon: 'bi-people' },
        analytics: { label: 'Actualizar metricas', icon: 'bi-graph-up-arrow' },
        databaseOptimization: { label: 'Optimizar BD', icon: 'bi-database-gear' },
        uiTextQuality: { label: 'Calidad de textos UI', icon: 'bi-fonts' }
    };

    function isAdmin() {
        return (AppState.user?.role || '').toLowerCase() === 'admin';
    }

    function formatDate(dateValue) {
        if (!dateValue) return '-';
        const dt = new Date(dateValue);
        if (Number.isNaN(dt.getTime())) return '-';
        return dt.toLocaleString('es-CO');
    }

    function formatDuration(start, end) {
        if (UI_HELPERS && typeof UI_HELPERS.formatDuration === 'function') {
            return UI_HELPERS.formatDuration(start, end);
        }
        if (!start) return '-';
        const a = new Date(start).getTime();
        const b = end ? new Date(end).getTime() : Date.now();
        if (Number.isNaN(a) || Number.isNaN(b) || b < a) return '-';
        const sec = Math.floor((b - a) / 1000);
        if (sec < 60) return `${sec}s`;
        const min = Math.floor(sec / 60);
        return `${min}m ${sec % 60}s`;
    }

    function statusBadge(status) {
        const map = {
            completed: '<span class="badge badge-success">Completado</span>',
            failed: '<span class="badge badge-warning">Falló</span>',
            running: '<span class="badge badge-info">Ejecutando</span>',
            pending: '<span class="badge badge-pending">Pendiente</span>'
        };
        return map[status] || `<span class="badge">${status || 'N/A'}</span>`;
    }

    function summarizeBySkill(skillName, summary, jobDetail) {
        if (UI_HELPERS && typeof UI_HELPERS.summarizeSkillOutput === 'function') {
            return UI_HELPERS.summarizeSkillOutput(skillName, summary || {}, (jobDetail?.results || []));
        }
        return '-';
    }

    function setButtonsBusy(skillName, busy) {
        const btn = document.querySelector(`.skill-run-btn[data-skill="${skillName}"]`);
        if (!btn) return;
        btn.disabled = busy;
        if (busy) {
            btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Ejecutando...';
        } else if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
        }
    }

    function getSkillPayload(skillName) {
        const eventId = AppState.user?.eventId || null;
        const base = { eventId, limit: 400 };
        if (skillName === 'analytics' || skillName === 'productivity') return { eventId };
        if (skillName === 'verification') return { eventId, limit: 250 };
        if (skillName === 'databaseOptimization' || skillName === 'uiTextQuality') return {};
        return base;
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value ?? 0);
    }

    function renderRecommendations(recommendations) {
        const container = document.getElementById('skillsRecommendations');
        if (!container) return;
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
            container.innerHTML = '<span class="badge badge-success">Sin acciones recomendadas por ahora</span>';
            return;
        }
        container.innerHTML = recommendations.map((rec) => {
            const cls = rec.level === 'warning' ? 'badge-warning' : 'badge-info';
            const label = SKILLS[rec.skill]?.label || rec.skill;
            return `<span class="badge ${cls}" title="${(rec.message || '').replace(/"/g, '&quot;')}">${label}: ${rec.message}</span>`;
        }).join('');
    }

    function renderHealth(data) {
        const totals = data?.totals || {};
        setText('healthValid', totals.totalValid || 0);
        setText('healthInvalid', totals.totalInvalid || 0);
        setText('healthDuplicate', totals.totalDuplicate || 0);
        setText('healthFlags', totals.totalWithFlags || 0);
        setText('healthPendingCall', totals.totalPendingCall || 0);
        setText('healthConfirmed', totals.totalConfirmed || 0);
        setText('healthMismatch', totals.mismatches || 0);
        setText('healthOrphan', totals.orphanRecords || 0);
        renderRecommendations(data?.recommendations || []);
    }

    function formatJobContext(job) {
        const payload = job?.payload || {};
        const parts = [];
        if (payload.eventId) parts.push(`event:${payload.eventId}`);
        if (payload.campaignId) parts.push(`campaign:${payload.campaignId}`);
        if (payload.leaderId) parts.push(`leader:${payload.leaderId}`);
        if (payload.limit) parts.push(`limit:${payload.limit}`);
        return parts.length > 0 ? parts.join(' | ') : '-';
    }

    function getJobFilters() {
        const skill = document.getElementById('skillsFilterSkill')?.value || '';
        const status = document.getElementById('skillsFilterStatus')?.value || '';
        return { skill, status };
    }

    function applyJobsFilters(jobs) {
        const { skill, status } = getJobFilters();
        return [...jobs]
            .filter((j) => (skill ? j.skillName === skill : true))
            .filter((j) => (status ? j.status === status : true))
            .sort((a, b) => new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime());
    }

    async function runSkill(skillName) {
        if (!isAdmin() || RUNNING.has(skillName)) return;
        RUNNING.add(skillName);
        setButtonsBusy(skillName, true);
        try {
            const result = await DataService.runSkillJob(skillName, getSkillPayload(skillName));
            if (result.jobId) {
                JOB_CACHE.set(result.jobId, { output: result.output || null });
                await refreshJobs();
                startPolling();
            }
            if (typeof DashboardModule !== 'undefined' && DashboardModule.refresh) {
                await DashboardModule.refresh();
            }
            if (typeof ModalsModule !== 'undefined' && ModalsModule.showAlert) {
                await ModalsModule.showAlert(`Job de ${SKILLS[skillName]?.label || skillName} lanzado correctamente.`, 'success');
            }
        } catch (error) {
            console.error('[SkillsModule] Error ejecutando skill', skillName, error);
            if (typeof ModalsModule !== 'undefined' && ModalsModule.showAlert) {
                await ModalsModule.showAlert(error.message || 'Error lanzando job', 'error');
            }
        } finally {
            RUNNING.delete(skillName);
            setButtonsBusy(skillName, false);
        }
    }

    async function openJobDetail(jobId) {
        try {
            const detail = await DataService.getSkillJob(jobId);
            const cached = JOB_CACHE.get(jobId) || {};
            JOB_CACHE.set(jobId, { ...cached, detail, output: cached.output || detail.resultSummary || null });

            const modal = document.getElementById('skillsJobDetailModal');
            const content = document.getElementById('skillsJobDetailContent');
            if (!modal || !content) return;

            const summary = detail.resultSummary || cached.output || {};
            const warnings = (detail.results || []).filter((r) => r.status === 'warning');
            const errors = (detail.results || []).filter((r) => r.status === 'error');
            const text = [
                `Skill: ${detail.skillName || '-'}`,
                `Estado: ${detail.status || '-'}`,
                `Lanzado por: ${detail.createdBy || '-'}`,
                `Inicio: ${formatDate(detail.startedAt || detail.createdAt)}`,
                `Fin: ${formatDate(detail.finishedAt)}`,
                `Duración: ${formatDuration(detail.startedAt || detail.createdAt, detail.finishedAt)}`,
                `Payload:`,
                JSON.stringify(detail.payload || {}, null, 2),
                ``,
                `Resumen:`,
                JSON.stringify(summary || {}, null, 2),
                ``,
                `Warnings (${warnings.length}):`,
                JSON.stringify(warnings.slice(0, 20), null, 2),
                ``,
                `Errores (${errors.length}):`,
                JSON.stringify(errors.slice(0, 20), null, 2),
                detail.error ? `\nError final:\n${detail.error}` : ''
            ].join('\n');
            content.textContent = text;
            modal.classList.add('active');
        } catch (error) {
            console.error('[SkillsModule] Error cargando detalle de job', error);
            if (typeof ModalsModule !== 'undefined' && ModalsModule.showAlert) {
                await ModalsModule.showAlert(error.message || 'No se pudo cargar detalle', 'error');
            }
        }
    }

    function renderJobs(jobs) {
        const tbody = document.getElementById('skillsJobsTableBody');
        if (!tbody) return;
        const filtered = applyJobsFilters(jobs || []);
        if (!Array.isArray(filtered) || filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin jobs recientes</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map((job) => {
            const skillMeta = SKILLS[job.skillName] || { label: job.skillName || 'N/A', icon: 'bi-gear' };
            const cached = JOB_CACHE.get(String(job._id)) || {};
            const summary = summarizeBySkill(job.skillName, job.resultSummary || cached.output || {}, cached.detail || null);
            const activeDot = job.status === 'running' || job.status === 'pending'
                ? '<span title="Job activo" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:6px;"></span>'
                : '';
            return `
                <tr>
                    <td>${activeDot}${statusBadge(job.status)}</td>
                    <td><i class="bi ${skillMeta.icon}"></i> ${skillMeta.label}</td>
                    <td>${job.createdBy || '-'}</td>
                    <td>${formatDate(job.startedAt || job.createdAt)}<br><small style="opacity:0.7">${formatJobContext(job)}</small></td>
                    <td>${formatDuration(job.startedAt || job.createdAt, job.finishedAt)}</td>
                    <td title="${(job.error || summary || '').replace(/"/g, '&quot;')}">${job.status === 'failed' ? (job.error || 'Error') : summary}</td>
                    <td><button class="btn btn-sm btn-outline" data-job-detail="${job._id}">Ver</button></td>
                </tr>
            `;
        }).join('');
    }

    function renderInconsistencies(rows) {
        const tbody = document.getElementById('skillsInconsistenciesTableBody');
        if (!tbody) return;
        if (!Array.isArray(rows) || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin inconsistencias abiertas</td></tr>';
            return;
        }

        tbody.innerHTML = rows.map((row) => `
            <tr>
                <td>${row.type || '-'}</td>
                <td>${row.fullName || '-'}<br><small>${row.affectedRecord || '-'}</small></td>
                <td>${row.leader || '-'}</td>
                <td>${row.localidad || '-'} / ${row.puesto || '-'}</td>
                <td>${statusBadge(row.status || 'open')}</td>
                <td>${formatDate(row.createdAt)}</td>
                <td>${row.registrationId ? `<button class="btn btn-sm btn-outline" data-review-registration="${row.registrationId}">Revisar</button>` : '-'}</td>
            </tr>
        `).join('');
    }

    async function refreshHealth() {
        try {
            const health = await DataService.getSkillsHealth();
            renderHealth(health);
        } catch (error) {
            console.error('[SkillsModule] Error refreshHealth', error);
        }
    }

    async function refreshInconsistencies() {
        try {
            const rows = await DataService.getSkillsInconsistencies({ status: 'open', limit: 80 });
            renderInconsistencies(rows);
        } catch (error) {
            console.error('[SkillsModule] Error refreshInconsistencies', error);
        }
    }

    async function refreshJobs() {
        if (!isAdmin()) return;
        const tbody = document.getElementById('skillsJobsTableBody');
        if (tbody && !tbody.dataset.loading) tbody.dataset.loading = 'true';
        try {
            allJobs = await DataService.getSkillJobs(JOBS_LIMIT);
            renderJobs(allJobs);
            const hasRunning = allJobs.some((j) => j.status === 'running' || j.status === 'pending');
            if (!hasRunning) stopPolling();
        } catch (error) {
            console.error('[SkillsModule] Error refreshJobs', error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Error cargando jobs: ${error.message}</td></tr>`;
        } finally {
            if (tbody) delete tbody.dataset.loading;
        }
    }

    function bindPanelEvents() {
        const refreshBtn = document.getElementById('skillsRefreshJobsBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', async () => {
            await refreshHealth();
            await refreshJobs();
            await refreshInconsistencies();
            if (typeof DashboardModule !== 'undefined' && DashboardModule.refresh) {
                await DashboardModule.refresh();
            }
        });

        document.querySelectorAll('.skill-run-btn[data-skill]').forEach((btn) => {
            if (btn.dataset.bound === 'true') return;
            btn.dataset.bound = 'true';
            btn.addEventListener('click', async () => {
                await runSkill(btn.dataset.skill);
                await refreshHealth();
                await refreshInconsistencies();
            });
        });

        const tbody = document.getElementById('skillsJobsTableBody');
        if (tbody && tbody.dataset.bound !== 'true') {
            tbody.dataset.bound = 'true';
            tbody.addEventListener('click', (e) => {
                const detailBtn = e.target.closest('[data-job-detail]');
                if (detailBtn) openJobDetail(detailBtn.dataset.jobDetail);
            });
        }

        const incTbody = document.getElementById('skillsInconsistenciesTableBody');
        if (incTbody && incTbody.dataset.bound !== 'true') {
            incTbody.dataset.bound = 'true';
            incTbody.addEventListener('click', (e) => {
                const reviewBtn = e.target.closest('[data-review-registration]');
                if (reviewBtn) {
                    Router.navigate('registrations');
                }
            });
        }

        ['skillsFilterSkill', 'skillsFilterStatus'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el || el.dataset.bound === 'true') return;
            el.dataset.bound = 'true';
            el.addEventListener('change', () => renderJobs(allJobs));
        });
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(async () => {
            if (AppState.getUI('currentSection') !== 'dashboard') return;
            await refreshJobs();
            await refreshHealth();
        }, POLL_MS);
    }

    function stopPolling() {
        if (!pollTimer) return;
        clearInterval(pollTimer);
        pollTimer = null;
    }

    async function init() {
        if (initialized) return;
        initialized = true;
        const panel = document.getElementById('skillsPanelContainer');
        if (!panel) return;
        if (!isAdmin()) {
            panel.style.display = 'none';
            return;
        }

        bindPanelEvents();
        await refreshHealth();
        await refreshJobs();
        await refreshInconsistencies();
        startPolling();
        console.log('[SkillsModule] Inicializado');
    }

    return {
        init,
        refreshJobs,
        runSkill,
        refreshHealth,
        refreshInconsistencies
    };
})();

if (typeof window !== 'undefined') window.SkillsModule = SkillsModule;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SkillsModule.init);
} else {
    SkillsModule.init();
}
