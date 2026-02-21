/**
 * Script para procesar el GEOJSON oficial de puestos de votación
 * y extraer nombres reales de instituciones por localidad
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el archivo GEOJSON
const geojsonPath = path.join(__dirname, 'pvo.geojson');
const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

console.log('\n📊 Procesando datos de puestos de votación...\n');

// Agrupar por localidad
const puestosPorLocalidad = {};
const estadisticas = {
  totalPuestos: 0,
  localidades: {}
};

data.features.forEach(feature => {
  const props = feature.properties;
  
  // Extraer información de los campos correctos
  let localidad = props.LOCNOMBRE;
  const nombrePuesto = props.PVONOMBRE;
  
  if (!localidad || !nombrePuesto) return;
  
  // Limpiar encoding
  localidad = localidad.replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã/g, 'Á')
    .replace(/É/g, 'É')
    .replace(/Í/g, 'Í')
    .replace(/Ó/g, 'Ó')
    .replace(/Ú/g, 'Ú');
    
  const nombreLimpio = nombrePuesto.replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã/g, 'Á')
    .replace(/É/g, 'É')
    .replace(/Í/g, 'Í')
    .replace(/Ó/g, 'Ó')
    .replace(/Ú/g, 'Ú');
  
  estadisticas.totalPuestos++;
  
  if (!puestosPorLocalidad[localidad]) {
    puestosPorLocalidad[localidad] = [];
    estadisticas.localidades[localidad] = 0;
  }
  
  if (nombreLimpio && !puestosPorLocalidad[localidad].includes(nombreLimpio)) {
    puestosPorLocalidad[localidad].push(nombreLimpio);
    estadisticas.localidades[localidad]++;
  }
});

// Mostrar estadísticas
console.log('📈 ESTADÍSTICAS GENERALES:');
console.log('════════════════════════════════════════════════════════════════');
console.log(`Total de puestos encontrados: ${estadisticas.totalPuestos}`);
console.log(`Total de localidades: ${Object.keys(puestosPorLocalidad).length}\n`);

console.log('📍 PUESTOS POR LOCALIDAD:');
console.log('════════════════════════════════════════════════════════════════');
Object.entries(puestosPorLocalidad).sort().forEach(([localidad, puestos]) => {
  console.log(`\n${localidad}: ${puestos.length} puestos`);
  puestos.sort().slice(0, 5).forEach(p => {
    console.log(`  - ${p}`);
  });
  if (puestos.length > 5) {
    console.log(`  ... y ${puestos.length - 5} más`);
  }
});

// Generar archivo de salida con los datos estructurados
const output = {
  totalPuestos: estadisticas.totalPuestos,
  localidades: puestosPorLocalidad
};

fs.writeFileSync('puestos_estructura.json', JSON.stringify(output, null, 2));
console.log('\n✅ Datos guardados en puestos_estructura.json');
