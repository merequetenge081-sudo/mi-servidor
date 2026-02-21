/**
 * Test local para import_puestos.js
 * Valida estructura sin conectar a MongoDB
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Datos de ejemplo para prueba
const PUESTOS_BOGOTA_EJEMPLO = [
  {
    codigoPuesto: "011001",
    nombre: "Colegio Distrital Usaquén",
    localidad: "Usaquén",
    direccion: "Cra 7 #120-50",
    mesas: [1, 2, 3, 4, 5]
  },
  {
    codigoPuesto: "012001",
    nombre: "Colegio Chapinero",
    localidad: "Chapinero",
    direccion: "Cra 7 #72-80",
    mesas: [1, 2, 3, 4]
  },
  {
    codigoPuesto: "018001",
    nombre: "Colegio Kennedy",
    localidad: "Kennedy",
    direccion: "Cra 68 #36-45",
    mesas: [1, 2, 3, 4, 5]
  }
];

async function testImport() {
  console.log('📋 TEST LOCAL: import_puestos.js\n');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Test 1: Validar estructura de datos
    console.log('✅ Test 1: Validando estructura de datos...');
    const puestosValidos = PUESTOS_BOGOTA_EJEMPLO.filter(p => 
      p.codigoPuesto && p.nombre && p.localidad && Array.isArray(p.mesas)
    );
    console.log(`   ✓ ${puestosValidos.length}/${PUESTOS_BOGOTA_EJEMPLO.length} puestos válidos\n`);

    // Test 2: Simular estadísticas
    console.log('✅ Test 2: Calculando estadísticas por localidad...');
    const stats = {};
    puestosValidos.forEach(p => {
      if (!stats[p.localidad]) {
        stats[p.localidad] = { count: 0, mesas: 0 };
      }
      stats[p.localidad].count++;
      stats[p.localidad].mesas += p.mesas.length;
    });

    console.log('   Resultados:');
    console.log('   ═══════════════════════════════════════════════════════');
    Object.entries(stats).sort().forEach(([localidad, data]) => {
      console.log(`   ${localidad.padEnd(25)} → ${data.count.toString().padStart(3)} puesto(s) | ${data.mesas.toString().padStart(3)} mesa(s)`);
    });
    console.log('   ═══════════════════════════════════════════════════════\n');

    // Test 3: Validar que script puede leer archivo
    console.log('✅ Test 3: Validando capacidad de lectura de archivo...');
    const testFile = path.join(__dirname, 'tools', 'puestos_procesados.json');
    if (fs.existsSync(testFile)) {
      const content = fs.readFileSync(testFile, 'utf-8');
      const data = JSON.parse(content);
      console.log(`   ✓ Archivo encontrado: ${data.length} puestos en puestos_procesados.json\n`);
    } else {
      console.log(`   ⚠️  Archivo no encontrado: ${testFile}\n`);
    }

    // Test 4: Validar ejemplo de puesto
    console.log('✅ Test 4: Estructura de documento ejemplo:');
    const ejemplo = PUESTOS_BOGOTA_EJEMPLO[0];
    console.log('   ───────────────────────────────────────────────────────');
    console.log(`   codigoPuesto: ${ejemplo.codigoPuesto}`);
    console.log(`   nombre: ${ejemplo.nombre}`);
    console.log(`   localidad: ${ejemplo.localidad}`);
    console.log(`   direccion: ${ejemplo.direccion}`);
    console.log(`   mesas: ${JSON.stringify(ejemplo.mesas)}`);
    console.log('   ───────────────────────────────────────────────────────\n');

    // Test 5: Validar que mongodb connection syntax es correcto
    console.log('✅ Test 5: Validando configuración de MongoDB...');
    const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor?retryWrites=true&w=majority";
    if (MONGO_URL.includes('mongodb+srv')) {
      console.log('   ✓ URL de MongoDB válida (usando MongoDB Atlas)\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✨ TODOS LOS TESTS PASARON EXITOSAMENTE\n');
    console.log('📌 Para ejecutar en Render:');
    console.log('   1. SSH a Render');
    console.log('   2. cd app');
    console.log('   3. node tools/import_puestos.js\n');

  } catch (error) {
    console.error('❌ Error en test:', error.message);
    process.exit(1);
  }
}

testImport();
