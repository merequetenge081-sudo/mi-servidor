const fs = require('fs');

let html = fs.readFileSync('public/analytics.html', 'utf8');

// 1. Upgrade the table HTML structure in Top Líderes card:
const oldTableHead = `<table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Líder</th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Votos Aportados</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="leaders-table-body">`;

const newTableHead = `<table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th scope="col" class="px-6 py-3 text-left text-xs font-black text-gray-600 uppercase tracking-wider">Líder</th>
                                    <th scope="col" class="px-6 py-3 text-right text-xs font-black text-gray-600 uppercase tracking-wider">Volumen y Progreso</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="leaders-table-body">`;

html = html.replace(/<table class="min-w-full divide-y divide-gray-200">[\s\S]*?<tbody class="bg-white divide-y divide-gray-200"\s+id="leaders-table-body">/, newTableHead);


// 2. Upgrade renderLeadersTable function
const oldRenderJs = `filteredData.slice(0, 20).forEach(lider => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`
                    <td class="px-6 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                \${lider.liderNombre ? lider.liderNombre.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900">\${lider.liderNombre || 'Desconocido'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                        \${lider.totalVotos}
                    </td>
                \`;
                tbody.appendChild(tr);
            });`;

const newRenderJs = `const maxVotos = filteredData.length > 0 ? Math.max(...filteredData.map(l => l.totalVotos)) : 1;
            
            filteredData.slice(0, 20).forEach(lider => {
                const percentage = Math.round((lider.totalVotos / maxVotos) * 100);
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-indigo-50 transition-colors group cursor-default';
                tr.innerHTML = \`
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg shadow-sm group-hover:shadow-md transition-shadow">
                                \${lider.liderNombre ? lider.liderNombre.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">\${lider.liderNombre || 'Desconocido'}</div>
                                <div class="text-xs text-gray-500">Rendimiento Destacado</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <div class="flex flex-col items-end justify-center">
                            <div class="text-sm font-bold text-gray-900 flex items-center mb-1">
                                <i class="fas fa-users text-indigo-400 mr-2"></i>
                                \${lider.totalVotos} <span class="text-xs font-normal text-gray-500 ml-1">aportes</span>
                            </div>
                            <div class="w-full max-w-[12rem] flex items-center justify-end space-x-2">
                                <div class="flex-grow bg-gray-200 rounded-full h-2 shadow-inner">
                                    <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full" style="width: \${percentage}%"></div>
                                </div>
                                <span class="text-xs font-bold text-indigo-600 w-8 text-right">\${percentage}%</span>
                            </div>
                        </div>
                    </td>
                \`;
                tbody.appendChild(tr);
            });`;

html = html.replace(/filteredData\.slice\(0, 20\)\.forEach\(lider => \{[\s\S]*?tbody\.appendChild\(tr\);\s*\}\);/, newRenderJs);

fs.writeFileSync('public/analytics.html', html, 'utf8');
console.log('patched real analytics.html');
