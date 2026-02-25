/**
 * Script para importar TODOS los 965 puestos de votación de Bogotá
 * Fuente: pvo.geojson (datos.gov.co + Registraduría)
 * 
 * Uso: node tools/import-complete-puestos.js
 * 
 * Este script:
 * 1. Lee los 965 puestos del geojson
 * 2. Los procesa y normaliza según el modelo Puestos
 * 3. Limpia la colección anterior
 * 4. Importa todos los puestos nuevos
 * 5. Agrega aliases automáticamente
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Puestos } from '../src/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor?retryWrites=true&w=majority';
const GEOJSON_FILE = path.join(__dirname, 'pvo.geojson');

// Aliases comunes para búsqueda fuzzy
const ALIASES = {
  'salitre': ['El Salitre', 'Salitre Greco'],
  'colegio': ['Colegio'],
  'escuela': ['Escuela'],
  'parque': ['Parque'],
  'vía pública': ['Vía Pública'],
};

async function importPuestos() {
  try {
    console.log('🔄 Iniciando importación de puestos...\n');

    // Conectar a MongoDB
    await mongoose.connect(MONGO_URL, {
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.log('✅ Conectado a MongoDB');

    // Leer GeoJSON
    if (!fs.existsSync(GEOJSON_FILE)) {
      throw new Error(`No encontrado: ${GEOJSON_FILE}`);
    }

    const geojson = JSON.parse(fs.readFileSync(GEOJSON_FILE, 'utf8'));
    const features = geojson.features || [];

    console.log(`\n📊 GeoJSON contiene: ${features.length} puestos`);

    // Procesar features a formato Puestos
    const puestosProcessados = features.map((feature, idx) => {
      const props = feature.properties;
      
      // Crear aliases automáticos
      const aliases = [];
      const nombre = props.PVONOMBRE || '';
      
      // Agregar variaciones del nombre
      aliases.push(nombre);
      
      // Agregar nombre sin "Colegio", "Escuela", etc.
      const nombreSimple = nombre
        .replace(/^Colegio\s+/i, '')
        .replace(/^Escuela\s+/i, '')
        .replace(/^Centro\s+/i, '')
        .replace(/\s+-\s+Sede\s+[A-Z]\d*$/i, '')
        .trim();
      if (nombreSimple !== nombre && nombreSimple.length > 3) {
        aliases.push(nombreSimple);
      }

      // Agregar localidad
      aliases.push(props.LOCNOMBRE);

      // Agregar sitio si existe
      if (props.PVONSITIO && props.PVONSITIO !== nombre) {
        aliases.push(props.PVONSITIO);
      }

      return {
        codigoPuesto: props.PVOCODIGO,
        nombre: nombre,
        localidad: props.LOCNOMBRE,
        codigoLocalidad: props.LOCCODIGO,
        direccion: props.PVODIRECCI || '',
        sitio: props.PVONSITIO || '',
        numeroMesas: parseInt(props.PVONPUESTO) || 1,
        mesas: Array.from({ length: parseInt(props.PVONPUESTO) || 1 }, (_, i) => ({
          numero: i + 1,
          activa: true
        })),
        aliases: [...new Set(aliases)], // Eliminar duplicados
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    console.log(`\n📋 Procesados ${puestosProcessados.length} puestos`);

    // Backup de puestos actuales
    const countActuales = await Puestos.countDocuments();
    console.log(`\n⚠️  Puestos actuales en BD: ${countActuales}`);

    if (countActuales > 0) {
      // Crear backup
      const backup = await Puestos.find().lean();
      const backupFile = path.join(__dirname, `puestos-backup-${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      console.log(`💾 Backup guardado: ${backupFile}`);
    }

    // Limpiar colección
    console.log(`\n🧹 Limpiando colección anterior...`);
    await Puestos.deleteMany({});
    console.log('✅ Colección limpiada');

    // Importar nuevos puestos
    console.log(`\n📥 Importando ${puestosProcessados.length} puestos...`);
    const resultado = await Puestos.insertMany(puestosProcessados, { ordered: false });
    console.log(`✅ Importados: ${resultado.length} puestos`);

    // Estadísticas finales
    const stats = await Puestos.aggregate([
      {
        $group: {
          _id: '$localidad',
          count: { $sum: 1 },
          totalMesas: { $sum: '$numeroMesas' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log(`\n📊 ESTADÍSTICAS FINALES:`);
    console.log('═'.repeat(60));
    console.log(`Total de puestos: ${puestosProcessados.length}`);
    console.log(`Total de mesas: ${stats.reduce((sum, s) => sum + s.totalMesas, 0)}`);
    console.log(`\nPor Localidad:`);
    stats.forEach(s => {
      console.log(`  • ${s._id}: ${s.count} puestos, ${s.totalMesas} mesas`);
    });

    // Verificar puestos específicos
    console.log(`\n🔍 VERIFICACIÓN ESPECÍFICA:`);
    
    const salitre = await Puestos.findOne({ 
      nombre: /salitre/i 
    });
    if (salitre) {
      console.log(`✅ "El Salitre" encontrado en ${salitre.localidad}`);
      console.log(`   Código: ${salitre.codigoPuesto}`);
    }

    const provinma = await Puestos.findOne({ 
      nombre: /provinma/i 
    });
    if (provinma) {
      console.log(`✅ "Colegio Provinma" (puesto #44 Usaquén) encontrado`);
      console.log(`   Localidad: ${provinma.localidad}`);
      console.log(`   Código: ${provinma.codigoPuesto}`);
    }

    console.log(`\n✅ IMPORTACIÓN COMPLETADA EXITOSAMENTE`);
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');
  }
}

// Ejecutar
importPuestos();
