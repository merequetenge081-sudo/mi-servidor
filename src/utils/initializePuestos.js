/**
 * Inicializador automático de Puestos
 * Si la colección está vacía, importa los 965 puestos desde GeoJSON
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Puestos } from '../models/index.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializePuestosIfEmpty() {
  try {
    // Verificar si hay puestos
    const count = await Puestos.countDocuments();
    
    if (count > 0) {
      logger.info(`✅ Puestos ya inicializados: ${count} puestos en BD`);
      return;
    }

    logger.info('📍 Colección de Puestos vacía. Iniciando importación automática...');

    // Leer GeoJSON
    const geoJsonPath = path.join(__dirname, '../..', 'tools/pvo.geojson');
    if (!fs.existsSync(geoJsonPath)) {
      logger.warn(`⚠️ GeoJSON no encontrado: ${geoJsonPath}`);
      return;
    }

    const geojson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
    const features = geojson.features || [];

    logger.info(`🔄 Procesando ${features.length} puestos desde GeoJSON...`);

    // Procesar features
    const puestosProcessados = features.map((feature) => {
      const props = feature.properties;
      const nombre = props.PVONOMBRE || '';

      // Crear aliases
      const aliases = [nombre];

      const nombreSimple = nombre
        .replace(/^Colegio\s+/i, '')
        .replace(/^Escuela\s+/i, '')
        .replace(/^Centro\s+/i, '')
        .replace(/\s+-\s+Sede\s+[A-Z]\d*$/i, '')
        .trim();

      if (nombreSimple !== nombre && nombreSimple.length > 3) {
        aliases.push(nombreSimple);
      }

      aliases.push(props.LOCNOMBRE);

      if (props.PVONSITIO && props.PVONSITIO !== nombre) {
        aliases.push(props.PVONSITIO);
      }

      return {
        codigoPuesto: props.PVOCODIGO,
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
        aliases: [...new Set(aliases)],
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    // Importar
    logger.info(`📥 Importando ${puestosProcessados.length} puestos...`);
    await Puestos.insertMany(puestosProcessados, { ordered: false });

    logger.info(`✅ Importación completada: ${puestosProcessados.length} puestos en BD`);

    // Verificar específicos
    const salitre = await Puestos.findOne({ nombre: /salitre/i });
    const provinma = await Puestos.findOne({ nombre: /provinma/i });

    if (salitre) {
      logger.info(`✅ "El Salitre" encontrado en ${salitre.localidad}`);
    }
    if (provinma) {
      logger.info(`✅ "Colegio Provinma" (Usaquén) encontrado`);
    }

  } catch (error) {
    logger.error('❌ Error inicializando Puestos:', error.message);
    // No lanzar error, solo loguear para que el servidor continúe
  }
}
