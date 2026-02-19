#!/usr/bin/env node

/**
 * Script de verificación de configuración SMTP
 * Uso: node verify-smtp-config.js
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

console.log(`
╔════════════════════════════════════════════════════╗
║      🔍 VERIFICACIÓN DE CONFIGURACIÓN SMTP         ║
╚════════════════════════════════════════════════════╝
`);

// Verificar variables de entorno
const checks = {
  NODE_ENV: process.env.NODE_ENV,
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.hostinger.com',
  SMTP_PORT: process.env.SMTP_PORT || '465',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : undefined,
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
  console.log('   → El servicio intentará enviar emails reales\n');
}

// Verificar credenciales críticas
const missingVars = [];
if (!process.env.EMAIL_USER) missingVars.push('EMAIL_USER');
if (!process.env.EMAIL_PASS) missingVars.push('EMAIL_PASS');
if (!process.env.BASE_URL) missingVars.push('BASE_URL');

if (missingVars.length > 0) {
  console.log('❌ Variables faltantes:\n');
  missingVars.forEach(v => console.log(`   • ${v}`));
  console.log('\n⚠️  El servicio NO podrá enviar emails hasta que estén configuradas.\n');
  process.exit(1);
}

// Test de conexión (solo en producción)
if (process.env.NODE_ENV === 'production') {
  console.log('🔌 Probando conexión SMTP...\n');

  const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpSecure = smtpPort === 465;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.log('❌ Error de conexión SMTP:\n');
      console.log(`   ${error.message}\n`);
      console.log('💡 Posibles causas:');
      console.log('   • Credenciales incorrectas');
      console.log('   • Host o puerto incorrectos');
      console.log('   • Firewall bloqueando el puerto');
      console.log('   • Email no configurado en el hosting\n');
      process.exit(1);
    } else {
      console.log('✅ Conexión SMTP exitosa!');
      console.log(`   Host: ${smtpHost}`);
      console.log(`   Puerto: ${smtpPort}`);
      console.log(`   SSL: ${smtpSecure}`);
      console.log(`   Usuario: ${process.env.EMAIL_USER}`);
      console.log('\n✅ El servicio está listo para enviar emails.\n');
    }
  });
} else {
  console.log('✅ Configuración válida para modo MOCK.');
  console.log('   Los emails se mostrarán en la consola del servidor.\n');
}
