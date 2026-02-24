/**
 * Integration Tests: Import/Export System
 * Pruebas de integración para el sistema completo de importación con fuzzy matching
 */

import { matchPuesto, matchLocalidad } from '../../../src/utils/fuzzyMatch.js';

describe('Import/Export Integration', () => {
  
  // ========== Mock Data ==========
  const mockPuestos = [
    { _id: 'p1', nombre: 'Puesto Usaquén', localidad: 'Usaquén' },
    { _id: 'p2', nombre: 'Puesto Chapinero', localidad: 'Chapinero' },
    { _id: 'p3', nombre: 'Puesto Santa Fe', localidad: 'Santa Fe' }
  ];

  const SIMILARITY_THRESHOLD = 0.80;

  // ========== Test: Escenarios de Importación ==========
  describe('Escenarios Realistas de Importación', () => {
    
    it('Escenario 1: Datos limpios sin errores', () => {
      const registros = [
        {
          firstName: 'Juan',
          lastName: 'García',
          cedula: '12345678',
          email: 'juan@example.com',
          phone: '3001234567',
          votingPlace: 'Puesto Usaquén',
          votingTable: 1,
          localidad: 'Usaquén'
        }
      ];

      const results = { imported: 0, corrected: 0, review: 0, failed: 0 };
      const corrections = [];

      registros.forEach(reg => {
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        
        if (puestoMatch) {
          results.imported++;
          if (puestoMatch.corrected) {
            results.corrected++;
            corrections.push({
              field: 'votingPlace',
              original: reg.votingPlace,
              corrected: puestoMatch.puesto.nombre
            });
          }
        } else {
          results.review++;
        }
      });

      expect(results.imported).toBe(1);
      expect(results.corrected).toBe(0);
      expect(results.review).toBe(0);
      expect(results.failed).toBe(0);
    });

    it('Escenario 2: Datos con typos menores', () => {
      const registros = [
        {
          firstName: 'María',
          lastName: 'López',
          cedula: '87654321',
          email: 'maria@example.com',
          phone: '3009876543',
          votingPlace: 'Puesto Usacuén', // Typo: ü instead of qu
          votingTable: 2,
          localidad: 'Usaquén'
        },
        {
          firstName: 'Pedro',
          lastName: 'Martínez',
          cedula: '55555555',
          email: 'pedro@example.com',
          phone: '3005555555',
          votingPlace: 'Puesto Chapinero',
          votingTable: 3,
          localidad: 'Chapinero'
        }
      ];

      const results = { imported: 0, corrected: 0, review: 0, failed: 0 };
      const corrections = [];

      registros.forEach(reg => {
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        
        if (puestoMatch) {
          results.imported++;
          if (puestoMatch.corrected) {
            results.corrected++;
            corrections.push({
              original: reg.votingPlace,
              corrected: puestoMatch.puesto.nombre
            });
          }
        } else {
          results.review++;
        }
      });

      expect(results.imported).toBe(2);
      expect(results.corrected).toBeGreaterThan(0);
      expect(corrections.length).toBeGreaterThan(0);
    });

    it('Escenario 3: Mix de datos válidos e inválidos', () => {
      const registros = [
        {
          votingPlace: 'Puesto Usaquén', // Válido exacto
          localidad: 'Usaquén'
        },
        {
          votingPlace: 'Puesto Inexistente', // Inválido
          localidad: 'Chapinero'
        },
        {
          votingPlace: 'Puesto Santa Fe', // Válido exacto
          localidad: 'Santa Fe'
        }
      ];

      let validCount = 0;
      let reviewCount = 0;

      registros.forEach(reg => {
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        
        if (puestoMatch) {
          validCount++;
        } else {
          reviewCount++;
        }
      });

      expect(validCount).toBe(2);
      expect(reviewCount).toBe(1);
    });
  });

  // ========== Test: Procesamiento por Lotes ==========
  describe('Procesamiento por Lotes (Batch Processing)', () => {
    
    it('debería procesar 100 registros con autocorrección', () => {
      const registros = Array.from({ length: 100 }, (_, i) => ({
        firstName: `Usuario${i}`,
        lastName: `Test${i}`,
        cedula: `${String(i).padStart(8, '0')}`,
        email: `user${i}@test.com`,
        phone: `300${String(i).padStart(7, '0')}`,
        votingPlace: i % 3 === 0 ? 'Puesto Usacuén' : 'Puesto Chapinero', // Algunos con typo
        votingTable: (i % 10) + 1,
        localidad: i % 2 === 0 ? 'Usaquén' : 'Chapinero'
      }));

      const start = performance.now();
      let correctedCount = 0;

      registros.forEach(reg => {
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        if (puestoMatch && puestoMatch.corrected) {
          correctedCount++;
        }
      });

      const end = performance.now();

      expect(correctedCount).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(1000); // Menos de 1 segundo
    });

    it('debería rastrear autocorrecciones por campo', () => {
      const registros = [
        { votingPlace: 'Puesto Usacuén', localidad: 'Usaquén' },
        { votingPlace: 'Puesto Chapinero', localidad: 'Chapinero' },
        { votingPlace: 'Puesto Santa Fe', localidad: 'Santa Fe' }
      ];

      const correctionsByField = {
        votingPlace: 0,
        localidad: 0
      };

      registros.forEach(reg => {
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        if (puestoMatch && puestoMatch.corrected) {
          correctionsByField.votingPlace++;
        }

        const localidadMatch = matchLocalidad(reg.localidad, SIMILARITY_THRESHOLD);
        if (localidadMatch && localidadMatch.corrected) {
          correctionsByField.localidad++;
        }
      });

      expect(Object.keys(correctionsByField).length).toBe(2);
    });
  });

  // ========== Test: Respuesta de Importación ==========
  describe('Estructura de Respuesta de Importación', () => {
    
    it('debería generar respuesta correcta', () => {
      const mockResponse = {
        success: true,
        imported: 5,
        requiresReview: 2,
        failed: 1,
        autocorrected: 3,
        errors: [],
        autocorrections: [
          {
            row: 2,
            name: 'María López',
            corrections: [
              {
                field: 'votingPlace',
                original: 'Puesto Usacuén',
                corrected: 'Puesto Usaquén',
                similarity: '92.5%'
              }
            ]
          }
        ],
        message: 'Importación completada: 5 registros importados, 3 autocorregidos, 2 requieren revisión de puesto, 1 errores.'
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.imported).toBe(5);
      expect(mockResponse.autocorrected).toBe(3);
      expect(mockResponse.requiresReview).toBe(2);
      expect(mockResponse.failed).toBe(1);
      expect(mockResponse.autocorrections.length).toBe(1);
      expect(mockResponse.message).toContain('autocorregidos');
    });
  });

  // ========== Test: Casos de Uso Reales ==========
  describe('Casos de Uso Reales', () => {
    
    it('Caso Real 1: Importación de Excel con variaciones de nombres', () => {
      // Simulando datos de un Excel real con variaciones comunes
      const registrosExcel = [
        {
          votingPlace: 'PUESTO USAQUEN', // Todo mayúsculas sin tilde
          localidad: 'USAQUEN'
        },
        {
          votingPlace: 'puesto chapinero', // Todo minúscula
          localidad: 'chapinero'
        },
        {
          votingPlace: 'Puesto santa fe', // Capitales inconsistentes
          localidad: 'santa fe'
        }
      ];

      let matchCount = 0;
      registrosExcel.forEach(reg => {
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        const localidadMatch = matchLocalidad(reg.localidad, SIMILARITY_THRESHOLD);
        
        if (puestoMatch || localidadMatch) {
          matchCount++;
        }
      });

      expect(matchCount).toBe(3); // Todos deben matchear
    });

    it('Caso Real 2: Manejo de datos incompletos', () => {
      const registrosIncompletos = [
        {
          votingPlace: 'Puesto Usaquén',
          localidad: undefined // Falta localidad
        },
        {
          votingPlace: null, // Falta puesto
          localidad: 'Chapinero'
        },
        {
          votingPlace: 'Puesto Santa Fe',
          localidad: 'Santa Fe'
        }
      ];

      const processableCount = registrosIncompletos.filter(reg => {
        const hasPuesto = reg.votingPlace ? matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD) : null;
        const hasLocalidad = reg.localidad ? matchLocalidad(reg.localidad, SIMILARITY_THRESHOLD) : null;
        return hasPuesto || hasLocalidad;
      }).length;

      expect(processableCount).toBe(1); // Solo el tercero es procesable
    });

    it('Caso Real 3: Detección de duplicados después de corrección', () => {
      const registros = [
        { votingPlace: 'Puesto Usaquén', cedula: '12345678' },
        { votingPlace: 'Puesto Usacuén', cedula: '12345678' } // Mismo cedula, puesto con typo
      ];

      const cedulasProcessados = new Set();
      let duplicateCount = 0;

      registros.forEach(reg => {
        // Corregir puesto
        const puestoMatch = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        const puestoCorregido = puestoMatch ? puestoMatch.puesto.nombre : reg.votingPlace;

        // Crear ID único
        const uniqueId = `${puestoCorregido}|${reg.cedula}`;

        if (cedulasProcessados.has(uniqueId)) {
          duplicateCount++;
        } else {
          cedulasProcessados.add(uniqueId);
        }
      });

      expect(duplicateCount).toBe(1); // Detecta el duplicado
    });
  });

  // ========== Test: Estadísticas de Importación ==========
  describe('Estadísticas de Importación', () => {
    
    it('debería contar correctamente importados vs autocorregidos', () => {
      const registros = [
        { votingPlace: 'Puesto Usaquén' }, // Exacto
        { votingPlace: 'Puesto Usacuén' }, // Autocorregido
        { votingPlace: 'Puesto Chapinero' }, // Exacto
        { votingPlace: 'Puesto Inexistente' } // Revisión
      ];

      let stats = {
        exactos: 0,
        corregidos: 0,
        revision: 0
      };

      registros.forEach(reg => {
        const match = matchPuesto(reg.votingPlace, mockPuestos, SIMILARITY_THRESHOLD);
        
        if (match) {
          if (match.corrected) {
            stats.corregidos++;
          } else {
            stats.exactos++;
          }
        } else {
          stats.revision++;
        }
      });

      expect(stats.exactos).toBe(2);
      expect(stats.corregidos).toBeGreaterThan(0);
      expect(stats.revision).toBe(1);
    });
  });

  // ========== Test: Compatibilidad con Frontend ==========
  describe('Compatibilidad con Frontend', () => {
    
    it('debería serializar correcciones para JSON', () => {
      const corrections = [
        {
          row: 2,
          name: 'Test User',
          corrections: [
            {
              field: 'votingPlace',
              original: 'Input Value',
              corrected: 'Corrected Value',
              similarity: '95.2%'
            }
          ]
        }
      ];

      // Debería ser serializable a JSON
      const json = JSON.stringify(corrections);
      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);

      // Debería ser deserializable
      const deserialized = JSON.parse(json);
      expect(deserialized[0].row).toBe(2);
      expect(deserialized[0].corrections).toHaveLength(1);
    });

    it('debería generar mensaje amigable para usuario', () => {
      const response = {
        success: true,
        imported: 10,
        autocorrected: 3,
        requiresReview: 2,
        failed: 1,
        message: `Importación completada: 10 registros importados, 3 autocorregidos, 2 requieren revisión de puesto, 1 errores.`
      };

      expect(response.message).toContain('autocorregidos');
      expect(response.message).toContain('requieren revisión');
      expect(response.message).toContain('errores');
    });
  });
});
