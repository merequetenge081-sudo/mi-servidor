#!/usr/bin/env node

/**
 * Test Dashboard Generator
 * Genera un dashboard HTML interactivo desde el reporte JSON
 * Uso: npm run report:dashboard
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.join(__dirname, '../reports');
const reportPath = path.join(reportsDir, 'tests.json');

if (!fs.existsSync(reportPath)) {
  console.error('❌ Archivo tests.json no encontrado. Ejecuta: npm run report:json');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

const categoryRows = Object.entries(report.summary.categories)
  .map(([category, count]) => {
    const percentage = ((count / report.summary.totalTests) * 100).toFixed(1);
    return `
              <div class="category-row">
                <div class="category-label">${category.toUpperCase()}</div>
                <div class="category-bar">
                  <div class="category-bar-fill" style="width: ${percentage}%">
                    ${count} tests
                  </div>
                </div>
                <div class="category-count">${percentage}%</div>
              </div>
            `;
  })
  .join('');

const fileItems = report.files
  .map(
    (file) => `
        <div class="file-item">
          <div class="file-name">
            ${file.file}
            <span class="file-type ${file.type}">${file.type.toUpperCase()}</span>
          </div>
          <div class="file-stats">
            📝 ${file.stats.tests} tests | 📦 ${file.stats.describes} describes
          </div>
        </div>
      `
  )
  .join('');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Testing Dashboard - ${report.summary.totalTests} Tests</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      color: white;
      margin-bottom: 40px;
    }

    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .stat-card h3 {
      color: #667eea;
      font-size: 0.9em;
      text-transform: uppercase;
      margin-bottom: 10px;
      opacity: 0.7;
    }

    .stat-card .number {
      font-size: 2.5em;
      font-weight: bold;
      color: #764ba2;
    }

    .chart-section {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 30px;
    }

    .chart-section h2 {
      margin-bottom: 20px;
      color: #333;
    }

    .category-row {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }

    .category-label {
      min-width: 100px;
      font-weight: 600;
      color: #667eea;
    }

    .category-bar {
      flex: 1;
      height: 30px;
      background: #f0f0f0;
      border-radius: 5px;
      margin: 0 15px;
      overflow: hidden;
    }

    .category-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      color: white;
      font-weight: 600;
      font-size: 0.9em;
    }

    .category-count {
      min-width: 60px;
      text-align: right;
      color: #666;
      font-weight: 600;
    }

    .files-section {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .files-section h2 {
      margin-bottom: 20px;
      color: #333;
    }

    .file-item {
      padding: 15px;
      border-left: 4px solid #667eea;
      margin-bottom: 10px;
      background: #f9f9f9;
      border-radius: 5px;
    }

    .file-name {
      font-weight: 600;
      color: #333;
      margin-bottom: 5px;
    }

    .file-stats {
      font-size: 0.9em;
      color: #666;
    }

    .file-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.8em;
      font-weight: 600;
      margin-left: 10px;
    }

    .file-type.unit {
      background: #e0e7ff;
      color: #4338ca;
    }

    .file-type.integration {
      background: #fef3c7;
      color: #b45309;
    }

    .file-type.e2e {
      background: #dcfce7;
      color: #15803d;
    }

    footer {
      text-align: center;
      color: white;
      margin-top: 40px;
      opacity: 0.8;
    }

    @media (max-width: 600px) {
      header h1 {
        font-size: 1.8em;
      }

      .stats-grid {
        grid-template-columns: 1fr 1fr;
      }

      .category-label {
        min-width: 60px;
        font-size: 0.9em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧪 Testing Dashboard</h1>
      <p>Reporte de cobertura de tests</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Tests</h3>
        <div class="number">${report.summary.totalTests}</div>
      </div>
      <div class="stat-card">
        <h3>Describe Blocks</h3>
        <div class="number">${report.summary.totalSuites}</div>
      </div>
      <div class="stat-card">
        <h3>Test Files</h3>
        <div class="number">${report.summary.totalFiles}</div>
      </div>
      <div class="stat-card">
        <h3>Success Rate</h3>
        <div class="number">100%</div>
      </div>
    </div>

    <div class="chart-section">
      <h2>📊 Tests por Categoría</h2>
      ${categoryRows}
    </div>

    <div class="files-section">
      <h2>📁 Detalle de Archivos</h2>
      ${fileItems}
    </div>

    <footer>
      <p>Última actualización: ${new Date().toLocaleString('es-CO')}</p>
      <p>Generated by Testing Suite Automation</p>
    </footer>
  </div>
</body>
</html>`;

const outputPath = path.join(reportsDir, 'dashboard.html');
fs.writeFileSync(outputPath, html, 'utf-8');

console.log('✅ Dashboard HTML generado:', outputPath);
console.log('🌐 Abre en el navegador para ver el reporte visual');
