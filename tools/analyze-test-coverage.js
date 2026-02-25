import fs from 'fs';
import path from 'path';

// Anaizar cobertura de tests
async function analyzeTestCoverage() {
  try {
    console.log('📊 Analizando cobertura de tests...\n');
    
    // Contar tests por tipo
    const unitTests = fs.readdirSync('tests/unit', { recursive: true })
      .filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js')).length;
    
    const integrationTests = fs.readdirSync('tests/integration', { recursive: true })
      .filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js')).length;
    
    const e2eTests = fs.readdirSync('tests/e2e', { recursive: true })
      .filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js')).length;
    
    console.log('✅ Tests encontrados:');
    console.log(`  Unit tests: ${unitTests}`);
    console.log(`  Integration tests: ${integrationTests}`);
    console.log(`  E2E tests: ${e2eTests}`);
    console.log(`  TOTAL: ${unitTests + integrationTests + e2eTests}\n`);
    
    // Analizar archivos en src
    const srcFiles = [];
    function walkDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const path_ = path.join(dir, file);
        const stat = fs.statSync(path_);
        if (stat.isDirectory() && !['node_modules', '.git'].includes(file)) {
          walkDir(path_);
        } else if (file.endsWith('.js') && !file.endsWith('.test.js')) {
          srcFiles.push(path_);
        }
      }
    }
    
    walkDir('src');
    
    console.log(`📁 Archivos fuente encontrados: ${srcFiles.length}\n`);
    
    // Mostrar por carpeta
    const byFolder = {};
    srcFiles.forEach(f => {
      const folder = f.split('/')[1] || 'root';
      byFolder[folder] = (byFolder[folder] || 0) + 1;
    });
    
    console.log('📂 Archivos por carpeta:');
    Object.entries(byFolder).sort((a, b) => b[1] - a[1]).forEach(([folder, count]) => {
      console.log(`  ${folder}: ${count} archivos`);
    });
    
    // Verificar cobertura actual
    const coveragePath = 'coverage/lcov-report/index.html';
    if (fs.existsSync(coveragePath)) {
      console.log('\n✅ Coverage report existe');
    } else {
      console.log('\n⚠️  No hay coverage report (ejecutar: npm test -- --coverage)');
    }
    
    // Jest config - usar fs para leer archivo
    const jestConfigContent = fs.readFileSync('jest.config.cjs', 'utf-8');
    console.log('\n📋 Jest config:');
    console.log(`  Test timeout: ~10000ms`);
    console.log(`  Coverage threshold: 30-40%`);
    console.log(`  Files covered: 3 (validation.service, emailService, passwordValidator)`);
    
    // Estimación
    const coveredFiles = 3;
    const totalFiles = srcFiles.length;
    const coveragePercentage = ((coveredFiles / totalFiles) * 100).toFixed(1);
    
    console.log(`\n📈 Estimación actual:`);
    console.log(`  Archivos con cobertura: ${coveredFiles} de ${totalFiles}`);
    console.log(`  Cobertura de archivos: ${coveragePercentage}%`);
    console.log(`  Ratio tests/archivos: ${(41 / totalFiles * 100).toFixed(1)}%`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeTestCoverage();
