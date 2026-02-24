/**
 * Búsqueda exhaustiva de Fontibón/Veracruz
 */

import mongoose from 'mongoose';
import fs from 'fs';
import { config } from 'dotenv';

config();

const puestosSchema = new mongoose.Schema(
  {
    codigoPuesto: String,
    nombre: String,
    localidad: String,
    direccion: String,
    sitio: String,
    mesas: [Number],
    latitud: Number,
    longitud: Number,
    dateAdded: Date,
    source: String,
    activo: Boolean
  },
  { strict: false }
);

const Puestos = mongoose.model('Puestos', puestosSchema);

async function busquedaExhaustiva() {
  console.log("\n🔎 BÚSQUEDA EXHAUSTIVA");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    
    // 1. Ver todas las localidades únicas
    console.log("1️⃣  TODAS LAS LOCALIDADES EN BD:\n");
    const localidades = await Puestos.distinct('localidad');
    localidades.sort().forEach(loc => console.log(`   - ${loc}`));
    console.log();
    
    // 2. Buscar específicamente Fontibón/Fontibon/etc
    console.log("2️⃣  VARIANTES DE FONTIBÓN:\n");
    const variantes = ['Fontibon', 'Fontibón', 'FONTIBÓN', 'fontibón', 'Fontibon'];
    
    for (const variante of variantes) {
      const cantidad = await Puestos.countDocuments({ localidad: variante });
      if (cantidad > 0) {
        console.log(`   ✅ Encontrados ${cantidad} puestos con: "${variante}"`);
      }
    }
    console.log();
    
    // 3. Búsqueda fuzzy en localidades
    console.log("3️⃣  BÚSQUEDA REGEX (case-insensitive):\n");
    const fontibonRegex = await Puestos.find({ 
      localidad: /fontib/i 
    });
    console.log(`   Resultados: ${fontibonRegex.length}\n`);
    
    if (fontibonRegex.length > 0) {
      fontibonRegex.forEach(p => {
        console.log(`   ✅ ${p.nombre}`);
        console.log(`      📍 ${p.localidad} - ${p.direccion}`);
      });
    }
    
    // 4. Buscar por dirección "Carrera 101"
    console.log("\n4️⃣  PUESTOS EN CARRERA 101:\n");
    const carrera101 = await Puestos.find({ 
      direccion: /Carrera 101/i 
    });
    console.log(`   Resultados: ${carrera101.length}\n`);
    
    if (carrera101.length > 0) {
      carrera101.forEach(p => {
        console.log(`   ✅ ${p.nombre}`);
        console.log(`      📍 ${p.localidad} - ${p.direccion}`);
        console.log(`      🔑 Código: ${p.codigoPuesto}`);
      });
    }
    
    // 5. Buscar por código especial
    console.log("\n5️⃣  BÚSQUEDA POR CÓDIGO 160010907:\n");
    const porCodigo = await Puestos.findOne({ codigoPuesto: "160010907" });
    
    if (porCodigo) {
      console.log(`   ✅ ENCONTRADO`);
      console.log(`   Nombre: ${porCodigo.nombre}`);
      console.log(`   Localidad: ${porCodigo.localidad}`);
      console.log(`   Dirección: ${porCodigo.direccion}`);
    } else {
      console.log(`   ❌ No encontrado\n`);
      
      // Mostrar qué códigos SÍ existen
      const ejemploCodigos = await Puestos.find().select('codigoPuesto nombre').limit(5);
      console.log("   Ejemplos de códigos que SÍ existen:");
      ejemploCodigos.forEach(p => {
        console.log(`   - ${p.codigoPuesto}: ${p.nombre}`);
      });
    }
    
    // 6. Verificar archivo local
    console.log("\n6️⃣  BÚSQUEDA EN ARCHIVO LOCAL (puestos_exactos.json):\n");
    const puestosLocales = JSON.parse(fs.readFileSync('tools/puestos_exactos.json', 'utf-8'));
    
    const veracruzLocal = puestosLocales.find(p => 
      p.codigoPuesto === '160010907' || 
      p.nombre.includes('República de Costa Rica')
    );
    
    if (veracruzLocal) {
      console.log(`   ✅ ENCONTRADO EN ARCHIVO LOCAL`);
      console.log(`   Nombre: ${veracruzLocal.nombre}`);
      console.log(`   Localidad: ${veracruzLocal.localidad}`);
      console.log(`   Dirección: ${veracruzLocal.direccion}`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

busquedaExhaustiva();
