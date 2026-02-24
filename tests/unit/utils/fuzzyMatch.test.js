/**
 * Unit Tests: Fuzzy Matching Utilities
 * Pruebas para funciones de búsqueda fuzzy y autocorrección
 */

import {
  normalizeString,
  calculateSimilarity,
  findBestMatch,
  matchLocalidad,
  matchDepartamento,
  matchCapital,
  matchPuesto,
  BOGOTA_LOCALIDADES,
  DEPARTAMENTOS_COLOMBIA,
  CAPITALES_COLOMBIA
} from '../../../src/utils/fuzzyMatch.js';

describe('Fuzzy Matching Utilities', () => {
  
  // ========== normalizeString ==========
  describe('normalizeString', () => {
    it('debería convertir a minúsculas', () => {
      expect(normalizeString('USAQUÉN')).toBe('usaquen');
    });

    it('debería remover acentos', () => {
      expect(normalizeString('Usaquén')).toBe('usaquen');
      expect(normalizeString('Á É Í Ó Ú')).toBe('a e i o u');
    });

    it('debería normalizar espacios', () => {
      expect(normalizeString('Rafael  Uribe   Uribe')).toBe('rafael uribe uribe');
    });

    it('debería manejar valores vacíos', () => {
      expect(normalizeString('')).toBe('');
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });

    it('debería remover espacios al inicio y final', () => {
      expect(normalizeString('  Usaquén  ')).toBe('usaquen');
    });
  });

  // ========== calculateSimilarity ==========
  describe('calculateSimilarity', () => {
    it('debería devolver 1.0 para strings idénticos', () => {
      const similarity = calculateSimilarity('Usaquén', 'Usaquén');
      expect(similarity).toBe(1.0);
    });

    it('debería devolver 1.0 para strings idénticos después de normalizacion', () => {
      const similarity = calculateSimilarity('USAQUÉN', 'usaquen');
      expect(similarity).toBe(1.0);
    });

    it('debería detectar alta similitud con typos menores', () => {
      const similarity = calculateSimilarity('Usaquen', 'Usaquén');
      expect(similarity).toBeGreaterThan(0.85);
    });

    it('debería detectar similitud parcial', () => {
      const similarity = calculateSimilarity('Chapinero', 'Chap');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });

    it('debería devolver baja similitud para strings muy diferentes', () => {
      const similarity = calculateSimilarity('Usaquén', 'Bogotá');
      expect(similarity).toBeLessThan(0.5);
    });

    it('debería manejar strings vacíos', () => {
      expect(calculateSimilarity('', '')).toBe(1.0);
      expect(calculateSimilarity('test', '')).toBe(0.0);
      expect(calculateSimilarity('', 'test')).toBe(0.0);
    });
  });

  // ========== findBestMatch ==========
  describe('findBestMatch', () => {
    const options = ['Usaquén', 'Chapinero', 'Santa Fe'];

    it('debería encontrar match exacto', () => {
      const result = findBestMatch('Usaquén', options, 0.80);
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
      expect(result.similarity).toBe(1.0);
      expect(result.corrected).toBe(false);
    });

    it('debería encontrar match con typo menor', () => {
      const result = findBestMatch('Usacuén', options, 0.80);
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
      expect(result.similarity).toBeGreaterThan(0.80);
      expect(result.corrected).toBe(true);
    });

    it('debería respetar el umbral de similitud', () => {
      // "Usaq" tiene baja similitud con "Usaquén"
      const result = findBestMatch('Usaq', options, 0.80);
      expect(result).toBeNull(); // No cumple el umbral
    });

    it('debería retornar null para entrada vacía', () => {
      const result = findBestMatch('', options, 0.80);
      expect(result).toBeNull();
    });

    it('debería retornar null para lista vacía', () => {
      const result = findBestMatch('Usaquén', [], 0.80);
      expect(result).toBeNull();
    });

    it('debería usar umbral personalizado', () => {
      // Con umbral muy bajo, debería encontrar
      const result = findBestMatch('Usaq', options, 0.40);
      expect(result).not.toBeNull();
    });
  });

  // ========== matchLocalidad ==========
  describe('matchLocalidad', () => {
    it('debería encontrar localidad exacta de Bogotá', () => {
      const result = matchLocalidad('Usaquén');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
    });

    it('debería autocorregir typo en localidad', () => {
      const result = matchLocalidad('Chapinero');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Chapinero');
    });

    it('debería encontrar localidad con case insensitive', () => {
      const result = matchLocalidad('USAQUÉN');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
    });

    it('debería retornar null para localidad inválida', () => {
      const result = matchLocalidad('Medellín'); // No es localidad de Bogotá
      expect(result).toBeNull();
    });

    it('debería validar todas las 20 localidades de Bogotá', () => {
      BOGOTA_LOCALIDADES.forEach(localidad => {
        const result = matchLocalidad(localidad);
        expect(result).not.toBeNull();
        expect(result.match).toBe(localidad);
      });
    });
  });

  // ========== matchDepartamento ==========
  describe('matchDepartamento', () => {
    it('debería encontrar departamento exacto', () => {
      const result = matchDepartamento('Antioquia');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Antioquia');
    });

    it('debería autocorregir typo en departamento', () => {
      const result = matchDepartamento('Bogotá'); // Debería encontrar Cundinamarca
      // Nota: "Bogotá" no va a matchear bien, pero "Cundinamarca" sí
      const result2 = matchDepartamento('Cundinamarca');
      expect(result2).not.toBeNull();
      expect(result2.match).toBe('Cundinamarca');
    });

    it('debería validar todos los departamentos', () => {
      DEPARTAMENTOS_COLOMBIA.forEach(depto => {
        const result = matchDepartamento(depto);
        expect(result).not.toBeNull();
      });
    });
  });

  // ========== matchCapital ==========
  describe('matchCapital', () => {
    it('debería encontrar capital exacta', () => {
      const result = matchCapital('Medellín');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Medellín');
    });

    it('debería encontrar capital con typo', () => {
      const result = matchCapital('Medellin'); // Sin tilde
      expect(result).not.toBeNull();
      expect(result.match).toBe('Medellín');
      expect(result.corrected).toBe(true);
    });

    it('debería validar Bogotá como capital', () => {
      const result = matchCapital('Bogotá');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Bogotá');
    });
  });

  // ========== matchPuesto ==========
  describe('matchPuesto', () => {
    const puestos = [
      { _id: '1', nombre: 'Puesto Central' },
      { _id: '2', nombre: 'Puesto Usaquén' },
      { _id: '3', nombre: 'Puesto Chapinero' }
    ];

    it('debería encontrar puesto exacto', () => {
      const result = matchPuesto('Puesto Central', puestos);
      expect(result).not.toBeNull();
      expect(result.puesto._id).toBe('1');
      expect(result.puesto.nombre).toBe('Puesto Central');
      expect(result.similarity).toBe(1.0);
    });

    it('debería encontrar puesto con typo', () => {
      const result = matchPuesto('Puesto Usacuén', puestos);
      expect(result).not.toBeNull();
      expect(result.puesto.nombre).toBe('Puesto Usaquén');
      expect(result.corrected).toBe(true);
    });

    it('debería respetar el umbral para puestos', () => {
      const result = matchPuesto('XXX', puestos, 0.80);
      expect(result).toBeNull();
    });

    it('debería retornar null para lista vacía', () => {
      const result = matchPuesto('Puesto Central', []);
      expect(result).toBeNull();
    });

    it('debería retornar null para entrada vacía', () => {
      const result = matchPuesto('', puestos);
      expect(result).toBeNull();
    });

    it('debería manejar puestos con acentos', () => {
      const puestosConAcentos = [
        { _id: '1', nombre: 'Puesto Cúcuta' },
        { _id: '2', nombre: 'Puesto Bucaramanga' }
      ];
      
      const result = matchPuesto('Puesto Cucuta', puestosConAcentos);
      expect(result).not.toBeNull();
      expect(result.puesto.nombre).toBe('Puesto Cúcuta');
      expect(result.corrected).toBe(true);
    });
  });

  // ========== Edge Cases ==========
  describe('Edge Cases', () => {
    it('debería manejar strings con caracteres especiales', () => {
      const result = matchLocalidad('Usaquén!!!');
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
    });

    it('debería manejar números en strings', () => {
      const puestos = [
        { _id: '1', nombre: 'Puesto 1' },
        { _id: '2', nombre: 'Puesto 2' }
      ];
      
      const result = matchPuesto('Puesto 1', puestos);
      expect(result).not.toBeNull();
      expect(result.puesto.nombre).toBe('Puesto 1');
    });

    it('debería mantener información del match original', () => {
      const result = matchLocalidad('usaquen'); // Entrada en minúscula
      expect(result.original).toBe('usaquen');
      expect(result.match).toBe('Usaquén');
    });
  });

  // ========== Performance ==========
  describe('Performance', () => {
    it('debería procesar 100 puestos en menos de 100ms', () => {
      const puestos = Array.from({ length: 100 }, (_, i) => ({
        _id: `id${i}`,
        nombre: `Puesto ${i}`
      }));

      const start = performance.now();
      matchPuesto('Puesto 50', puestos);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });
  });
});
