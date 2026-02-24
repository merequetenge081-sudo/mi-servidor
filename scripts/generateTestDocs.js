#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, '../tests');
const docsDir = path.join(__dirname, '../docs');

// Estructura para almacenar datos de tests
const testStats = {
  suites: [],
  totalTests: 0,
  totalSuites: 0,
  categories: {},
};

// Leer archivos de test recursivamente
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

// Parsear archivo de test y extraer información
function parseTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(testsDir, filePath);
  
  // Contar describe blocks
  const describeMatches = content.match(/describe\(['""`]([^'""`]+)['""`]/g) || [];
  
  // Contar it tests
  const itMatches = content.match(/it\(['""`]([^'""`]+)['""`]|test\(['""`]([^'""`]+)['""`]/g) || [];

  return {
    file: relativePath,
    describes: describeMatches.length,
    tests: itMatches.length,
    content: content,
  };
}

// Generar documentación
function generateDocs(testData) {
  let markdown = `# 📋 Testing Suite - Documentación Automática

**Generado:** ${new Date().toLocaleString('es-CO')}  
**Total Tests:** ${testStats.totalTests}  
**Total Suites:** ${testStats.totalSuites}

> ℹ️ Esta documentación se genera automáticamente con \`npm run docs:generate\`

---

## 📊 Resumen Global

\`\`\`
Test Suites: ${testStats.totalSuites}
Tests:       ${testStats.totalTests}
\`\`\`

---

## 📁 Struktura de Tests

\`\`\`
tests/
`;

  // Agrupar por directorio
  const byDir = {};
  for (const test of testData) {
    const dir = path.dirname(test.file);
    if (!byDir[dir]) byDir[dir] = [];
    byDir[dir].push(test);
  }

  for (const [dir, tests] of Object.entries(byDir)) {
    const dirParts = dir.split(path.sep);
    markdown += `├── ${dirParts.join('/')}/\n`;
    
    let totalInDir = 0;
    for (const test of tests) {
      const fileName = path.basename(test.file);
      markdown += `│   ├── ${fileName} (${test.tests} tests)\n`;
      totalInDir += test.tests;
    }
    markdown += `│   └── Total: ${totalInDir} tests\n│\n`;
  }

  markdown += `\`\`\`\n\n---\n\n## 📈 Estadísticas por Categoría\n\n`;

  // Categorizar por tipo de test
  const categories = {
    'Unit Tests': [],
    'Integration Tests': [],
    'E2E Tests': [],
  };

  for (const test of testData) {
    if (test.file.includes('unit')) {
      categories['Unit Tests'].push(test);
    } else if (test.file.includes('integration')) {
      categories['Integration Tests'].push(test);
    } else if (test.file.includes('e2e')) {
      categories['E2E Tests'].push(test);
    }
  }

  for (const [category, tests] of Object.entries(categories)) {
    if (tests.length === 0) continue;

    const totalTests = tests.reduce((sum, t) => sum + t.tests, 0);
    markdown += `### ${category}\n\n`;
    markdown += `**Total:** ${totalTests} tests\n\n`;
    markdown += `| Archivo | Tests |\n`;
    markdown += `|---------|-------|\n`;

    for (const test of tests) {
      const fileName = path.basename(test.file);
      markdown += `| ${fileName} | ${test.tests} |\n`;
    }

    markdown += `\n`;
  }

  markdown += `---\n\n## 🔄 Comandos Útiles\n\n`;
  markdown += `\`\`\`bash\n`;
  markdown += `npm test                  # Ejecutar todos los tests\n`;
  markdown += `npm run test:watch       # Modo watch\n`;
  markdown += `npm run test:coverage    # Con reporte de coverage\n`;
  markdown += `npm run docs:generate    # Regenerar esta documentación\n`;
  markdown += `\`\`\`\n\n`;

  markdown += `---\n\n`;
  markdown += `**Last Update:** ${new Date().toISOString()}\n`;

  return markdown;
}

// Ejecutar
console.log('📝 Generando documentación de tests...\n');

const testFiles = readTestFiles(testsDir);
console.log(`✓ Encontrados ${testFiles.length} archivos de test\n`);

const testData = [];
for (const file of testFiles) {
  const data = parseTestFile(file);
  testData.push(data);
  testStats.totalTests += data.tests;
  testStats.totalSuites += data.describes;
  console.log(`  ✓ ${data.file}: ${data.tests} tests`);
}

const docs = generateDocs(testData);

// Guardar documentación
const outputPath = path.join(docsDir, 'TESTING_SUITE.md');
fs.writeFileSync(outputPath, docs, 'utf-8');

console.log(`\n✅ Documentación generada: ${outputPath}\n`);
console.log(`📊 Estadísticas:\n`);
console.log(`   - Tests Totales: ${testStats.totalTests}`);
console.log(`   - Suites: ${testStats.totalSuites}`);
console.log(`   - Archivos: ${testFiles.length}\n`);
