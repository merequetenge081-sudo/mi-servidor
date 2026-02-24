#!/usr/bin/env node

/**
 * VALIDACIÓN COMPLETA DE ENDPOINTS /api/v2
 * Script rápido para validar todos los módulos enterprise
 * Run: node tools/quick-validate.js
 */

import axios from 'axios';

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;

async function test(name, method, url, data) {
  try {
    const res = method === 'GET' 
      ? await axios.get(`${BASE}${url}`, { validateStatus: () => true })
      : await axios.post(`${BASE}${url}`, data, { validateStatus: () => true });
    
    const ok = res.status < 300;
    if (ok) { console.log(`✓ ${name}`); pass++; }
    else { console.log(`✗ ${name} (${res.status})`); fail++; }
  } catch(e) { console.log(`✗ ${name} (${e.message})`); fail++; }
}

console.log('\n📋 VALIDACIÓN ENDPOINTS /api/v2\n');

// Auth
await test('Auth: Admin Login', 'POST', '/api/v2/auth/admin-login', 
  { username: 'admin', password: 'admin123' });
await test('Auth: Leader Login', 'POST', '/api/v2/auth/leader-login',
  { email: 'lider@example.com', password: 'leader123' });

// Leaders
await test('Leaders: GET all', 'GET', '/api/v2/leaders');
await test('Leaders: GET single', 'GET', '/api/v2/leaders/123');

// Events
await test('Events: GET active', 'GET', '/api/v2/events/active/current');
await test('Events: GET all', 'GET', '/api/v2/events');

// Puestos
await test('Puestos: GET localidades', 'GET', '/api/v2/puestos/localidades');
await test('Puestos: GET by localidad', 'GET', '/api/v2/puestos/localidad/baruta');

// Registrations
await test('Registrations: POST register', 'POST', '/api/v2/registrations',
  { cedula: '12345678', nombre: 'Test', apellido: 'User' });
await test('Registrations: GET all', 'GET', '/api/v2/registrations');

console.log(`\n✓ ${pass} passed | ✗ ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
