#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import codecs

# Leer el archivo con diferentes codificaciones
try:
    with open('app.html', 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
except:
    with open('app.html', 'r', encoding='latin-1', errors='replace') as f:
        content = f.read()

# Limpiar caracteres problemáticos
# Reemplazar cualquier carácter que no sea ASCII válido en contexto de tildes españolas

replacements = [
    # Caracteres individuales corruptos
    ('C\x00f3dula', 'Cédula'),
    ('C\u00f3dula', 'Cédula'),  
    ('C?dula', 'Cédula'),
    ('C\ufffdula', 'Cédula'),
    
    ('\x00bfVotante?', '¿Votante?'),
    ('\u00bfVotante?', '¿Votante?'),
    ('?Votante?', '¿Votante?'),
    
    ('Votaci\u00f3n', 'Votación'),
    ('Votaci?n', 'Votación'),
    ('Votaci\ufffdUn', 'Votación'),
    
    ('N\u00ba Mesa', 'N° Mesa'),
    ('N?Mesa', 'N° Mesa'),
    ('N\ufffdda', 'Número'),
    
    ('Acci\u00f3n', 'Acción'),
    ('Acci?n', 'Acción'),
    
    ('Tienes inscrita la c\u00e9dula', 'Tienes inscrita la cédula'),
    ('Tienes inscrita la c?dula', 'Tienes inscrita la cédula'),
    
    ('S\u00ed', 'Sí'),
    ('S?', 'Sí'),
    
    ('No est\u00e1s', 'No estás'),
    ('No est?s', 'No estás'),
    
    ('\u00bfD\u00f3nde voto', '¿Dónde voto'),
    ('?D?nde voto', '¿Dónde voto'),
    
    ('Tiene inscrita la c\u00e9dula', 'Tiene inscrita la cédula'),
    ('Tiene inscrita la c?dula', 'Tiene inscrita la cédula'),
    
    ('N\u00famero de mesa', 'Número de mesa'),
    ('N?mero de mesa', 'Número de mesa'),
    
    ('confirmaci\u00f3n', 'confirmación'),
    ('confirmaci?n', 'confirmación'),
    
    ('informaci\u00f3n', 'información'),
    ('informaci?n', 'información'),
    
    ('d\u00f3nde+voto', 'dónde+voto'),
    ('d?nde+voto', 'dónde+voto'),
    
    ('registradur\u00eda', 'registraduría'),
    ('registradur?a', 'registraduría'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Guardar archivo limpio
with open('app.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Archivo limpiado completamente')
