/**
 * Controller para importación de puestos vía API
 * Ruta protegida: POST /api/admin/import-puestos
 * Requiere: JWT con role "admin"
 */

import { Puestos } from "../models/index.js";
import logger from "../config/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Datos de ejemplo
const PUESTOS_BOGOTA_EJEMPLO = [
  { codigoPuesto: "011001", nombre: "Colegio Distrital Usaquén", localidad: "Usaquén", direccion: "Cra 7 #120-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "011002", nombre: "Instituto Técnico Usaquén", localidad: "Usaquén", direccion: "Cra 9 #125-60", mesas: [1, 2, 3] },
  { codigoPuesto: "012001", nombre: "Colegio Chapinero", localidad: "Chapinero", direccion: "Cra 7 #72-80", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "012002", nombre: "Escuela Chapinero Alto", localidad: "Chapinero", direccion: "Cra 5 #75-40", mesas: [1, 2] },
  { codigoPuesto: "013001", nombre: "Colegio Santa Fe", localidad: "Santa Fe", direccion: "Cra 3 #12-30", mesas: [1, 2, 3, 4, 5, 6] },
  { codigoPuesto: "014001", nombre: "Colegio San Cristóbal", localidad: "San Cristóbal", direccion: "Cra 2 #40-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "015001", nombre: "Colegio Usme", localidad: "Usme", direccion: "Av Cra 3 #85-20", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "016001", nombre: "Colegio Tunjuelito", localidad: "Tunjuelito", direccion: "Cra 19 #32-50", mesas: [1, 2, 3] },
  { codigoPuesto: "017001", nombre: "Colegio Bosa", localidad: "Bosa", direccion: "Cra 40 #67-80", mesas: [1, 2, 3, 4, 5, 6] },
  { codigoPuesto: "017002", nombre: "Instituto Bosa", localidad: "Bosa", direccion: "Cra 45 #70-40", mesas: [1, 2, 3] },
  { codigoPuesto: "018001", nombre: "Colegio Kennedy", localidad: "Kennedy", direccion: "Cra 68 #36-45", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "018002", nombre: "Escuela Kennedy Central", localidad: "Kennedy", direccion: "Cra 70 #38-30", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "018003", nombre: "Instituto Técnico Kennedy Sur", localidad: "Kennedy", direccion: "Cra 75 #41-60", mesas: [1, 2, 3] },
  { codigoPuesto: "019001", nombre: "Colegio Fontibón", localidad: "Fontibón", direccion: "Cra 67 #19-40", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "0110001", nombre: "Colegio Engativá", localidad: "Engativá", direccion: "Cra 72 #70-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "0110002", nombre: "Colegio Suba", localidad: "Suba", direccion: "Cra 100 #122-60", mesas: [1, 2, 3, 4, 5, 6] },
  { codigoPuesto: "0110003", nombre: "Colegio Barrios Unidos", localidad: "Barrios Unidos", direccion: "Cra 9 #60-50", mesas: [1, 2, 3] },
  { codigoPuesto: "0110004", nombre: "Colegio Teusaquillo", localidad: "Teusaquillo", direccion: "Cra 15 #52-40", mesas: [1, 2, 3] },
  { codigoPuesto: "0110005", nombre: "Colegio Los Mártires", localidad: "Los Mártires", direccion: "Cra 8 #17-30", mesas: [1, 2] },
  { codigoPuesto: "0110006", nombre: "Colegio Antonio Nariño", localidad: "Antonio Nariño", direccion: "Cra 2 #29-50", mesas: [1, 2, 3] },
  { codigoPuesto: "0110007", nombre: "Colegio Puente Aranda", localidad: "Puente Aranda", direccion: "Cra 30 #19-40", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "0110008", nombre: "Colegio La Candelaria", localidad: "La Candelaria", direccion: "Cra 3 #11-50", mesas: [1] },
  { codigoPuesto: "0110009", nombre: "Colegio Rafael Uribe Uribe", localidad: "Rafael Uribe Uribe", direccion: "Cra 14 #51-60", mesas: [1, 2, 3, 4] },
  { codigoPuesto: "0110010", nombre: "Colegio Ciudad Bolívar", localidad: "Ciudad Bolívar", direccion: "Cra 30 #63-50", mesas: [1, 2, 3, 4, 5] },
  { codigoPuesto: "0110011", nombre: "Centro Comunitario Sumapaz", localidad: "Sumapaz", direccion: "Cra 2 #90-20", mesas: [1, 2] }
];

export async function importarPuestosAPIHandler(req, res) {
  try {
    logger.info("📍 Iniciando importación de puestos vía API...");

    const organizationId = req.user?.organizationId ?? null;
    
    // Requerir puestos del request
    const { puestos: puestosRequest } = req.body || {};
    
    if (!Array.isArray(puestosRequest) || puestosRequest.length === 0) {
      logger.warn("⚠️  No se enviaron puestos en el request body");
      return res.status(400).json({
        success: false,
        message: "Debe enviar array 'puestos' en el body",
        receivedBody: req.body ? Object.keys(req.body) : "empty"
      });
    }

    logger.info(`📦 Recibidos ${puestosRequest.length} puestos del request`);

    // Validar datos
    const puestosValidos = puestosRequest.filter(p => 
      p.codigoPuesto && p.nombre && p.localidad && Array.isArray(p.mesas)
    );

    if (puestosValidos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay puestos válidos para importar"
      });
    }

    logger.info(`📦 Validados ${puestosValidos.length} puestos`);

    const deleteFilter = organizationId ? { organizationId } : {};
    await Puestos.deleteMany(deleteFilter);
    logger.info(`🗑️  Colección anterior limpiada`);

    // Insertar nuevos puestos
    const puestosConOrg = puestosValidos.map((puesto) => ({
      ...puesto,
      organizationId: puesto.organizationId ?? organizationId ?? null
    }));

    const resultado = await Puestos.insertMany(puestosConOrg);
    logger.info(`✅ Se importaron ${resultado.length} puestos de votación`);

    // Calcular estadísticas
    const stats = {};
    resultado.forEach(p => {
      if (!stats[p.localidad]) {
        stats[p.localidad] = { count: 0, mesas: 0 };
      }
      stats[p.localidad].count++;
      stats[p.localidad].mesas += p.mesas.length;
    });

    // Preparar respuesta
    const estadisticas = Object.entries(stats)
      .sort()
      .map(([localidad, data]) => ({
        localidad,
        puestos: data.count,
        mesas: data.mesas
      }));

    const totalMesas = Object.values(stats).reduce((sum, s) => sum + s.mesas, 0);

    return res.status(200).json({
      success: true,
      imported: resultado.length,
      message: `✅ Se importaron ${resultado.length} puestos de votación exitosamente`,
      data: {
        totalPuestos: resultado.length,
        totalMesas,
        estadisticas
      }
    });

  } catch (error) {
    logger.error(`❌ Error al importar puestos vía API: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error al importar puestos",
      error: error.message
    });
  }
}

/**
 * Importar puestos desde GeoJSON oficial (965 puestos Bogotá)
 * POST /api/admin/import-geojson-puestos
 * Requiere: JWT con role "admin"
 */
export async function importarPuestosDesdeGeoJSON(req, res) {
  try {
    logger.info("🔄 Iniciando importación desde GeoJSON...");

    const organizationId = req.user?.organizationId ?? null;

    // Leer GeoJSON
    const geoJsonPath = path.join(__dirname, "../../tools/pvo.geojson");
    if (!fs.existsSync(geoJsonPath)) {
      logger.error(`GeoJSON no encontrado: ${geoJsonPath}`);
      return res.status(400).json({
        success: false,
        error: `GeoJSON no encontrado: ${geoJsonPath}`
      });
    }

    const geojson = JSON.parse(fs.readFileSync(geoJsonPath, "utf8"));
    const features = geojson.features || [];

    logger.info(`📊 Procesando ${features.length} puestos desde GeoJSON`);

    // Procesar features
    const puestosProcessados = features.map((feature) => {
      const props = feature.properties;
      const nombre = props.PVONOMBRE || "";

      // Crear aliases automáticos
      const aliases = [nombre];

      const nombreSimple = nombre
        .replace(/^Colegio\s+/i, "")
        .replace(/^Escuela\s+/i, "")
        .replace(/^Centro\s+/i, "")
        .replace(/\s+-\s+Sede\s+[A-Z]\d*$/i, "")
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
        direccion: props.PVODIRECCI || "",
        sitio: props.PVONSITIO || "",
        numeroMesas: parseInt(props.PVONPUESTO) || 1,
        mesas: Array.from({ length: parseInt(props.PVONPUESTO) || 1 }, (_, i) => ({
          numero: i + 1,
          activa: true
        })),
        aliases: [...new Set(aliases)],
        organizationId,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    logger.info(`📋 Procesados ${puestosProcessados.length} puestos`);

    // Backup si hay puestos
    const backupFilter = organizationId ? { organizationId } : {};
    const countActuales = await Puestos.countDocuments(backupFilter);
    if (countActuales > 0) {
      const backup = await Puestos.find(backupFilter).lean();
      const backupFile = path.join(__dirname, `../../tools/puestos-backup-${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      logger.info(`💾 Backup guardado: ${backupFile}`);
    }

    // Limpiar colección
    logger.info("🧹 Limpiando colección anterior");
    await Puestos.deleteMany(backupFilter);

    // Importar
    logger.info(`📥 Importando ${puestosProcessados.length} puestos...`);
    const resultado = await Puestos.insertMany(puestosProcessados, { ordered: false });
    logger.info(`✅ Importados: ${resultado.length} puestos`);

    // Estadísticas
    const stats = await Puestos.aggregate([
      {
        $group: {
          _id: "$localidad",
          count: { $sum: 1 },
          totalMesas: { $sum: "$numeroMesas" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Verificaciones específicas
    const salitre = await Puestos.findOne({ nombre: /salitre/i });
    const provinma = await Puestos.findOne({ nombre: /provinma/i });

    const response = {
      success: true,
      message: "✅ Importación completada exitosamente",
      data: {
        totalPuestos: puestosProcessados.length,
        totalMesas: stats.reduce((sum, s) => sum + s.totalMesas, 0),
        totalLocalidades: stats.length,
        estadisticasLocalidades: stats,
        verificacion: {
          salitreEncontrado: !!salitre,
          salitreDetalles: salitre
            ? {
                nombre: salitre.nombre,
                localidad: salitre.localidad,
                codigo: salitre.codigoPuesto
              }
            : null,
          provinmaEncontrado: !!provinma,
          provinmaDetalles: provinma
            ? {
                nombre: provinma.nombre,
                localidad: provinma.localidad,
                codigo: provinma.codigoPuesto
              }
            : null
        },
        timestamp: new Date().toISOString()
      }
    };

    logger.info("✅ Importación completada");
    res.json(response);
  } catch (error) {
    logger.error(`❌ Error en importación GeoJSON: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
}
