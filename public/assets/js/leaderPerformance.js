document.addEventListener('DOMContentLoaded', () => {
    const eventId = localStorage.getItem('eventId') || sessionStorage.getItem('eventId');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!eventId || !token) {
        showError('No hay evento seleccionado o sesión inválida. Por favor, inicie sesión nuevamente.');
        return;
    }

    fetchLeaderPerformance(eventId, token);
});

let currentGlobalData = null;

async function fetchLeaderPerformance(eventId, token) {
    try {
        const response = await fetch(`/api/v2/analytics/leader-performance?eventId=${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            currentGlobalData = data.data;
            renderDashboard(data.data);
            setupFilters();
        } else {
            throw new Error(data.message || 'Error al obtener los datos de rendimiento');
        }

    } catch (error) {
        console.error('Error fetching leader performance:', error);
        showError(error.message);
    }
}

function setupFilters() {
    const filterSelect = document.getElementById('ranking-filter');
    if(filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            renderRankingTable(currentGlobalData.rankingGeneral, e.target.value);
        });
    }
}

function renderRankingTable(rankingData, filterType = 'score') {
    const rankingBody = document.getElementById('ranking-table-body');
    const dynamicCol = document.getElementById('dynamic-col');
    rankingBody.innerHTML = '';
    
    if (!rankingData || rankingData.length === 0) {
        rankingBody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">No hay datos disponibles</td></tr>';
        return;
    }

    let sortedData = [...rankingData];
    
    if (filterType === 'score') {
        dynamicCol.classList.add('hidden');
        sortedData = sortedData.sort((a, b) => b.performanceScore - a.performanceScore);
    } else if (filterType === 'revisionPuesto') {
        dynamicCol.classList.remove('hidden');
        dynamicCol.textContent = 'A Revisar';
        sortedData = sortedData.filter(l => l.revisionPuesto > 0).sort((a, b) => b.revisionPuesto - a.revisionPuesto);
        if(sortedData.length === 0) {
            rankingBody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">No hay líderes con revisión de puesto</td></tr>';
            return;
        }
    } else if (filterType === 'sinTelefono') {
        dynamicCol.classList.remove('hidden');
        dynamicCol.textContent = 'Sin Teléfonos';
        sortedData = sortedData.filter(l => l.sinTelefono > 0).sort((a, b) => b.sinTelefono - a.sinTelefono);
        if(sortedData.length === 0) {
            rankingBody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">No hay líderes con registros sin teléfono</td></tr>';
            return;
        }
    }

    sortedData.forEach((lider, index) => {
        const scoreClass = lider.performanceScore > 0 ? 'score-positive' : (lider.performanceScore < 0 ? 'score-negative' : 'score-neutral');
        
        let dynamicValueHtml = '';
        if (filterType === 'revisionPuesto') {
            dynamicValueHtml = `<td class="px-4 py-4 whitespace-nowrap text-center"><span class="text-sm text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded">${lider.revisionPuesto}</span></td>`;
        } else if (filterType === 'sinTelefono') {
            dynamicValueHtml = `<td class="px-4 py-4 whitespace-nowrap text-center"><span class="text-sm text-red-500 font-bold bg-red-50 px-2 py-1 rounded">${lider.sinTelefono}</span></td>`;
        }

        const row = `
            <tr class="hover:bg-indigo-50 transition-colors group cursor-default">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full ${index < 3 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'} font-bold mr-4 shadow-sm border ${index < 3 ? 'border-yellow-200' : 'border-gray-200'}">${index + 1}</span>
                        <span class="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">${lider.leaderName || 'Desconocido'}</span>
                    </div>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-center">
                    <span class="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full font-medium shadow-inner">${lider.totalRegistros}</span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-center">
                    <span class="text-sm ${lider.errores > 0 ? 'text-red-500 font-bold bg-red-50' : 'text-gray-400'} px-2 py-1 rounded">${lider.errores > 0 ? '<i class="fas fa-times-circle mr-1"></i>' : ''}${lider.errores}</span>
                </td>
                ${dynamicValueHtml}
                <td class="px-4 py-4 whitespace-nowrap text-center">
                    <span class="text-base ${scoreClass} ${lider.performanceScore > 0 ? 'bg-green-50 px-3 py-1 rounded-full border border-green-200' : (lider.performanceScore < 0 ? 'bg-red-50 px-3 py-1 rounded-full border border-red-200' : 'bg-gray-50 px-3 py-1 rounded-full')} shadow-sm inline-flex items-center">
                       ${lider.performanceScore > 0 ? '<i class="fas fa-caret-up mr-1 opacity-70"></i>' : (lider.performanceScore < 0 ? '<i class="fas fa-caret-down mr-1 opacity-70"></i>' : '')} ${lider.performanceScore}
                    </span>
                </td>
            </tr>
        `;
        rankingBody.insertAdjacentHTML('beforeend', row);
    });
}

function renderDashboard(data) {
    // Hide loading, show content
    document.getElementById('loading-indicator').classList.add('hidden');
    document.getElementById('dashboard-content').classList.remove('hidden');

    // 1. Update Top Cards
    
    // Peor Desempeño
    if (data.peorDesempeno && data.peorDesempeno.length > 0) {
        const peor = data.peorDesempeno[0];
        document.getElementById('card-peor-nombre').textContent = peor.leaderName || 'Desconocido';
        document.getElementById('card-peor-score').textContent = `Score: ${peor.performanceScore}`;
    } else {
        document.getElementById('card-peor-nombre').textContent = 'N/A';
        document.getElementById('card-peor-score').textContent = 'Score: 0';
    }

    // Más Errores
    if (data.topErrores && data.topErrores.length > 0) {
        const errores = data.topErrores[0];
        document.getElementById('card-errores-nombre').textContent = errores.leaderName || 'Desconocido';
        document.getElementById('card-errores-count').textContent = `${errores.errores} errores`;
    } else {
        document.getElementById('card-errores-nombre').textContent = 'N/A';
        document.getElementById('card-errores-count').textContent = '0 errores';
    }

    // Más Importaciones
    if (data.topImportaciones && data.topImportaciones.length > 0) {
        const imports = data.topImportaciones[0];
        document.getElementById('card-import-nombre').textContent = imports.leaderName || 'Desconocido';
        document.getElementById('card-import-count').textContent = `${imports.importaciones} registros`;
    } else {
        document.getElementById('card-import-nombre').textContent = 'N/A';
        document.getElementById('card-import-count').textContent = '0 registros';
    }

    // Más Verificaciones
    if (data.topVerificaciones && data.topVerificaciones.length > 0) {
        const verif = data.topVerificaciones[0];
        document.getElementById('card-verif-nombre').textContent = verif.leaderName || 'Desconocido';
        document.getElementById('card-verif-count').textContent = `${verif.verificaciones} verificados`;
    } else {
        document.getElementById('card-verif-nombre').textContent = 'N/A';
        document.getElementById('card-verif-count').textContent = '0 verificados';
    }

    // 2. Render Ranking General Table
    renderRankingTable(data.rankingGeneral);

    // 3. Render Top por Localidad Table
    const localidadBody = document.getElementById('localidad-table-body');
    localidadBody.innerHTML = '';

    if (data.topPorLocalidad && data.topPorLocalidad.length > 0) {
        data.topPorLocalidad.forEach(loc => {
            const row = `
                <tr class="hover:bg-blue-50 transition-colors group">
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                            <i class="fas fa-map-pin text-blue-400 mr-2 group-hover:animate-bounce"></i>
                            <span class="text-sm font-bold text-gray-800 uppercase tracking-wide">${loc.localidad || 'Sin Localidad'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-2 shadow-sm"><i class="fas fa-user-tie"></i></div>
                            <span class="text-sm font-semibold text-gray-700 group-hover:text-blue-700 transition-colors">${loc.topLeaderName || 'Desconocido'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-right">
                        <span class="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-xs border border-blue-100 shadow-sm">${loc.maxRegistros} reg.</span>
                    </td>
                </tr>
            `;
            localidadBody.insertAdjacentHTML('beforeend', row);
        });
    } else {
        localidadBody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-gray-500">No hay datos disponibles</td></tr>';
    }
}

function showError(message) {
    document.getElementById('loading-indicator').classList.add('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
}