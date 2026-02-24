/**
 * Parseador de Puestos de Votación Bogotá 2019
 * Extrae alias/nombres de sitios del PDF convertido a texto
 */

import fs from 'fs';

function parsearPuestosRegistraduria(filePath) {
  console.log("\n📖 PARSEADOR DE PUESTOS");
  console.log("════════════════════════════════════════════\n");
  
  try {
    const contenido = fs.readFileSync(filePath, 'utf-8');
    
    // Localidades y sus números en el documento
    const localidades = {
      'USAQUÉN': { regex: /USAQUÉN[\s\S]*?(?=CHAPINERO|$)/i, num: '01' },
      'CHAPINERO': { regex: /CHAPINERO[\s\S]*?(?=SANTA FÉ|$)/i, num: '02' },
      'SANTA FÉ': { regex: /SANTA FÉ[\s\S]*?(?=SAN CRISTÓBAL|MÁRTIRES|$)/i, num: '03' },
      'SAN CRISTÓBAL': { regex: /SAN CRISTÓBAL[\s\S]*?(?=USME|$)/i, num: '04' },
      'USME': { regex: /USME[\s\S]*?(?=TUNJUELITO|$)/i, num: '05' },
      'TUNJUELITO': { regex: /TUNJUELITO[\s\S]*?(?=BOSA|$)/i, num: '06' },
      'BOSA': { regex: /BOSA[\s\S]*?(?=KENNEDY|$)/i, num: '07' },
      'KENNEDY': { regex: /KENNEDY[\s\S]*?(?=FONTIBÓN|ENGATIVÁ|$)/i, num: '08' },
      'FONTIBÓN': { regex: /FONTIBÓN[\s\S]*?(?=ENGATIVÁ|$)/i, num: '09' },
      'ENGATIVÁ': { regex: /ENGATIVÁ[\s\S]*?(?=SUBA|$)/i, num: '10' },
      'SUBA': { regex: /SUBA[\s\S]*?(?=BARRIOS UNIDOS|$)/i, num: '11' },
      'BARRIOS UNIDOS': { regex: /BARRIOS UNIDOS[\s\S]*?(?=TEUSAQUILLO|$)/i, num: '12' },
      'TEUSAQUILLO': { regex: /TEUSAQUILLO[\s\S]*?(?=MÁRTIRES|LOS MÁRTIRES|$)/i, num: '13' },
      'MÁRTIRES': { regex: /(?:MÁRTIRES|LOS MÁRTIRES)[\s\S]*?(?=ANTONIO NARIÑO|$)/i, num: '14' },
      'ANTONIO NARIÑO': { regex: /ANTONIO NARIÑO[\s\S]*?(?=PUENTE ARANDA|$)/i, num: '15' },
      'PUENTE ARANDA': { regex: /PUENTE ARANDA[\s\S]*?(?=LA CANDELARIA|RAFAEL URIBE|$)/i, num: '16' },
      'LA CANDELARIA': { regex: /LA CANDELARIA[\s\S]*?(?=RAFAEL URIBE|$)/i, num: '17' },
      'RAFAEL URIBE URIBE': { regex: /RAFAEL URIBE[\s\S]*?(?=CIUDAD BOLÍVAR|$)/i, num: '18' },
      'CIUDAD BOLÍVAR': { regex: /CIUDAD BOLÍVAR[\s\S]*?(?=SUMAPAZ|$)/i, num: '19' },
      'SUMAPAZ': { regex: /SUMAPAZ[\s\S]*?(?=Otros Puestos|$)/i, num: '20' }
    };
    
    console.log("Extrayendo puestos de cada localidad...\n");
    
    const puestosConAlias = {};
    
    // Regex para extraer número, nombre y dirección
    const regexPuesto = /No\.\s+(\d+)\s+(.+?)\s{2,}(.+?)(?=\n\s*(?:No\.|Dirección de Catastro|Puestos que coparon|$))/;
    
    for (const [localidad, config] of Object.entries(localidades)) {
      const match = contenido.match(config.regex);
      if (!match) {
        console.log(`⚠️  ${localidad}: No se encontró sección`);
        continue;
      }
      
      const seccion = match[0];
      
      // Buscar todas las líneas de puestos
      const lineas = seccion.split('\n');
      let puestosLocalidad = [];
      
      let i = 0;
      while (i < lineas.length) {
        const linea = lineas[i].trim();
        
        // Buscar línea que comience con número
        if (/^\d+\s/.test(linea) && !linea.includes('Puestos de votación')) {
          const partes = linea.split(/\s{2,}/);
          
          if (partes.length >= 2) {
            const num = partes[0];
            const nombre = partes[1];
            
            // La dirección puede estar en la siguiente línea si tiene espacios al inicio
            let direccion = partes[2] || '';
            
            // Si no tiene dirección completa, buscar en línea siguiente
            if (!direccion || direccion.length < 5) {
              i++;
              if (i < lineas.length) {
                const siguienteLínea = lineas[i].trim();
                if (siguienteLínea && !siguienteLínea.match(/^\d+\s/) && !siguienteLínea.includes('No.')) {
                  direccion = siguienteLínea;
                }
              }
            }
            
            if (nombre && direccion && nombre.length > 3) {
              puestosLocalidad.push({
                numero: num,
                nombre: nombre.trim(),
                direccion: direccion.trim(),
                localidad: localidad
              });
            }
          }
        }
        
        i++;
      }
      
      if (puestosLocalidad.length > 0) {
        puestosConAlias[localidad] = puestosLocalidad;
        console.log(`✅ ${localidad}: ${puestosLocalidad.length} puestos encontrados`);
      }
    }
    
    // Mostrar ejemplos
    console.log("\n📌 EJEMPLOS EXTRAÍDOS:\n");
    
    if (puestosConAlias['FONTIBÓN']) {
      console.log("FONTIBÓN:");
      puestosConAlias['FONTIBÓN'].slice(0, 3).forEach(p => {
        console.log(`  ${p.numero}. ${p.nombre}`);
        console.log(`     📍 ${p.direccion}\n`);
      });
    }
    
    if (puestosConAlias['SUBA']) {
      console.log("SUBA:");
      puestosConAlias['SUBA'].slice(0, 3).forEach(p => {
        console.log(`  ${p.numero}. ${p.nombre}`);
        console.log(`     📍 ${p.direccion}\n`);
      });
    }
    
    // Guardar datos
    fs.writeFileSync('tools/puestos-registraduria-2019.json', JSON.stringify(puestosConAlias, null, 2));
    console.log("✅ Datos guardados en: tools/puestos-registraduria-2019.json\n");
    
    // Estadísticas
    const totalPuestos = Object.values(puestosConAlias).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`📊 Total de puestos extraídos: ${totalPuestos}`);
    console.log(`📍 Localidades: ${Object.keys(puestosConAlias).length}\n`);
    
    return puestosConAlias;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

// Ejecutar
parsearPuestosRegistraduria('Puestos-de-Votacion.txt');
