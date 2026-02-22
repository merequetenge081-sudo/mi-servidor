#!/usr/bin/env node

/**
 * Test script para validar el endpoint POST /api/leaders/:id/send-access
 * Uso: node test-send-access-email.js
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Credenciales de admin (cambiar si es necesario)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASS = 'admin123456';

async function testSendAccessEmail() {
  try {
    console.log(`
╔════════════════════════════════════════════════════╗
║    🧪 TEST: Endpoint POST /api/leaders/:id/send-access
║         Sistema de Envío de Email con QR
╚════════════════════════════════════════════════════╝
`);

    // Paso 1: Login admin
    console.log('\n📍 PASO 1: Autenticar como admin...');
    const loginRes = await fetch(`${API_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASS
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.text();
      throw new Error(`Login fallido: ${error}`);
    }

    const loginData = await loginRes.json();
    const { token } = loginData;
    console.log(`✓ Autenticado correctamente. Token: ${token.substring(0, 20)}...`);

    // Paso 2: Obtener lista de líderes
    console.log('\n📍 PASO 2: Obtener lista de líderes...');
    const leadersRes = await fetch(`${API_URL}/leaders`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!leadersRes.ok) {
      throw new Error(`No se pudo obtener líderes: ${leadersRes.status}`);
    }

    const leaders = await leadersRes.json();
    
    let leaderId;
    let leaderEmail;
    let leaderName;

    if (!Array.isArray(leaders) || leaders.length === 0) {
      console.log('⚠️  No hay líderes en el sistema. Creando uno de prueba...');
      
      // Crear un líder de prueba
      const createRes = await fetch(`${API_URL}/leaders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Leader',
          email: 'test.leader@example.com',
          phone: '1234567890',
          area: 'Test Area'
        })
      });

      if (!createRes.ok) {
        throw new Error(`No se pudo crear líder de prueba: ${createRes.status}`);
      }

      const newLeader = await createRes.json();
      console.log(`✓ Líder creado: ${newLeader.name} (${newLeader._id})`);
      
      leaderId = newLeader._id;
      leaderEmail = newLeader.email;
      leaderName = newLeader.name;
    } else {
      // Usar primer líder de la lista
      const firstLeader = leaders[0];
      leaderId = firstLeader._id;
      leaderEmail = firstLeader.email;
      leaderName = firstLeader.name;

      console.log(`✓ Encontrados ${leaders.length} líderes`);
      console.log(`  Usando: ${leaderName} (${leaderId})`);
      console.log(`  Email: ${leaderEmail}`);

      if (!leaderEmail) {
        console.warn('⚠️  Este líder no tiene email. Saltando prueba de envío.');
        return;
      }
    }

    // Paso 3: Enviar email de acceso
    console.log(`\n📍 PASO 3: Enviar email de acceso...`);
    console.log(`   ID del líder: ${leaderId}`);
    console.log(`   Email: ${leaderEmail}`);

    const sendEmailRes = await fetch(`${API_URL}/leaders/${leaderId}/send-access`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sendEmailRes.ok) {
      const error = await sendEmailRes.json();
      console.error('❌ Error al enviar email:', error);
      throw new Error(`Error: ${error.error}`);
    }

    const result = await sendEmailRes.json();
    console.log(`✓ Email enviado correctamente!`);
    console.log(`  Mensaje: ${result.message}`);
    if (result.mock) {
      console.log(`  📝 Nota: Modo MOCK (desarrollo). Se mostró en la consola del servidor.`);
    }
    if (result.messageId) {
      console.log(`  Message ID: ${result.messageId}`);
    }

    console.log(`
╔════════════════════════════════════════════════════╗
║           ✅ PRUEBA COMPLETADA EXITOSAMENTE
╚════════════════════════════════════════════════════╝

📋 Resumen:
  • Autenticación: ✓
  • Obtención de líderes: ✓
  • Envío de email: ✓

Next steps:
  1. Revisar la consola del servidor para ver el email mock
  2. En producción, verificar que EMAIL_USER y EMAIL_PASS están correctos
  3. Cambiar BASE_URL en .env a tu dominio real
    `);

  } catch (error) {
    console.error(`
╔════════════════════════════════════════════════════╗
║              ❌ ERROR EN LA PRUEBA
╚════════════════════════════════════════════════════╝
    `);
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Ejecutar prueba
testSendAccessEmail();
