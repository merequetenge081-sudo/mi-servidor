#!/bin/bash

# Script para verificar configuración de seguridad en producción

echo "🔒 Verificación de Seguridad para Producción"
echo "=============================================="
echo ""

# Verificar NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  echo "✅ NODE_ENV=production"
else
  echo "⚠️  NODE_ENV no está en production (actual: $NODE_ENV)"
fi

# Verificar JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  echo "❌ JWT_SECRET no está configurado"
else
  LENGTH=${#JWT_SECRET}
  if [ $LENGTH -lt 32 ]; then
    echo "❌ JWT_SECRET muy corto (actual: $LENGTH caracteres, mínimo: 32)"
  else
    echo "✅ JWT_SECRET configurado ($LENGTH caracteres)"
  fi
fi

# Verificar MONGO_URL
if [ -z "$MONGO_URL" ]; then
  echo "❌ MONGO_URL no está configurado"
else
  echo "✅ MONGO_URL configurado"
fi

# Verificar port
if [ -z "$PORT" ]; then
  echo "⚠️  PORT no especificado (usando default: 5000)"
else
  echo "✅ PORT=$PORT"
fi

# Verificar dependencias instaladas
echo ""
echo "📦 Verificando dependencias..."

DEPS=("helmet" "express-rate-limit" "xss-clean" "hpp" "compression" "winston")

for dep in "${DEPS[@]}"; do
  if npm list "$dep" > /dev/null 2>&1; then
    echo "✅ $dep"
  else
    echo "❌ $dep (no instalado)"
  fi
done

echo ""
echo "✔️  Verificación completada"
echo ""
echo "Para deploy en Render:"
echo "1. Asegurar JWT_SECRET sea de 32+ caracteres"
echo "2. Agregar variables en Render Dashboard"
echo "3. Hacer push a GitHub"
echo "4. Render hará deploy automático"
