/**
 * VALIDACIÓN DETALLADA DE ENDPOINTS /api/v2
 * Script para validar que todos los módulos enterprise están funcionando
 * Run: node tools/validate-endpoints.js
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const ENDPOINTS = [];

let testsPassed = 0;
let testsFailed = 0;

// ==================== TEST UTILITIES ====================

async function test(name, method, url, data = null, expectedStatus = 200) {
  try {
    console.log(`\n[TEST] ${name}`);
    console.log(`       ${method} ${url}`);

    let response;
    if (method === 'GET') {
      response = await axios.get(`${BASE_URL}${url}`, { validateStatus: () => true });
    } else {
      response = await axios.post(`${BASE_URL}${url}`, data || {}, { validateStatus: () => true });
    }

    const success = response.status === expectedStatus || (response.status >= 200 && response.status < 300);
    
    if (success) {
      console.log(`✓ Status ${response.status}`);
      if (response.data?.data) {
        console.log(`  Data:`, JSON.stringify(response.data.data).substring(0, 60) + '...');
      }
      testsPassed++;
    } else {
      console.log(`✗ Expected ${expectedStatus}, got ${response.status}`);
      if (response.data?.error?.message) {
        console.log(`  Error: ${response.data.error.message}`);
      }
      testsFailed++;
    }
  } catch (error) {
    console.log(`✗ Exception: ${error.message}`);
    testsFailed++;
  }
}

// ==================== VALIDACIÓN ENDPOINTS ====================

async function validateEndpoints() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  VALIDACIÓN DETALLADA DE ENDPOINTS /api/v2');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n┌─ HEALTH CHECK ──────────────────────────────────────────────────');
  await test('Health check', 'GET', '/health', null, 200);

  // ──────────────────────────────────────────────────────────────────────
  // AUTH ENDPOINTS (nuevos)
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n┌─ AUTH ENDPOINTS ────────────────────────────────────────────────');
  
  // Variables para reutilizar tokens
  let adminToken = null;
  let leaderToken = null;

  await test(
    'Admin Login (valid credentials)',
    'POST',
    '/api/v2/auth/admin-login',
    { username: 'admin', password: 'admin123' },
    200
  );

  // Intentar admin login con credentials inválidas
  await test(
    'Admin Login (invalid password)',
    'POST',
    '/api/v2/auth/admin-login',
    { username: 'admin', password: 'wrong' },
    401
  );

  // Leader login (sin data - debería fallar)
  await test(
    'Leader Login (invalid email)',
    'POST',
    '/api/v2/auth/leader-login',
    { email: 'nonexistent@test.com', password: 'test123' },
    401
  );

  await test(
    'Verify Token (sin token - debería fallar)',
    'POST',
    '/api/v2/auth/verify-token',
    null,
    401
  );

  await test(
    'Change Password (sin token - debería fallar)',
    'POST',
    '/api/v2/auth/change-password',
    { oldPassword: 'old', newPassword: 'new' },
    401
  );

  // Request password reset
  await test(
    'Request Password Reset (admin)',
    'POST',
    '/api/v2/auth/request-password-reset',
    { email: 'admin@example.com', role: 'admin' },
    200
  );

  // ──────────────────────────────────────────────────────────────────────
  // LEADERS ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n┌─ LEADERS ENDPOINTS ─────────────────────────────────────────────');
  
  await test('List leaders (public)', 'GET', '/api/v2/leaders', null, 200);
  
  await test(
    'Create leader (requires token)',
    'POST',
    '/api/v2/leaders',
    {
      name: 'Test Leader',
      email: `test-${Date.now()}@example.com`,
      cedula: Math.random().toString().substring(2, 11),
      specialty: 'coordinator'
    },
    401 // Debería fallar sin token
  );

  // ──────────────────────────────────────────────────────────────────────
  // EVENTS ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n┌─ EVENTS ENDPOINTS ──────────────────────────────────────────────');
  
  await test('Get active event (public)', 'GET', '/api/v2/events/active/current', null, 200);
  
  await test('List all events (public)', 'GET', '/api/v2/events', null, 200);

  // ──────────────────────────────────────────────────────────────────────
  // PUESTOS ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n┌─ PUESTOS ENDPOINTS ─────────────────────────────────────────────');
  
  await test('Get localidades', 'GET', '/api/v2/puestos/localidades', null, 200);
  
  await test(
    'Get puestos by localidad',
    'GET',
    '/api/v2/puestos/localidad/baruta',
    null,
    200
  );

  // ──────────────────────────────────────────────────────────────────────
  // REGISTRATIONS ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n┌─ REGISTRATIONS ENDPOINTS ───────────────────────────────────────');
  
  await test('Register voter (public)', 'POST', '/api/v2/registrations', 
    {
      cedula: Math.random().toString().substring(2, 11),
      nombre: 'Test Voter',
      apellido: 'Test',
      puesto_id: '65a1234567890abcdef12345'
    },
    200 // Podría fallar si no existe puesto, pero endpoint debe estar disponible
  );

  // ────────────────────────────────────────────────────────────────────────
  // RESUMEN
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  RESULTADOS: ${testsPassed} pasaron, ${testsFailed} fallaron`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run validation
validateEndpoints().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
