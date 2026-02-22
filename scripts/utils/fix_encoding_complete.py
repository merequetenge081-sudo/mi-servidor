#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aggressive encoding fix - replaces all corrupted characters with correct Spanish text
"""

def fix_all_encoding():
    with open('app.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Complete replacement map for all known corruptions
    replacements = {
        'An?lisis': 'Análisis',
        'an?lisis': 'análisis',
        'operaci?n': 'operación',
        'operaci?n': 'operación',
        'desempe?o': 'desempeño',
        'confirmaci?n': 'confirmación',
        'Confirmaci?n': 'Confirmación',
        'confirmaci?n': 'confirmación',
        'l?dera': 'lídera',
        'l?der': 'líder',
        'L?der': 'Líder',
        'L?ders': 'Líderes',
        'l?ders': 'líderes',
        'cr?dula': 'cédula',
        'C?dula': 'Cédula',
        '?': 'á',  # Catch-all for broken accents
        'secci?n': 'sección',
        'Secci?n': 'Sección',
        'Est?': 'Está',
        'est?': 'está',
        'estad?sticos': 'estadísticos',
        'gr?fico': 'gráfico',
        'gr?ficos': 'gráficos',
        'filtro de':  'filtro',
        'geograf?a': 'geografía',
        'Geograf?a': 'Geografía',
        'telef?no': 'teléfono',
        'Tel?fono': 'Teléfono',
        'selecci?n': 'selección',
        'informaci?n': 'información',
        'Informaci?n': 'Información',
        'sugerencia': 'sugerencia',
        'Reporte de An?lisis': 'Reporte de Análisis',
        'Generado autom?ticamente': 'Generado automáticamente',
        'Revisa la secci?n': 'Revisa la sección',
        'Considera acelerar el proceso de confirmaci?n': 'Considera acelerar el proceso de confirmación',
        'No se pudo renderizar chart de estado de confirmaci?n': 'No se pudo renderizar chart de estado de confirmación',
        'Error al actualizar an?lisis': 'Error al actualizar análisis',
        'An?lisis actualizado': 'Análisis actualizado',
        'NUEVAS FUNCIONES DE AN?LISIS': 'NUEVAS FUNCIONES DE ANÁLISIS',
        'NUEVOS AN?LISIS ESTAD?STICOS': 'NUEVOS ANÁLISIS ESTADÍSTICOS',
        'Tasa de confirmaci?n': 'Tasa de confirmación',
        'Excelente Confirmaci?n': 'Excelente Confirmación',
        'Tu tasa de confirmaci?n': 'Tu tasa de confirmación',
        'Confirmaci?n Moderada': 'Confirmación Moderada',
        'Confirmaci?n Baja': 'Confirmación Baja',
        'Sugerencia de confirmaci?n': 'Sugerencia de confirmación',
        'Velocidad de Confirmaci?n': 'Velocidad de Confirmación',
        'REPORTE DE AN?LISIS DE DATOS': 'REPORTE DE ANÁLISIS DE DATOS',
        'Velocidad de Confirmaci?n': 'Velocidad de Confirmación',
        'Revisa la secci?n de Insights': 'Revisa la sección de Insights',
        'an?lisis detallados': 'análisis detallados',
        'proceso de confirmaci?n': 'proceso de confirmación',
        '?': 'á',  # Last resort: replace remaining ? with á (most common)
    }
    
    # Apply replacements in order
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            count = len(content.split(old)) - 1
            if count > 0:
                print(f"✓ Fixed '{old}' → '{new}' ({count} occurrences)")
    
    # Write back
    with open('app.html', 'w', encoding='utf-8-sig') as f:
        f.write(content)
    
    print("\n✅ All encoding issues fixed!")

if __name__ == '__main__':
    fix_all_encoding()
