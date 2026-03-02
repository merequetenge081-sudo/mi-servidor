const fs = require('fs');

// 1. UPDATE analytics.html
let html = fs.readFileSync('public/analytics.html', 'utf8');

const oldHtml = `<!-- Data Status Filter -->
                  <div class="flex items-center">
                      <label for="data-status-filter" class="mr-2 text-sm font-medium text-gray-700">Mostrar:</label>
                      <select id="data-status-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2">
                          <option value="all">Todos los datos</option>
                          <option value="confirmed">Solo datos confirmados</option>
                          <option value="unconfirmed">Solo datos sin confirmar</option>
                      </select>
                  </div>`;

const newHtml = `<!-- Data Status Filter -->
                  <div class="flex items-center">
                      <label for="data-status-filter" class="mr-2 text-sm font-medium text-gray-700">Mostrar:</label>
                      <select id="data-status-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2">
                          <option value="all">Todos los datos</option>
                          <option value="confirmed">Solo datos confirmados</option>
                          <option value="unconfirmed">Solo datos sin confirmar</option>
                      </select>
                  </div>
                  
                  <!-- Global Leader Filter -->
                  <div class="flex items-center">
                      <label for="global-leader-filter" class="mr-2 text-sm font-medium text-gray-700">Líder:</label>
                      <select id="global-leader-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2" style="max-width: 200px;">
                          <option value="">Todos los líderes</option>
                      </select>
                  </div>`;

if (html.includes('id="data-status-filter"')) {
    html = html.replace(oldHtml, newHtml);
}

// Ensure the new dropdown works in JS logic:
const fetchJsOld = `const status = dataStatusFilter.value;
                  const response = await fetch(\`/api/v2/analytics/advanced?status=\${status}\`, {`;
const fetchJsNew = `const status = dataStatusFilter.value;
                  const leaderVal = document.getElementById('global-leader-filter') ? document.getElementById('global-leader-filter').value : '';
                  const response = await fetch(\`/api/v2/analytics/advanced?status=\${status}&leaderId=\${leaderVal}\`, {`;
html = html.replace(fetchJsOld, fetchJsNew);

const initJsOld = `fetchAnalyticsData();

              // Toggle Event Listener`;
const initJsNew = `fetchAnalyticsData();

              // Initial load of leaders
              fetch('/api/leaders', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } })
                .then(r => r.json())
                .then(data => {
                    if (data && data.success && data.data) {
                        const select = document.getElementById('global-leader-filter');
                        if (select) {
                            data.data.forEach(l => {
                                const opt = document.createElement('option');
                                opt.value = l.id || l._id;
                                opt.textContent = l.name;
                                select.appendChild(opt);
                            });
                        }
                    }
                })
                .catch(err => console.error('Error fetching leaders', err));

              const globalLeaderFilter = document.getElementById('global-leader-filter');
              if (globalLeaderFilter) {
                  globalLeaderFilter.addEventListener('change', () => fetchAnalyticsData());
              }

              // Toggle Event Listener`;

html = html.replace(initJsOld, initJsNew);

// Make the top lideres analysis table text richer
const topLeadersTableOld = `return \`
                              <tr class="hover:bg-gray-50 transition-colors">
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="flex items-center">
                                          <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full \${avatarColor} text-white font-bold text-lg">
                                              \${initial}
                                          </div>
                                          <div class="ml-4">
                                              <div class="text-sm font-medium text-gray-900">\${lider.liderNombre || 'Desconocido'}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                      <div class="flex items-center justify-end">
                                          <span class="mr-2">\${lider.total}</span>
                                          <div class="w-24 bg-gray-200 rounded-full h-2">
                                              <div class="bg-indigo-600 h-2 rounded-full" style="width: \${percentage}%"></div>
                                          </div>
                                      </div>
                                  </td>
                              </tr>
                          \`;
                      }).join('');
              }
          }`;

const topLeadersTableNew = `return \`
                              <tr class="hover:bg-gray-50 transition-colors">
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="flex items-center">
                                          <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full \${avatarColor} text-white font-bold text-lg">
                                              \${initial}
                                          </div>
                                          <div class="ml-4">
                                              <div class="text-sm font-bold text-indigo-700">\${lider.liderNombre || 'Desconocido'}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                      <div class="flex flex-col items-end justify-center">
                                          <span class="text-lg text-gray-800 font-bold">\${lider.total} registros aportados</span>
                                          <div class="w-full max-w-xs mt-1 flex items-center justify-end gap-2">
                                              <div class="flex-grow bg-gray-200 rounded-full h-2.5">
                                                  <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full" style="width: \${percentage}%"></div>
                                              </div>
                                              <span class="text-xs text-indigo-600 font-bold">\${percentage}%</span>
                                          </div>
                                      </div>
                                  </td>
                              </tr>
                          \`;
                      }).join('');
              }
          }`;

html = html.replace(topLeadersTableOld, topLeadersTableNew);

fs.writeFileSync('public/analytics.html', html, 'utf8');
console.log('analytics.html updated');
