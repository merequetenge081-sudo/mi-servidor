#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

with open('app.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Mapa exhaustivo de reemplazos de caracteres corruptos
replacements = {
    # Caracteres individuales problemáticos - reemplazar el carácter corrupto
    '◆': 'á',
    '◆': 'é',
    '◆': 'í',
    '◆': 'ó',
    '◆': 'ú',
    '◊': 'ñ',
    
    # Palabras completas con problemas
    'Exportar L◆deres': 'Exportar Líderes',
    'L◆der': 'Líder',
    'L◆deres': 'Líderes',
    'Gesti◆n': 'Gestión',
    'An◆lisis': 'Análisis',
    'desempe◆o': 'desempeño',
    'operaci◆n': 'operación',
    'Confirmaci◆n': 'Confirmación',
    'confirmaci◆n': 'confirmación',
    'informaci◆n': 'información',
    'P◆blico': 'Público',
    'p◆blico': 'público',
    'Pol◆tica': 'Política',
    'M◆vil': 'Móvil',
    'c◆dula': 'cédula',
    'C◆dula': 'Cédula',
    'est◆s': 'estás',
    'D◆nde': 'Dónde',
    'd◆nde': 'dónde',
    'G◆grafia': 'Geografía',
    'R◆pidos': 'Rápidos',
    'Votaci◆n': 'Votación',
    'N◆mero': 'Número',
    'S◆': 'Sí',
    'Geogr◆fia': 'Geografía',
    'acci◆n': 'acción',
    'Acci◆n': 'Acción',
    '◆Votante': '¿Votante',
    'está◆': 'está',
    'Puesto Votaci◆n': 'Puesto Votación',
    'dinámicamente': 'dinámicamente',
}

# Realizar todos los reemplazos
for old, new in replacements.items():
    content = content.replace(old, new)

# Limpiar patrones regex comunes de caracteres corruptos
# Reemplazar cualquier patrón de consonante+◆+vocal
content = re.sub(r'n◆', 'ñ', content)
content = re.sub(r'a◆', 'á', content)
content = re.sub(r'e◆', 'é', content)
content = re.sub(r'i◆', 'í', content)
content = re.sub(r'o◆', 'ó', content)
content = re.sub(r'u◆', 'ú', content)
content = re.sub(r'A◆', 'Á', content)
content = re.sub(r'E◆', 'É', content)
content = re.sub(r'I◆', 'Í', content)
content = re.sub(r'O◆', 'Ó', content)
content = re.sub(r'U◆', 'Ú', content)

# Reemplazar interrogaciones mal formadas
content = re.sub(r'^◆', '¿', content, flags=re.MULTILINE)
content = re.sub(r'◆\?', '?', content)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ app.html limpiado completamente')
