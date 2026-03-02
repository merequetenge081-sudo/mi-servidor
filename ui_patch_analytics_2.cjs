const fs = require('fs');

let html = fs.readFileSync('public/analytics.html', 'utf8');

// Replacement 1: Add HTML Filter Next to "Data Status Filter"
const headerHtmlOld = `                <!-- Data Status Filter -->
                <div class="flex items-center">
                    <label for="data-status-filter" class="mr-2 text-sm font-medium text-gray-700">Mostrar:</label>
                    <select id="data-status-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2">
                        <option value="all">Todos los datos</option>
                        <option value="confirmed">Solo datos confirmados</option>
                        <option value="unconfirmed">Solo datos sin confirmar</option>
                    </select>
                </div>`;

const headerHtmlNew = `                <!-- Data Status Filter -->
                <div class="flex items-center">
                    <label for="data-status-filter" class="mr-2 text-sm font-medium text-gray-700">Mostrar:</label>
                    <select id="data-status-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm border focus:ring-indigo-500 focus:border-indigo-500 block p-2">
                        <option value="all">Todos los datos</option>
                        <option value="confirmed">Solo datos confirmados</option>
                        <option value="unconfirmed">Solo datos sin confirmar</option>
                    </select>
                </div>
                
                <!-- Global Leader Filter -->
                <div class="flex items-center">
                    <label for="global-leader-filter" class="mr-2 text-sm font-medium text-gray-700">Líder:</label>
                    <select id="global-leader-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 whitespace-nowrap overflow-ellipsis" style="max-width: 200px;">
                        <option value="">Todos los líderes</option>
                    </select>
                </div>`;

html = html.replace(headerHtmlOld, headerHtmlNew);

// Replacement 2: DOMContentLoaded initializer
const initOld = `fetchAnalyticsData();

              // Toggle Event Listener`;

const initNew = `fetchAnalyticsData();

              // Load all leaders into the new filter
              const globalLeaderFilter = document.getElementById('global-leader-filter');
              if (globalLeaderFilter) {
                  fetch('/api/v2/leaders?limit=1000', { 
                      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } 
                  })
                  .then(r => r.json())
                  .then(data => {
                      if (data && data.success && data.data) {
                          data.data.forEach(l => {
                              const opt = document.createElement('option');
                              opt.value = l.id || l._id;
                              opt.textContent = l.name;
                              globalLeaderFilter.appendChild(opt);
                          });
                      }
                  })
                  .catch(err => console.error('Error fetching leaders', err));

                  // Listen for global leader changes
                  globalLeaderFilter.addEventListener('change', () => {
                      fetchAnalyticsData();
                  });
              }

              // Toggle Event Listener`;

html = html.replace(initOld, initNew);


// Replacement 3: fetchAnalyticsData update URL
const fetchOld = `const status = dataStatusFilter.value;
                  const response = await fetch(\`/api/v2/analytics/advanced?status=\${status}\`, {`;
const fetchNew = `const status = dataStatusFilter.value;
                  const globalLeaderFilter = document.getElementById('global-leader-filter');
                  const leaderId = globalLeaderFilter ? globalLeaderFilter.value : '';
                  const response = await fetch(\`/api/v2/analytics/advanced?status=\${status}&leaderId=\${leaderId}\`, {`;

html = html.replace(fetchOld, fetchNew);

// Improvements to top leader UI table inside renderLeadersTable (making it 'mas pulido')
const renderLeadersOld = `            return \`
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
                      }).join('');`;

const renderLeadersNew = `            return \`
                              <tr class="hover:bg-indigo-50 transition-colors group">
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="flex items-center">
                                          <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full \${avatarColor} text-white font-bold text-lg shadow-sm group-hover:shadow-md transition-shadow">
                                              \${initial}
                                          </div>
                                          <div class="ml-4">
                                              <div class="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">\${lider.liderNombre || 'Desconocido'}</div>
                                              <div class="text-xs text-gray-500">Rendimiento destacado</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap text-right">
                                      <div class="flex flex-col items-end justify-center">
                                          <div class="text-sm font-bold text-gray-900 flex items-center">
                                              <i class="fas fa-users text-indigo-400 mr-2"></i>
                                              \${lider.total} <span class="text-xs font-normal text-gray-500 ml-1">registros aportados</span>
                                          </div>
                                          <div class="w-full max-w-[12rem] flex items-center justify-end mt-1 space-x-2">
                                              <div class="flex-grow bg-gray-200 rounded-full h-2 shadow-inner">
                                                  <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full" style="width: \${percentage}%"></div>
                                              </div>
                                              <span class="text-xs font-bold text-indigo-600 w-8 text-right">\${percentage}%</span>
                                          </div>
                                      </div>
                                  </td>
                              </tr>
                          \`;
                      }).join('');`;

html = html.replace(renderLeadersOld, renderLeadersNew);


fs.writeFileSync('public/analytics.html', html, 'utf8');
console.log('analytics.html successfully patched again.');
