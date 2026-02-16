#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('app.html', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Reemplazos simples de caracteres dañados
replacements = [
    ('c?dula', 'cédula'),
    ('est?s', 'estás'),
    ('D?nde', 'Dónde'),
    ('autenticaci?n', 'autenticación'),
    ('autom?tica', 'automática'),
    ('informaci?n', 'información'),
    ('p?blico', 'público'),
    ('m?vil', 'móvil'),
    ('an?lisis', 'análisis'),
    ('gesti?n', 'gestión'),
    ('pol?tica', 'política'),
    ('l?der', 'líder'),
    ('l?deres', 'líderes'),
    ('?Votante', '¿Votante'),
    ('registradur?a', 'registraduría'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Cambiar logout para dirigir a login
lines = content.split('\n')
new_lines = []
in_logout = False

for line in lines:
    if 'function logout()' in line:
        in_logout = True
    
    # Solo reemplazar la línea landingPage en la función logout
    if in_logout and 'landingPage' in line and 'getElementById' in line:
        line = '    window.location.href = "/public/login.html";'
        in_logout = False
    
    new_lines.append(line)

content = '\n'.join(new_lines)

with open('app.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Textos limpios y logout redirigido a /public/login.html')
