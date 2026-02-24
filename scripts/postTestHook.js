/**
 * Post-Test Hook
 * Se ejecuta automáticamente después de cada test para generar docs
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Solo generar docs si la variable de entorno lo permite
if (process.env.GENERATE_DOCS !== 'false') {
  console.log('\n📝 Actualizando documentación de tests...\n');

  const script = spawn(
    'node',
    [
      '--experimental-vm-modules',
      path.join(__dirname, 'generateTestDocs.js'),
    ],
    {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    }
  );

  script.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Documentación actualizada\n');
    } else {
      console.error('❌ Error generando documentación\n');
    }
  });
}
