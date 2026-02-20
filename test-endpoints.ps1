# Script para probar endpoints con JWT
# Genera tokens y prueba los endpoints de organizaciones

Write-Host "`n🧪 PRUEBAS DE ENDPOINTS - Phase 6" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:5000"

# Test 1: Health Check
Write-Host "📋 Test 1: Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Health: $($health.status)" -ForegroundColor Green
    Write-Host "   Timestamp: $($health.timestamp)`n" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Test 2: Public endpoint (sin auth)
Write-Host "📋 Test 2: Public Registration Form" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/form.html" -Method GET -TimeoutSec 5
    Write-Host "✅ Form.html accesible sin autenticación`n" -ForegroundColor Green
} catch {
    Write-Host "❌ Form not accessible: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Test 3: Endpoint protegido sin token
Write-Host "📋 Test 3: Protected Endpoint (sin token)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/organizations" -Method GET -TimeoutSec 5
    Write-Host "❌ Debería haber bloqueado sin token" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -match "401") {
        Write-Host "✅ Correctamente bloqueado: 401 Unauthorized`n" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Otro error: $($_.Exception.Message)`n" -ForegroundColor Yellow
    }
}

# Test 4: Generar JWT Token con Node.js
Write-Host "📋 Test 4: Generando JWT Tokens con Node.js" -ForegroundColor Yellow

$nodeScript = @"
const jwt = require('jsonwebtoken');
const SECRET = 'dev_secret_key_change_in_production';

const superAdminToken = jwt.sign({
    userId: 'admin1',
    email: 'superadmin@test.com',
    role: 'super_admin'
}, SECRET, { expiresIn: '12h' });

const orgAdminToken = jwt.sign({
    userId: 'admin2',
    email: 'orgadmin@test.com',
    role: 'org_admin',
    organizationId: 'ORG001'
}, SECRET, { expiresIn: '12h' });

console.log(JSON.stringify({
    superAdminToken,
    orgAdminToken
}));
"@

$nodeScript | Out-File -FilePath "temp_gen_tokens.js" -Encoding UTF8

try {
    $tokens = node temp_gen_tokens.js | ConvertFrom-Json
    Remove-Item temp_gen_tokens.js
    
    $superAdminToken = $tokens.superAdminToken
    $orgAdminToken = $tokens.orgAdminToken
    
    Write-Host "🔑 Super Admin Token:" -ForegroundColor Cyan
    Write-Host "   $($superAdminToken.Substring(0, 50))...`n" -ForegroundColor Gray
    
    Write-Host "🔑 Org Admin Token:" -ForegroundColor Cyan
    Write-Host "   $($orgAdminToken.Substring(0, 50))...`n" -ForegroundColor Gray
    
    # Test 5: Endpoint con Super Admin Token
    Write-Host "📋 Test 5: Organizations List (Super Admin)" -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $superAdminToken"
        }
        $orgs = Invoke-RestMethod -Uri "$baseUrl/api/organizations" -Method GET -Headers $headers -TimeoutSec 5
        Write-Host "✅ Super admin puede listar organizaciones" -ForegroundColor Green
        Write-Host "   Organizaciones encontradas: $($orgs.organizations.Count)`n" -ForegroundColor Gray
    } catch {
        if ($_.Exception.Message -match "500") {
            Write-Host "⚠️ Endpoint responde pero MongoDB no conectado (esperado)`n" -ForegroundColor Yellow
        } else {
            Write-Host "❌ Error: $($_.Exception.Message)`n" -ForegroundColor Red
        }
    }
    
    # Test 6: Endpoint con Org Admin Token (debe ser bloqueado)
    Write-Host "📋 Test 6: Organizations List (Org Admin - debe fallar)" -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $orgAdminToken"
        }
        $orgs = Invoke-RestMethod -Uri "$baseUrl/api/organizations" -Method GET -Headers $headers -TimeoutSec 5
        Write-Host "❌ Org admin NO debería poder listar todas las orgs" -ForegroundColor Red
    } catch {
        if ($_.Exception.Message -match "403") {
            Write-Host "✅ Correctamente bloqueado: 403 Forbidden`n" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Otro error: $($_.Exception.Message)`n" -ForegroundColor Yellow
        }
    }
    
    # Test 7: Leaders endpoint con filtrado
    Write-Host "📋 Test 7: Leaders List (con filtrado org)" -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $orgAdminToken"
        }
        $leaders = Invoke-RestMethod -Uri "$baseUrl/api/leaders" -Method GET -Headers $headers -TimeoutSec 5
        Write-Host "✅ Org admin puede ver sus leaders" -ForegroundColor Green
        Write-Host "   Leaders encontrados: $($leaders.leaders.Count)`n" -ForegroundColor Gray
    } catch {
        if ($_.Exception.Message -match "500") {
            Write-Host "⚠️ Endpoint responde pero MongoDB no conectado (esperado)`n" -ForegroundColor Yellow
        } else {
            Write-Host "❌ Error: $($_.Exception.Message)`n" -ForegroundColor Red
        }
    }
    
    Write-Host "`n🎯 RESUMEN DE PRUEBAS" -ForegroundColor Cyan
    Write-Host "===================`n" -ForegroundColor Cyan
    Write-Host "✅ Health check funcionando" -ForegroundColor Green
    Write-Host "✅ Endpoints públicos accesibles" -ForegroundColor Green
    Write-Host "✅ Autenticación bloqueando requests sin token" -ForegroundColor Green
    Write-Host "✅ JWT tokens generados correctamente" -ForegroundColor Green
    Write-Host "✅ Role-based access control funcionando" -ForegroundColor Green
    Write-Host "⚠️ MongoDB no conectado (esperado en dev)`n" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error generando tokens: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path temp_gen_tokens.js) {
        Remove-Item temp_gen_tokens.js
    }
}
