document.addEventListener('DOMContentLoaded', () => {
    const eventId = localStorage.getItem('currentEventId');
    const token = localStorage.getItem('token');

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
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                            <span class="text-gray-500 font-bold mr-3">#${index + 1}</span>
                            <span class="font-medium text-gray-900">${lider.leaderName || 'Desconocido'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-500">
                        ${lider.totalRegistros}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-red-500 font-medium">
                        ${lider.errores}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm ${scoreClass}">
                        ${lider.performanceScore}
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
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${loc.localidad || 'Sin Localidad'}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <i class="fas fa-star text-yellow-400 mr-1 text-xs"></i>
                        ${loc.topLeader || 'Desconocido'}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500 font-medium">
                        ${loc.totalRegistros}
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