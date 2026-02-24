/**
 * Importador de puestos nuevos a MongoDB
 * Lee puestos-nuevos-para-agregar.json y los inserta en BD
 */

import fs from 'fs';
import mongoose from 'mongoose';
import chalk from 'chalk';
import { config } from 'dotenv';

config();

// Modelo Puestos (versión simplificada)
const puestosSchema = new mongoose.Schema({
  codigoPuesto: { type: String, unique: true, sparse: true },
  nombre: { type: String, required: true, index: true },
  localidad: { type: String, index: true },
  direccion: String,
  sitio: String,
  mesas: [Number],
  latitud: Number,
  longitud: Number,
  dateAdded: { type: Date, default: Date.now },
  source: String,
  activo: { type: Boolean, default: true }
}, { timestamps: true });

const Puestos = mongoose.model('Puestos', puestosSchema);

async function importarPuestosNuevos() {
  console.log("\n🔄 IMPORTADOR DE PUESTOS NUEVOS");
  console.log("═══════════════════════════════════════════\n");
  
  try {
    // Conectar BD
    console.log("🔐 Conectando a MongoDB...");
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    console.log(`✅ Conectado: ${mongoUrl}\n`);
    
    // Leer archivo
    console.log("📂 Leyendo puestos nuevos...");
    const puestosNuevos = JSON.parse(
      fs.readFileSync('tools/puestos-nuevos-para-agregar.json', 'utf-8')
    );
    console.log(`✅ ${puestosNuevos.length} puestos a importar\n`);
    
    // Preparar para inserción
    const puestosPreparados = puestosNuevos.map(p => ({
      codigoPuesto: p.codigoPuesto || `AUTO_${Date.now()}_${Math.random().toString(36)}`,
      nombre: p.nombre,
      localidad: p.localidad,
      direccion: p.direccion,
      sitio: p.sitio,
      mesas: p.mesas || [],
      latitud: p.latitud,
      longitud: p.longitud,
      source: 'datos.gov.co-sincronizacion',
      activo: true
    }));
    
    // Validar
    console.log("✓ Validando puestos...");
    let validos = 0;
    const erroresValidacion = [];
    
    for (let i = 0; i < puestosPreparados.length; i++) {
      const p = puestosPreparados[i];
      
      if (!p.nombre || p.nombre.trim() === '') {
        erroresValidacion.push(`Puesto ${i}: falta nombre`);
      } else {
        validos++;
      }
    }
    
    console.log(`✅ ${validos} puestos válidos\n`);
    
    if (erroresValidacion.length > 0) {
      console.log("⚠️  Errores de validación:");
      erroresValidacion.slice(0, 5).forEach(e => console.log(`  - ${e}`));
      if (erroresValidacion.length > 5) {
        console.log(`  ... y ${erroresValidacion.length - 5} más\n`);
      }
    }
    
    // Insertar
    console.log(`📝 Insertando ${puestosPreparados.length} puestos...\n`);
    
    let insertados = 0;
    let duplicados = 0;
    let errores = 0;
    
    for (const puesto of puestosPreparados) {
      try {
        // Verificar si ya existe por código o nombre
        const existe = await Puestos.findOne({
          $or: [
            { codigoPuesto: puesto.codigoPuesto },
            { nombre: puesto.nombre, localidad: puesto.localidad }
          ]
        });
        
        if (existe) {
          duplicados++;
          console.log(`⏭️  Salteado (existe): ${puesto.nombre}`);
        } else {
          await Puestos.create(puesto);
          insertados++;
          
          if (insertados % 50 === 0) {
            console.log(`   ✅ Insertados ${insertados}...`);
          }
        }
      } catch (error) {
        errores++;
        console.log(`   ❌ Error: ${puesto.nombre} - ${error.message}`);
      }
    }
    
    console.log("\n═════════════════════════════════════════════");
    console.log("📊 RESULTADO DE IMPORTACIÓN");
    console.log("═════════════════════════════════════════════");
    console.log(`✅ Insertados: ${insertados}`);
    console.log(`⏭️  Duplicados (no insertados): ${duplicados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log("═════════════════════════════════════════════\n");
    
    // Contar total en BD
    const totalBD = await Puestos.countDocuments();
    console.log(`📦 Total de puestos en BD: ${totalBD}\n`);
    
    // Contar por localidad
    console.log("📍 Distribución por localidad:");
    const porLocalidad = await Puestos.aggregate([
      { $group: { _id: '$localidad', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    porLocalidad.forEach(({ _id, count }) => {
      console.log(`  ${_id}: ${count} puestos`);
    });
    
    if (porLocalidad.length === 10) {
      const otras = await Puestos.countDocuments({
        localidad: { $nin: porLocalidad.map(x => x._id) }
      });
      console.log(`  Otras localidades: ${otras} puestos`);
    }
    
    console.log("\n✅ Importación completada\n");
    
  } catch (error) {
    console.error(`\n❌ Error fatal: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Ejecutar
importarPuestosNuevos();
