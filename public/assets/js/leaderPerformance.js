document.addEventListener('DOMContentLoaded', () => {
    const eventId = localStorage.getItem('eventId') || sessionStorage.getItem('eventId');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!eventId || !token) {
        showError('No hay evento seleccionado o sesión inválida. Por favor, inicie sesión nuevamente.');
        return;
    }

    fetchLeaderPerformance(eventId, token);
});

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
            renderDashboard(data.data);
        } else {
            throw new Error(data.message || 'Error al obtener los datos de rendimiento');
        }

    } catch (error) {
        console.error('Error fetching leader performance:', error);
        showError(error.message);
    }
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
    const rankingBody = document.getElementById('ranking-table-body');
    rankingBody.innerHTML = '';
    
    if (data.rankingGeneral && data.rankingGeneral.length > 0) {
        data.rankingGeneral.forEach((lider, index) => {
            const scoreClass = lider.performanceScore > 0 ? 'score-positive' : (lider.performanceScore < 0 ? 'score-negative' : 'score-neutral');
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
                    <td class="px-4 py-4 whitespace-nowrap text-center">
                        <span class="text-base ${scoreClass} ${lider.performanceScore > 0 ? 'bg-green-50 px-3 py-1 rounded-full border border-green-200' : (lider.performanceScore < 0 ? 'bg-red-50 px-3 py-1 rounded-full border border-red-200' : 'bg-gray-50 px-3 py-1 rounded-full')} shadow-sm inline-flex items-center">
                           ${lider.performanceScore > 0 ? '<i class="fas fa-caret-up mr-1 opacity-70"></i>' : (lider.performanceScore < 0 ? '<i class="fas fa-caret-down mr-1 opacity-70"></i>' : '')} ${lider.performanceScore}
                        </span>
                    </td>
                </tr>
            `;
            rankingBody.insertAdjacentHTML('beforeend', row);
        });
    } else {
        rankingBody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">No hay datos disponibles</td></tr>';
    }

    // 3. Render Top por Localidad Table
    const localidadBody = document.getElementById('localidad-table-body');
    localidadBody.innerHTML = '';

    if (data.topPorLocalidad && data.topPorLocalidad.length > 0) {
        data.topPorLocalidad.forEach(loc => {
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
                    <td class="px-4 py-4 whitespace-nowrap text-center">
                        <span class="text-base ${scoreClass} ${lider.performanceScore > 0 ? 'bg-green-50 px-3 py-1 rounded-full border border-green-200' : (lider.performanceScore < 0 ? 'bg-red-50 px-3 py-1 rounded-full border border-red-200' : 'bg-gray-50 px-3 py-1 rounded-full')} shadow-sm inline-flex items-center">
                           ${lider.performanceScore > 0 ? '<i class="fas fa-caret-up mr-1 opacity-70"></i>' : (lider.performanceScore < 0 ? '<i class="fas fa-caret-down mr-1 opacity-70"></i>' : '')} ${lider.performanceScore}
                        </span>
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