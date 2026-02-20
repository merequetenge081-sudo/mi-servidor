import logger from "../config/logger.js";

/**
 * Panel de control Superadmin secreto
 * Información de sistema y control general
 */
export async function getControlCenter(req, res) {
  try {
    const user = req.user;
    const clientIP = req.clientIP;

    // Recolectar información del sistema
    const systemInfo = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      uptime: Math.floor(process.uptime()),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
        external: Math.round(process.memoryUsage().external / 1024 / 1024) + "MB",
      },
      mongodb: {
        url: process.env.MONGO_URL ? "✓ Configured" : "✗ Not configured",
        // No exponemos la URL completa por seguridad
      },
      features: {
        jwt: process.env.JWT_SECRET ? "✓ Enabled" : "✗ Disabled",
        devMode: process.env.DEV_SECRET_KEY ? "✓ Enabled" : "✗ Disabled",
        emailService: process.env.RESEND_API_KEY ? "✓ Configured" : "✗ Not configured",
      },
    };

    const controlPanel = {
      status: "authorized",
      accessedBy: {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
      accessIP: clientIP,
      system: systemInfo,
      actions: [
        {
          endpoint: "POST /internal/control-center/restart",
          description: "Restart server (requires additional confirmation)",
          status: "available",
        },
        {
          endpoint: "GET /internal/control-center/logs",
          description: "View recent server logs",
          status: "available",
        },
        {
          endpoint: "GET /internal/control-center/stats",
          description: "View system statistics",
          status: "available",
        },
      ],
      warning: "This endpoint is for authorized superadmin use only",
    };

    // Loggear acceso exitoso
    logger.info("✓ Control center accessed successfully", {
      userId: user.userId,
      email: user.email,
      ip: clientIP,
    });

    return res.status(200).json(controlPanel);
  } catch (error) {
    logger.error("Error in getControlCenter", { error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Obtener últimos logs del servidor
 */
export async function getControlCenterLogs(req, res) {
  try {
    const user = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000 logs

    // Nota: En una aplicación real, buscarías esto en tu servicio de logs
    // Por ahora, devolvemos un mensaje indicativo
    const logs = {
      message: "Logs endpoint is available",
      limit,
      note: "Implement log storage/retrieval service for full functionality",
      lastAccess: {
        userId: user.userId,
        timestamp: new Date().toISOString(),
      },
    };

    logger.info("Control center logs accessed", { userId: user.userId });
    return res.status(200).json(logs);
  } catch (error) {
    logger.error("Error in getControlCenterLogs", { error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Obtener estadísticas del sistema
 */
export async function getControlCenterStats(req, res) {
  try {
    const user = req.user;
    const timestamp = new Date().toISOString();

    const stats = {
      timestamp,
      server: {
        uptime: Math.floor(process.uptime()) + "s",
        pid: process.pid,
        nodeVersion: process.version,
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      cpu: {
        usage: process.cpuUsage(),
      },
      accessedBy: user.userId,
    };

    logger.info("Control center stats accessed", { userId: user.userId });
    return res.status(200).json(stats);
  } catch (error) {
    logger.error("Error in getControlCenterStats", { error: error.message });
    return res.status(500).json({ error: "Internal server error" });
  }
}
