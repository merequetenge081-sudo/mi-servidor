/**
 * Script para descargar puestos de votación de datos.gov.co
 * y compararlos con los que tenemos en BD
 */

import fs from 'fs';
import https from 'https';
import http from 'http';

// URL del GeoJSON desde el portal de datos abiertos de Bogotá
const GEOJSON_URL = "https://datosabiertos.bogota.gov.co/dataset/d03ad429-75f7-4307-9521-da7442154289/resource/acc0e326-b82c-46f7-8af6-9a46f2ff79de/download/pvo.geojson";

// También intentaremos el servicio REST de ArcGIS
const ARCGIS_API_URL = "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/sitiosinteres/puestovotacion/MapServer/0/query?where=1=1&outFields=*&returnGeometry=true&f=json";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = { rejectUnauthorized: false };  // Deshabilitar verificación SSL
    
    protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        }
      });
    }).on('error', reject);
  });
}

async function downloadPuestosData() {
  try {
    console.log("🔄 Descargando datos de puestos de votación...\n");
    
    // Intentar con GeoJSON
    let puestosData = null;
    let source = null;
    
    try {
      console.log("📥 Intentando descargar GeoJSON desde datos.gov.co...");
      const geojson = await fetchUrl(GEOJSON_URL);
      
      // Procesar GeoJSON a nuestro formato
      puestosData = geojson.features.map(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        
        // Mapear campos del GeoJSON al nuestro formato
        const nombre = props.PVONOMBRE || props.nombre || '';
        const localidad = props.LOCNOMBRE || props.localidad || '';
        const direccion = props.PVODIRECCI || props.direccion || '';
        const codigo = props.PVOCODIGO || props.codigoPuesto || '';
        const numPuesto = props.PVONPUESTO || props.puestoOriginal || 0;
        
        return {
          codigoPuesto: codigo,
          nombre: nombre,
          localidad: localidad,
          direccion: direccion,
          latitud: coords[1],
          longitud: coords[0],
          mesas: [numPuesto],
          sitio: props.PVONSITIO || props.sitio || '',
          datosOriginales: {
            OBJECTID: props.OBJECTID,
            LOCCODIGO: props.LOCCODIGO,
            PVONPUES_1: props.PVONPUES_1
          }
        };
      });
      
      source = 'GeoJSON (datos.gov.co)';
      console.log(`✅ GeoJSON descargado: ${puestosData.length} puestos\n`);
          mesas: [numPuesto],
          sitio: props.PVONSITIO || props.sitio || '',
          datosOriginales: {
            OBJECTID: props.OBJECTID,
            LOCCODIGO: props.LOCCODIGO,
            PVONPUES_1: props.PVONPUES_1
          }
        };
      });
      
      source = 'GeoJSON (datos.gov.co)';
      console.log(`✅ GeoJSON descargado: ${puestosData.length} puestos\n`);
      
    } catch (geoJsonError) {
      console.log(`⚠️  GeoJSON falló: ${geoJsonError.message}`);
      console.log("📥 Intentando con ArcGIS REST API...\n");
      
      try {
        const data = await fetchUrl(ARCGIS_API_URL);
        
        if (data.features && data.features.length > 0) {
          puestosData = data.features.map(feature => {
            const attrs = feature.attributes;
            const geom = feature.geometry;
            
            return {
              nombre: attrs.nombre || attrs.NOMBRE || '',
              localidad: attrs.localidad || attrs.LOCALIDAD || '',
              direccion: attrs.direccion || attrs.DIRECCION || '',
              latitud: geom?.y || '',
              longitud: geom?.x || '',
              codigoPuesto: attrs.codigoPuesto || attrs.CODIGO || '',
              mesas: attrs.mesas ? (Array.isArray(attrs.mesas) ? attrs.mesas : [attrs.mesas]) : [],
              ...attrs
            };
          });
          
          source = 'ArcGIS REST API';
          console.log(`✅ ArcGIS data descargado: ${puestosData.length} puestos\n`);
        }
      } catch (arcgisError) {
        throw new Error(`Ambas fuentes fallaron: ${geoJsonError.message} | ${arcgisError.message}`);
      }
    }
    
    if (!puestosData) {
      throw new Error("No se pudieron descargar los datos");
    }
    
    // Guardar descarga completa
    fs.writeFileSync(
      'tools/puestos_descargados_nacion.json',
      JSON.stringify(puestosData, null, 2)
    );
    console.log(`💾 Datos descargados guardados en: tools/puestos_descargados_nacion.json`);
    console.log(`📊 Fuente: ${source}\n`);
    
    return { puestosData, source };
    
  } catch (error) {
    console.error(`❌ Error descargando datos: ${error.message}`);
    throw error;
  }
}

