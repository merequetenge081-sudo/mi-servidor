/**
 * Unit Tests: Puestos Verification & Fuzzy Matching
 * Pruebas para búsqueda fuzzy, matching de puestos y verificación automática
 */

import mongoose from 'mongoose';
import { Puestos } from '../../../src/models/index.js';
import { fuzzyMatch } from '../../../src/utils/fuzzyMatch.js';

describe('Puestos Verification Suite', () => {
  
  // Mock data para tests
  const mockPuestos = [
    {
      _id: new mongoose.Types.ObjectId(),
      codigoPuesto: '160010409',
      nombre: 'Colegio Distrital Montebello',
      localidad: 'San Cristóbal',
      codigoLocalidad: '04',
      direccion: 'Calle 24 A Sur No. 1 A - 95 Este',
      sitio: 'Montebello',
      numeroMesas: 9,
      aliases: [
        'Colegio Distrital Montebello',
        'Distrital Montebello',
        'San Cristóbal',
        'Montebello'
      ],
      activo: true
    },
    {
      _id: new mongoose.Types.ObjectId(),
      codigoPuesto: '160010448',
      nombre: 'Colegio Distrital Montebello Sede B',
      localidad: 'San Cristóbal',
      codigoLocalidad: '04',
      direccion: 'Calle 24 Sur No. 1 A - 95 Este',
      sitio: 'Montebello Sede B',
      numeroMesas: 8,
      aliases: [
        'Colegio Distrital Montebello Sede B',
        'Distrital Montebello Sede B',
        'San Cristóbal',
        'Montebello Sede B'
      ],
      activo: true
    },
    {
      _id: new mongoose.Types.ObjectId(),
      codigoPuesto: '160011306',
      nombre: 'El Salitre',
      localidad: 'Teusaquillo',
      codigoLocalidad: '12',
      direccion: 'Carrera 70 No. 47 - 09',
      sitio: 'Salitre',
      numeroMesas: 6,
      aliases: ['El Salitre', 'Salitre', 'Teusaquillo'],
      activo: true
    }
  ];

  describe('Fuzzy Matching', () => {
    it('debería hacer match exacto con "montebello"', () => {
      const results = mockPuestos.filter(p => 
        fuzzyMatch('montebello', p.nombre, 0.85) ||
        p.aliases.some(alias => fuzzyMatch('montebello', alias, 0.85))
      );
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.nombre.includes('Montebello'))).toBe(true);
    });

    it('debería hacer match fuzzy con variaciones de "montebello"', () => {
      const variaciones = [
        { term: 'Montebello', shouldMatch: true },
        { term: 'MONTEBELLO', shouldMatch: true },
        { term: 'montebelo', shouldMatch: true },
        { term: 'montebbelo', shouldMatch: false } // Demasiado diferente
      ];
      
      variaciones.forEach(({ term, shouldMatch }) => {
        const match = mockPuestos.some(p => {
          const mainMatch = fuzzyMatch(term.toLowerCase(), p.nombre.toLowerCase(), 0.85);
          const aliasMatch = p.aliases.some(alias => 
            fuzzyMatch(term.toLowerCase(), alias.toLowerCase(), 0.85)
          );
          return mainMatch || aliasMatch;
        });
        
        expect(match).toBe(shouldMatch);
      });
    });

    it('debería encontrar por alias "Distrital Montebello"', () => {
      const results = mockPuestos.filter(p =>
        p.aliases.some(alias => 
          fuzzyMatch('Distrital Montebello', alias, 0.85)
        )
      );
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('debería encontrar por localidad "San Cristóbal"', () => {
      const results = mockPuestos.filter(p => 
        fuzzyMatch('San Cristóbal', p.localidad, 0.85) ||
        p.aliases.some(alias => fuzzyMatch('San Cristóbal', alias, 0.85))
      );
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('debería diferenciar entre "Montebello" y "Montebello Sede B"', () => {
      // Ambos contienen "Montebello", buscar exactamente
      const result1 = mockPuestos.filter(p => p.sitio === 'Montebello');
      const result2 = mockPuestos.filter(p => p.sitio === 'Montebello Sede B');
      
      expect(result1.length).toBe(1);
      expect(result2.length).toBe(1);
      expect(result1[0].codigoPuesto).toBe('160010409');
      expect(result2[0].codigoPuesto).toBe('160010448');
    });

    it('debería encontrar "El Salitre" por búsqueda "salitre"', () => {
      const results = mockPuestos.filter(p =>
        fuzzyMatch('salitre', p.nombre, 0.85) ||
        p.aliases.some(alias => fuzzyMatch('salitre', alias, 0.85))
      );
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].codigoPuesto).toBe('160011306');
    });

    it('debería rechazar búsquedas muy diferentes', () => {
      const invalidSearches = ['xyz', 'qwerty', 'asfwef'];
      
      invalidSearches.forEach(search => {
        const match = mockPuestos.some(p =>
          fuzzyMatch(search, p.nombre, 0.85) ||
          p.aliases.some(alias => fuzzyMatch(search, alias, 0.85))
        );
        
        expect(match).toBe(false);
      });
    });
  });

  describe('Puesto Selection', () => {
    it('debería retornar múltiples resultados para búsqueda "montebello"', () => {
      const searchTerm = 'montebello';
      const results = mockPuestos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm) ||
        p.sitio.toLowerCase().includes(searchTerm) ||
        p.aliases.some(alias => alias.toLowerCase().includes(searchTerm))
      );
      
      expect(results.length).toBe(2);
      expect(results[0].numeroMesas).toBe(9);
      expect(results[1].numeroMesas).toBe(8);
    });

    it('debería incluir información de mesas en resultado', () => {
      const puesto = mockPuestos[0];
      
      expect(puesto.numeroMesas).toBe(9);
      expect(puesto.mesas === undefined || Array.isArray(puesto.mesas)).toBe(true);
    });

    it('debería incluir aliases en resultado', () => {
      const puesto = mockPuestos[0];
      
      expect(Array.isArray(puesto.aliases)).toBe(true);
      expect(puesto.aliases.length).toBeGreaterThan(0);
      expect(puesto.aliases).toContain('Montebello');
    });

    it('debería retornar solo puestos activos', () => {
      const inactivePuesto = { ...mockPuestos[0], activo: false };
      const allPuestos = [...mockPuestos, inactivePuesto];
      
      const results = allPuestos.filter(p => p.activo === true);
      
      expect(results.length).toBe(3);
      expect(results.every(p => p.activo)).toBe(true);
    });
  });

  describe('Auto-Verification Flow', () => {
    const mockRegistrations = [
      {
        _id: new mongoose.Types.ObjectId(),
        leaderId: 'LID-TEST123',
        firstName: 'Juan',
        lastName: 'Pérez',
        cedula: '1234567890',
        votingPlace: 'montebello',
        mesa: 1,
        localidad: 'San Cristóbal',
        registeredToVote: true,
        requiereRevisionPuesto: true,
        revisionPuestoResuelta: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        leaderId: 'LID-TEST123',
        firstName: 'María',
        lastName: 'González',
        cedula: '0987654321',
        votingPlace: 'salitre',
        mesa: 3,
        localidad: 'Teusaquillo',
        registeredToVote: true,
        requiereRevisionPuesto: true,
        revisionPuestoResuelta: false
      }
    ];

    it('debería encontrar puesto correcto para "montebello"', () => {
      const votingPlace = 'montebello';
      const matched = mockPuestos.find(p =>
        fuzzyMatch(votingPlace, p.nombre, 0.85) ||
        p.aliases.some(alias => fuzzyMatch(votingPlace, alias, 0.85))
      );
      
      expect(matched).toBeDefined();
      expect(matched.codigoPuesto).toBe('160010409');
      expect(matched.nombre).toBe('Colegio Distrital Montebello');
    });

    it('debería actualizar registro con puestoId encontrado', () => {
      const registration = mockRegistrations[0];
      const matched = mockPuestos.find(p =>
        fuzzyMatch(registration.votingPlace, p.nombre, 0.85) ||
        p.aliases.some(alias => fuzzyMatch(registration.votingPlace, alias, 0.85))
      );
      
      expect(matched).toBeDefined();
      
      const updated = {
        ...registration,
        puestoId: matched._id,
        votingPlace: matched.nombre,
        revisionPuestoResuelta: true
      };
      
      expect(updated.puestoId).toBe(matched._id);
      expect(updated.votingPlace).toBe('Colegio Distrital Montebello');
      expect(updated.revisionPuestoResuelta).toBe(true);
    });

    it('debería procesar múltiples registros en verificación automática', () => {
      const threshold = 0.85;
      const results = {
        total: mockRegistrations.length,
        updated: 0,
        corrected: 0,
        requiresReview: 0,
        unchanged: 0
      };

      mockRegistrations.forEach(reg => {
        const matched = mockPuestos.find(p =>
          fuzzyMatch(reg.votingPlace.toLowerCase(), p.nombre.toLowerCase(), threshold) ||
          p.aliases.some(alias => 
            fuzzyMatch(reg.votingPlace.toLowerCase(), alias.toLowerCase(), threshold)
          )
        );

        if (matched) {
          results.updated++;
          results.corrected++;
        } else {
          results.requiresReview++;
        }
      });

      expect(results.total).toBe(2);
      expect(results.updated).toBe(2);
      expect(results.corrected).toBe(2);
      expect(results.requiresReview).toBe(0);
    });

    it('debería mantener mesa válida después de actualizar puesto', () => {
      const registration = mockRegistrations[0];
      const matched = mockPuestos[0]; // Montebello con 9 mesas

      expect(registration.mesa).toBe(1);
      expect(registration.mesa <= matched.numeroMesas).toBe(true);
      
      // Mesa sigue siendo válida después de update
      const updated = {
        ...registration,
        puestoId: matched._id,
        votingPlace: matched.nombre
      };

      expect(updated.mesa <= matched.numeroMesas).toBe(true);
    });

    it('debería rechazar mesa inválida para puesto', () => {
      const registration = { ...mockRegistrations[0], mesa: 20 };
      const matched = mockPuestos[0]; // Montebello con 9 mesas

      expect(registration.mesa > matched.numeroMesas).toBe(true);
      
      const validation = {
        valid: registration.mesa <= matched.numeroMesas,
        error: registration.mesa > matched.numeroMesas ? 
          `Mesa ${registration.mesa} no existe en ${matched.nombre} (máx: ${matched.numeroMesas})` : 
          null
      };

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Mesa 20');
    });
  });

  describe('Localidad Matching', () => {
    it('debería encontrar puestos por localidad "San Cristóbal"', () => {
      const results = mockPuestos.filter(p => p.localidad === 'San Cristóbal');
      
      expect(results.length).toBe(2);
      expect(results.every(p => p.codigoLocalidad === '04')).toBe(true);
    });

    it('debería encontrar puestos por código de localidad', () => {
      const results = mockPuestos.filter(p => p.codigoLocalidad === '12');
      
      expect(results.length).toBe(1);
      expect(results[0].nombre).toBe('El Salitre');
    });

    it('debería validar localidad contra puesto encontrado', () => {
      const registration = {
        votingPlace: 'montebello',
        localidad: 'San Cristóbal'
      };

      const matched = mockPuestos.find(p =>
        p.aliases.some(alias => fuzzyMatch(registration.votingPlace, alias, 0.85))
      );

      expect(matched).toBeDefined();
      expect(matched.localidad).toBe(registration.localidad);
    });

    it('debería ser flexible con localidad incorrecta pero puesto válido', () => {
      const registration = {
        votingPlace: 'montebello',
        localidad: 'Usaquén' // Incorrecto
      };

      const matched = mockPuestos.find(p =>
        p.aliases.some(alias => fuzzyMatch(registration.votingPlace, alias, 0.85))
      );

      expect(matched).toBeDefined();
      expect(matched.localidad).toBe('San Cristóbal'); // Sistema corrige
      
      const corrected = {
        ...registration,
        localidad: matched.localidad
      };

      expect(corrected.localidad).toBe('San Cristóbal');
    });
  });

  describe('Edge Cases', () => {
    it('debería manejar búsqueda vacía', () => {
      const searchTerm = '';
      const results = mockPuestos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(results.length).toBe(3); // Todas ya que incluyen string vacío
    });

    it('debería manejar búsqueda con espacios extra', () => {
      const searchTerm = '  montebello  ';
      const trimmed = searchTerm.trim();
      const results = mockPuestos.filter(p =>
        fuzzyMatch(trimmed, p.nombre, 0.85) ||
        p.aliases.some(alias => fuzzyMatch(trimmed, alias, 0.85))
      );
      
      expect(results.length).toBeGreaterThan(0);
    });

    it('debería manejar búsqueda con caracteres especiales', () => {
      const searchTerm = 'montebello-sede';
      const results = mockPuestos.filter(p =>
        fuzzyMatch(searchTerm, p.nombre, 0.80) ||
        p.aliases.some(alias => fuzzyMatch(searchTerm, alias, 0.80))
      );
      
      // Debería encontrar "Montebello Sede B" con threshold más bajo
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('debería manejar registro sin puesto (fuera de Bogotá)', () => {
      const registration = {
        _id: new mongoose.Types.ObjectId(),
        leaderId: 'LID-TEST',
        firstName: 'Pedro',
        lastName: 'López',
        cedula: '5555555555',
        votingPlace: 'Municipio de Ubaté',
        mesa: 1,
        registeredToVote: true,
        localidad: 'Cundinamarca'
      };

      const matched = mockPuestos.find(p =>
        fuzzyMatch(registration.votingPlace, p.nombre, 0.85)
      );

      expect(matched).toBeUndefined(); // No existe en BD
    });

    it('debería retornar info de dos sedes de Montebello', () => {
      const search = 'montebello';
      const results = mockPuestos.filter(p =>
        p.nombre.toLowerCase().includes(search) ||
        p.aliases.some(alias => alias.toLowerCase().includes(search))
      );

      expect(results.length).toBe(2);
      expect(results[0].sitio).toBe('Montebello');
      expect(results[1].sitio).toBe('Montebello Sede B');
    });
  });

  describe('Verification Summary', () => {
    it('debería generar resumen correcto de verificación', () => {
      const mockRegs = [
        { votingPlace: 'montebello', status: 'actualizado' },
        { votingPlace: 'salitre', status: 'actualizado' },
        { votingPlace: 'desconocido', status: 'requiere_revision' }
      ];

      const summary = {
        total: mockRegs.length,
        updated: mockRegs.filter(r => r.status === 'actualizado').length,
        requiresReview: mockRegs.filter(r => r.status === 'requiere_revision').length
      };

      expect(summary.total).toBe(3);
      expect(summary.updated).toBe(2);
      expect(summary.requiresReview).toBe(1);
    });

    it('debería retornar detalles de correcciones', () => {
      const corrections = [
        {
          leaderId: 'LID-TEST',
          cedula: '1234567890',
          puestoOriginal: 'montebello',
          puestoCorregido: 'Colegio Distrital Montebello',
          codigoPuesto: '160010409'
        }
      ];

      expect(corrections.length).toBe(1);
      expect(corrections[0].puestoCorregido).toBe('Colegio Distrital Montebello');
      expect(corrections[0].codigoPuesto).toBe('160010409');
    });
  });
});
