# Script para acceder al Control Center Secreto
# Uso: .\test-control-center.ps1

param(
    [string]$Email = "admin@example.com",
    [string]$Password = "admin123456",
    [string]$DevKey = "your_super_secret_control_center_key_change_in_production_2024",
    [string]$ServerUrl = "http://localhost:3000"
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Control Center Secreto - Test Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Variables
$LoginEndpoint = "$ServerUrl/api/auth/login"
$ControlCenterEndpoint = "$ServerUrl/internal/control-center"
$LogsEndpoint = "$ServerUrl/internal/control-center/logs"
$StatsEndpoint = "$ServerUrl/internal/control-center/stats"

# ==================== PASO 1: LOGIN ====================
Write-Host "[1/4] Intentando login como: $Email" -ForegroundColor Yellow

try {
    $loginResponse = Invoke-RestMethod -Uri $LoginEndpoint -Method POST `
        -ContentType "application/json" `
        -Body @{
            email    = $Email
            password = $Password
        } | ConvertTo-Json -Depth 10 | ConvertFrom-Json

    if ($loginResponse.token) {
        $token = $loginResponse.token
        Write-Host "✓ Login exitoso" -ForegroundColor Green
        Write-Host "  Token: $($token.Substring(0, 50))..." -ForegroundColor Gray
        $roleValue = if ($loginResponse.role) { $loginResponse.role } else { "N/A" }
        Write-Host "  Role: $roleValue" -ForegroundColor Gray
    }
    else {
        Write-Host "✗ No se recibió token" -ForegroundColor Red
        Write-Host "Respuesta: $($loginResponse | ConvertTo-Json -Depth 10)" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "✗ Error en login: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ==================== PASO 2: ACCEDER AL CONTROL CENTER ====================
Write-Host "[2/4] Accediendo a /internal/control-center" -ForegroundColor Yellow

try {
    $controlCenterResponse = Invoke-RestMethod `
        -Uri $ControlCenterEndpoint `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "x-dev-key"     = $DevKey
        } `
        -ContentType "application/json"

    Write-Host "✓ Acceso exitoso al Control Center" -ForegroundColor Green
    Write-Host "  Status: $($controlCenterResponse.status)" -ForegroundColor Gray
    Write-Host "  Usuario: $($controlCenterResponse.accessedBy.email)" -ForegroundColor Gray
    Write-Host "  IP acceso: $($controlCenterResponse.accessIP)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Sistema:" -ForegroundColor Cyan
    Write-Host "    - Node Version: $($controlCenterResponse.system.nodeVersion)" -ForegroundColor Gray
    Write-Host "    - Entorno: $($controlCenterResponse.system.environment)" -ForegroundColor Gray
    Write-Host "    - Uptime: $($controlCenterResponse.system.uptime)s" -ForegroundColor Gray
    Write-Host "    - Memory Heap: $($controlCenterResponse.system.memoryUsage.heapUsed) / $($controlCenterResponse.system.memoryUsage.heapTotal)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Features:" -ForegroundColor Cyan
    Write-Host "    - JWT: $($controlCenterResponse.system.features.jwt)" -ForegroundColor Gray
    Write-Host "    - Dev Mode: $($controlCenterResponse.system.features.devMode)" -ForegroundColor Gray
    Write-Host "    - Email Service: $($controlCenterResponse.system.features.emailService)" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Error accediendo al Control Center: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "  Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""

# ==================== PASO 3: OBTENER LOGS ====================
Write-Host "[3/4] Obteniendo logs recent: /internal/control-center/logs" -ForegroundColor Yellow

try {
    $logsResponse = Invoke-RestMethod `
        -Uri "$LogsEndpoint`?limit=50" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "x-dev-key"     = $DevKey
        } `
        -ContentType "application/json"

    Write-Host "✓ Logs obtenidos exitosamente" -ForegroundColor Green
    Write-Host "  Mensaje: $($logsResponse.message)" -ForegroundColor Gray
    Write-Host "  Límite: $($logsResponse.limit)" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Error obteniendo logs: $_" -ForegroundColor Red
}

Write-Host ""

# ==================== PASO 4: OBTENER STATS ====================
Write-Host "[4/4] Obteniendo estadísticas: /internal/control-center/stats" -ForegroundColor Yellow

try {
    $statsResponse = Invoke-RestMethod `
        -Uri $StatsEndpoint `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $token"
            "x-dev-key"     = $DevKey
        } `
        -ContentType "application/json"

    Write-Host "✓ Estadísticas obtenidas exitosamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Server:" -ForegroundColor Cyan
    Write-Host "    - Uptime: $($statsResponse.server.uptime)" -ForegroundColor Gray
    Write-Host "    - PID: $($statsResponse.server.pid)" -ForegroundColor Gray
    Write-Host "    - Node Version: $($statsResponse.server.nodeVersion)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Memoria:" -ForegroundColor Cyan
    Write-Host "    - Heap Used: $($statsResponse.memory.heapUsed) MB" -ForegroundColor Gray
    Write-Host "    - Heap Total: $($statsResponse.memory.heapTotal) MB" -ForegroundColor Gray
    Write-Host "    - External: $($statsResponse.memory.external) MB" -ForegroundColor Gray
    Write-Host "    - RSS: $($statsResponse.memory.rss) MB" -ForegroundColor Gray
}
catch {
    Write-Host "✗ Error obteniendo estadísticas: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✓ Test completado exitosamente" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
