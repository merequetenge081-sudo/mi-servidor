#!/bin/bash

echo "🚀 Instalando dependencias para optimización en producción..."

# Dependencias de seguridad
npm install helmet express-rate-limit xss-clean hpp compression

# Logging
npm install winston

# DevDependencies para build
npm install --save-dev terser clean-css-cli

echo "✅ Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Configurar variables en .env"
echo "2. Ejecutar: npm start"
echo "3. Revisar logs en logs/combined.log"
echo "4. Para producción: NODE_ENV=production npm start"
echo ""
echo "🔐 IMPORTANTE: En producción, establecer JWT_SECRET con mínimo 32 caracteres"
