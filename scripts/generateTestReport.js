#!/usr/bin/env node

/**
 * Test Report Generator
 * Genera reporte JSON de todos los tests
 * Uso: npm run report:json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, '../tests');
const reportsDir = path.join(__dirname, '../reports');

// Crear directorio de reportes si no existe
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function getTestType(filePath) {
  if (filePath.includes('e2e')) return 'e2e';
  if (filePath.includes('integration')) return 'integration';
  return 'unit';
}

function readTestFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(testsDir, filePath);
  const type = getTestType(relativePath);

  // Extraer describe blocks
  const describeRegex = /describe\(['""`]([^'""`]+)['""`]/g;
  const describes = [];
  let match;
  while ((match = describeRegex.exec(content)) !== null) {
    describes.push(match[1]);
  }

  // Extraer tests (it y test)
  const testRegex = /(?:it|test)\(['""`]([^'""`]+)['""`]/g;
  const tests = [];
  while ((match = testRegex.exec(content)) !== null) {
    tests.push(match[1]);
  }

  return {
    path: relativePath,
    file: path.basename(filePath),
    type,
    describes,
    tests,
    stats: {
      describes: describes.length,
      tests: tests.length,
    },
  };
}

function generateReport(files) {
  const summary = {
    totalTests: 0,
    totalSuites: 0,
    totalFiles: files.length,
    categories: {
      unit: 0,
      integration: 0,
      e2e: 0,
    },
  };

  const parsedFiles = files.map((file) => {
    const parsed = parseTestFile(file);
    summary.totalTests += parsed.stats.tests;
    summary.totalSuites += parsed.stats.describes;
    summary.categories[parsed.type] += parsed.stats.tests;
    return parsed;
  });

  return {
    timestamp: new Date().toISOString(),
    summary,
    files: parsedFiles,
  };
}

console.log('📊 Generando reporte JSON de tests...\n');

const testFiles = readTestFiles(testsDir);
console.log(`✓ Encontrados ${testFiles.length} archivos\n`);

const report = generateReport(testFiles);

// Guardar reporte JSON
const reportPath = path.join(reportsDir, 'tests.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

console.log(`✅ Reporte JSON generado: ${reportPath}\n`);
console.log('📈 Estadísticas:');
console.log(`   - Tests Totales: ${report.summary.totalTests}`);
console.log(`   - Describe Blocks: ${report.summary.totalSuites}`);
console.log(`   - Archivos: ${report.summary.totalFiles}`);
console.log(`\n📂 Por Categoría:`);
console.log(`   - Unit: ${report.summary.categories.unit} tests`);
console.log(`   - Integration: ${report.summary.categories.integration} tests`);
console.log(`   - E2E: ${report.summary.categories.e2e} tests\n`);
