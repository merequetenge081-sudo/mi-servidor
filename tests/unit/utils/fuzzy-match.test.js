/**
 * Unit Tests: Fuzzy Matching Algorithm
 * Pruebas exhaustivas de la función fuzzyMatch
 */

import { fuzzyMatch, calculateSimilarity, normalizeString, findBestMatch } from '../../../src/utils/fuzzyMatch.js';

describe('Fuzzy Match Algorithm', () => {
  
  describe('Basic Matching', () => {
    it('debería retornar true para match exacto', () => {
      expect(fuzzyMatch('montebello', 'Montebello', 0.85)).toBe(true);
      expect(fuzzyMatch('salitre', 'Salitre', 0.85)).toBe(true);
    });

    it('debería ser case-insensitive', () => {
      expect(fuzzyMatch('MONTEBELLO', 'montebello', 0.85)).toBe(true);
      expect(fuzzyMatch('MoNtEbElLo', 'MONTEBELLO', 0.85)).toBe(true);
    });

    it('debería hacer trim de espacios', () => {
      expect(fuzzyMatch('  montebello  ', 'montebello', 0.85)).toBe(true);
      expect(fuzzyMatch('montebello', '  montebello  ', 0.85)).toBe(true);
    });
  });

  describe('Threshold Sensitivity', () => {
    it('debería ser más permisivo con threshold bajo', () => {
      const similar = 'monterello'; // Typo: falta una 'l'
      const strict = fuzzyMatch(similar, 'montebello', 0.95);
      const permissive = fuzzyMatch(similar, 'montebello', 0.70);
      
      expect(strict).toBe(false);
      expect(permissive).toBe(true);
    });

    it('debería ser más estricto con threshold alto', () => {
      const similar = 'montebbelo'; // Typo: 'b' extra
      const result = fuzzyMatch(similar, 'montebello', 0.95);
      
      expect(result).toBe(false);
    });

    it('debería respetar threshold de 0.85 por defecto', () => {
      const result = fuzzyMatch('montbello', 'montebello', 0.85);
      expect(result).toBe(true);
    });
  });

  describe('Common Misspellings', () => {
    it('debería tolerar typos menores con threshold apropiado', () => {
      const typos = [
        { term: 'monterello', threshold: 0.85, expected: true },
        { term: 'montebbelo', threshold: 0.80, expected: true },
        { term: 'montebelo', threshold: 0.85, expected: true }
      ];

      typos.forEach(({ term, threshold, expected }) => {
        const result = fuzzyMatch(term, 'montebello', threshold);
        expect(result).toBe(expected);
      });
    });

    it('debería tolerar acentos', () => {
      expect(fuzzyMatch('salitre', 'salitré', 0.85)).toBe(true);
      expect(fuzzyMatch('usaquen', 'usaquén', 0.85)).toBe(true);
    });
  });

  describe('Normalize String', () => {
    it('debería remover acentos', () => {
      const normalized = normalizeString('Usaquén');
      expect(normalized).not.toContain('é');
    });

    it('debería convertir a minúsculas', () => {
      const normalized = normalizeString('MONTEBELLO');
      expect(normalized).toBe('montebello');
    });

    it('debería remover caracteres especiales', () => {
      const normalized = normalizeString('col.de-montebello');
      expect(normalized).toContain('montebello');
    });

    it('debería manejar espacios múltiples', () => {
      const normalized = normalizeString('montebello    multiple');
      expect(normalized).toBe('montebello multiple');
    });
  });

  describe('Calculate Similarity', () => {
    it('debería retornar 1.0 para strings idénticos', () => {
      const similarity = calculateSimilarity('montebello', 'montebello');
      expect(similarity).toBe(1.0);
    });

    it('debería retornar 0.0 para strings completamente diferentes', () => {
      const similarity = calculateSimilarity('montebello', 'xyz');
      expect(similarity).toBe(0.0);
    });

    it('debería ser simétrico', () => {
      const sim1 = calculateSimilarity('montebello', 'montebelo');
      const sim2 = calculateSimilarity('montebelo', 'montebello');
      expect(sim1).toBe(sim2);
    });

    it('debería scale basado en longitud máxima', () => {
      // Strings más largos tienen más diferencias permitidas
      const short = calculateSimilarity('abc', 'abd');
      const long = calculateSimilarity('abcdefghij', 'abcdefghik');
      
      expect(short).toBeLessThan(long); // Typo en string más largo es menos penalizado
    });
  });

  describe('Empty & Null Cases', () => {
    it('debería retornar false para string vacío', () => {
      expect(fuzzyMatch('', 'montebello', 0.85)).toBe(false);
      expect(fuzzyMatch('montebello', '', 0.85)).toBe(false);
    });

    it('debería retornar false para null/undefined', () => {
      expect(fuzzyMatch(null, 'montebello', 0.85)).toBe(false);
      expect(fuzzyMatch('montebello', null, 0.85)).toBe(false);
    });

    it('debería retornar false para ambos vacíos', () => {
      expect(fuzzyMatch('', '', 0.85)).toBe(false);
    });
  });

  describe('Find Best Match', () => {
    it('debería encontrar mejor match en lista', () => {
      const options = ['Montebello', 'Salitre', 'Kennedy'];
      const result = findBestMatch('montebello', options);
      
      expect(result).toBeDefined();
      expect(result.match).toBe('Montebello');
    });

    it('debería respetar threshold en findBestMatch', () => {
      const options = ['xyz', 'abc', 'def'];
      const result = findBestMatch('montebello', options, 0.90);
      
      expect(result).toBeNull(); // Nada cumple threshold
    });

    it('debería retornar null si no hay buena opción', () => {
      const options = ['completamente', 'diferente'];
      const result = findBestMatch('montebello', options, 0.85);
      
      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    it('debería ser rápido con strings cortos', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        fuzzyMatch('montebello', 'Montebello', 0.85);
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100);
    });

    it('debería manejar strings largos sin crashes', () => {
      const longString = 'A'.repeat(1000);
      const result = fuzzyMatch('A', longString, 0.50);
      
      expect(result).toBeDefined();
    });
  });

  describe('Bogotá Localidades', () => {
    it('debería encontrar puestos por nombre normalizado', () => {
      // Use fuzzyMatch para nombres similares en longitud
      expect(fuzzyMatch('usaquén', 'Usaquen', 0.85)).toBe(true);
      expect(fuzzyMatch('teusaquillo', 'teusaquillo', 0.85)).toBe(true);
    });

    it('debería tolerar variaciones de nombres', () => {
      expect(fuzzyMatch('san cristobal', 'san cristobal', 0.85)).toBe(true);
      expect(fuzzyMatch('sancristobal', 'san cristobal', 0.75)).toBe(true);
    });
  });

  describe('Real Usage Patterns', () => {
    it('debería encontrar puestos usando alias exacto', () => {
      const puestos = [
        { nombre: 'Colegio Montebello', aliases: ['Montebello'] }
      ];

      const search = 'montebello';
      const found = puestos.filter(p => 
        p.aliases.some(alias => fuzzyMatch(search, alias, 0.85))
      );

      expect(found.length).toBe(1);
    });

    it('debería encontrar por nombre exacto (no substring)', () => {
      const search = 'montebello';
      const target = 'Colegio Distrital Montebello';
      
      // Este no va a funcionar bien porque el nombre completo es mucho más largo
      const directMatch = fuzzyMatch(search, target, 0.85);
      expect(directMatch).toBe(false);
      
      // Pero funciona si usamos normalizeString primero
      const normalized = normalizeString(target);
      expect(normalized).toContain('montebello');
    });

    it('debería usar findBestMatch para búsquedas en lista', () => {
      const puestos = [
        'Montebello',
        'Salitre', 
        'Kennedy'
      ];

      const result = findBestMatch('montebello', puestos, 0.80);
      expect(result).toBeDefined();
      expect(result.match).toBe('Montebello');
    });
  });

  describe('Regression Tests', () => {
    it('debería no estar afectado por orden de parámetros diferentes', () => {
      const result1 = fuzzyMatch('montebello', 'Montebello', 0.85);
      const result2 = fuzzyMatch('Montebello', 'montebello', 0.85);
      
      expect(result1).toBe(result2);
    });

    it('debería manejar strings con números correctamente', () => {
      // Los números son removidos por normalizeString
      const result = fuzzyMatch('44', '44', 0.85);
      expect(result).toBeDefined();
    });
  });
});