async function downloadPuestosDataWithSource() {
  return await downloadPuestosData();

function normalizeNombre(nombre) {
  if (!nombre) return '';
  return nombre
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

function findMatchingPuesto(nombreNuevo, puestosExistentes) {
  const nombreNorm = normalizeNombre(nombreNuevo);
  
  for (const puesto of puestosExistentes) {
    const nombreExistentNorm = normalizeNombre(puesto.nombre);
    if (nombreNorm === nombreExistentNorm) {
      return puesto;
    }
  }
  
  // Buscar por coincidencia parcial (mejora del match)
  for (const puesto of puestosExistentes) {
    const nombreExistentNorm = normalizeNombre(puesto.nombre);
    const similarity = calculateStringSimilarity(nombreNorm, nombreExistentNorm);
    if (similarity > 0.85) {
      return puesto;
    }
  }
  
  return null;
}

function calculateStringSimilarity(a, b) {
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

async function comparePuestos() {
  try {
    // Cargar puestos existentes
    console.log("\n📂 Cargando puestos existentes...");
    const puestosExistentes = JSON.parse(
      fs.readFileSync('tools/puestos_exactos.json', 'utf-8')
    );
    console.log(`✅ ${puestosExistentes.length} puestos en BD local\n`);
    
    // Descargar nuevos puestos
    const { puestosData: puestosNuevos, source } = await downloadPuestosDataWithSource();
    
    // Comparar
    console.log("🔍 Comparando datos...\n");
    
    const noEncontrados = [];
    const encontrados = [];
    const duplicados = new Set();
    
    for (const puestoNuevo of puestosNuevos) {
      if (!puestoNuevo.nombre || puestoNuevo.nombre.trim() === '') continue;
      
      const match = findMatchingPuesto(puestoNuevo.nombre, puestosExistentes);
      
      if (match) {
        encontrados.push({
          nuevo: puestoNuevo,
          existente: match,
          coincidencia: 'exacta'
        });
      } else {
        noEncontrados.push(puestoNuevo);
      }
    }
    
    // Identificar puestos que tenemos pero no están en los datos nuevos
    const puestosNoEnDescarga = [];
    for (const puestoExistente of puestosExistentes) {
      const match = noEncontrados.find(p => 
        normalizeNombre(p.nombre) === normalizeNombre(puestoExistente.nombre)
      );
      
      if (!match) {
        const encontradoEnNuevos = puestosNuevos.find(p => 
          normalizeNombre(p.nombre) === normalizeNombre(puestoExistente.nombre)
        );
        if (!encontradoEnNuevos) {
          puestosNoEnDescarga.push(puestoExistente);
        }
      }
    }
    
    // Reporte
    console.log("═══════════════════════════════════════════════");
    console.log("📊 REPORTE DE COMPARACIÓN");
    console.log("═══════════════════════════════════════════════");
    console.log(`Total nuevos descargados: ${puestosNuevos.length}`);
    console.log(`Total en BD local: ${puestosExistentes.length}`);
    console.log(`Encontrados/Coincidentes: ${encontrados.length}`);
    console.log(`❌ NO encontrados (a agregar): ${noEncontrados.length}`);
    console.log(`⚠️  En BD pero no en descarga: ${puestosNoEnDescarga.length}`);
    console.log("═══════════════════════════════════════════════\n");
    
    // Guardar reportes
    fs.writeFileSync(
      'tools/comparacion-puestos-reporte.json',
      JSON.stringify({
        fecha: new Date().toISOString(),
        totalNuevos: puestosNuevos.length,
        totalLocal: puestosExistentes.length,
        encontrados: encontrados.length,
        noEncontrados: noEncontrados.length,
        puestosNoEnDescarga: puestosNoEnDescarga.length
      }, null, 2)
    );
    
    // Si hay puestos no encontrados, guardarlos
    if (noEncontrados.length > 0) {
      console.log(`📝 Guardando ${noEncontrados.length} puestos no encontrados...\n`);
      
      // Preparar puestos para agregar (con estructura de nuestro BD)
      const puestosAgregar = noEncontrados.map((puesto, idx) => ({
        codigoPuesto: puesto.codigoPuesto || `NEW_${idx + 1}`,
        nombre: puesto.nombre,
        localidad: puesto.localidad || 'Desconocida',
        direccion: puesto.direccion || '',
        mesas: puesto.mesas || [],
        latitud: puesto.latitud || null,
        longitud: puesto.longitud || null,
        source: source || 'datos.gov.co',
        dateAdded: new Date().toISOString()
      }));
      
      fs.writeFileSync(
        'tools/puestos-a-agregar.json',
        JSON.stringify(puestosAgregar, null, 2)
      );
      console.log(`✅ ${puestosAgregar.length} puestos listos para agregar`);
      console.log(`   Archivo: tools/puestos-a-agregar.json\n`);
    }
    
    // Mostrar ejemplos
    if (noEncontrados.length > 0) {
      console.log("📌 Ejemplos de puestos NO ENCONTRADOS:");
      console.log("─────────────────────────────────────");
      noEncontrados.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.nombre}`);
        console.log(`   Localidad: ${p.localidad}`);
        console.log(`   Dirección: ${p.direccion}\n`);
      });
    }
    
    return {
      encontrados,
      noEncontrados,
      puestosNoEnDescarga,
      puestosNuevos,
      puestosExistentes
    };
    
  } catch (error) {
    console.error(`❌ Error en comparación: ${error.message}`);
    throw error;
  }
}

// Ejecutar
comparePuestos().catch(error => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
