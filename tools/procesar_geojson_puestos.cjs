#!/usr/bin/env node
/**
 * Procesa GeoJSON oficial de Bogotá y prepara datos para importar
 * Convierte coordenadas y estructura a formato compatible con schema Puestos
 * 
 * Mapeo de campos:
 * - PVOCODIGO → codigoPuesto
 * - PVONOMBRE → nombre
 * - LOCNOMBRE → localidad
 * - PVODIRECCI → direccion
 * - PVONPUESTO → mesas
 * - geometry.coordinates → coordinates [lon, lat]
 */

const fs = require('fs');
const path = require('path');

// Localidades de Bogotá con códigos
const mapeoLocalidades = {
  '01': 'Usaquén',
  '02': 'Chapinero',
  '03': 'Santa Fe',
  '04': 'San Cristóbal',
  '05': 'Usme',
  '06': 'Tunjuelito',
  '07': 'Bosa',
  '08': 'Kennedy',
  '09': 'Fontibón',
  '10': 'Engativá',
  '11': 'Suba',
  '12': 'Barrios Unidos',
  '13': 'Teusaquillo',
  '14': 'Mártires',
  '15': 'Antonio Nariño',
  '16': 'Puente Aranda',
  '17': 'Candelaria',
  '18': 'Rafael Uribe Uribe',
  '19': 'Ciudad Bolívar',
  '20': 'Sumapaz',
};

/**
 * Procesa un feature del GeoJSON
 * Agrupa puestos por localidad y código de puesto
 */
function procesarGeoJSON(archivoEntrada, archivoSalida) {
  console.log(`📖 Leyendo GeoJSON desde: ${archivoEntrada}`);
  
  let geojson;
  try {
    const contenido = fs.readFileSync(archivoEntrada, 'utf8');
    geojson = JSON.parse(contenido);
  } catch (error) {
    console.error('❌ Error al leer/parsear GeoJSON:', error.message);
    process.exit(1);
  }

  const puestos = {};
  let duplicados = 0;
  let procesados = 0;

  console.log(`\n🔄 Procesando ${geojson.features.length} features...`);

  geojson.features.forEach((feature, idx) => {
    const props = feature.properties;
    const coords = feature.geometry?.coordinates;

    if (!props.PVOCODIGO || !props.PVONOMBRE) {
      console.warn(`⚠️  Feature ${idx} sin PVOCODIGO o PVONOMBRE`);
      return;
    }

    const codigoPuesto = props.PVOCODIGO;
    const mesa = parseInt(props.PVONPUESTO) || 0;

    // Usar localidad de props si existe, si no mapear por código
    let localidad = props.LOCNOMBRE;
    if (!localidad && props.LOCCODIGO) {
      localidad = mapeoLocalidades[props.LOCCODIGO];
    }

    if (!localidad) {
      console.warn(`⚠️  Feature ${idx} sin localidad`);
      return;
    }

    // Agrupar mesas por puesto
    if (puestos[codigoPuesto]) {
      // Ya existe, agregar mesa si no está
      if (!puestos[codigoPuesto].mesas.includes(mesa)) {
        puestos[codigoPuesto].mesas.push(mesa);
      }
      duplicados++;
    } else {
      puestos[codigoPuesto] = {
        codigoPuesto,
        nombre: props.PVONOMBRE.trim(),
        localidad: localidad.trim(),
        direccion: (props.PVODIRECCI || '').trim(),
        mesas: mesa > 0 ? [mesa] : [],
        coordinates: coords ? { longitude: coords[0], latitude: coords[1] } : null,
      };
      procesados++;
    }
  });

  // Ordenar mesas en cada puesto
  Object.values(puestos).forEach(puesto => {
    puesto.mesas.sort((a, b) => a - b);
  });

  const arrayPuestos = Object.values(puestos);

  console.log(`\n✅ Procesamiento completado:`);
  console.log(`   • Puestos únicos: ${procesados}`);
  console.log(`   • Mesas adicionales encontradas: ${duplicados}`);
  console.log(`   • Total para importar: ${arrayPuestos.length}`);

  // Contar por localidad
  const porLocalidad = {};
  arrayPuestos.forEach(p => {
    porLocalidad[p.localidad] = (porLocalidad[p.localidad] || 0) + 1;
  });

  console.log(`\n📊 Distribución por localidad:`);
  Object.entries(porLocalidad)
    .sort((a, b) => b[1] - a[1])
    .forEach(([loc, count]) => {
      console.log(`   ${loc.padEnd(25)} ${count.toString().padStart(3)} puestos`);
    });

  // Guardar JSON procesado
  try {
    fs.writeFileSync(
      archivoSalida,
      JSON.stringify(arrayPuestos, null, 2),
      'utf8'
    );
    console.log(`\n💾 Datos guardados en: ${archivoSalida}`);
  } catch (error) {
    console.error('❌ Error al guardar archivo:', error.message);
    process.exit(1);
  }

  return arrayPuestos;
}

/**
 * Descarga el GeoJSON desde el servidor oficial
 */
async function descargarGeoJSON(url) {
  console.log(`📥 Descargando GeoJSON desde servidor oficial...`);
  console.log(`   URL: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const geojson = await response.json();
    const archivoTemp = path.join(__dirname, 'pvo_oficial.geojson');
    
    fs.writeFileSync(archivoTemp, JSON.stringify(geojson, null, 2));
    console.log(`✅ GeoJSON descargado: ${archivoTemp}`);
    
    return archivoTemp;
  } catch (error) {
    console.error('❌ Error descargando GeoJSON:', error.message);
    throw error;
  }
}

// Main
(async () => {
  const archivoEntrada = process.argv[2];
  const urlOficial = 'https://datosabiertos.bogota.gov.co/dataset/d03ad429-75f7-4307-9521-da7442154289/resource/acc0e326-b82c-46f7-8af6-9a46f2ff79de/download/pvo.geojson';

  let entrada = archivoEntrada;

  // Si no se proporciona archivo, descargar del servidor
  if (!entrada) {
    try {
      entrada = await descargarGeoJSON(urlOficial);
    } catch (error) {
      console.error('❌ No se pudo descargar GeoJSON. Proporciona un archivo:');
      console.error('   node procesar_geojson_puestos.js archivo.geojson');
      process.exit(1);
    }
  }

  // Validar que existe el archivo
  if (!fs.existsSync(entrada)) {
    console.error(`❌ Archivo no encontrado: ${entrada}`);
    process.exit(1);
  }

  const salida = path.join(path.dirname(entrada), 'puestos_procesados.json');
  procesarGeoJSON(entrada, salida);

  console.log(`\n🚀 Para importar a MongoDB, ejecuta:`);
  console.log(`   node import_puestos.js --file ${salida}`);
})();
