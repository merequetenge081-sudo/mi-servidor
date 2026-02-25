#!/usr/bin/env node

import fs from 'fs';
import https from 'https';

// Usar staging de Render  
const STAGING_URL = 'https://mi-servidor-staging.onrender.com';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTk4MTVmZGNhZDY4NzI1NmU0NTMxMDUiLCJsZWFkZXJJZCI6IkxJRC1NTFVMVlRTTi0zRzRIIiwicm9sZSI6ImxlYWRlciIsIm5hbWUiOiJjb2NvMTJhIiwib3JnYW5pemF0aW9uSWQiOiI2OTk1NDNlNjQ3ZTc4YTBmZjJkZDg1ZTYiLCJzb3VyY2UiOiJtb25nb2RiIiwiaWF0IjoxNzcxOTczMzc1LCJleHAiOjE3NzE5NzY5NzV9.TU9AGsp4OrTu_9n9VVio8Yxkk3s_CpPWcHsoo87Gzps';

console.log('📦 Importación consolidada de 751 puestos');
console.log(`📍 Staging: ${STAGING_URL}\n`);
console.log('⏳ Esperando a que Render esté listo (máx 30 intentos)...\n');

async function checkServerHealth() {
  return new Promise((resolve) => {
    const req = https.get(`${STAGING_URL}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000);
  });
}

async function uploadPuestos() {
  // Esperar a que Render esté listo
  let ready = false;
  let attempts = 0;
  
  while (!ready && attempts < 30) {
    ready = await checkServerHealth();
    if (!ready) {
      attempts++;
      console.log(`  Intento ${attempts}/30...`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  
  if (!ready) {
    console.error('❌ Timeout esperando a Render');
    process.exit(1);
  }
  
  console.log('✅ Render está listo!\n');

  // Leer JSON consolidado
  const puestos = JSON.parse(fs.readFileSync('./tools/todos-puestos-consolidados.json', 'utf-8'));
  console.log(`📊 Puestos a importar: ${puestos.length}\n`);

  // Hacer POST
  const body = JSON.stringify({ puestos });
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${STAGING_URL}/api/puestos/import`);
    
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${TOKEN}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`📡 Respuesta: ${res.statusCode}`);
          
          if (json.success || json.inserted) {
            console.log('\n✅ Resultados:');
            console.log(`  - Insertados: ${json.inserted || json.insertedCount || 0}`);
            console.log(`  - Total en BD: ${json.total || json.totalCount || 0}`);
            console.log('\n🎉 ¡Importación exitosa!');
          } else {
            console.log('\n⚠️  Respuesta:', json);
          }
          resolve(json);
        } catch (e) {
          reject(new Error(`Error parsing response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

uploadPuestos()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
