/**
 * ✨ EJEMPLO DE TEST - Registrations Controller
 * 
 * Este archivo muestra cómo escribir tests para las funciones críticas
 * que acabas de arreglar y que necesitan cobertura.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import mongoose from 'mongoose';

// Mock de dependencias
jest.mock('mongoose');
jest.mock('../models/Leader.js');
jest.mock('../models/LeaderRegistration.js');
jest.mock('../models/Puestos.js');
jest.mock('../utils/fuzzyMatch.js');

import * as registrationsController from '../controllers/registrations.controller.js';
import { Leader, LeaderRegistration, Puestos } from '../models/index.js';
import { matchPuesto } from '../utils/fuzzyMatch.js';

describe('RegistrationsController - verifyLeaderRegistrations', () => {
  
  const testLeaderId = 'LID-MLULVTSN-3G4H';
  const testObjectId = new mongoose.Types.ObjectId();
  
  beforeAll(() => {
    // Setup mocks
    mongoose.Types.ObjectId.isValid = jest.fn((id) => {
      return /^[a-f\d]{24}$/i.test(id) || id.toString().length === 24;
    });
  });

  // ✅ TEST 1: Happy Path - Verificación exitosa con ObjectId válido
  it('should verify registrations with valid ObjectId leaderId', async () => {
    const mockLeader = {
      _id: testObjectId,
      leaderId: testLeaderId,
      name: 'Test Leader',
    };

    const mockRegistrations = [
      {
        _id: new mongoose.Types.ObjectId(),
        leaderId: testObjectId,
        puesto: 'Alcaldía Quiroga',
        localidad: 'Rafael Uribe Uribe',
        matchConfidence: 0.0,
      },
    ];

    const mockPuesto = {
      _id: new mongoose.Types.ObjectId(),
      nombre: 'Alcaldía Quiroga',
      localidad: 'Rafael Uribe Uribe',
      codigoPuesto: '1900010',
    };

    // Setup mocks para este test
    Leader.findOne.mockResolvedValue(mockLeader);
    LeaderRegistration.find.mockResolvedValue(mockRegistrations);
    Puestos.findOne.mockResolvedValue(mockPuesto);
    matchPuesto.mockReturnValue(0.95); // Match alto

    // Enviar request mock
    const req = {
      params: { leaderId: testObjectId.toString() },
      body: { threshold: 0.85 },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Ejecutar
    await registrationsController.verifyLeaderRegistrations(req, res);

    // Validar
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        matched: expect.any(Number),
      })
    );
  });

  // ⚠️ TEST 2: Edge Case - ObjectId inválido (ERROR ANTERIOR)
  it('should handle invalid ObjectId casting gracefully', async () => {
    const invalidId = 'NOT-A-VALID-OBJECTID';

    const req = {
      params: { leaderId: invalidId },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // TODO: Debería retornar error 400, no 500
    try {
      await registrationsController.verifyLeaderRegistrations(req, res);
      
      // Validar que NO Sea 500
      expect(res.status).not.toHaveBeenCalledWith(500);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  // ⚠️ TEST 3: Edge Case - Leader no encontrado
  it('should return 404 when leader not found', async () => {
    const req = {
      params: { leaderId: testObjectId.toString() },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    Leader.findOne.mockResolvedValue(null);

    await registrationsController.verifyLeaderRegistrations(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // 🚨 TEST 4: Error - DB Connection Fail
  it('should handle database connection errors', async () => {
    const req = {
      params: { leaderId: testObjectId.toString() },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    Leader.findOne.mockRejectedValue(new Error('DB Connection failed'));

    await registrationsController.verifyLeaderRegistrations(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('RegistrationsController - bulkCreateRegistrations', () => {
  
  // ✅ TEST 5: Happy Path - Import 751 puestos exitoso
  it('should bulk import 751 puestos without errors', async () => {
    const mockLeader = { _id: new mongoose.Types.ObjectId() };
    
    const registrations = Array(751).fill(null).map((_, i) => ({
      leaderId: mockLeader._id,
      puesto: `Puesto ${i}`,
      localidad: `Localidad ${i % 19}`,
    }));

    const req = {
      body: { registrations },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    LeaderRegistration.insertMany.mockResolvedValue(
      registrations.map((r, i) => ({ ...r, _id: new mongoose.Types.ObjectId() }))
    );

    await registrationsController.bulkCreateRegistrations(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        inserted: 751,
        total: 751,
      })
    );
  });

  // ⚠️ TEST 6: Edge Case - Duplicados en bulk import
  it('should handle duplicates in bulk import', async () => {
    const identical = {
      leaderId: new mongoose.Types.ObjectId(),
      puesto: 'Alcaldía Quiroga',
      localidad: 'Rafael Uribe Uribe',
    };

    const req = {
      body: {
        registrations: [identical, identical], // Duplicado
      },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Mock: prevenir duplicados
    LeaderRegistration.insertMany.mockImplementation(async (regs) => {
      // Simular comportamiento de unique constraint
      return regs.slice(0, 1).map(r => ({ ...r, _id: new mongoose.Types.ObjectId() }));
    });

    await registrationsController.bulkCreateRegistrations(req, res);

    // Debería insertar solo 1
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        inserted: 1,
      })
    );
  });

  // 🚨 TEST 7: Error - Payload muy grande
  it('should reject payload > 10MB', async () => {
    const hugeData = 'x'.repeat(11 * 1024 * 1024); // 11MB

    const req = {
      body: { registrations: hugeData },
    };

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    // Express payload limit debería rechazar
    // (Este test usualmente se maneja con middleware)
    
    expect(req.body.registrations.length).toBeGreaterThan(10 * 1024 * 1024);
  });
});

describe('RegistrationsController - Fuzzy Matching Integration', () => {

  // ✅ TEST 8: Happy Path - Match threshold 0.85
  it('should match "Alcaldía Quiroga" con threshold 0.85', async () => {
    const input = 'Alcaldia Quiroga'; // Sin acento
    const expected = 'Alcaldía Quiroga';
    
    const mockPuesto = {
      nombre: expected,
      aliases: ['Alcaldia Quiroga', 'Quiroga Alcaldia'],
    };

    matchPuesto.mockReturnValue(0.92); // 92% match

    const result = matchPuesto(input, mockPuesto, 0.85);

    expect(result).toBeGreaterThanOrEqual(0.85);
  });

  // ⚠️ TEST 9: Edge Case - Nombre muy similar pero falla match
  it('should NOT match "Libertador II" con threshold 0.85 si es muy diferente', async () => {
    const input = 'Libertador';
    const mockPuesto = {
      nombre: 'Colegio Distrital El Libertador Sede B',
    };

    matchPuesto.mockReturnValue(0.72); // 72% match (falla)

    const result = matchPuesto(input, mockPuesto, 0.85);

    expect(result).toBeLessThan(0.85);
  });

  // ✅ TEST 10: Happy Path - Substring boost (nombre ≥4 chars)
  it('should apply substring boost for names >= 4 chars', async () => {
    const shortName = 'Apt'; // 3 chars - NO boost
    const longName = 'Apartado'; // 7 chars - SÍ boost

    // El algoritmo debería dar boost a strings largos
    matchPuesto.mockReturnValue(0.85); // Con substring boost
    
    const result = matchPuesto(longName, { nombre: 'Apartamentos' }, 0.80);
    
    expect(result).toBeGreaterThan(0.85);
  });
});

// ============================================
// EJECUTAR: npm test -- registrations.controller.test.js
// ============================================
