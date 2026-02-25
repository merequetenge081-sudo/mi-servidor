# cleanup-tools.ps1 - Depuración de la carpeta tools

$toKeep = @(
    'parse-todos-csvs.js',
    'todos-puestos-consolidados.json',
    'puestos-nuevos-all.json',
    'check-duplicates.js',
    'bulk-import-staging.js',
    'test-verify-endpoint.js',
    'test-leader-matching.js',
    'test-puestos-endpoint.js',
    'add-found-aliases.js',
    'quick-validate.js',
    'add-missing-puestos.js'
)

$toolsPath = (Get-Location).Path
$allFiles = Get-ChildItem -File

$toDelete = @()

foreach ($file in $allFiles) {
    if ($file.Name -notin $toKeep) {
        $toDelete += $file.FullName
    }
}

Write-Host "[INFO] Archivos a MANTENER: $($toKeep.Count)"
Write-Host "[INFO] Archivos a ELIMINAR: $($toDelete.Count)"
Write-Host ""

# Hacer git rm
foreach ($file in $toDelete) {
    $fileName = Split-Path $file -Leaf
    Write-Host "[ELIMINANDO] $fileName"
    git rm -f $file 2>$null
}

Write-Host ""
Write-Host "[OK] Limpieza completada"
Write-Host "[INFO] Archivos restantes:"
Get-ChildItem -File | ForEach-Object { Write-Host "  - $($_.Name)" }
