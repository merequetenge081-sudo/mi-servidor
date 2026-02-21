import { Puestos } from "../models/index.js";
import logger from "../utils/logger.js";

/**
 * GET /api/puestos?localidad=Kennedy
 * Obtiene todos los puestos de votación de una localidad específica
 */
export async function getPuestosHandler(req, res) {
  try {
    const { localidad } = req.query;

    if (!localidad) {
      return res.status(400).json({
        success: false,
        message: "Parámetro 'localidad' es requerido"
      });
    }

    const puestos = await Puestos.find({
      localidad: localidad,
      activo: true
    })
      .sort({ nombre: 1 })
      .lean();

    logger.info(`Cargados ${puestos.length} puestos para ${localidad}`);

    res.status(200).json({
      success: true,
      data: puestos,
      count: puestos.length
    });
  } catch (error) {
    logger.error(`Error al obtener puestos: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error al obtener puestos",
      error: error.message
    });
  }
}

/**
 * GET /api/puestos/:id
 * Obtiene un puesto específico con sus mesas disponibles
 */
export async function getPuestoDetalleHandler(req, res) {
  try {
    const { id } = req.params;

    const puesto = await Puestos.findById(id).lean();

    if (!puesto) {
      return res.status(404).json({
        success: false,
        message: "Puesto no encontrado"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: puesto._id,
        codigoPuesto: puesto.codigoPuesto,
        nombre: puesto.nombre,
        localidad: puesto.localidad,
        direccion: puesto.direccion,
        mesas: puesto.mesas
      }
    });
  } catch (error) {
    logger.error(`Error al obtener detalle del puesto: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error al obtener detalle del puesto",
      error: error.message
    });
  }
}

/**
 * GET /api/localidades
 * Obtiene todas las localidades disponibles
 */
export async function getLocalidadesHandler(req, res) {
  try {
    const localidades = await Puestos.distinct("localidad", { activo: true });

    res.status(200).json({
      success: true,
      data: localidades.sort(),
      count: localidades.length
    });
  } catch (error) {
    logger.error(`Error al obtener localidades: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error al obtener localidades",
      error: error.message
    });
  }
}

/**
 * POST /api/puestos/import
 * Importa datos de puestos (requiere admin)
 * Body: { puestos: [...] }
 */
export async function importarPuestosHandler(req, res) {
  try {
    const { puestos } = req.body;

    if (!Array.isArray(puestos) || puestos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Se requiere un array válido de puestos"
      });
    }

    // Sanitizar y validar datos
    const puestosValidos = puestos.filter(p => 
      p.codigoPuesto && p.nombre && p.localidad && Array.isArray(p.mesas)
    );

    if (puestosValidos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Ninguno de los puestos tiene datos válidos"
      });
    }

    // Borrar puestos existentes o actualizar
    await Puestos.deleteMany({});

    const resultado = await Puestos.insertMany(puestosValidos);

    logger.info(`Se importaron ${resultado.length} puestos de votación`);

    res.status(201).json({
      success: true,
      message: `Se importaron ${resultado.length} puestos correctamente`,
      data: resultado
    });
  } catch (error) {
    logger.error(`Error al importar puestos: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error al importar puestos",
      error: error.message
    });
  }
}
