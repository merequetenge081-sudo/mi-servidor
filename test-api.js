import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import jwt from 'jsonwebtoken';

const API_URL = 'http://localhost:3000';

// Crear token de admin
const adminToken = jwt.sign(
  { username: 'admin', role: 'admin' },
  'tu-clave-secreta-supersecreto-123',
  { expiresIn: '24h' }
);

async function testAPI() {
  try {
    // Test 1: Get events
    console.log('🔍 Obteniendo eventos del API...\n');
    const eventRes = await fetch(`${API_URL}/api/events`, {
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${eventRes.status}`);
    console.log(`Headers: ${JSON.stringify(Object.fromEntries(eventRes.headers))}\n`);
    
    const events = await eventRes.json();
    console.log('📋 Eventos recibidos:');
    console.log(JSON.stringify(events, null, 2));
    
    if (Array.isArray(events)) {
      console.log(`\n✓ Total eventos: ${events.length}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testAPI();
