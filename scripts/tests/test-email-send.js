#!/usr/bin/env node

import 'dotenv/config';
import { emailService } from './src/services/emailService.js';
import logger from './src/config/logger.js';

// Test data
const testLeader = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test Leader',
  email: process.env.TEST_EMAIL || 'test@example.com',
  token: 'test-token-12345'
};

async function runTest() {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║       📧 TEST DE ENVÍO DE EMAIL - PRODUCCIÓN       ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  
  console.log(`📋 Datos del Test:`);
  console.log(`   Email destino: ${testLeader.email}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Configurado' : '❌ NO configurado'}`);
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Configurado' : '❌ NO configurado'}`);
  console.log(`   BASE_URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    console.log(`🚀 Iniciando envío de email...\n`);
    
    const result = await emailService.sendAccessEmail(
      testLeader, 
      process.env.BASE_URL || 'http://localhost:3000'
    );
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 Resultado del Test:\n`);
    console.log(`   Success: ${result.success ? '✅ Sí' : '❌ No'}`);
    console.log(`   Mock: ${result.mock ? '⚠️  Sí (simulado)' : '✅ No (real)'}`);
    console.log(`   Fallback: ${result.fallback ? '❌ Sí (error SMTP)' : '✅ No'}`);
    if (result.messageId) console.log(`   Message ID: ${result.messageId}`);
    if (result.error) console.log(`   Error: ${result.error}`);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    if (result.success && !result.mock) {
      console.log(`✅ ✅ ✅ EMAIL ENVIADO EXITOSAMENTE ✅ ✅ ✅\n`);
      process.exit(0);
    } else if (result.mock) {
      console.log(`⚠️  EMAIL EN MODO SIMULADO - verificar credenciales SMTP\n`);
      process.exit(1);
    } else if (result.fallback) {
      console.log(`❌ ERROR SMTP DETECTADO:\n${result.error}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
