/**
 * Reimportador: Importa los 50 puestos originales + 892 nuevos
 * Soluciona el problema de datos perdidos
 */

import fs from 'fs';
import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

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

async function reimportar() {
  console.log("\n🔄 REIMPORTADOR DE PUESTOS");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    console.log(`✅ Conectado a BD\n`);
    
    // 1. Cargar datos
    console.log("📂 Cargando datos...");
    const puestosOriginales = JSON.parse(fs.readFileSync('tools/puestos_exactos.json', 'utf-8'));
    const puestosNuevos = JSON.parse(fs.readFileSync('tools/puestos-nuevos-para-agregar.json', 'utf-8'));
    
    console.log(`   ✅ ${puestosOriginales.length} puestos originales`);
    console.log(`   ✅ ${puestosNuevos.length} puestos nuevos`);
    console.log(`   📊 Total: ${puestosOriginales.length + puestosNuevos.length}\n`);
    
    // 2. Limpiar colección
    console.log("🗑️  Limpiando colección Puestos...");
    const eliminados = await Puestos.deleteMany({});
    console.log(`   ✅ Eliminados: ${eliminados.deletedCount}\n`);
    
    // 3. Preparar todos los puestos
    const todosPuestos = [
      ...puestosOriginales.map(p => ({
        codigoPuesto: p.codigoPuesto || `ORIG_${p.nombre}`,
        nombre: p.nombre,
        localidad: p.localidad,
        direccion: p.direccion,
        sitio: p.sitio || '',
        mesas: p.mesas || [],
        latitud: p.latitud || null,
        longitud: p.longitud || null,
        source: 'original',
        activo: true
      })),
      ...puestosNuevos.map(p => ({
        codigoPuesto: p.codigoPuesto || `NEW_${p.nombre}`,
        nombre: p.nombre,
        localidad: p.localidad,
        direccion: p.direccion,
        sitio: p.sitio || '',
        mesas: p.mesas || [],
        latitud: p.latitud || null,
        longitud: p.longitud || null,
        source: p.source || 'datos.gov.co-sincronizacion',
        activo: true
      }))
    ];
    
    console.log(`📝 Insertando ${todosPuestos.length} puestos...\n`);
    
    let insertados = 0;
    let errores = 0;
    let duplicados = 0;
    
    for (const puesto of todosPuestos) {
      try {
        // Verificar duplicados por código o nombre+localidad
        const existe = await Puestos.findOne({
          $or: [
            { codigoPuesto: puesto.codigoPuesto },
            { nombre: puesto.nombre, localidad: puesto.localidad }
          ]
        });
        
        if (existe) {
          duplicados++;
        } else {
          await Puestos.create(puesto);
          insertados++;
          
          if (insertados % 100 === 0) {
            console.log(`   ✅ Insertados ${insertados}...`);
          }
        }
      } catch (error) {
        errores++;
        console.log(`   ❌ Error: ${puesto.nombre} - ${error.message}`);
      }
    }
    
    console.log("\n═════════════════════════════════════════════");
    console.log("📊 RESULTADO");
    console.log("═════════════════════════════════════════════");
    console.log(`✅ Insertados: ${insertados}`);
    console.log(`⏭️  Duplicados: ${duplicados}`);
    console.log(`❌ Errores: ${errores}`);
    console.log("═════════════════════════════════════════════\n");
    
    // 4. Verificar datos
    const total = await Puestos.countDocuments();
    console.log(`📦 Total en BD: ${total}`);
    
    // Localidades
    const localidades = await Puestos.distinct('localidad');
    console.log(`📍 Localidades: ${localidades.length}`);
    console.log(`   ${localidades.sort().join(', ')}\n`);
    
    // 5. Verificar Fontibón específicamente
    console.log("🔍 VERIFICACIÓN ESPECIAL - Fontibón:");
    const fontibonPuestos = await Puestos.find({ localidad: "Fontibon" });
    console.log(`   Puestos en Fontibón: ${fontibonPuestos.length}\n`);
    
    if (fontibonPuestos.length > 0) {
      fontibonPuestos.forEach(p => {
        console.log(`   ✅ ${p.nombre}`);
        console.log(`      📍 ${p.direccion}`);
        console.log(`      🔑 Código: ${p.codigoPuesto}`);
        console.log(`      📦 Fuente: ${p.source}\n`);
      });
    }
    
    // 6. Buscar específicamente el código
    console.log("🔍 BÚSQUEDA ESPECÍFICA - Código 160010907:");
    const codigo160010907 = await Puestos.findOne({ codigoPuesto: "160010907" });
    if (codigo160010907) {
      console.log(`   ✅ ENCONTRADO`);
      console.log(`   Nombre: ${codigo160010907.nombre}`);
      console.log(`   Localidad: ${codigo160010907.localidad}`);
      console.log(`   Dirección: ${codigo160010907.direccion}`);
    } else {
      console.log(`   ❌ No encontrado`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

console.log("⚠️  ADVERTENCIA: Este script limpiará la colección y la reimportará");
console.log("    Si tienes datos personalizados, haz backup primero!\n");

reimportar();
