const fs = require('fs');
const path = 'public/js/modules/real-data-validation.module.js';
let js = fs.readFileSync(path, 'utf8');

// Replacements for the reported votes
js = js.replace(
    /const rep = parseInt\(row\.votosReportadosTotales\) \|\| 0;/g,
    "const rep = parseInt(row.groupCount) || 0;"
);

js = js.replace(
    /const repVal = parseInt\(row\.votosReportadosTotales\) \|\| 0;/g,
    "const repVal = parseInt(row.groupCount) || 0;"
);

// Replacement to dynamically calculate delta using row.groupCount
const oldDeltaLogic = `if (row.diferencia !== null && row.diferencia !== undefined) {
                        let d = parseInt(row.diferencia);
                        diffHtml = d === 0 ? '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-emerald-600" style="color:#059669; font-size:0.7rem; font-weight:600;">Exacto</div>' : 
                                          '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-red-600" style="color:#dc2626; font-size:0.7rem; font-weight:600;">Δ ' + (d > 0 ? '+'+d : d) + '</div>';
                    }`;

const newDeltaLogic = `let d = e14Val - repVal;
                    diffHtml = d === 0 ? '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-emerald-600" style="color:#059669; font-size:0.7rem; font-weight:600;">Exacto</div>' : 
                                      '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-red-600" style="color:#dc2626; font-size:0.7rem; font-weight:600;">Δ ' + (d > 0 ? '+'+d : d) + '</div>';`;

if (js.includes('row.diferencia !== null')) {
    js = js.replace(oldDeltaLogic, newDeltaLogic);
    
    // update parent nodes diferencia formatting to make it correct? Wait, parent nodes don't show delta, they just show "14 vs 12".
    // That's fine.

    fs.writeFileSync(path, js, 'utf8');
    console.log("Patch groupCount and dynamic delta applied successfully.");
} else {
    // maybe spaces were formatted differently
    console.log("Could not find delta logic exact literal.");
}
