const fs = require('fs');
const path = 'public/js/modules/real-data-validation.module.js';
let js = fs.readFileSync(path, 'utf8');

const targetLogic = `let E14Display = '--';
                let currentEvState = row.estado;
                
                if (e14Val !== null && e14Val !== undefined && e14Val !== '') {
                    e14Val = parseInt(e14Val);
                    E14Display = e14Val;
                    
                    let d = e14Val - repVal;
                    diffHtml = d === 0 ? '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-emerald-600" style="color:#059669; font-size:0.7rem; font-weight:600;">Exacto</div>' : 
                                      '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-red-600" style="color:#dc2626; font-size:0.7rem; font-weight:600;">Δ ' + (d > 0 ? '+'+d : d) + '</div>';
                } else {
                    if (repVal === 0) currentEvState = 'sin_votos';
                    else currentEvState = 'pendiente_e14';
                }`;

const newLogic = `let E14Display = '--';
                let currentEvState = row.estado;
                
                // Recalcular estado segun repVal (groupCount) para ignorar el false flag del backend de 'sin_votos_reportados'
                if (e14Val !== null && e14Val !== undefined && e14Val !== '') {
                    e14Val = parseInt(e14Val);
                    E14Display = e14Val;
                    
                    let d = e14Val - repVal;
                    diffHtml = d === 0 ? '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-emerald-600" style="color:#059669; font-size:0.7rem; font-weight:600;">Exacto</div>' : 
                                      '<div class="tw-text-xs tw-mt-0.5 tw-font-medium tw-text-red-600" style="color:#dc2626; font-size:0.7rem; font-weight:600;">Δ ' + (d > 0 ? '+'+d : d) + '</div>';
                    
                    if (repVal === 0) {
                        currentEvState = 'sin_votos_reportados';
                    } else if (d === 0) {
                        currentEvState = 'confirmado';
                    } else if (Math.abs(d) <= 5) {
                        currentEvState = 'confirmacion_alta';
                    } else {
                        currentEvState = 'diferencia_alta';
                    }
                } else {
                    if (repVal === 0) currentEvState = 'sin_votos';
                    else currentEvState = 'pendiente_e14';
                }`;

if (js.includes("let d = e14Val - repVal;")) {
    js = js.replace(targetLogic, newLogic);
    fs.writeFileSync(path, js, 'utf8');
    console.log("State badge calculation overriden successfully.");
} else {
    // If exact literal mismatch, we do a regex or simpler replace
    console.log("Could not find block. Attempting fallback.");
    let idx = js.indexOf("let E14Display = '--';");
    if (idx > 0) {
        let before = js.substring(0, idx);
        let endIdx = js.indexOf("let conf = parseFloat", idx);
        if (endIdx > 0) {
             let after = js.substring(endIdx);
             js = before + newLogic + "\n\n                " + after;
             fs.writeFileSync(path, js, 'utf8');
             console.log("Fallback state badge patch successful.");
        }
    }
}
