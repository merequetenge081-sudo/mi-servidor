/**
 * Actualización de Puestos con Aliases automáticos
 * Incluye: nuevos puestos, cambios de nombre como alias, cambios de mesas
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generarPuestosActualizados() {
  console.log('📥 Generando puestos actualizados con aliases...');

  // Leer GeoJSON actual
  const geoJsonPath = path.join(__dirname, 'pvo.geojson');
  const geojson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));

  // Leer análisis de cambios
  const analysisPath = path.join(__dirname, 'puestos-analysis.json');
  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

  // Leer anterior para obtener aliases históricos
  const descargadosPath = path.join(__dirname, 'puestos-descargados.json');
  const puestosDescargados = JSON.parse(fs.readFileSync(descargadosPath, 'utf8'));
  const mapAnteriores = new Map(puestosDescargados.map(p => [p.codigoPuesto, p]));

  // Procesar GeoJSON con aliases
  const puestosActualizados = geojson.features.map((feature) => {
    const props = feature.properties;
    const codigo = props.PVOCODIGO;
    const nombre = props.PVONOMBRE || '';

    // Crear aliases
    const aliases = [nombre];

    // Agregar nombre anterior si cambió
    const cambio = analysis.cambiosNombre.find(c => c.codigo === codigo);
    if (cambio) {
      aliases.push(cambio.nombreAnterior);
      console.log(`  ✏️  Alias agregado: "${cambio.nombreAnterior}"`);
    }

    // Agregar nombre simplificado
    const nombreSimple = nombre
      .replace(/^Colegio\s+/i, '')
      .replace(/^Escuela\s+/i, '')
      .replace(/^Centro\s+/i, '')
      .replace(/\s+-\s+Sede\s+[A-Z]\d*$/i, '')
      .trim();
    if (nombreSimple !== nombre && nombreSimple.length > 3) {
      aliases.push(nombreSimple);
    }

    // Agregar localidad
    aliases.push(props.LOCNOMBRE);

    // Agregar sitio
    if (props.PVONSITIO && props.PVONSITIO !== nombre) {
      aliases.push(props.PVONSITIO);
    }

    // Agregar aliases históricos si existen
    const anterior = mapAnteriores.get(codigo);
    if (anterior && anterior.aliases) {
      anterior.aliases.forEach(alias => {
        if (!aliases.includes(alias)) {
          aliases.push(alias);
        }
      });
    }

    return {
      codigoPuesto: codigo,
      nombre: nombre,
      localidad: props.LOCNOMBRE,
      codigoLocalidad: props.LOCCODIGO,
      direccion: props.PVODIRECCI || '',
      sitio: props.PVONSITIO || '',
      numeroMesas: parseInt(props.PVONPUESTO) || 1,
      mesas: Array.from({ length: parseInt(props.PVONPUESTO) || 1 }, (_, i) => ({
        numero: i + 1,
        activa: true
      })),
      aliases: [...new Set(aliases)], // Eliminar duplicados
      activo: true,
      versionActualizacion: 'v2.0-2023',
      fechaActualizacion: new Date().toISOString().split('T')[0],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  console.log(`\n✅ ${puestosActualizados.length} puestos procesados con aliases`);

  // Guardar
  const outputPath = path.join(__dirname, 'puestos-actualizados.json');
  fs.writeFileSync(outputPath, JSON.stringify(puestosActualizados, null, 2));
  console.log(`💾 Guardado: ${outputPath}`);

  return puestosActualizados;
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    generarPuestosActualizados();
    console.log('\n✅ Actualización completada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

export default generarPuestosActualizados;
