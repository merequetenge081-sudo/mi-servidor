import fs from 'fs';

// Rafael Uribe Uribe = Localidad 19, código 19
const LOCALIDAD_CODE = '19';
const NOMBRE_LOCALIDAD = 'Rafael Uribe Uribe';

function parseRafaelUribeCSV() {
  try {
    console.log('📂 Parseando CSV de Rafael Uribe Uribe...\n');

    // Leer el CSV
    const csvPath = 'C:/Users/Janus/Downloads/300 ppp/CVS/RafaelUribeUribe_Puestos_Completo.csv';
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Archivo no encontrado:', csvPath);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Skip header
    const puestosData = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Parse CSV (simple split by ;)
      const parts = line.split(';');
      if (parts.length < 2) {
        skipped++;
        continue;
      }

      const localidad = parts[0].trim();
      const nombre = parts[1].trim();
      const direccion = parts[2] ? parts[2].trim() : '';

      if (localidad !== NOMBRE_LOCALIDAD || !nombre) {
        skipped++;
        continue;
      }

      puestosData.push({
        localidad,
        nombre,
        direccion
      });
    }

    console.log(`📋 Puestos leídos: ${puestosData.length}`);
    console.log(`⏭️  Líneas saltadas: ${skipped}\n`);

    // Generar codigoPuesto para todos estos
    const puestosConCodigo = [];
    let counter = 1;

    for (const puesto of puestosData) {
      const codigoPuesto = `${LOCALIDAD_CODE}${String(counter).padStart(5, '0')}`;
      
      puestosConCodigo.push({
        codigoPuesto,
        nombre: puesto.nombre,
        localidad: puesto.localidad,
        direccion: puesto.direccion,
        mesas: [],
        aliases: [],
        organizationId: null,
        activo: true,
        fuente: 'CSV_RAFAEL_URIBE_2026'
      });

      counter++;
    }

    // Guardar JSON
    const outputPath = './tools/rafael-uribe-nuevos.json';
    fs.writeFileSync(outputPath, JSON.stringify(puestosConCodigo, null, 2));

    console.log(`✅ JSON generado: ${outputPath}`);
    console.log(`📊 Total documentos: ${puestosConCodigo.length}\n`);
    
    console.log('Primeros 3 puestos:');
    puestosConCodigo.slice(0, 3).forEach(p => {
      console.log(`  - ${p.nombre} (${p.codigoPuesto}): ${p.direccion}`);
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

parseRafaelUribeCSV();
