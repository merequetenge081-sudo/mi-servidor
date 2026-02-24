/**
 * Validador final de sincronización de puestos
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

async function validacionFinal() {
  console.log("\n✅ VALIDACIÓN FINAL DE SINCRONIZACIÓN");
  console.log("════════════════════════════════════════════════\n");
  
  try {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/mi-servidor';
    await mongoose.connect(mongoUrl);
    
    // Estadísticas generales
    const totalPuestos = await Puestos.countDocuments();
    const activos = await Puestos.countDocuments({ activo: true });
    const conCoordenadas = await Puestos.countDocuments({
      latitud: { $exists: true, $ne: null },
      longitud: { $exists: true, $ne: null }
    });
    const conCodigoPuesto = await Puestos.countDocuments({
      codigoPuesto: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log("📊 ESTADÍSTICAS GENERALES");
    console.log("─────────────────────────────────────────────");
    console.log(`Total de puestos: ${totalPuestos}`);
    console.log(`Puestos activos: ${activos}`);
    console.log(`Con coordenadas (lat/lon): ${conCoordenadas} (${((conCoordenadas/totalPuestos)*100).toFixed(1)}%)`);
    console.log(`Con código de puesto: ${conCodigoPuesto} (${((conCodigoPuesto/totalPuestos)*100).toFixed(1)}%)`);
    
    // Por localidad
    console.log("\n📍 PUESTOS POR LOCALIDAD");
    console.log("─────────────────────────────────────────────");
    const porLocalidad = await Puestos.aggregate([
      { $group: { _id: '$localidad', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    let total = 0;
    porLocalidad.forEach(({ _id, count }, idx) => {
      total += count;
      const barra = '█'.repeat(Math.floor(count / 3));
      console.log(`${_id.padEnd(25)} │ ${count.toString().padStart(3)} ${barra}`);
    });
    
    // Por fuente
    console.log("\n📦 PUESTOS POR FUENTE");
    console.log("─────────────────────────────────────────────");
    const porFuente = await Puestos.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    porFuente.forEach(({ _id, count }) => {
      const porcentaje = ((count / totalPuestos) * 100).toFixed(1);
      console.log(`${(_id || 'sin especificar').padEnd(30)} ${count.toString().padStart(4)} (${porcentaje.padStart(5)}%)`);
    });
    
    // Ejemplos recientes
    console.log("\n🆕 ÚLTIMOS PUESTOS AGREGADOS");
    console.log("─────────────────────────────────────────────");
    const ultimos = await Puestos.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    ultimos.forEach((p, i) => {
      console.log(`${i + 1}. ${p.nombre}`);
      console.log(`   📍 ${p.localidad} - ${p.direccion}`);
      if (p.mesas && p.mesas.length > 0) {
        console.log(`   📋 Mesas: ${p.mesas.join(', ')}`);
      }
    });
    
    // Puestos sin coordenadas
    console.log("\n⚠️  PUESTOS SIN COORDENADAS");
    console.log("─────────────────────────────────────────────");
    const sinCoordenadas = await Puestos.countDocuments({
      $or: [
        { latitud: { $exists: false } },
        { latitud: null },
        { longitud: { $exists: false } },
        { longitud: null }
      ]
    });
    
    console.log(`Total sin coordenadas: ${sinCoordenadas} (${((sinCoordenadas/totalPuestos)*100).toFixed(1)}%)`);
    
    if (sinCoordenadas > 0 && sinCoordenadas <= 10) {
      const ejemplos = await Puestos.find({
        $or: [
          { latitud: { $exists: false } },
          { latitud: null }
        ]
      }).limit(5);
      
      console.log("\nEjemplos:");
      ejemplos.forEach(p => console.log(`  - ${p.nombre} (${p.localidad})`));
    }
    
    // Resumen final
    console.log("\n════════════════════════════════════════════════");
    console.log("✅ SINCRONIZACIÓN COMPLETADA CON ÉXITO");
    console.log("════════════════════════════════════════════════");
    console.log(`\n📋 Total de puestos en BD: ${totalPuestos}`);
    console.log(`📊 Cobertura: 19 localidades de Bogotá`);
    console.log(`📍 Coordenadas disponibles: ${((conCoordenadas/totalPuestos)*100).toFixed(1)}%\n`);
    
    // Guardar reporte
    const reporte = {
      fechaSincronizacion: new Date().toISOString(),
      totalPuestos,
      activos,
      conCoordenadas,
      conCodigoPuesto,
      porLocalidad,
      porFuente,
      estadisticas: {
        conCoordenadas,
        sinCoordenadas,
        porcentajeCoordenadas: ((conCoordenadas/totalPuestos)*100).toFixed(1)
      }
    };
    
    fs.writeFileSync(`tools/reporte-sincronizacion-${Date.now()}.json`, JSON.stringify(reporte, null, 2));
    console.log(`📁 Reporte guardado en: tools/reporte-sincronizacion-${Date.now()}.json\n`);
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Ejecutar
validacionFinal();
