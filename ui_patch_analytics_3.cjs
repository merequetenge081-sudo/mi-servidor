const fs = require('fs');
let html = fs.readFileSync('public/analytics.html', 'utf8');

// 1. Add Filter after <!-- Data Status Filter --> block
const statusFilterRegex = /<!-- Data Status Filter -->[\s\S]*?<\/select>\s*<\/div>/;
if (statusFilterRegex.test(html) && !html.includes('global-leader-filter')) {
    html = html.replace(statusFilterRegex, match => {
        return match + `
                
                <!-- Global Leader Filter -->
                <div class="flex items-center">
                    <label for="global-leader-filter" class="mr-2 text-sm font-medium text-gray-700">Líder:</label>
                    <select id="global-leader-filter" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2" style="max-width: 200px;">
                        <option value="">Todos los líderes</option>
                    </select>
                </div>`;
    });
}

// 2. Fetch leaders on DOMContentLoaded
const fetchInitRegex = /fetchAnalyticsData\(\);\s*\/\/\s*Toggle Event Listener/;
if (fetchInitRegex.test(html)) {
    html = html.replace(fetchInitRegex, `fetchAnalyticsData();

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

              // Toggle Event Listener`);
}

// 3. Update Fetch URL
const fetchUrlRegex = /fetch\(\`\/api\/v2\/analytics\/advanced\?status=\$\{status\}\`,\s*\{/g;
if (fetchUrlRegex.test(html)) {
    console.log("Found fetch URL!");
    html = html.replace(/const status = dataStatusFilter\.value;[\s\S]*?fetch\(\`\/api\/v2\/analytics\/advanced\?status=\$\{status\}\`/g, 
`const status = dataStatusFilter.value;
                  const globalLeaderFilter = document.getElementById('global-leader-filter');
                  const leaderId = globalLeaderFilter ? globalLeaderFilter.value : '';
                  const response = await fetch(\`/api/v2/analytics/advanced?status=\${status}&leaderId=\${leaderId}\``);
}

// 4. Polish the leaders table
const leadersHtmlRegex = /<tr class="hover:bg-gray-50 transition-colors">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/td>[\s\S]*?<\/tr>/;
html = html.replace(leadersHtmlRegex, `<tr class="hover:bg-indigo-50 transition-colors group">
                                  <td class="px-6 py-4 whitespace-nowrap">
                                      <div class="flex items-center">
                                          <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full \${avatarColor} text-white font-bold text-lg shadow-sm group-hover:shadow-md transition-shadow">
                                              \${initial}
                                          </div>
                                          <div class="ml-4">
                                              <div class="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">\${lider.liderNombre || 'Desconocido'}</div>
                                              <div class="text-xs text-gray-500">Rendimiento constante</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td class="px-6 py-4 whitespace-nowrap text-right">
                                      <div class="flex flex-col items-end justify-center">
                                          <div class="text-sm font-bold text-gray-900 flex items-center mb-1">
                                              <i class="fas fa-users text-indigo-400 mr-2"></i>
                                              \${lider.total} <span class="text-xs font-normal text-gray-500 ml-1">registros aportados</span>
                                          </div>
                                          <div class="w-24 md:w-32 bg-gray-200 rounded-full h-2">
                                              <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full shadow-inner" style="width: \${percentage}%"></div>
                                          </div>
                                      </div>
                                  </td>
                              </tr>`);

// Optional: Improve top cards styling
html = html.replace(/<div class="bg-white overflow-hidden shadow-sm/g, '<div class="bg-white overflow-hidden shadow-md group border-l-4 border-indigo-500');
html = html.replace(/<dt class="text-sm font-medium text-gray-500 truncate/g, '<dt class="text-xs uppercase font-extrabold tracking-wider text-gray-500 group-hover:text-indigo-500 transition-colors truncate');
html = html.replace(/<dd class="mt-1 text-3xl font-semibold text-gray-900/g, '<dd class="mt-2 text-4xl font-black text-gray-900 drop-shadow-sm');

fs.writeFileSync('public/analytics.html', html, 'utf8');
console.log('Script executed');
