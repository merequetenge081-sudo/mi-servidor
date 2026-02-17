#!/usr/bin/env pwsh
# Script de verificación rápida del sistema

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🔍 VERIFICACIÓN DEL SISTEMA" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar puerto 5000
Write-Host "1️⃣  Verificando puerto 5000..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "   ✅ Servidor corriendo en puerto 5000" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Puerto 5000 no está en uso" -ForegroundColor Red
    Write-Host "   → Ejecutar: npm start" -ForegroundColor Gray
}

Write-Host ""

# 2. Verificar .env
Write-Host "2️⃣  Verificando configuración (.env)..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $env_content = Get-Content ".env" -Raw
    
    if ($env_content -match "MONGO_URL") {
        Write-Host "   ✅ MONGO_URL configurado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ MONGO_URL no encontrado" -ForegroundColor Red
    }
    
    if ($env_content -match "JWT_SECRET") {
        Write-Host "   ✅ JWT_SECRET configurado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ JWT_SECRET no encontrado" -ForegroundColor Red
    }
    
    if ($env_content -match "NODE_ENV=development") {
        Write-Host "   ✅ NODE_ENV=development" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  NODE_ENV no es 'development'" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Archivo .env no encontrado" -ForegroundColor Red
}

Write-Host ""

# 3. Verificar archivos HTML
Write-Host "3️⃣  Verificando archivos HTML..." -ForegroundColor Yellow
$htmlFiles = @(
    "public/login.html",
    "public/app.html",
    "public/leader.html",
    "public/form.html"
)

foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file existe" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file NO EXISTE" -ForegroundColor Red
    }
}

Write-Host ""

# 4. Verificar archivos de configuración
Write-Host "4️⃣  Verificando archivos de configuración..." -ForegroundColor Yellow
$configFiles = @(
    "src/app.js",
    "src/config/db.js",
    "src/config/env.js",
    "src/routes/index.js"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file existe" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file NO EXISTE" -ForegroundColor Red
    }
}

Write-Host ""

# 5. Verificar data.json
Write-Host "5️⃣  Verificando datos para migración..." -ForegroundColor Yellow
if (Test-Path "data.json") {
    try {
        $data = Get-Content "data.json" | ConvertFrom-Json
        $leaderCount = $data.leaders.Count
        $registrationCount = $data.registrations.Count
        Write-Host "   ✅ data.json contiene:" -ForegroundColor Green
        Write-Host "      • $leaderCount líderes" -ForegroundColor Green
        Write-Host "      • $registrationCount registros" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  data.json existe pero no es JSON válido" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  data.json no encontrado (opcional para migración)" -ForegroundColor Yellow
}

Write-Host ""

# 6. Verificar node_modules
Write-Host "6️⃣  Verificando dependencias..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✅ node_modules existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ node_modules NO existe" -ForegroundColor Red
    Write-Host "   → Ejecutar: npm install" -ForegroundColor Gray
}

Write-Host ""

# 7. Tests básicos
Write-Host "7️⃣  Tests de API (si servidor está corriendo)..." -ForegroundColor Yellow
try {
    $health = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($health.StatusCode -eq 200) {
        Write-Host "   ✅ /api/health respondiendo" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  /api/health no respondiendo (servidor apagado o error de conexión)" -ForegroundColor Yellow
}

try {
    $root = Invoke-WebRequest -Uri "http://localhost:5000/" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($root.RawContent -match "login" -or $root.RawContent -match "admin") {
        Write-Host "   ✅ / sirviendo login.html" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  / no respondiendo" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ VERIFICACIÓN COMPLETADA" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📚 Pasos siguientes:" -ForegroundColor Magenta
Write-Host "1. Asegurar que npm start esté corriendo" -ForegroundColor Gray
Write-Host "2. Visitar http://localhost:5000 en el navegador" -ForegroundColor Gray
Write-Host "3. Hacer POST a /api/migrate para migrar datos" -ForegroundColor Gray
Write-Host "4. Iniciar sesión con:" -ForegroundColor Gray
Write-Host "   • Usuario: admin" -ForegroundColor Gray
Write-Host "   • Contraseña: admin123" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 Ver documentación completa en: GUIA_INICIO_RAPIDO.md" -ForegroundColor Magenta
