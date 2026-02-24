/**
 * Script para sincronizar puestos de votación de datos.gov.co
 * Descarga, compara y actualiza la BD local
 */

import fs from 'fs';
import https from 'https';
import http from 'http';

const GEOJSON_URL = "https://datosabiertos.bogota.gov.co/dataset/d03ad429-75f7-4307-9521-da7442154289/resource/acc0e326-b82c-46f7-8af6-9a46f2ff79de/download/pvo.geojson";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = { rejectUnauthorized: false };
    
    protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse: ${e.message}`));
          }
        }
      });
    }).on('error', reject);
  });
}

function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s]/g, '');
}

function calculateSimilarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function findMatchingPuesto(nombreNuevo, puestosExistentes, threshold = 0.85) {
  const nombreNorm = normalizeString(nombreNuevo);
  
  // Búsqueda exacta primero
  for (const puesto of puestosExistentes) {
    if (normalizeString(puesto.nombre) === nombreNorm) {
      return puesto;
    }
  }
  
  // Búsqueda fuzzy
  for (const puesto of puestosExistentes) {
    const similarity = calculateSimilarity(nombreNorm, normalizeString(puesto.nombre));
    if (similarity > threshold) {
      return puesto;
    }
  }
  
  return null;
}

async function downloadPuestos() {
  console.log("📥 Descargando puestos de votación...\n");
  try {
    const geojson = await fetchUrl(GEOJSON_URL);
    
    const puestos = geojson.features.map(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      
      return {
        codigoPuesto: props.PVOCODIGO || '',
        nombre: props.PVONOMBRE || '',
        localidad: props.LOCNOMBRE || '',
        direccion: props.PVODIRECCI || '',
        sitio: props.PVONSITIO || '',
        mesas: [props.PVONPUESTO || 0],
        latitud: coords[1],
        longitud: coords[0]
      };
    }).filter(p => p.nombre); // Filtrar sin nombre
    
    console.log(`✅ Descargados ${puestos.length} puestos\n`);
    fs.writeFileSync('tools/puestos-descargados.json', JSON.stringify(puestos, null, 2));
    
    return puestos;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

async function comparePuestos() {
  try {
    // Cargar existentes
    const puestosExistentes = JSON.parse(fs.readFileSync('tools/puestos_exactos.json', 'utf-8'));
    console.log(`📂 BD Local: ${puestosExistentes.length} puestos\n`);
    
    // Descargar nuevos
    const puestosNuevos = await downloadPuestos();
    
    // Comparar
    const encontrados = [];
    const noEncontrados = [];
    
    for (const puestoNuevo of puestosNuevos) {
      const match = findMatchingPuesto(puestoNuevo.nombre, puestosExistentes, 0.85);
      
      if (match) {
        encontrados.push({ nuevo: puestoNuevo, existente: match });
      } else {
        noEncontrados.push(puestoNuevo);
      }
    }
    
    console.log("═════════════════════════════════════════════");
    console.log("📊 REPORTE DE COMPARACIÓN");
    console.log("═════════════════════════════════════════════");
    console.log(`Total descargados: ${puestosNuevos.length}`);
    console.log(`Total local: ${puestosExistentes.length}`);
    console.log(`✅ Coincidentes: ${encontrados.length}`);
    console.log(`❌ NO encontrados (a agregar): ${noEncontrados.length}`);
    console.log("═════════════════════════════════════════════\n");
    
    // Guardar puestos nuevos
    if (noEncontrados.length > 0) {
      console.log(`📝 Preparando ${noEncontrados.length} puestos nuevos...\n`);
      
      const puestosAgregar = noEncontrados.map(p => ({
        ...p,
        dateAdded: new Date().toISOString(),
        source: 'datos.gov.co'
      }));
      
      fs.writeFileSync('tools/puestos-nuevos-para-agregar.json', JSON.stringify(puestosAgregar, null, 2));
      
      // Mostrar ejemplos
      console.log("📌 Ejemplos de puestos nuevos:");
      console.log("─────────────────────────────────────────");
      noEncontrados.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. ${p.nombre}`);
        console.log(`   🏠 ${p.localidad} - ${p.direccion}`);
      });
      
      if (noEncontrados.length > 10) {
        console.log(`   ... y ${noEncontrados.length - 10} más\n`);
      }
      
      console.log(`\n✅ Archivo generado: tools/puestos-nuevos-para-agregar.json`);
    }
    
    return {
      encontrados,
      noEncontrados,
      puestosExistentes,
      puestosNuevos
    };
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

// Ejecutar
console.log("\n🔄 SINCRONIZACIÓN DE PUESTOS DE VOTACIÓN");
console.log("════════════════════════════════════════════\n");

comparePuestos()
  .then(resultado => {
    console.log("\n✅ Sincronización completada");
    
    if (resultado.noEncontrados.length > 0) {
      console.log(`\n📋 Próximos pasos:`);
      console.log(`  1. Revisar: tools/puestos-nuevos-para-agregar.json`);
      console.log(`  2. Ejecutar: npm run import:puestos-nuevos`);
    }
  })
  .catch(error => {
    console.error("\n❌ Error fatal:", error.message);
    process.exit(1);
  });
