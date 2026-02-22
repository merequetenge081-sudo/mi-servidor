Write-Host "=== TEST FLUJO COMPLETO ===" -ForegroundColor Cyan

# 1. Test Login Admin
Write-Host "`n1️⃣ Probando LOGIN DE ADMIN..." -ForegroundColor Yellow
$body = ConvertTo-Json @{username='admin'; password='admin123'}
$loginRes = Invoke-WebRequest -Uri http://localhost:5000/api/auth/admin-login -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -ErrorAction SilentlyContinue
$loginData = $loginRes.Content | ConvertFrom-Json

if ($loginData.token) {
    Write-Host "✅ Login exitoso!" -ForegroundColor Green
    $token = $loginData.token
    Write-Host "Token recibido (primeros 30 chars): $($token.Substring(0, 30))..."
    
    # 2. Test obtener registrations con token
    Write-Host "`n2️⃣ Probando GET /api/registrations con token..." -ForegroundColor Yellow
    try {
        $regsRes = Invoke-WebRequest -Uri http://localhost:5000/api/registrations -Method GET -Headers @{'Authorization'="Bearer $token"} -UseBasicParsing
        Write-Host "✅ Registrations obtenidas!" -ForegroundColor Green
        $regsData = $regsRes.Content | ConvertFrom-Json
        Write-Host "Respuesta: $($regsData | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Error obteniendo registrations: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 3. Test obtener leaders
    Write-Host "`n3️⃣ Probando GET /api/leaders..." -ForegroundColor Yellow
    try {
        $leadersRes = Invoke-WebRequest -Uri http://localhost:5000/api/leaders -Method GET -Headers @{'Authorization'="Bearer $token"} -UseBasicParsing
        Write-Host "✅ Leaders obtenidos!" -ForegroundColor Green
        $leadersData = $leadersRes.Content | ConvertFrom-Json
        Write-Host "Respuesta: $($leadersData | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Error obteniendo leaders: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n4️⃣ Test de logout (localStorage será manejado por el navegador)" -ForegroundColor Yellow
    Write-Host "✅ Sistema listo para testing en el navegador!" -ForegroundColor Green
    
} else {
    Write-Host "❌ Login fallido!" -ForegroundColor Red
    Write-Host "Error: $($loginData.error)"
}

Write-Host "`n=== TEST COMPLETADO ===" -ForegroundColor Cyan
