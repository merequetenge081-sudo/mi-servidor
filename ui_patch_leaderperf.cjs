const fs = require('fs');

const performanceHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rendimiento de Líderes - Panel de Control</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        body { background-color: #f3f4f6; font-family: 'Inter', sans-serif; }
        .card { background: white; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); padding: 1.5rem; transition: transform 0.2s; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
        .table-container { overflow-x: auto; }
        .score-positive { color: #10b981; font-weight: bold; }
        .score-negative { color: #ef4444; font-weight: bold; }
        .score-neutral { color: #6b7280; font-weight: bold; }
        .tooltip { position: relative; display: inline-block; cursor: help; }
        .tooltip .tooltiptext { visibility: hidden; width: 220px; background-color: #4b5563; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 10; bottom: 125%; left: 50%; margin-left: -110px; opacity: 0; transition: opacity 0.3s; font-size: 0.75rem; font-weight: normal; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); line-height: 1.4; pointer-events: none; }
        .tooltip .tooltiptext::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: #4b5563 transparent transparent transparent; }
        .tooltip:hover .tooltiptext { visibility: visible; opacity: 1; }
    </style>
</head>
<body>
    <nav class="bg-gradient-to-r from-purple-800 to-indigo-900 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex items-center">
                    <i class="fas fa-chart-line text-2xl mr-3 text-purple-300"></i>
                    <span class="font-bold text-xl tracking-wide">Rendimiento de Líderes</span>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="/analytics.html" class="text-white hover:bg-purple-700 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-purple-500">
                        <i class="fas fa-arrow-left mr-2"></i>Volver a Análisis
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <!-- Info Section (More Explanatory UI) -->
        <div class="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-lg shadow-sm mb-8">
            <h2 class="text-lg font-bold text-indigo-900 mb-2 whitespace-nowrap"><i class="fas fa-info-circle mr-2"></i>¿Cómo interpretar estos datos?</h2>
            <p class="text-indigo-800 text-sm mb-3">Este panel evalúa la <strong>calidad y cantidad</strong> de los registros aportados por cada líder. No solo premia a quienes traen más registros, sino que penaliza a quienes ingresan datos con errores severos o inconsistencias.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
                <div class="bg-white p-3 rounded shadow-sm border border-indigo-100">
                    <span class="text-indigo-600 font-bold block mb-1"><i class="fas fa-star mr-1"></i> Score (Puntaje)</span>
                    Es el cálculo final de rendimiento. Se suman puntos por cada registro válido y se restan puntos por cada error, registro duplicado o inconsistencia.
                </div>
                <div class="bg-white p-3 rounded shadow-sm border border-indigo-100">
                    <span class="text-red-500 font-bold block mb-1"><i class="fas fa-times-circle mr-1"></i> Errores y Calidad</span>
                    Los errores ocurren cuando faltan números de cédula, hay teléfonos inválidos o los datos no cruzan correctamente en la base nacional.
                </div>
                <div class="bg-white p-3 rounded shadow-sm border border-indigo-100">
                    <span class="text-green-600 font-bold block mb-1"><i class="fas fa-shield-alt mr-1"></i> Verificaciones</span>
                    Registros que fueron revisados y confirmados automáticamente o manualmente, aumentando la confiabilidad del líder.
                </div>
            </div>
        </div>

        <!-- Loading Indicator -->
        <div id="loading-indicator" class="text-center py-12">
            <i class="fas fa-circle-notch fa-spin text-5xl text-purple-600 mb-4 drop-shadow-md"></i>
            <p class="text-gray-600 font-bold tracking-wide animate-pulse">Analizando desempeño en tiempo real...</p>
        </div>

        <!-- Error Message -->
        <div id="error-message" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 shadow-sm" role="alert">
            <strong class="font-bold"><i class="fas fa-exclamation-circle mr-1"></i> ¡Error!</strong>
            <span class="block sm:inline" id="error-text"></span>
        </div>

        <!-- Dashboard Content -->
        <div id="dashboard-content" class="hidden">

            <!-- Top Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                
                <!-- Más Verificaciones -->
                <div class="card border-l-4 border-green-500 hover:border-green-600">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-green-100 text-green-600 mr-4 shadow-inner">
                            <i class="fas fa-award text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-xs text-gray-500 font-extrabold uppercase tracking-wide tooltip">
                                Mejor Precisión
                                <span class="tooltiptext">Líder con la mayor cantidad de registros confirmados y verificados.</span>
                            </p>
                            <p class="text-lg font-black text-gray-800 truncate mt-1" id="card-verif-nombre">---</p>
                            <p class="text-sm font-bold text-green-600 bg-green-50 inline-block px-2 py-0.5 rounded mt-1 border border-green-200" id="card-verif-count">0 validados</p>
                        </div>
                    </div>
                </div>

                <!-- Más Importaciones -->
                <div class="card border-l-4 border-blue-500 hover:border-blue-600">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-blue-100 text-blue-600 mr-4 shadow-inner">
                            <i class="fas fa-bolt text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-xs text-gray-500 font-extrabold uppercase tracking-wide tooltip">
                                Mayor Volumen
                                <span class="tooltiptext">El líder que ha ingresado la mayor cantidad total de registros al sistema.</span>
                            </p>
                            <p class="text-lg font-black text-gray-800 truncate mt-1" id="card-import-nombre">---</p>
                            <p class="text-sm font-bold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded mt-1 border border-blue-200" id="card-import-count">0 aportados</p>
                        </div>
                    </div>
                </div>

                <!-- Más Errores -->
                <div class="card border-l-4 border-orange-500 hover:border-orange-600 bg-orange-50">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-orange-200 text-orange-600 mr-4 shadow-inner">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-xs text-orange-800 font-extrabold uppercase tracking-wide tooltip">
                                Alerta de Calidad
                                <span class="tooltiptext">El líder cuyos registros presentan la mayor cantidad de errores o formato inválido.</span>
                            </p>
                            <p class="text-lg font-black text-gray-900 truncate mt-1" id="card-errores-nombre">---</p>
                            <p class="text-sm font-bold text-orange-600 bg-orange-100 inline-block px-2 py-0.5 rounded mt-1 border border-orange-300" id="card-errores-count">0 errores</p>
                        </div>
                    </div>
                </div>

                <!-- Peor Desempeño -->
                <div class="card border-l-4 border-red-500 hover:border-red-600 bg-red-50">
                    <div class="flex items-center">
                        <div class="p-3 rounded-full bg-red-200 text-red-600 mr-4 shadow-inner">
                            <i class="fas fa-arrow-down text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-xs text-red-800 font-extrabold uppercase tracking-wide tooltip">
                                Riesgo Crítico
                                <span class="tooltiptext">Líder con el peor puntaje consolidado. Los errores superan sus aportes válidos.</span>
                            </p>
                            <p class="text-lg font-black text-gray-900 truncate mt-1" id="card-peor-nombre">---</p>
                            <p class="text-sm font-bold text-red-600 bg-red-100 inline-block px-2 py-0.5 rounded mt-1 border border-red-300" id="card-peor-score">Score: 0</p>
                        </div>
                    </div>
                </div>

            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

                <!-- Ranking General -->
                <div class="card lg:col-span-2">
                    <div class="flex justify-between items-center mb-4 border-b pb-3">
                        <h3 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-list-ol text-indigo-500 mr-2"></i>Ranking Detallado de Líderes
                        </h3>
                        <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full"><i class="fas fa-sort-amount-down mr-1"></i>Ordenado por Score</span>
                    </div>
                    <div class="table-container bg-white rounded-lg overflow-hidden border border-gray-200">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-4 text-left text-xs font-black text-gray-600 uppercase tracking-wider tooltip">Líder <span class="tooltiptext">Nombre registrado del líder</span></th>
                                    <th class="px-4 py-4 text-center text-xs font-black text-gray-600 uppercase tracking-wider tooltip">Aportes <span class="tooltiptext">Volumen total aportado sin contar calidad</span></th>
                                    <th class="px-4 py-4 text-center text-xs font-black text-gray-600 uppercase tracking-wider tooltip text-orange-500">Fallos <span class="tooltiptext">Cantidad de registros erróneos o devueltos</span></th>
                                    <th class="px-4 py-4 text-center text-xs font-black text-gray-900 uppercase tracking-wider tooltip bg-indigo-50">Score <span class="tooltiptext">Calificación final (Puntaje = Aportes válidos - Penalidad por fallos)</span></th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200" id="ranking-table-body">
                                <!-- Rows will be injected by leaderPerformance.js -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Top por Localidad -->
                <div class="card">
                    <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-3">
                        <i class="fas fa-map-marker-alt text-blue-500 mr-2"></i>Top por Localidad
                        <p class="text-xs font-normal text-gray-500 mt-1 ml-6">El líder más fuerte en cada zona urbana</p>
                    </h3>
                    <div class="table-container">
                        <table class="min-w-full divide-y divide-gray-100">
                            <tbody class="bg-white divide-y divide-gray-100" id="localidad-table-body">
                                <!-- Rows will be injected by leaderPerformance.js -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- Modals or extra tools could go here -->

    <script src="/assets/js/leaderPerformance.js"></script>
</body>
</html>`;

fs.writeFileSync('public/leader-performance.html', performanceHtml, 'utf8');
console.log('leader-performance.html updated for maximum explainability!');
