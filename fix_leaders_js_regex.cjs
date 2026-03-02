const fs = require('fs');

let jsCode = fs.readFileSync('public/assets/js/leaderPerformance.js', 'utf8');

// The file still hasn't been fixed because the huge string replace failed (newlines and CRs mismatch).
// We'll use a regex that matches the start of data.topPorLocalidad.forEach up to the end of that block.

const badRegex = /data\.topPorLocalidad\.forEach\(loc => \{[\s\S]*?localidadBody\.insertAdjacentHTML\('beforeend', row\);\s*\}\);/;

const goodBlock = `data.topPorLocalidad.forEach(loc => {
            const row = \`
                <tr class="hover:bg-blue-50 transition-colors group">
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                            <i class="fas fa-map-pin text-blue-400 mr-2 group-hover:animate-bounce"></i>
                            <span class="text-sm font-bold text-gray-800 uppercase tracking-wide">\${loc.localidad || 'Sin Localidad'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-2 shadow-sm"><i class="fas fa-user-tie"></i></div>
                            <span class="text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">\${loc.topLeaderName || 'Desconocido'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-right">
                        <span class="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-xs border border-blue-100 shadow-sm">\${loc.maxRegistros} reg.</span>
                    </td>
                </tr>
            \`;
            localidadBody.insertAdjacentHTML('beforeend', row);
        });`;

if (badRegex.test(jsCode)) {
    jsCode = jsCode.replace(badRegex, goodBlock);
    fs.writeFileSync('public/assets/js/leaderPerformance.js', jsCode, 'utf8');
    console.log('Fixed leaderPerformance.js WITH REGEX!');
} else {
    console.log('REGEX FAILED TO MATCH');
}
