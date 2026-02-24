/**
 * Actualizador de alias en puestos de votación
 * Agrega campo "alias" basado en nombres conocidos
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { aliasPuestos, encontrarAlias } from '../src/utils/aliasPuestos.js';

config();

const puestosSchema = new mongoose.Schema({
  codigoPuesto: String,
  nombre: String,
  localidad: String,
  direccion: String,
  sitio: String,
  aliases: [String],
  mesas: [Number],
  latitud: Number,
  longitud: Number,
  dateAdded: Date,
  source: String,
  activo: Boolean
}, { strict: false });

const Puestos = mongoose.model('Puestos', puestosSchema);

async function actualizarAlias() {
  console.log("\n🏷️  ACTUALIZADOR DE ALIAS");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    console.log(`✅ Conectado a BD\n`);
    
    // Obtener todos los puestos
    const todosLosPuestos = await Puestos.find({});
    console.log(`📦 Total de puestos: ${todosLosPuestos.length}\n`);
    
    let actualizados = 0;
    let noEncontrados = 0;
    
    console.log("🔄 Buscando alias para cada puesto...\n");
    
    for (const puesto of todosLosPuestos) {
      // Buscar alias por nombre
      let alias = encontrarAlias(puesto.nombre);
      
      // Si no encuentra por nombre, buscar por sitio
      if (!alias && puesto.sitio) {
        alias = encontrarAlias(puesto.sitio);
      }
      
      // Si encontramos alias, actualizar
      if (alias) {
        await Puestos.updateOne(
          { _id: puesto._id },
          { $set: { aliases: [alias] } }
        );
        
        actualizados++;
        
        if (actualizados <= 10) {
          console.log(`✅ ${alias} → ${puesto.nombre}`);
        } else if (actualizados === 11) {
          console.log(`   ... actualizando más puestos ...\n`);
        }
        
        if (actualizados % 50 === 0) {
          console.log(`   ✅ Actualizados ${actualizados}...`);
        }
      } else {
        noEncontrados++;
      }
    }
    
    console.log("\n═════════════════════════════════════════════");
    console.log("📊 RESULTADO");
    console.log("═════════════════════════════════════════════");
    console.log(`✅ Actualizados con alias: ${actualizados}`);
    console.log(`⚪ Sin alias asignado: ${noEncontrados}`);
    console.log("═════════════════════════════════════════════\n");
    
    // Verificar ejemplos
    console.log("🔍 VERIFICACIÓN - Ejemplos con alias:\n");
    
    const ejemplos = await Puestos.find({ aliases: { $exists: true, $ne: [] } }).limit(5);
    
    ejemplos.forEach(p => {
      const aliasEjemplo = Array.isArray(p.aliases) ? p.aliases[0] : undefined;
      console.log(`📍 ${aliasEjemplo || 'Sin alias'} - ${p.nombre}`);
      console.log(`   📮 ${p.localidad} - ${p.direccion}\n`);
    });
    
    // Verificar específicamente Veracruz
    console.log("🎯 VERIFICACIÓN ESPECIAL - Veracruz:\n");
    const veracruz = await Puestos.findOne({ 
      localidad: "Fontibon",
      nombre: /República de Costa Rica/i
    });
    
    if (veracruz) {
      console.log(`✅ Puesto encontrado:`);
      const aliasVeracruz = Array.isArray(veracruz.aliases) ? veracruz.aliases[0] : undefined;
      console.log(`   Alias: ${aliasVeracruz || 'No asignado'}`);
      console.log(`   Nombre: ${veracruz.nombre}`);
      console.log(`   Dirección: ${veracruz.direccion}\n`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

actualizarAlias();
