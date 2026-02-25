import fs from 'fs';

const API_URL = 'http://localhost:3000';  // Local development
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTk4MTVmZGNhZDY4NzI1NmU0NTMxMDUiLCJsZWFkZXJJZCI6IkxJRC1NTFVMVlRTTi0zRzRIIiwicm9sZSI6ImxlYWRlciIsIm5hbWUiOiJjb2NvMTJhIiwib3JnYW5pemF0aW9uSWQiOiI2OTk1NDNlNjQ3ZTc4YTBmZjJkZDg1ZTYiLCJzb3VyY2UiOiJtb25nb2RiIiwiaWF0IjoxNzcxOTczMzc1LCJleHAiOjE3NzE5NzY5NzV9.TU9AGsp4OrTu_9n9VVio8Yxkk3s_CpPWcHsoo87Gzps';

async function uploadPuestosViaAPI() {
  try {
    console.log('🚀 Subiendo puestos de Rafael Uribe Uribe via API...\n');

    // Leer JSON
    const jsonPath = './tools/rafael-uribe-nuevos.json';
    const puestos = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`📊 Puestos a subir: ${puestos.length}\n`);

    // Hacer POST al endpoint
    const response = await fetch(`${API_URL}/api/puestos/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ puestos })
    });

    console.log(`📡 Respuesta del servidor: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('\n✅ Resultado:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n🎉 Importación exitosa!');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadPuestosViaAPI();
