const fs = require('fs');
const path = 'public/js/modules/real-data-validation.module.js';
let js = fs.readFileSync(path, 'utf8');

const targetFunction = 'function renderRows(items = []) {';
const rsStart = js.indexOf(targetFunction);

// find where it ends
const endStr = "}).join('');\n    }";
const rsEnd = js.indexOf(endStr, rsStart);

if (rsStart === -1 || rsEnd === -1) {
    console.log("Could not find boundaries of renderRows. Trying second strategy.");
}

const newRenderRows = `function renderRows(items = []) {
    const tbody = document.getElementById('rdvTableBody');
    if (!tbody) return;
    
    rowsByKey = new Map();
    items.forEach(row => rowsByKey.set(String(row.mesaKey), row));
    currentRows = Array.isArray(items) ? [...items] : [];

    if (!Array.isArray(items) || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="tw-text-center tw-py-8 tw-text-slate-500" style="text-align:center; padding:2rem;">No hay mesas</td></tr>';
        return;
    }

    // 1. Agrupar jerarquicamente: Localidad -> Puesto -> Mesa
    const tree = {};
    items.forEach((row, index) => {
        const loc = row.localidad || 'Sin Localidad';
        const puesto = row.puesto || 'Sin Puesto';
        
        if (!tree[loc]) tree[loc] = { name: loc, tipo: 'localidad', votosReportados: 0, votosE14: 0, children: {}, totalMesas: 0, confirmadas: 0, allNoData: true };
        if (!tree[loc].children[puesto]) tree[loc].children[puesto] = { name: puesto, tipo: 'puesto', votosReportados: 0, votosE14: 0, children: [], totalMesas: 0, confirmadas: 0, allNoData: true };
        
        row._originalIndex = index; // Referencia nativa para botones 'Abrir/Detalle'
        tree[loc].children[puesto].children.push(row);
        
        // Sumar votos validando Reglas
        const rep = parseInt(row.votosReportadosTotales) || 0;
        let e14 = row.votosE14Candidate105 ?? row.votosE14SuggestedCandidate105;
        e14 = e14 !== null && e14 !== undefined && e14 !== '' ? parseInt(e14) : null;
        
        tree[loc].votosReportados += rep;
        tree[loc].children[puesto].votosReportados += rep;
        
        if (e14 !== null) {
            tree[loc].votosE14 += e14;
            tree[loc].children[puesto].votosE14 += e14;
            tree[loc].allNoData = false;
            tree[loc].children[puesto].allNoData = false;
        }
        
        tree[loc].totalMesas++;
        tree[loc].children[puesto].totalMesas++;
        
        if (row.estado === 'confirmado') {
            tree[loc].confirmadas++;
            tree[loc].children[puesto].confirmadas++;
        }
    });

    window.toggleRow = function(id) {
        const els = document.querySelectorAll('.' + id);
        const icon = document.getElementById('icon-' + id);
        let isExpanded = false;
        
        els.forEach(el => {
            if (el.style.display === 'none') {
                // Expanding
                el.style.display = 'table-row';
                isExpanded = true;
            } else {
                // Collapsing
                el.style.display = 'none';
                isExpanded = false;
                // Si estoy contrayendo un padre (Localidad), contraigo sus sub-hijos (Mesas) tambien
                if (el.classList.contains('puesto-row')) {
                   const childId = el.getAttribute('data-puesto-id');
                   const childEls = document.querySelectorAll('.' + childId);
                   const childIcon = document.getElementById('icon-' + childId);
                   childEls.forEach(c => c.style.display = 'none');
                   if (childIcon) {
                        childIcon.classList.remove('bi-chevron-down');
                        childIcon.classList.add('bi-chevron-right');
                   }
                }
            }
        });
        
        if (icon) {
             icon.classList.remove(isExpanded ? 'bi-chevron-right' : 'bi-chevron-down');
             icon.classList.add(isExpanded ? 'bi-chevron-down' : 'bi-chevron-right');
        }
    };

    let html = '';
    let locIndex = 0;
    
    Object.keys(tree).sort().forEach(locName => {
        const loc = tree[locName];
        const locId = 'loc-' + locIndex++;
        const pctLoc = loc.totalMesas > 0 ? Math.round((loc.confirmadas / loc.totalMesas) * 100) : 0;
        
        let locE14Display = loc.allNoData ? '--' : loc.votosE14;
        
        html += '<tr class="hover:tw-bg-slate-50 tw-cursor-pointer" style="border-top:2px solid #e2e8f0; background:#f8fafc;" onclick="toggleRow(\\''+locId+'\\')">' +
            '<td class="tw-px-6 tw-py-3" style="padding:0.75rem 1.5rem;">' +
                '<div class="tw-flex tw-items-center tw-gap-2" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; color:#0f172a; font-size:0.875rem;">' +
                    '<button class="tw-p-1 tw-rounded hover:tw-bg-slate-200 tw-text-slate-500" style="background:none; border:none; padding:0.25rem;"><i id="icon-'+locId+'" class="bi bi-chevron-right"></i></button>' +
                    escapeHtml(locName) + ' <span style="color:#64748b; font-weight:normal; font-size:0.75rem;">(' + loc.totalMesas + ' mesas)</span>' +
                '</div>' +
            '</td>' +
            '<td class="tw-px-6 tw-py-3 tw-text-right" style="padding:0.75rem 1.5rem; text-align:right; font-weight:600;">' +
                loc.votosReportados + ' <span class="tw-text-slate-400" style="font-weight:normal; color:#94a3b8;">vs</span> ' + locE14Display +
            '</td>' +
            '<td class="tw-px-6 tw-py-3" style="padding:0.75rem 1.5rem;">' +
                '<div class="tw-flex tw-items-center tw-gap-2" style="display:flex; align-items:center; gap:0.5rem;">' +
                    '<div class="tw-w-20 tw-h-2 tw-bg-slate-200 tw-rounded-full" style="width:4rem; height:0.375rem; background:#e2e8f0; border-radius:999px; overflow:hidden;"><div style="width: ' + pctLoc + '%; height:100%; background:#6366f1;"></div></div>' +
                    '<span class="tw-text-xs tw-font-bold" style="font-size:0.75rem;">' + pctLoc + '%</span>' +
                '</div>' +
            '</td>' +
            '<td class="tw-px-6 tw-py-3" style="padding:0.75rem 1.5rem;"></td>' +
            '<td class="tw-px-6 tw-py-3" style="padding:0.75rem 1.5rem;"></td>' +
            '<td class="tw-px-6 tw-py-3" style="padding:0.75rem 1.5rem;"></td>' +
        '</tr>';
        
        let puestoIndex = 0;
        Object.keys(loc.children).sort().forEach(puestoName => {
            const puesto = loc.children[puestoName];
            const puestoId = locId + '-p' + puestoIndex++;
            const pctPuesto = puesto.totalMesas > 0 ? Math.round((puesto.confirmadas / puesto.totalMesas) * 100) : 0;
            
            let puestoE14Display = puesto.allNoData ? '--' : puesto.votosE14;
            
            html += '<tr class="'+locId+' puesto-row tw-cursor-pointer" data-puesto-id="'+puestoId+'" style="display:none; border-top:1px solid #f1f5f9; background:#fff;" onclick="toggleRow(\\''+puestoId+'\\')">' +
                '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem; padding-left:3.5rem;">' +
                    '<div class="tw-flex tw-items-center tw-gap-2" style="display:flex; align-items:center; gap:0.5rem; font-weight:600; color:#334155; font-size:0.875rem;">' +
                        '<button class="tw-p-1 tw-rounded hover:tw-bg-slate-100 tw-text-slate-400" style="background:none; border:none; padding:0.25rem;"><i id="icon-'+puestoId+'" class="bi bi-chevron-right"></i></button>' +
                        escapeHtml(puestoName) +
                    '</div>' +
                '</td>' +
                '<td class="tw-px-6 tw-py-2 tw-text-right" style="padding:0.5rem 1.5rem; text-align:right; font-weight:500;">' +
                    puesto.votosReportados + ' <span class="tw-text-slate-400" style="font-weight:normal; color:#94a3b8;">vs</span> ' + puestoE14Display +
                '</td>' +
                '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;">' +
                     '<div class="tw-flex tw-items-center tw-gap-2" style="display:flex; align-items:center; gap:0.5rem;">' +
                        '<div class="tw-w-20 tw-h-2 tw-bg-slate-100 tw-rounded-full" style="width:4rem; height:0.375rem; background:#f1f5f9; border-radius:999px; overflow:hidden;"><div style="width: ' + pctPuesto + '%; height:100%; background:#818cf8;"></div></div>' +
                        '<span class="tw-text-xs tw-font-bold tw-text-slate-600" style="color:#475569; font-size:0.75rem;">' + pctPuesto + '%</span>' +
                    '</div>' +
                '</td>' +
                '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;"></td>' +
                '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;"></td>' +
                '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;"></td>' +
            '</tr>';
            
            // 3. Mesas
            puesto.children.forEach(row => {
                const sourceFile = toReadableText(row.sourceArchivo, 'Sin OCR');
                const sourceUrl = row?.sourceDocumento ? escapeHtml(row.sourceDocumento) : '';
                
                let pct = parseFloat(row.confirmacionPorcentaje) || 0;
                let barColor = pct === 100 ? '#10b981' : (pct > 0 ? '#f59e0b' : '#cbd5e1');
                
                let diffHtml = '';
                
                const repVal = parseInt(row.votosReportadosTotales) || 0;
                let e14Val = row.votosE14Candidate105 ?? row.votosE14SuggestedCandidate105;
                let E14Display = '--';
                let currentEvState = row.estado;
                
                if (e14Val !== null && e14Val !== undefined && e14Val !== '') {
                    e14Val = parseInt(e14Val);
                    E14Display = e14Val;
                    
                    if (row.diferencia !== null && row.diferencia !== undefined) {
                        let d = parseInt(row.diferencia);
                        diffHtml = d === 0 ? '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-emerald-600" style="color:#059669; font-size:0.7rem; font-weight:600;">Exacto</div>' : 
                                          '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-red-600" style="color:#dc2626; font-size:0.7rem; font-weight:600;">Δ ' + (d > 0 ? '+'+d : d) + '</div>';
                    }
                } else {
                    if (repVal === 0) currentEvState = 'sin_votos';
                    else currentEvState = 'pendiente_e14';
                }

                let conf = parseFloat(row.sourceConfidence) || 0;
                let ocrHtml = sourceFile !== 'Sin OCR' ? 
                    '<div class="tw-flex tw-items-center tw-gap-1 tw-border tw-border-slate-200 tw-px-2 tw-py-1 tw-rounded tw-w-max tw-bg-white" style="display:inline-flex; align-items:center; gap:0.25rem; border:1px solid #e2e8f0; padding:0.125rem 0.375rem; border-radius:0.25rem; background:#fff;">' +
                        (conf >= 80 ? '<i class="bi bi-check-circle-fill tw-text-emerald-500" style="color:#10b981; font-size:0.75rem;"></i>' : '<i class="bi bi-exclamation-circle-fill tw-text-amber-500" style="color:#f59e0b; font-size:0.75rem;"></i>') +
                        '<span class="tw-text-[10px] tw-font-bold" style="font-size:0.65rem; font-weight:bold;">' + conf + '%</span>' +
                        '<span class="tw-text-[9px] tw-text-slate-500" style="font-size:0.6rem; color:#64748b; max-width:60px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="'+escapeHtml(sourceFile)+'">' + escapeHtml(sourceFile) + '</span>' +
                    '</div>' : '<span class="tw-text-[10px] tw-text-slate-400" style="font-size:0.65rem; color:#94a3b8; font-weight:500;">SIN OCR</span>';

                let badgeBg = '#f1f5f9'; let badgeText = '#475569'; let badgeBorder = '#e2e8f0'; let badgeLabel = escapeHtml(toReadableText(currentEvState, 'Sin procesar'));
                
                if (currentEvState === 'confirmado') { badgeBg = '#ecfdf5'; badgeText = '#047857'; badgeBorder = '#a7f3d0'; }
                else if (currentEvState === 'sin_votos') { badgeBg = '#f1f5f9'; badgeText = '#475569'; badgeBorder = '#e2e8f0'; badgeLabel = "SIN VOTOS"; }
                else if (currentEvState === 'pendiente_e14') { badgeBg = '#fffbeb'; badgeText = '#b45309'; badgeBorder = '#fde68a'; badgeLabel = "PENDIENTE E14"; }
                else if (currentEvState && currentEvState.includes('diferencia')) { badgeBg = '#fef2f2'; badgeText = '#b91c1c'; badgeBorder = '#fecaca'; }
                else if (currentEvState && currentEvState.includes('alta')) { badgeBg = '#eff6ff'; badgeText = '#4338ca'; badgeBorder = '#c7d2fe'; }

                let buttonsHtml = '';
                if (row?.sourceDocumento) {
                    buttonsHtml += '<a class="tw-p-1 tw-text-slate-400 hover:tw-text-slate-900 hover:tw-bg-slate-100 tw-rounded rdv-mesa-btn" style="padding:0.25rem; color:#94a3b8; border-radius:0.25rem;" href="'+sourceUrl+'" target="_blank" title="Ver PDF"><i class="bi bi-file-earmark-pdf"></i></a>';
                } else {
                    buttonsHtml += '<button class="tw-p-1 tw-text-slate-400 hover:tw-text-slate-900 hover:tw-bg-slate-100 tw-rounded rdv-mesa-btn" style="padding:0.25rem; color:#94a3b8; border-radius:0.25rem; background:none; border:none; cursor:pointer;" data-action="open-e14" data-index="'+row._originalIndex+'" title="Abrir E14"><i class="bi bi-link"></i></button>';
                }
                
                buttonsHtml += '<button class="tw-p-1 tw-text-slate-400 hover:tw-text-slate-900 hover:tw-bg-slate-100 tw-rounded rdv-mesa-btn" style="padding:0.25rem; color:#94a3b8; border-radius:0.25rem; background:none; border:none; cursor:pointer;" data-action="copy-hint" data-index="'+row._originalIndex+'" title="Copiar Ref"><i class="bi bi-clipboard"></i></button>';
                buttonsHtml += '<button class="tw-p-1 tw-text-indigo-600 hover:tw-text-indigo-900 tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded tw-font-medium rdv-mesa-btn" style="padding:0.25rem 0.5rem; color:#4f46e5; border-radius:0.25rem; background:#eef2ff; border:none; cursor:pointer; font-weight:500;" data-action="manual" data-index="'+row._originalIndex+'" title="Ver Detalle"><i class="bi bi-eye"></i></button>';

                html += '<tr class="'+puestoId+' '+locId+' tw-group" style="display:none; transition:background 0.2s; border-top:1px solid #f8fafc; background:#fafafa;">' +
                    '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem; padding-left:5.5rem;">' +
                        '<div class="tw-flex tw-items-center tw-text-sm" style="display:flex; align-items:center; gap:0.5rem;">' +
                            '<span class="tw-text-slate-300" style="color:#cbd5e1;">↳</span>' +
                            '<span class="tw-font-medium tw-text-slate-600" style="color:#475569; font-weight:500; font-size:0.875rem;">Mesa ' + escapeHtml(toReadableText(row.mesa, '-')) + '</span>' +
                        '</div>' +
                    '</td>' +
                    '<td class="tw-px-6 tw-py-2 tw-text-right" style="padding:0.5rem 1.5rem; text-align:right;">' +
                        '<div class="tw-font-medium" style="font-weight:500; font-size:0.875rem;">' + repVal + ' <span class="tw-text-slate-400" style="font-weight:normal; color:#94a3b8; font-size:0.75rem;">vs</span> ' + E14Display + '</div>' +
                        diffHtml +
                    '</td>' +
                    '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;">' +
                        '<div class="tw-flex tw-items-center tw-gap-2" style="display:flex; align-items:center; gap:0.5rem;">' +
                            '<div class="tw-w-16 tw-h-1.5 tw-bg-slate-100 tw-rounded-full" style="width:4rem; height:0.375rem; background:#f1f5f9; border-radius:999px; overflow:hidden;"><div style="width: ' + pct + '%; height:100%; background:' + barColor + ';"></div></div>' +
                            '<span class="tw-text-xs tw-font-bold tw-text-slate-600" style="font-size:0.7rem; font-weight:bold; color:#475569;">' + pct + '%</span>' +
                        '</div>' +
                    '</td>' +
                    '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;">' +
                        '<span class="tw-px-2 tw-py-0.5 tw-text-[9px] tw-font-bold tw-uppercase tw-rounded tw-border" style="padding:0.125rem 0.375rem; font-size:9px; font-weight:bold; text-transform:uppercase; border-radius:0.25rem; background:'+badgeBg+'; color:'+badgeText+'; border:1px solid '+badgeBorder+';">' + badgeLabel + '</span>' +
                    '</td>' +
                    '<td class="tw-px-6 tw-py-2" style="padding:0.5rem 1.5rem;">' + ocrHtml + '</td>' +
                    '<td class="tw-px-6 tw-py-2 tw-text-right" style="padding:0.5rem 1.5rem; text-align:right;">' +
                        '<div class="tw-flex tw-items-center tw-justify-end tw-gap-1 rdv-actions-container" style="display:flex; justify-content:flex-end; gap:0.25rem; opacity:0; transition:opacity 0.2s;">' +
                           buttonsHtml +
                        '</div>' +
                    '</td>' +
                '</tr>';
            });
        });
    });

    tbody.innerHTML = html;
    
    // Fix logic for hovering on rows injecting vanilla JS listeners since Tailwind group-hover could fail injected inline 
    setTimeout(() => {
        const rows = tbody.querySelectorAll('tr.tw-group');
        rows.forEach(tr => {
            tr.addEventListener('mouseenter', function() {
                const actions = this.querySelector('.rdv-actions-container');
                if(actions) actions.style.opacity = '1';
                this.style.backgroundColor = '#f1f5f9';
            });
            tr.addEventListener('mouseleave', function() {
                const actions = this.querySelector('.rdv-actions-container');
                if(actions) actions.style.opacity = '0';
                this.style.backgroundColor = this.classList.contains('puesto-row') ? '#fff' : '#fafafa';
            });
        });
    }, 50);
}`;

if (rsStart > -1 && rsEnd > -1) {
    js = js.substring(0, rsStart) + newRenderRows + js.substring(rsEnd + endStr.length);
    fs.writeFileSync(path, js, 'utf8');
    console.log("Tree table patch applied successfully.");
} else if (rsStart > -1) {
    console.log("Could not find end of renderRows function.");
}
