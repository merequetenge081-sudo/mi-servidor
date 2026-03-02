const fs = require('fs');

let jsCode = fs.readFileSync('public/assets/js/leaderPerformance.js', 'utf8');

// The current bad code string:
const badBlock = `    if (data.topPorLocalidad && data.topPorLocalidad.length > 0) {
        data.topPorLocalidad.forEach(loc => {
            const row = \`
                <tr class="hover:bg-indigo-50 transition-colors group cursor-default">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <span class="inline-flex items-center justify-center h-8 w-8 rounded-full \${index < 3 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'} font-bold mr-4 shadow-sm border \${index < 3 ? 'border-yellow-200' : 'border-gray-200'}">\${index + 1}</span>
                            <span class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">\${lider.leaderName || 'Desconocido'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-center">
                        <span class="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full font-medium shadow-inner">\${lider.totalRegistros}</span>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-center">
                        <span class="text-sm \${lider.errores > 0 ? 'text-red-500 font-bold bg-red-50' : 'text-gray-400'} px-2 py-1 rounded">\${lider.errores > 0 ? '<i class="fas fa-times-circle mr-1"></i>' : ''}\${lider.errores}</span>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap text-center">
                        <span class="text-base \${scoreClass} \${lider.performanceScore > 0 ? 'bg-green-50 px-3 py-1 rounded-full border border-green-200' : (lider.performanceScore < 0 ? 'bg-red-50 px-3 py-1 rounded-full border border-red-200' : 'bg-gray-50 px-3 py-1 rounded-full')} shadow-sm inline-flex items-center">
                           \${lider.performanceScore > 0 ? '<i class="fas fa-caret-up mr-1 opacity-70"></i>' : (lider.performanceScore < 0 ? '<i class="fas fa-caret-down mr-1 opacity-70"></i>' : '')} \${lider.performanceScore}
                        </span>
                    </td>
                </tr>
            \`;
            localidadBody.insertAdjacentHTML('beforeend', row);
        });`;

const goodBlock = `    if (data.topPorLocalidad && data.topPorLocalidad.length > 0) {
        data.topPorLocalidad.forEach(loc => {
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

jsCode = jsCode.replace(badBlock, goodBlock);

fs.writeFileSync('public/assets/js/leaderPerformance.js', jsCode, 'utf8');
console.log('Fixed leaderPerformance.js');
