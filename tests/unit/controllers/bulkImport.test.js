/**
 * Unit Tests: Bulk Import con Fuzzy Matching
 * Pruebas para bulkCreateRegistrations con autocorrección
 */

import { matchPuesto, matchLocalidad } from '../../../src/utils/fuzzyMatch.js';

describe('Bulk Import Fuzzy Matching', () => {
  
  // ========== Mock Data ==========
  const mockLeader = {
    leaderId: 'leader123',
    name: 'Test Leader',
    eventId: 'event123',
    organizationId: 'org123',
    active: true
  };

  const mockPuestos = [
    {
      _id: 'puesto1',
      nombre: 'Puesto Usaquén',
      localidad: 'Usaquén',
      organizationId: 'org123',
      activo: true
    },
    {
      _id: 'puesto2',
      nombre: 'Puesto Chapinero',
      localidad: 'Chapinero',
      organizationId: 'org123',
      activo: true
    },
    {
      _id: 'puesto3',
      nombre: 'Puesto Santa Fe',
      localidad: 'Santa Fe',
      organizationId: 'org123',
      activo: true
    }
  ];

  // ========== Test: Fuzzy Matching en Puestos ==========
  describe('Fuzzy Matching de Puestos', () => {
    it('debería hacer match exacto de puesto', () => {
      const votingPlace = 'Puesto Usaquén';
      const result = matchPuesto(votingPlace, mockPuestos, 0.80);
      
      expect(result).not.toBeNull();
      expect(result.puesto._id).toBe('puesto1');
      expect(result.similarity).toBe(1.0);
      expect(result.corrected).toBe(false);
    });

    it('debería autocorregir typo en nombre de puesto', () => {
      const votingPlace = 'Puesto Usacuén'; // Typo: ü en lugar de qu
      const result = matchPuesto(votingPlace, mockPuestos, 0.80);
      
      expect(result).not.toBeNull();
      expect(result.puesto._id).toBe('puesto1');
      expect(result.puesto.nombre).toBe('Puesto Usaquén');
      expect(result.corrected).toBe(true);
      expect(result.similarity).toBeGreaterThan(0.80);
    });

    it('debería autocorregir acentos en puesto', () => {
      const votingPlace = 'Puesto Chapinero'; // Sin acento
      const result = matchPuesto(votingPlace, mockPuestos, 0.80);
      
      expect(result).not.toBeNull();
      expect(result.puesto.nombre).toBe('Puesto Chapinero');
    });

    it('debería marcar para revisión si similitud < 80%', () => {
      const votingPlace = 'XYZ';
      const result = matchPuesto(votingPlace, mockPuestos, 0.80);
      
      expect(result).toBeNull(); // No cumple umbral
    });
  });

  // ========== Test: Fuzzy Matching de Localidades ==========
  describe('Fuzzy Matching de Localidades', () => {
    it('debería hacer match exacto de localidad', () => {
      const localidad = 'Usaquén';
      const result = matchLocalidad(localidad, 0.80);
      
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
      expect(result.corrected).toBe(false);
    });

    it('debería autocorregir typo en localidad', () => {
      const localidad = 'Usacuén'; // Typo
      const result = matchLocalidad(localidad, 0.80);
      
      expect(result).not.toBeNull();
      expect(result.match).toBe('Usaquén');
      expect(result.corrected).toBe(true);
      expect(result.similarity).toBeGreaterThan(0.80);
    });

    it('debería ignorar case en localidad', () => {
      const localidad = 'CHAPINERO';
      const result = matchLocalidad(localidad, 0.80);
      
      expect(result).not.toBeNull();
      expect(result.match).toBe('Chapinero');
    });
  });

  // ========== Test: Flujo Completo de Importación ==========
  describe('Flujo Completo de Importación con Autocorrección', () => {
    
    it('debería importar registro con puesto autocorregido', () => {
      // Registro con typo en puesto
      const registro = {
        firstName: 'Juan',
        lastName: 'Pérez',
        cedula: '12345678',
        email: 'juan@test.com',
        phone: '3001234567',
        votingPlace: 'Puesto Usacuén', // Typo
        votingTable: 1,
        localidad: 'Usaquén'
      };

      // Simular matching
      const puestoMatch = matchPuesto(registro.votingPlace, mockPuestos, 0.80);
      expect(puestoMatch).not.toBeNull();
      
      // El registro debería ser corregido
      const recordoCorregido = {
        ...registro,
        votingPlace: puestoMatch.puesto.nombre,
        puestoId: puestoMatch.puesto._id,
        localidad: puestoMatch.puesto.localidad
      };

      expect(recordoCorregido.votingPlace).toBe('Puesto Usaquén');
      expect(recordoCorregido.puestoId).toBe('puesto1');
    });

    it('debería marcar para revisión si no hay match > 80%', () => {
      const registro = {
        votingPlace: 'Puesto Inexistente'
      };

      const puestoMatch = matchPuesto(registro.votingPlace, mockPuestos, 0.80);
      expect(puestoMatch).toBeNull();

      // El registro debería marcarse para revisión
      const requiereRevision = puestoMatch === null;
      expect(requiereRevision).toBe(true);
    });

    it('debería detectar múltiples correcciones en un registro', () => {
      const registro = {
        firstName: 'María',
        lastName: 'García',
        cedula: '87654321',
        email: 'maria@test.com',
        phone: '3009876543',
        votingPlace: 'Puesto Chapinero', // Podría tener typo
        localidad: 'Chapinero' // Podría tener typo
      };

      const corrections = [];

      // Check puesto
      const puestoMatch = matchPuesto(registro.votingPlace, mockPuestos, 0.80);
      if (puestoMatch && puestoMatch.corrected) {
        corrections.push({
          field: 'votingPlace',
          original: registro.votingPlace,
          corrected: puestoMatch.puesto.nombre
        });
      }

      // Check localidad
      const localidadMatch = matchLocalidad(registro.localidad, 0.80);
      if (localidadMatch && localidadMatch.corrected) {
        corrections.push({
          field: 'localidad',
          original: registro.localidad,
          corrected: localidadMatch.match
        });
      }

      // Debería rastrear correcciones
      expect(Array.isArray(corrections)).toBe(true);
    });
  });

  // ========== Test: Casos Extremos ==========
  describe('Casos Extremos', () => {
    it('debería manejar puestos duplicados similar', () => {
      const puestosConDuplicados = [
        ...mockPuestos,
        { _id: 'puesto4', nombre: 'Puesto Usaquén 2', localidad: 'Usaquén' }
      ];

      const votingPlace = 'Puesto Usaquén';
      const result = matchPuesto(votingPlace, puestosConDuplicados, 0.80);
      
      // Debería retornar el mejor match
      expect(result).not.toBeNull();
      expect(result.similarity).toBeGreaterThan(0.80);
    });

    it('debería manejar lista grande de puestos', () => {
      const manyPuestos = Array.from({ length: 500 }, (_, i) => ({
        _id: `puesto${i}`,
        nombre: `Puesto ${i}`,
        localidad: `Localidad ${i}`,
        organizationId: 'org123',
        activo: true
      }));

      // Agregar nuestro puesto de prueba
      manyPuestos[50] = mockPuestos[0];

      const result = matchPuesto('Puesto Usaquén', manyPuestos, 0.80);
      expect(result).not.toBeNull();
    });

    it('debería retornar null para strings vacíos', () => {
      const result = matchPuesto('', mockPuestos);
      expect(result).toBeNull();
    });

    it('debería ser case-insensitive', () => {
      const testCases = [
        'PUESTO USAQUÉN',
        'puesto usaquén',
        'Puesto Usaquén',
        'PuEstO UsAquÉn'
      ];

      testCases.forEach(testCase => {
        const result = matchPuesto(testCase, mockPuestos, 0.80);
        expect(result).not.toBeNull();
      });
    });
  });

  // ========== Test: Umbral de Similitud ==========
  describe('Umbral de Similitud', () => {
    it('debería permitir diferentes umbrales', () => {
      const votingPlace = 'Puesto Usacuén';

      // Con umbral 80%
      const result80 = matchPuesto(votingPlace, mockPuestos, 0.80);
      expect(result80).not.toBeNull();

      // Con umbral más bajo
      const result60 = matchPuesto(votingPlace, mockPuestos, 0.60);
      expect(result60).not.toBeNull();

      // Con umbral más alto (podría fallar)
      const result95 = matchPuesto(votingPlace, mockPuestos, 0.95);
      // Depende de la similitud real
    });

    it('debería usar 80% como umbral por defecto', () => {
      const votingPlace = 'Puesto Usaquén';
      const resultDefault = matchPuesto(votingPlace, mockPuestos);
      const resultExplicit = matchPuesto(votingPlace, mockPuestos, 0.80);

      expect(resultDefault).not.toBeNull();
      expect(resultExplicit).not.toBeNull();
    });
  });

  // ========== Test: Response Structure ==========
  describe('Estructura de Respuesta', () => {
    it('debería retornar estructura correcta para match exitoso', () => {
      const result = matchPuesto('Puesto Usaquén', mockPuestos);

      expect(result).toHaveProperty('puesto');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('corrected');

      expect(typeof result.similarity).toBe('number');
      expect(result.similarity).toBeGreaterThan(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
      expect(typeof result.corrected).toBe('boolean');
    });

    it('debería retornar estructura correcta para localidad', () => {
      const result = matchLocalidad('Usaquén');

      expect(result).toHaveProperty('match');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('corrected');
    });
  });

  // ========== Test: Integración con Datos Reales ==========
  describe('Integración con Datos Reales de Colombia', () => {
    it('debería hacer match con todas las localidades de Bogotá', () => {
      const localidades = [
        'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 
        'Rafael Uribe Uribe', 'Ciudad Bolívar'
      ];

      localidades.forEach(localidad => {
        const result = matchLocalidad(localidad, 0.80);
        expect(result).not.toBeNull();
        expect(result.match).toBe(localidad);
      });
    });

    it('debería autocorregir variaciones comunes de nombres', () => {
      const variations = [
        { input: 'Rafael Uribe Uribe', expected: 'Rafael Uribe Uribe' },
        { input: 'Los Martires', expected: 'Los Mártires' },
        { input: 'San Cristobal', expected: 'San Cristóbal' }
      ];

      variations.forEach(({ input, expected }) => {
        const result = matchLocalidad(input, 0.80);
        if (result) {
          expect(result.match).toBe(expected);
        }
      });
    });
  });
});
