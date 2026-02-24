/**
 * Script de diagnóstico: Verificar funciones del panel admin
 * Simula acciones del admin panel para detectar funciones rotas
 */

const API_URL = 'http://localhost:3000';

async function testAdminFunctions() {
  console.log('\n🔍 DIAGNOSTICANDO FUNCIONES DEL PANEL ADMIN...\n');

  try {
    // 1. Obtener credenciales de prueba
    console.log('1️⃣  Obteniendo credenciales de prueba...');
    const credsRes = await fetch(`${API_URL}/api/test-credentials`);
    const creds = await credsRes.json();
    const admin = creds.admins[0];
    console.log('✅ Credenciales obtenidas:', admin.username);

    // 2. Login como admin
    console.log('\n2️⃣  Intentando login como admin...');
    const loginRes = await fetch(`${API_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: admin.username, password: admin.password })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.error('❌ Login falló:', loginData.message);
      return;
    }
    const token = loginData.token;
    console.log('✅ Login exitoso, token obtenido');

    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 3. Probar funciones principals
    const tests = [
      {
        name: 'Obtener líderes v1',
        url: `${API_URL}/api/leaders`,
        method: 'GET',
        v: 'v1'
      },
      {
        name: 'Obtener líderes v2',
        url: `${API_URL}/api/v2/leaders`,
        method: 'GET',
        v: 'v2'
      },
      {
        name: 'Obtener registros v1',
        url: `${API_URL}/api/registrations`,
        method: 'GET',
        v: 'v1'
      },
      {
        name: 'Obtener registros v2',
        url: `${API_URL}/api/v2/registrations`,
        method: 'GET',
        v: 'v2'
      },
      {
        name: 'Obtener stats v1',
        url: `${API_URL}/api/stats`,
        method: 'GET',
        v: 'v1'
      },
      {
        name: 'Obtener stats v2',
        url: `${API_URL}/api/v2/stats`,
        method: 'GET',
        v: 'v2'
      },
      {
        name: 'Obtener análisis v1',
        url: `${API_URL}/api/analytics/dashboard`,
        method: 'GET',
        v: 'v1'
      },
      {
        name: 'Obtener análisis v2',
        url: `${API_URL}/api/v2/analytics/dashboard`,
        method: 'GET',
        v: 'v2'
      },
      {
        name: 'Obtener eventos v1',
        url: `${API_URL}/api/events`,
        method: 'GET',
        v: 'v1'
      },
      {
        name: 'Obtener eventos v2',
        url: `${API_URL}/api/v2/events`,
        method: 'GET',
        v: 'v2'
      },
      {
        name: 'Crear líder (preview)',
        url: `${API_URL}/api/leaders`,
        method: 'POST',
        body: {
          name: 'Test Leader',
          email: 'test@example.com',
          phone: '1234567890',
          area: 'Test'
        },
        v: 'v1'
      },
      {
        name: 'Exportar registros',
        url: `${API_URL}/api/export/registrations`,
        method: 'GET',
        v: 'v1'
      }
    ];

    console.log('\n3️⃣  Probando funciones del dashboard...\n');

    for (const test of tests) {
      try {
        const options = {
          method: test.method,
          headers: headers
        };
        if (test.body) {
          options.body = JSON.stringify(test.body);
        }

        const res = await fetch(test.url, options);
        const text = await res.text();
        let data;
        
        try {
          data = JSON.parse(text);
        } catch {
          data = text.substring(0, 100);
        }

        const status = res.ok ? '✅' : '❌';
        const statusCode = res.status;
        console.log(`${status} [${statusCode}] ${test.name} (${test.v})`);
        
        if (!res.ok) {
          console.log(`   └─ Error: ${data.message || text || 'Unknown error'}`);
        } else if (test.method === 'GET' && typeof data === 'object') {
          const count = Array.isArray(data) ? data.length : Object.keys(data).length;
          console.log(`   └─ Datos: ${count} items`);
        }
      } catch (error) {
        console.log(`❌ ${test.name} - Error de red: ${error.message}`);
      }
    }

    console.log('\n🔍 ANÁLISIS COMPLETADO\n');

  } catch (error) {
    console.error('Error durante las pruebas:', error.message);
  }

  process.exit(0);
}

// Ejecutar
testAdminFunctions();
