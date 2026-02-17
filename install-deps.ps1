# Windows PowerShell Script - Instalar dependencias de producción
# Uso: .\install-deps.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📦 Instalando Dependencias de Producción" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si npm está instalado
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm no está instalado. Instala Node.js primero." -ForegroundColor Red
    exit 1
}

Write-Host "✓ npm encontrado: $(npm --version)" -ForegroundColor Green
Write-Host ""

# Listar dependencias a instalar
Write-Host "📝 Dependencias a instalar:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  PRODUCTION:" -ForegroundColor Yellow
Write-Host "    • helmet (v7.1.0) - HTTP security headers" -ForegroundColor White
Write-Host "    • express-rate-limit (v7.6.0) - Rate limiting" -ForegroundColor White
Write-Host "    • xss-clean (v0.1.1) - XSS protection" -ForegroundColor White
Write-Host "    • hpp (v0.2.3) - Parameter pollution protection" -ForegroundColor White
Write-Host "    • compression (v1.7.4) - GZIP compression" -ForegroundColor White
Write-Host "    • winston (v3.14.2) - Logging" -ForegroundColor White
Write-Host ""
Write-Host "  DEVELOPMENT:" -ForegroundColor Yellow
Write-Host "    • terser (v5.31.3) - JS minification" -ForegroundColor White
Write-Host "    • clean-css-cli (v5.6.3) - CSS minification" -ForegroundColor White
Write-Host ""

# Confirmar instalación
$confirm = Read-Host "¿Continuar con la instalación? (s/n)"
if ($confirm -ne 's' -and $confirm -ne 'S') {
    Write-Host "❌ Instalación cancelada." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔄 Instalando dependencias..." -ForegroundColor Cyan
Write-Host ""

# Instalación
$startTime = Get-Date

npm install helmet express-rate-limit xss-clean hpp compression winston terser clean-css-cli

if ($LASTEXITCODE -eq 0) {
    $duration = ((Get-Date) - $startTime).TotalSeconds
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "✅ ¡Instalación exitosa!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tiempo: $([math]::Round($duration, 2))s" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Próximos pasos:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Configurar .env:" -ForegroundColor White
    Write-Host "   NODE_ENV=development" -ForegroundColor Gray
    Write-Host "   JWT_SECRET=mi-clave-super-secreta-32-caracteres-minimo" -ForegroundColor Gray
    Write-Host "   MONGO_URL=mongodb+srv://..." -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Inicio local:" -ForegroundColor White
    Write-Host "   npm start" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Ver logs:" -ForegroundColor White
    Write-Host "   Get-Content logs\combined.log -Tail 20 -Wait" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Si todo funciona, hacer push:" -ForegroundColor White
    Write-Host "   git push origin main" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📖 Lee QUICK_START.md para instrucciones detalladas" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "❌ Error en la instalación" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, verifica:" -ForegroundColor Yellow
    Write-Host "  • Conexión a internet" -ForegroundColor White
    Write-Host "  • npm está actualizado: npm install -g npm" -ForegroundColor White
    Write-Host "  • Estás en el directorio correcto: $(Get-Location)" -ForegroundColor White
    Write-Host ""
    exit 1
}
