/**
 * Comparador de Puestos - Identifica cambios entre versiones
 * Busca: Nuevos puestos, cambios de nombre, discontinuados
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeName(name) {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function comparePuestos() {
  console.log('📊 COMPARADOR DE PUESTOS');
  console.log('═'.repeat(70));

  // Cargar datos actual (GeoJSON)
  const geoJsonPath = path.join(__dirname, 'pvo.geojson');
  const geojson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  const currentPuestos = new Map();

  geojson.features.forEach(f => {
    const props = f.properties;
    const key = props.PVOCODIGO; // Usar código como clave única
    currentPuestos.set(key, {
      codigo: props.PVOCODIGO,
      nombre: props.PVONOMBRE,
      localidad: props.LOCNOMBRE,
      codigoLocalidad: props.LOCCODIGO,
      direccion: props.PVODIRECCI,
      mesas: parseInt(props.PVONPUESTO) || 1
    });
  });

  console.log(`\n✅ Puestos cargados de GeoJSON: ${currentPuestos.size}`);

  // Cargar datos descargados (anterior)
  const descargadosPath = path.join(__dirname, 'puestos-descargados.json');
  const puestosDescargados = JSON.parse(fs.readFileSync(descargadosPath, 'utf8'));
  const previousPuestos = new Map();

  puestosDescargados.forEach(p => {
    const key = p.codigoPuesto;
    previousPuestos.set(key, {
      codigo: p.codigoPuesto,
      nombre: p.nombre,
      localidad: p.localidad,
      codigoLocalidad: p.codigoLocalidad,
      direccion: p.direccion,
      mesas: p.numeroMesas || 1
    });
  });

  console.log(`✅ Puestos cargados de anterior: ${previousPuestos.size}`);

  // ANÁLISIS
  const analysis = {
    nuevos: [],
    eliminados: [],
    cambiosNombre: [],
    cambiosMesas: [],
    sinCambios: []
  };

  // 1. Identificar nuevos y cambios
  for (const [codigo, puesto] of currentPuestos.entries()) {
    const anterior = previousPuestos.get(codigo);

    if (!anterior) {
      // Nuevo puesto
      analysis.nuevos.push(puesto);
    } else {
      // Puesto existe, revisar cambios
      const nombreActual = normalizeName(puesto.nombre);
      const nombreAnterior = normalizeName(anterior.nombre);

      if (nombreActual !== nombreAnterior) {
        // Cambio de nombre
        analysis.cambiosNombre.push({
          codigo,
          nombreActual: puesto.nombre,
          nombreAnterior: anterior.nombre,
          localidad: puesto.localidad,
          sugerencia: `Agregar alias: "${anterior.nombre}"`
        });
      } else if (puesto.mesas !== anterior.mesas) {
        // Cambio de mesas
        analysis.cambiosMesas.push({
          codigo,
          nombre: puesto.nombre,
          mesasAnterior: anterior.mesas,
          mesasActual: puesto.mesas,
          localidad: puesto.localidad
        });
      } else {
        analysis.sinCambios.push(codigo);
      }
    }
  }

  // 2. Identificar eliminados
  for (const [codigo, puesto] of previousPuestos.entries()) {
    if (!currentPuestos.has(codigo)) {
      analysis.eliminados.push({
        codigo,
        nombre: puesto.nombre,
        localidad: puesto.localidad
      });
    }
  }

  // REPORTE
  console.log('\n📝 REPORTE DE CAMBIOS');
  console.log('═'.repeat(70));

  // Nuevos puestos
  if (analysis.nuevos.length > 0) {
    console.log(`\n🆕 PUESTOS NUEVOS: ${analysis.nuevos.length}`);
    analysis.nuevos.slice(0, 10).forEach(p => {
      console.log(`  • [${p.codigo}] ${p.nombre} (${p.localidad})`);
    });
    if (analysis.nuevos.length > 10) {
      console.log(`  ... y ${analysis.nuevos.length - 10} más`);
    }
  }

  // Cambios de nombre
  if (analysis.cambiosNombre.length > 0) {
    console.log(`\n🔄 CAMBIOS DE NOMBRE: ${analysis.cambiosNombre.length}`);
    analysis.cambiosNombre.slice(0, 10).forEach(c => {
      console.log(`  • [${c.codigo}] ${c.nombreAnterior} → ${c.nombreActual}`);
      console.log(`    ${c.sugerencia}`);
    });
    if (analysis.cambiosNombre.length > 10) {
      console.log(`  ... y ${analysis.cambiosNombre.length - 10} más`);
    }
  }

  // Cambios de mesas
  if (analysis.cambiosMesas.length > 0) {
    console.log(`\n📊 CAMBIOS EN MESAS: ${analysis.cambiosMesas.length}`);
    analysis.cambiosMesas.slice(0, 10).forEach(c => {
      console.log(`  • [${c.codigo}] ${c.nombre}: ${c.mesasAnterior} → ${c.mesasActual}`);
    });
    if (analysis.cambiosMesas.length > 10) {
      console.log(`  ... y ${analysis.cambiosMesas.length - 10} más`);
    }
  }

  // Eliminados
  if (analysis.eliminados.length > 0) {
    console.log(`\n❌ PUESTOS ELIMINADOS: ${analysis.eliminados.length}`);
    analysis.eliminados.slice(0, 10).forEach(p => {
      console.log(`  • [${p.codigo}] ${p.nombre} (${p.localidad})`);
    });
    if (analysis.eliminados.length > 10) {
      console.log(`  ... y ${analysis.eliminados.length - 10} más`);
    }
  }

  // Se especifican búsquedas específicas
  console.log(`\n✨ VALIDACIONES:`)
  const montebello = currentPuestos.get('160010409');
  if (montebello) {
    console.log(`  ✅ Montebello encontrado: ${montebello.nombre} (${montebello.localidad})`);
  }
  
  const salitre = Array.from(currentPuestos.values()).find(p => 
    p.nombre.toUpperCase().includes('SALITRE')
  );
  if (salitre) {
    console.log(`  ✅ Salitre encontrado: ${salitre.nombre} (${salitre.localidad})`);
  }

  // RESUMEN
  console.log('\n📊 RESUMEN');
  console.log('═'.repeat(70));
  console.log(`Puestos en versión actual: ${currentPuestos.size}`);
  console.log(`Puestos en versión anterior: ${previousPuestos.size}`);
  console.log(`\nCambios identificados:`);
  console.log(`  • Nuevos: ${analysis.nuevos.length}`);
  console.log(`  • Eliminados: ${analysis.eliminados.length}`);
  console.log(`  • Cambio de nombre: ${analysis.cambiosNombre.length}`);
  console.log(`  • Cambio de mesas: ${analysis.cambiosMesas.length}`);
  console.log(`  • Sin cambios: ${analysis.sinCambios.length}`);

  // Guardar análisis completo
  const outputPath = path.join(__dirname, 'puestos-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log(`\n💾 Análisis completo guardado: ${outputPath}`);

  // Crear JSON de actualización con ALIAS INCLUIDOS
  console.log('\n📥 Generando datos de actualización...');
  const actualizacion = {
    nuevos: analysis.nuevos,
    cambios: analysis.cambiosNombre.map(c => ({
      codigo: c.codigo,
      nuevoNombre: c.nombreActual,
      aliasesAdd: [c.nombreAnterior] // Agregar nombre anterior como alias
    })),
    removidos: analysis.eliminados,
    timestamp: new Date().toISOString()
  };

  const updatePath = path.join(__dirname, 'puestos-update.json');
  fs.writeFileSync(updatePath, JSON.stringify(actualizacion, null, 2));
  console.log(`💾 Actualización guardada: ${updatePath}`);

  return analysis;
}

// Ejecutar
try {
  comparePuestos();
  console.log('\n✅ Análisis completado');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
