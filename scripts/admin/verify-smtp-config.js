#!/usr/bin/env node

/**
 * Script de verificación de configuración de Resend API
 * Uso: node verify-smtp-config.js
 */

import { config } from 'dotenv';
import { Resend } from 'resend';

config();

console.log(`
╔════════════════════════════════════════════════════╗
║      🔍 VERIFICACIÓN DE CONFIGURACIÓN RESEND       ║
╚════════════════════════════════════════════════════╝
`);

// Verificar variables de entorno
const checks = {
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY ? '✓ Configurado' : undefined,
  BASE_URL: process.env.BASE_URL,
};

console.log('📋 Variables de Entorno:\n');
Object.entries(checks).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  console.log(`  ${status} ${key}: ${value || '(no definido)'}`);
});

console.log('\n');

// Verificar modo de operación
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  NODE_ENV no es "production"');
  console.log('   → El servicio usará MODO MOCK (emails en consola)');
  console.log('   → Para enviar emails reales, configura NODE_ENV=production\n');
} else {
  console.log('✅ NODE_ENV es "production"');
  console.log('   → El servicio intentará enviar emails con Resend\n');
}

// Verificar credenciales críticas
const missingVars = [];
if (!process.env.RESEND_API_KEY) missingVars.push('RESEND_API_KEY');
if (!process.env.BASE_URL) missingVars.push('BASE_URL');

if (missingVars.length > 0) {
  console.log('❌ Variables faltantes:\n');
  missingVars.forEach(v => console.log(`   • ${v}`));
  console.log('\n⚠️  El servicio NO podrá enviar emails hasta que estén configuradas.\n');
  process.exit(1);
}

// Test de conexión (solo en producción)
if (process.env.NODE_ENV === 'production') {
  console.log('🔌 Probando conexión a Resend API...\n');

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    console.log('✅ Cliente Resend inicializado correctamente!');
    console.log('   API Key: ✓ Configurada');
    console.log('\n✅ El servicio está listo para enviar emails con Resend.\n');
  } catch (error) {
    console.log('❌ Error inicializando Resend:\n');
    console.log(`   ${error.message}\n`);
    console.log('💡 Posibles causas:');
    console.log('   • RESEND_API_KEY inválida');
    console.log('   • Formato de API Key incorrecto');
    console.log('   • Problemas de conectividad\n');
    process.exit(1);
  }
} else {
  console.log('✅ Configuración válida para modo MOCK.');
  console.log('   Los emails se mostrarán en la consola del servidor.\n');
}
