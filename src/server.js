import "dotenv/config.js";
import app from "./app.js";
import { connectDB, mongoDbName } from "./config/db.js";
import { currentEnv, isProduction } from "./backend/config/environment.js";

const PORT = process.env.PORT || 5000;

/**
 * Start server with database connection (fail-fast)
 * If DB connection fails, process exits immediately
 */
async function startServer() {
  try {
    // Initialize database connection first (fail-fast)
    await connectDB();
    
    const server = app.listen(PORT, () => {
      const banner = [
        "==============================",
        "🚀 SERVER STARTED",
        `Environment: ${currentEnv}`,
        `Mongo DB: ${mongoDbName}`,
        `Port: ${PORT}`,
        "==============================",
      ].join("\n");

      if (isProduction) {
        console.log(banner);
      } else {
        console.log(`\x1b[36m${banner}\x1b[0m`);
      }
    });
    
    // Graceful Shutdown
    process.on('SIGTERM', () => {
      console.log('\n⚠️  SIGTERM recibido - Cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
      });
    });

    // Error handling
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection:', reason);
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

