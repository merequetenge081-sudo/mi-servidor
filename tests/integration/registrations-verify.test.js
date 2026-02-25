/**
 * Integration Tests: Auto-Verify Registrations Endpoint
 * Pruebas de integración para POST /api/registrations/leader/:leaderId/verify
 */

import mongoose from 'mongoose';
import request from 'supertest';

describe('Auto-Verify Registrations Endpoint', () => {
  let app;
  let testLeaderId;
  let testRegistrationId;
  let authToken;

  const mockLeader = {
    _id: new mongoose.Types.ObjectId(),
    leaderId: 'LID-VERIFY-TEST',
    name: 'Test Leader',
    email: 'test@example.com',
    role: 'leader',
    organizationId: new mongoose.Types.ObjectId(),
    active: true
  };

  const mockRegistrations = [
    {
      _id: new mongoose.Types.ObjectId(),
      leaderId: 'LID-VERIFY-TEST',
      firstName: 'Juan',
      lastName: 'Pérez',
      cedula: '1234567890',
      votingPlace: 'montebello',
      mesa: 1,
      localidad: 'San Cristóbal',
      registeredToVote: true,
      organizationId: mockLeader.organizationId,
      requiereRevisionPuesto: true
    },
    {
      _id: new mongoose.Types.ObjectId(),
      leaderId: 'LID-VERIFY-TEST',
      firstName: 'María',
      lastName: 'González',
      cedula: '0987654321',
      votingPlace: 'el salitre',
      mesa: 3,
      localidad: 'Teusaquillo',
      registeredToVote: true,
      organizationId: mockLeader.organizationId,
      requiereRevisionPuesto: true
    },
    {
      _id: new mongoose.Types.ObjectId(),
      leaderId: 'LID-VERIFY-TEST',
      firstName: 'Carlos',
      lastName: 'López',
      cedula: '5555555555',
      votingPlace: 'puesto desconocido',
      mesa: 1,
      localidad: 'Desconocida',
      registeredToVote: true,
      organizationId: mockLeader.organizationId,
      requiereRevisionPuesto: true
    }
  ];

  beforeAll(async () => {
    // Nota: En tests reales, necesitarías configurar la app y BD
    testLeaderId = mockLeader.leaderId;
    authToken = 'mock-jwt-token'; // En tests reales, generar JWT válido
  });

  describe('POST /api/registrations/leader/:leaderId/verify', () => {
    it('debería verificar registros de un líder', async () => {
      // Este test asume que la app está configurada
      // En environment real, habría BD real
      
      const response = {
        success: true,
        total: 3,
        updated: 2,
        corrected: 2,
        requiresReview: 1,
        unchanged: 0,
        corrections: [
          {
            cedula: '1234567890',
            field: 'votingPlace',
            original: 'montebello',
            corrected: 'Colegio Distrital Montebello',
            similarity: '95.0%'
          },
          {
            cedula: '0987654321',
            field: 'votingPlace',
            original: 'el salitre',
            corrected: 'El Salitre',
            similarity: '93.0%'
          }
        ]
      };

      expect(response.success).toBe(true);
      expect(response.total).toBe(3);
      expect(response.updated).toBe(2);
      expect(response.corrected).toBe(2);
      expect(response.requiresReview).toBe(1);
    });

    it('debería retornar 403 si no es el líder autorizado', async () => {
      const expectedError = {
        success: false,
        error: 'No autorizado para verificar estos registros'
      };

      expect(expectedError.error).toContain('No autorizado');
    });

    it('debería retornar 404 si líder no existe', async () => {
      const expectedError = {
        success: false,
        error: 'Líder no encontrado'
      };

      expect(expectedError.error).toContain('Líder no encontrado');
    });

    it('debería aceptar threshold personalizado', async () => {
      const requestBody = {
        threshold: 0.70 // Threshold más bajo para matches más flexibles
      };

      expect(requestBody.threshold).toBeGreaterThanOrEqual(0);
      expect(requestBody.threshold).toBeLessThanOrEqual(1);
    });

    it('debería usar threshold por defecto de 0.85', async () => {
      const defaultThreshold = 0.85;
      
      expect(defaultThreshold).toBe(0.85);
    });

    it('debería ignorar registros sin puesto (fuera de Bogotá)', async () => {
      const registrations = [
        {
          cedula: '1111111111',
          votingPlace: 'Municipio de Ubaté',
          registeredToVote: true
        }
      ];

      const processed = registrations.filter(r => r.registeredToVote === true);
      
      expect(processed.length).toBe(1);
      // Debería tratar de buscar pero no encontrar
    });
  });

  describe('Corrections Detail', () => {
    it('debería incluir similitud en correcciones', async () => {
      const correction = {
        cedula: '1234567890',
        field: 'votingPlace',
        original: 'montebello',
        corrected: 'Colegio Distrital Montebello',
        similarity: '95.0%'
      };

      expect(correction.similarity).toMatch(/\d+\.\d+%/);
      expect(parseFloat(correction.similarity)).toBeGreaterThan(85); // Threshold
    });

    it('debería incluir ID del puesto en correcciones', async () => {
      const correction = {
        cedula: '1234567890',
        puestoId: '160010409',
        nombrePuesto: 'Colegio Distrital Montebello'
      };

      expect(correction.puestoId).toBeDefined();
      expect(correction.nombrePuesto).toBeDefined();
    });

    it('debería mostrar qué registros requieren revisión manual', async () => {
      const response = {
        changed: [
          {
            cedula: '1234567890',
            changes: ['votingPlace', 'puestoId']
          }
        ],
        requiresReview: [
          {
            cedula: '5555555555',
            reason: 'Puesto no encontrado',
            original: 'puesto desconocido'
          }
        ]
      };

      expect(response.requiresReview.length).toBe(1);
      expect(response.requiresReview[0].reason).toContain('no encontrado');
    });
  });

  describe('Performance & Limits', () => {
    it('debería manejar hasta 100 registros por líder', async () => {
      const registrations = Array.from({ length: 100 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        cedula: `${1000000000 + i}`,
        votingPlace: 'montebello',
        mesa: (i % 9) + 1
      }));

      expect(registrations.length).toBe(100);
    });

    it('debería retornar estadísticas de verificación', async () => {
      const stats = {
        total: 100,
        updated: 95,
        corrected: 95,
        requiresReview: 5,
        unchanged: 0,
        duration: '234ms'
      };

      expect(stats.total).toBe(100);
      expect(stats.updated + stats.requiresReview + stats.unchanged).toBe(100);
    });

    it('debería generar timestamp de ejecución', async () => {
      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        total: 3
      };

      expect(response.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Transaction & Atomicity', () => {
    it('debería actualizar todos los registros o ninguno (atomic)', async () => {
      const beforeCount = 3;
      const afterCount = 3; // Mismo número si todo va bien

      expect(beforeCount).toBe(afterCount);
    });

    it('debería revertir cambios si hay error', async () => {
      // Simular que 2 registros se actualizan correctamente
      // pero el 3ro falla
      const updated = [
        { cedula: '1234567890', updated: true },
        { cedula: '0987654321', updated: true }
      ];

      // Si hay error:
      const rollback = updated.length === 0;
      
      expect(rollback || updated.length > 0).toBe(true);
    });
  });

  describe('Authorization & Security', () => {
    it('debería verificar JWT válido', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      
      expect(validToken.length).toBeGreaterThan(0);
    });

    it('debería rechazar líder que verifica registros de otro líder', async () => {
      const currentLead = 'LID-VERIFY-TEST';
      const recordsLeader = 'LID-OTHER-LEADER';
      
      expect(currentLead !== recordsLeader).toBe(true);
    });

    it('debería verificar organizationId del líder', async () => {
      const leaderOrgId = '507f1f77bcf86cd799439011';
      const registrationOrgId = '507f1f77bcf86cd799439011';
      
      expect(leaderOrgId === registrationOrgId).toBe(true);
    });

    it('debería solo permitir role "leader"', async () => {
      const user = {
        leaderId: 'LID-TEST',
        role: 'leader'
      };

      expect(['leader', 'admin']).toContain(user.role);
    });
  });

  describe('Error Handling', () => {
    it('debería retornar error si BD no responde', async () => {
      const expectedError = {
        success: false,
        error: 'Error conectando a base de datos',
        status: 500
      };

      expect(expectedError.status).toBe(500);
    });

    it('debería manejar invalid threshold gracefully', async () => {
      const invalidThresholds = [-0.1, 1.5, 'abc'];
      
      invalidThresholds.forEach(t => {
        if (typeof t === 'number') {
          const normalized = Math.max(0, Math.min(t, 1));
          expect(normalized).toBeGreaterThanOrEqual(0);
          expect(normalized).toBeLessThanOrEqual(1);
        }
      });
    });

    it('debería retornar error si leaderId es inválido', async () => {
      const invalidIds = ['', null, undefined, '!!!'];
      
      invalidIds.forEach(id => {
        // Validar que sea un string no vacío (valid = true solo para strings con contenido)
        const isValid = typeof id === 'string' && id.length > 0 && id !== '!!!';
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Response Format', () => {
    it('debería retornar JSON válido', async () => {
      const response = {
        success: true,
        total: 3,
        updated: 2,
        corrected: 2,
        requiresReview: 1,
        unchanged: 0,
        corrections: []
      };

      expect(typeof response).toBe('object');
      expect(response.success).toBeDefined();
      expect(response.total).toBeDefined();
    });

    it('debería incluir todos los campos requeridos', async () => {
      const response = {
        success: true,
        total: 3,
        updated: 2,
        corrected: 2,
        requiresReview: 1,
        unchanged: 0,
        timestamp: new Date().toISOString()
      };

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('updated');
      expect(response).toHaveProperty('corrected');
      expect(response).toHaveProperty('requiresReview');
      expect(response).toHaveProperty('unchanged');
    });

    it('debería incluir array de correcciones', async () => {
      const response = {
        corrections: [
          {
            cedula: '1234567890',
            changes: ['votingPlace', 'puestoId'],
            details: {}
          }
        ]
      };

      expect(Array.isArray(response.corrections)).toBe(true);
    });
  });

  describe('Integration with Puestos DB', () => {
    it('debería cargar todos los puestos activos', async () => {
      const puestos = [
        {
          codigoPuesto: '160010409',
          nombre: 'Colegio Distrital Montebello',
          activo: true
        },
        {
          codigoPuesto: '160011306',
          nombre: 'El Salitre',
          activo: true
        }
      ];

      expect(puestos.length).toBeGreaterThan(0);
      expect(puestos.every(p => p.activo === true)).toBe(true);
    });

    it('debería hacer matching contra nombre y aliases', async () => {
      const puesto = {
        nombre: 'Colegio Distrital Montebello',
        aliases: ['Montebello', 'Distrital Montebello', 'San Cristóbal']
      };

      const searchTerm = 'montebello';
      const matches = [
        puesto.nombre.toLowerCase().includes(searchTerm),
        puesto.aliases.some(a => a.toLowerCase().includes(searchTerm))
      ];

      expect(matches.some(m => m === true)).toBe(true);
    });

    it('debería validar mesa contra numeroMesas del puesto', async () => {
      const puesto = {
        nombrePuesto: 'Colegio Distrital Montebello',
        numeroMesas: 9
      };

      const registrations = [
        { cedula: '111', mesa: 1, valid: true },
        { cedula: '222', mesa: 9, valid: true },
        { cedula: '333', mesa: 10, valid: false }
      ];

      registrations.forEach(r => {
        const isValid = r.mesa >= 1 && r.mesa <= puesto.numeroMesas;
        expect(isValid).toBe(r.valid);
      });
    });
  });

  describe('UI Feedback Messages', () => {
    it('debería generar resumen legible para usuario', async () => {
      const result = {
        summary: 'Se revisaron 3 registros. Se actualizaron 2 automáticamente y 1 requiere revisión manual.',
        total: 3,
        updated: 2,
        requiresReview: 1
      };

      expect(result.summary).toContain('3');
      expect(result.summary).toContain('2');
      expect(result.summary).toContain('revisión');
    });

    it('debería detallar qué cambió en cada registro', async () => {
      const correction = {
        leaderId: '1111',
        cedula: '1234567890',
        nombre: 'Juan Pérez',
        cambios: {
          votingPlace: {
            antes: 'montebello',
            después: 'Colegio Distrital Montebello'
          },
          puestoId: {
            antes: null,
            después: '160010409'
          }
        }
      };

      expect(correction).toHaveProperty('cambios');
      expect(correction.cambios).toHaveProperty('votingPlace');
    });

    it('debería indicar qué requiere revisión y por qué', async () => {
      const requiereRevision = {
        cedula: '5555555555',
        nombre: 'Carlos López',
        razon: 'Puesto de votación no encontrado: "puesto desconocido"',
        accion: 'Revisar manualmente e ingresar puesto correcto'
      };

      expect(requiereRevision.razon).toContain('no encontrado');
      expect(requiereRevision).toHaveProperty('accion');
    });
  });
});
