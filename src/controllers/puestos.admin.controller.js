/**
 * Endpoint simplificado para importar puestos - versión funcional
 */

import { Puestos } from "../models/index.js";
import logger from "../config/logger.js";

export async function importarPuestosSimpleHandler(req, res) {
  try {
    const { puestos } = req.body;
    
    if (!Array.isArray(puestos)) {
      return res.status(400).json({
        success: false,
        error: "Debe enviar array 'puestos' en body"
      });
    }

    logger.info(`📦 Importando ${puestos.length} puestos...`);

    // Limpiar y reinsertarlet
    await Puestos.deleteMany({});
    
    const resultado = await Puestos.insertMany(puestos);
    
    logger.info(`✅ Importados ${resultado.length} puestos`);

    res.json({
      success: true,
      imported: resultado.length,
      count: resultado.length
    });

  } catch (error) {
    logger.error(`❌ Error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
