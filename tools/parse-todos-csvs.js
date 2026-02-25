import fs from 'fs';
import path from 'path';

// Mapeo de localidades a códigos (Bogotá)
const LOCALIDAD_CODES = {
  'Santa Fe': '01',
  'Chapinero': '02',
  'Usaquén': '02',
  'La Candelaria': '03',
  'San Cristóbal': '05',
  'Mártires': '06',
  'Kennedy': '07',
  'Fontibón': '08',
  'Engativá': '09',
  'Suba': '10',
  'Barrios Unidos': '11',
  'Teusaquillo': '12',
  'Puente Aranda': '18',
  'Rafael Uribe Uribe': '19',
  'Tunjuelito': '17',
  'Usme': '02',
  'Bosa': '07',
  'Antonio Nariño': '15',
  'Sumapaz': '20'
};

const CSV_FILES = [
  'RafaelUribeUribe_Puestos_Completo.csv',
  'LaCandelaria_Puestos_Completo.csv',
  'PuenteAranda_Puestos_Completo.csv',
  'AntonioNarino_Puestos_Completo.csv',
  'Martires_Puestos_Completo.csv',
  'Teusaquillo_Puestos_Completo.csv',
  'BarriosUnidos_Puestos_Completo.csv',
  'Suba_Puestos_Completo.csv',
  'Engativa_Puestos_Completo.csv',
  'Fontibon_Puestos_Completo.csv',
  'Kennedy_Puestos_Completo.csv',
  'Bosa_Puestos_Completo.csv',
  'Tunjuelito_Puestos_Completo.csv',
  'Usme_Puestos_Completo.csv',
  'SanCristobal_Puestos_Completo.csv',
  'SantaFe_Puestos_Completo.csv',
  'Chapinero_Puestos_Completo.csv',
  'Usaquen_Puestos_Completo.csv',
  'Sumapaz_Puestos_Completo.csv'
];

const CSV_DIR = 'C:/Users/Janus/Downloads/300 ppp/CVS';

// Puestos aliased (para agregar aliases automáticamente)
const KNOWN_ALIASES = {
  'Libertador II': ['Libertador 2', 'Colegio Distrital El Libertador Sede B'],
  'Restrepo B': ['Restrepo 2', 'Colegio Distrital Restrepo Millán - Sede B'],
  'San Vicente Colsubsidio': ['San Vicente']
};

function parseCSV(content, localidad) {
  const lines = content.split('\n').filter(line => line.trim());
  const puestos = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV - manejar encima con comillas o semicolon
    let parts;
    if (line.includes('"')) {
      // Formato CSV con comillas
      parts = line.split('"').filter((p, i) => i % 2 === 1);
    } else {
      // Formato semicolon
      parts = line.split(';');
    }
    
    if (parts.length < 2) continue;
    
    const nombre = parts[1] ? parts[1].trim() : '';
    const direccion = parts[2] ? parts[2].trim() : '';
    
    if (!nombre) continue;
    
    puestos.push({
      localidad,
      nombre,
      direccion
    });
  }
  
  return puestos;
}

async function procesarTodosLosCSVs() {
  try {
    console.log('📂 Procesando todos los CSVs...\n');
    
    const todosLosPuestos = {};
    let totalParsed = 0;
    
    for (const csvFile of CSV_FILES) {
      const csvPath = path.join(CSV_DIR, csvFile);
      
      if (!fs.existsSync(csvPath)) {
        console.log(`⏭️  Saltando ${csvFile} (no existe)`);
        continue;
      }
      
      const content = fs.readFileSync(csvPath, 'utf-8');
      
      // Extraer localidad del nombre del archivo
      const localidadMatch = csvFile.replace('_Puestos_Completo.csv', '');
      let localidad = localidadMatch
        .replace(/([A-Z])/g, " $1")
        .trim();
      
      // Normalizar algunos nombres
      localidad = localidad === 'Engativa' ? 'Engativá' : localidad;
      localidad = localidad === 'Antonio Narino' ? 'Antonio Nariño' : localidad;
      
      const puestos = parseCSV(content, localidad);
      
      console.log(`✅ ${csvFile}: ${puestos.length} puestos`);
      totalParsed += puestos.length;
      
      // Agrupar por localidad
      if (!todosLosPuestos[localidad]) {
        todosLosPuestos[localidad] = [];
      }
      todosLosPuestos[localidad].push(...puestos);
    }
    
    console.log(`\n📊 Total parseado: ${totalParsed} puestos\n`);
    
    // Generar JSON con códigos
    const puestosConCodigo = [];
    let globalCounter = 1;
    
    for (const [localidad, puestos] of Object.entries(todosLosPuestos)) {
      const code = LOCALIDAD_CODES[localidad] || '99';
      let localCounter = 1;
      
      for (const puesto of puestos) {
        const codigoPuesto = `${code}${String(localCounter).padStart(5, '0')}`;
        
        const aliases = KNOWN_ALIASES[puesto.nombre] || [];
        
        puestosConCodigo.push({
          codigoPuesto,
          nombre: puesto.nombre,
          localidad: puesto.localidad,
          direccion: puesto.direccion,
          mesas: [],
          aliases,
          organizationId: null,
          activo: true,
          fuente: 'CSV_TODAS_LOCALIDADES_2026'
        });
        
        localCounter++;
        globalCounter++;
      }
    }
    
    // Guardar JSON
    const outputPath = './tools/todos-puestos-consolidados.json';
    fs.writeFileSync(outputPath, JSON.stringify(puestosConCodigo, null, 2));
    
    console.log(`✅ JSON guardado: ${outputPath}`);
    console.log(`📊 Total documentos: ${puestosConCodigo.length}\n`);
    
    // Estadísticas por localidad
    console.log('Estadísticas por localidad:');
    for (const [loc, puestos] of Object.entries(todosLosPuestos)) {
      console.log(`  ${loc}: ${puestos.length}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

procesarTodosLosCSVs();
