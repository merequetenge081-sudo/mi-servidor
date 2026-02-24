/**
 * Script para buscar un puesto específico en la BD
 */

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

async function buscarPuesto() {
  console.log("\n🔍 BUSCANDO PUESTO DE VOTACIÓN");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    console.log(`✅ Conectado a BD\n`);
    
    // Buscar por:
    // 1. Nombre "Veracruz" o dirección "Carrera 101"
    // 2. Localidad "Fontibón"
    // 3. Código "160010907" (del archivo descargado)
    
    console.log("1️⃣  Buscando por nombre 'Veracruz' y/o dirección en Fontibón...");
    const busqueda1 = await Puestos.find({
      localidad: "Fontibon",
      $or: [
        { nombre: /Veracruz/i },
        { direccion: /Carrera 101/i }
      ]
    });
    
    console.log(`   Resultados: ${busqueda1.length}\n`);
    if (busqueda1.length > 0) {
      busqueda1.forEach(p => {
        console.log(`   ✅ ${p.nombre}`);
        console.log(`      📍 ${p.localidad} - ${p.direccion}`);
        console.log(`      📋 Mesas: ${p.mesas.join(', ')}`);
        console.log(`      🔑 Código: ${p.codigoPuesto}`);
        console.log();
      });
    }
    
    console.log("2️⃣  Buscando por código 160010907...");
    const busqueda2 = await Puestos.findOne({ codigoPuesto: "160010907" });
    
    if (busqueda2) {
      console.log(`   ✅ ENCONTRADO`);
      console.log(`   Nombre: ${busqueda2.nombre}`);
      console.log(`   Localidad: ${busqueda2.localidad}`);
      console.log(`   Dirección: ${busqueda2.direccion}`);
      console.log(`   Sitio: ${busqueda2.sitio}`);
      console.log(`   Mesas: ${busqueda2.mesas.join(', ')}`);
      console.log(`   Coordenadas: ${busqueda2.latitud}, ${busqueda2.longitud}\n`);
    } else {
      console.log(`   ❌ NO ENCONTRADO\n`);
    }
    
    console.log("3️⃣  Buscando CUALQUIER puesto en Fontibón con Carrera 101 #23...");
    const busqueda3 = await Puestos.find({
      localidad: "Fontibon",
      direccion: /23.*42/i
    });
    
    console.log(`   Resultados: ${busqueda3.length}\n`);
    if (busqueda3.length > 0) {
      busqueda3.forEach(p => {
        console.log(`   ✅ ${p.nombre}`);
        console.log(`      Dirección: ${p.direccion}`);
        console.log(`      Código: ${p.codigoPuesto}`);
        console.log();
      });
    }
    
    console.log("4️⃣  Listando TODOS los puestos en Fontibón...");
    const todosFont = await Puestos.find({ localidad: "Fontibon" });
    console.log(`   Total en Fontibón: ${todosFont.length}\n`);
    
    if (todosFont.length > 0) {
      console.log("   Primeros 5:");
      todosFont.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.nombre}`);
        console.log(`      📍 ${p.direccion}`);
      });
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

buscarPuesto();
