#!/bin/bash
set -e

################################################################################
# Script One-Click para Render: Descargar, Procesar e Importar Puestos
# 
# Uso: bash deploy_puestos.sh
# 
# Pasos:
# 1. Descargar GeoJSON oficial desde datosabiertos.bogota.gov.co
# 2. Procesar datos (~940 puestos)
# 3. Importar a MongoDB
# 4. Verificar importación
################################################################################

PROJECT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TOOLS_DIR="$PROJECT_DIR/tools"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "════════════════════════════════════════════════════════════════════════════"
echo "🗳️  IMPORTAR PUESTOS DE VOTACIÓN DE BOGOTÁ"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con colores
log_step() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${1}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

# Paso 1: Descargar GeoJSON
log_step "PASO 1: Descargar GeoJSON Oficial"

GEO_FILE="$TOOLS_DIR/pvo_oficial_${TIMESTAMP}.geojson"

echo "📥 Descargando desde datosabiertos.bogota.gov.co..."
echo "   URL: https://datosabiertos.bogota.gov.co/dataset/d03ad429-75f7-4307-9521-da7442154289/resource/acc0e326-b82c-46f7-8af6-9a46f2ff79de/download/pvo.geojson"
echo ""

# Descargar con curl (está disponible en Render)
if curl -f -L -o "$GEO_FILE" "https://datosabiertos.bogota.gov.co/dataset/d03ad429-75f7-4307-9521-da7442154289/resource/acc0e326-b82c-46f7-8af6-9a46f2ff79de/download/pvo.geojson" 2>/dev/null; then
    FILE_SIZE=$(du -h "$GEO_FILE" | cut -f1)
    FEATURE_COUNT=$(grep -o '"type": "Feature"' "$GEO_FILE" | wc -l)
    log_success "GeoJSON descargado: $FILE_SIZE ($FEATURE_COUNT features)"
else
    log_error "No se pudo descargar GeoJSON. Abortando."
    exit 1
fi

echo ""

# Paso 2: Procesar GeoJSON
log_step "PASO 2: Procesar Datos GeoJSON"

PROCESSED_FILE="$TOOLS_DIR/puestos_procesados_${TIMESTAMP}.json"

echo "🔄 Procesando con procesar_geojson_puestos.cjs..."
echo ""

if node "$TOOLS_DIR/procesar_geojson_puestos.cjs" "$GEO_FILE" > /tmp/procesar.log 2>&1; then
    # El script guarda el archivo en puestos_procesados.json en el mismo dir que el GEO_FILE
    ACTUAL_PROCESSED="$TOOLS_DIR/puestos_procesados.json"
    if [ -f "$ACTUAL_PROCESSED" ]; then
        mv "$ACTUAL_PROCESSED" "$PROCESSED_FILE"
        PUESTO_COUNT=$(grep -o '"codigoPuesto"' "$PROCESSED_FILE" | wc -l)
        log_success "Datos procesados: $PUESTO_COUNT puestos únicos"
    else
        log_error "Archivo procesado no encontrado"
        cat /tmp/procesar.log
        exit 1
    fi
else
    log_error "Error en procesamiento"
    cat /tmp/procesar.log
    exit 1
fi

echo ""

# Paso 3: Importar a MongoDB
log_step "PASO 3: Importar a MongoDB"

echo "📤 Importando puestos desde $PROCESSED_FILE..."
echo ""

if node "$TOOLS_DIR/import_puestos.js" --file "$PROCESSED_FILE" > /tmp/import.log 2>&1; then
    log_success "Importación completada!"
    cat /tmp/import.log | grep -E "✅|📊|→"
else
    log_error "Error en importación"
    cat /tmp/import.log
    exit 1
fi

echo ""

# Paso 4: Verificar
log_step "PASO 4: Verificar Datos Importados"

echo "🔍 Verificando puestos..."
echo ""

if node "$TOOLS_DIR/verify_puestos.js" > /tmp/verify.log 2>&1; then
    cat /tmp/verify.log | grep -E "✅|Localidades|Total"
    log_success "Verificación completada"
else
    log_warning "Verificación no disponible (DB puede no estar lista)"
fi

echo ""

# Resumen final
log_step "RESUMEN FINAL"

echo -e "${GREEN}✅ Sistema de Puestos de Votación importado exitosamente${NC}"
echo ""
echo "📊 Archivos generados:"
echo "   • GeoJSON oficial: $GEO_FILE"
echo "   • Datos procesados: $PROCESSED_FILE"
echo ""
echo "🔗 Endpoints disponibles:"
echo "   • GET /api/public/localidades"
echo "   • GET /api/public/puestos?localidad=Kennedy"
echo "   • GET /api/public/puestos/:id"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Testear en producción: https://mi-servidor.onrender.com/form.html"
echo "   2. Seleccionar una localidad en el formulario"
echo "   3. Verificar que cargan los puestos dinámicamente"
echo ""
echo "════════════════════════════════════════════════════════════════════════════"
