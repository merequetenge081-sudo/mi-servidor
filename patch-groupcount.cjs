const fs = require('fs');
const path = 'public/js/modules/real-data-validation.module.js';
let js = fs.readFileSync(path, 'utf8');

js = js.replace(
    "const rep = parseInt(row.votosReportadosTotales) || 0;",
    "const rep = parseInt(row.groupCount) || 0; // Usar groupCount (registros confirmados) ya que representa los votos reportados"
);

js = js.replace(
    "const repVal = parseInt(row.votosReportadosTotales) || 0;",
    "const repVal = parseInt(row.groupCount) || 0; // Usar groupCount en lugar de votosReportadosTotales vacios"
);

fs.writeFileSync(path, js, 'utf8');
console.log("Patch groupCount applied successfully.");
