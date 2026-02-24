/**
 * Debug: Verificar estado de BD y buscar dónde está el puesto
 */

import mongoose from 'mongoose';
import fs from 'fs';
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

async function debug() {
  console.log("\n🔧 DEBUG: Estado de Puestos");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    
    // 1. Contar total
    const total = await Puestos.countDocuments();
    console.log(`📊 Total de documentos en colección Puestos: ${total}\n`);
    
    // 2. Check si está vacía
    if (total === 0) {
      console.log("❌ Colección VACÍA!\n");
      
      // Ver si existen otras colecciones
      const colecciones = await mongoose.connection.db.listCollections().toArray();
      console.log("📋 Colecciones disponibles en BD:");
      colecciones.forEach(c => console.log(`   - ${c.name}`));
      
      // Buscar en puestos_exactos.json
      console.log("\n📂 Verificando archivo local puestos_exactos.json...");
      const puestosLocales = JSON.parse(fs.readFileSync('tools/puestos_exactos.json', 'utf-8'));
      console.log(`   Total de puestos locales: ${puestosLocales.length}`);
      
      // Buscar Veracruz en archivo local
      const veracruz = puestosLocales.find(p => 
        p.nombre.includes('Veracruz') || 
        p.nombre.includes('República de Costa Rica') ||
        p.codigoPuesto === '160010907'
      );
      
      if (veracruz) {
        console.log(`\n✅ ENCONTRADO EN ARCHIVO LOCAL:`);
        console.log(`   Nombre: ${veracruz.nombre}`);
        console.log(`   Localidad: ${veracruz.localidad}`);
        console.log(`   Dirección: ${veracruz.direccion}`);
        console.log(`   Código: ${veracruz.codigoPuesto}`);
      }
      
    } else {
      console.log(`✅ Colección con ${total} documentos\n`);
      
      // Mostrar primeros puestos
      const primeros = await Puestos.find().limit(3);
      console.log("Primeros 3 puestos:");
      primeros.forEach(p => {
        console.log(`  - ${p.nombre} (${p.localidad})`);
      });
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

debug();
