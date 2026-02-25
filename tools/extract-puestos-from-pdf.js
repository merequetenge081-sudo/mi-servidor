/**
 * Script para extraer puestos de votación del PDF de la Registraduría 2023
 * Uso: node tools/extract-puestos-from-pdf.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractPuestosFromPDF() {
  try {
    // Import pdf-parse using dynamic import
    const pdfParse = (await import('pdf-parse')).default;
    const pdfPath = 'C:/Users/Janus/Downloads/20230517_puestos-de-votacion_consultas.pdf';

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF no encontrado:', pdfPath);
      process.exit(1);
    }

    console.log('📖 Leyendo PDF de Registraduría...');
    const pdfBuffer = fs.readFileSync(pdfPath);

    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    console.log(`✅ PDF leído: ${data.numpages} páginas`);
    console.log('\n📝 Primeras 1000 caracteres de contenido:');
    console.log('═'.repeat(60));
    console.log(text.substring(0, 1000));
    console.log('\n...\n');

    // Expresión regular para buscar puestos
    // Patrón: Número - Nombre
    const puestoPattern = /^\s*(\d+)\s+([A-Z][^0-9\n]+?)(?:\n|$)/gm;
    
    // Buscar localidades
    const localidadPattern = /^([A-Z][A-Z\s]+)\s*$/gm;

    console.log('🔍 Análisis de estructura:');
    console.log('═'.repeat(60));

    // Buscar líneas que parecen ser números de puestos
    const lines = text.split('\n');
    let currentLocalidad = null;
    const puestos = [];
    let puestoCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detectar localidades (líneas en mayúsculas solas)
      if (line.length > 0 && line === line.toUpperCase() && line.length > 5) {
        currentLocalidad = line;
        console.log(`\n📍 Detectada localidad: ${currentLocalidad}`);
      }
      
      // Detectar puestos (comienzan con número)
      const puestoMatch = line.match(/^(\d+)\s+(.+?)(\d+)?$/);
      if (puestoMatch && currentLocalidad) {
        const numero = puestoMatch[1];
        const nombre = puestoMatch[2].trim();
        
        if (nombre.length > 3) {
          puestos.push({
            numero,
            nombre,
            localidad: currentLocalidad
          });
          puestoCount++;
          
          if (puestoCount <= 5) {
            console.log(`  • ${numero}: ${nombre}`);
          }
        }
      }
    }

    console.log(`\n✅ Total de puestos extraídos: ${puestoCount}`);

    // Guardar a archivo JSON para revisión
    const outputPath = path.join(__dirname, 'puestos-pdf-2023.json');
    fs.writeFileSync(outputPath, JSON.stringify(puestos, null, 2));
    console.log(`💾 Guardado en: ${outputPath}`);

    // También guardar texto plano para análisis manual
    const textPath = path.join(__dirname, 'pdf-content-2023.txt');
    fs.writeFileSync(textPath, text);
    console.log(`📄 Contenido completo en: ${textPath}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

extractPuestosFromPDF();
