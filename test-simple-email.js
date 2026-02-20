#!/usr/bin/env node

/**
 * Test simple del endpoint de envío de email
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

async function test() {
  try {
    console.log('Probando endpoint /api/auth/admin-login...\n');

    const loginRes = await fetch('http://localhost:3000/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123456'
      })
    });

    console.log('Status:', loginRes.status);
    console.log('Headers:', Object.fromEntries(loginRes.headers));

    const text = await loginRes.text();
    console.log('\nRespuesta (texto):', text);

    if (loginRes.ok) {
      const data = JSON.parse(text);
      console.log('\n✓ Login exitoso');
      console.log('Token:', data.token.substring(0, 50) + '...');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

test();
