/**
 * Electoral Data Validation Tests
 * Tests críticos para validación de datos electorales
 */

describe('Validación de Cédula - CRÍTICO', () => {
  // Validar formato de cédula colombiana (6-10 dígitos)
  const validateCedula = (cedula) => {
    if (!cedula) {
      return { valid: false, error: 'Cédula requerida' };
    }

    const cleanCedula = cedula.toString().replace(/\D/g, '');

    if (cleanCedula.length < 6) {
      return { valid: false, error: 'Cédula muy corta (mínimo 6 dígitos)' };
    }

    if (cleanCedula.length > 10) {
      return { valid: false, error: 'Cédula muy larga (máximo 10 dígitos)' };
    }

    return { valid: true, cedula: cleanCedula };
  };

  it('debería validar cédula correcta', () => {
    const result = validateCedula('1234567890');
    expect(result.valid).toBe(true);
    expect(result.cedula).toBe('1234567890');
  });

  it('debería rechazar cédula vacía', () => {
    const result = validateCedula('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('requerida');
  });

  it('debería rechazar cédula muy corta', () => {
    const result = validateCedula('12345');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('muy corta');
  });

  it('debería rechazar cédula muy larga', () => {
    const result = validateCedula('12345678901');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('muy larga');
  });

  it('debería limpiar caracteres no numéricos', () => {
    const result = validateCedula('1.234.567-890');
    expect(result.valid).toBe(true);
    expect(result.cedula).toBe('1234567890');
  });
});

describe('Validación de Nombres - IMPORTANTE', () => {
  const validateName = (name, field = 'Nombre') => {
    if (!name || !name.trim()) {
      return { valid: false, error: `${field} requerido` };
    }

    const cleanName = name.trim();

    if (cleanName.length < 2) {
      return { valid: false, error: `${field} muy corto` };
    }

    if (cleanName.length > 50) {
      return { valid: false, error: `${field} muy largo` };
    }

    // Validar solo letras, espacios y caracteres latinos
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(cleanName)) {
      return { valid: false, error: `${field} contiene caracteres inválidos` };
    }

    return { valid: true, name: cleanName };
  };

  it('debería validar nombre correcto', () => {
    const result = validateName('Juan Pérez');
    expect(result.valid).toBe(true);
  });

  it('debería rechazar nombre vacío', () => {
    const result = validateName('');
    expect(result.valid).toBe(false);
  });

  it('debería rechazar nombre muy corto', () => {
    const result = validateName('A');
    expect(result.valid).toBe(false);
  });

  it('debería aceptar nombres con tildes', () => {
    const result = validateName('María José');
    expect(result.valid).toBe(true);
  });

  it('debería aceptar nombres con ñ', () => {
    const result = validateName('Muñoz');
    expect(result.valid).toBe(true);
  });

  it('debería rechazar nombres con números', () => {
    const result = validateName('Juan123');
    expect(result.valid).toBe(false);
  });

  it('debería rechazar nombres con símbolos', () => {
    const result = validateName('Juan@#$');
    expect(result.valid).toBe(false);
  });
});

describe('Validación de Teléfono - IMPORTANTE', () => {
  const validatePhone = (phone) => {
    if (!phone) {
      return { valid: true, phone: null }; // Teléfono es opcional
    }

    const cleanPhone = phone.toString().replace(/\D/g, '');

    if (cleanPhone.length < 7) {
      return { valid: false, error: 'Teléfono muy corto (mínimo 7 dígitos)' };
    }

    if (cleanPhone.length > 10) {
      return { valid: false, error: 'Teléfono muy largo (máximo 10 dígitos)' };
    }

    return { valid: true, phone: cleanPhone };
  };

  it('debería validar teléfono correcto', () => {
    const result = validatePhone('3001234567');
    expect(result.valid).toBe(true);
    expect(result.phone).toBe('3001234567');
  });

  it('debería aceptar teléfono vacío (opcional)', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(true);
    expect(result.phone).toBeNull();
  });

  it('debería limpiar formato de teléfono', () => {
    const result = validatePhone('300-123-4567');
    expect(result.valid).toBe(true);
    expect(result.phone).toBe('3001234567');
  });

  it('debería rechazar teléfono muy corto', () => {
    const result = validatePhone('123456');
    expect(result.valid).toBe(false);
  });
});

describe('Validación de Puesto de Votación - CRÍTICO', () => {
  const validatePuesto = (puesto) => {
    if (!puesto || !puesto.trim()) {
      return { valid: false, error: 'Puesto de votación requerido' };
    }

    const cleanPuesto = puesto.trim();

    if (cleanPuesto.length < 3) {
      return { valid: false, error: 'Nombre de puesto muy corto' };
    }

    return { valid: true, puesto: cleanPuesto };
  };

  it('debería validar puesto correcto', () => {
    const result = validatePuesto('Colegio San José');
    expect(result.valid).toBe(true);
  });

  it('debería rechazar puesto vacío', () => {
    const result = validatePuesto('');
    expect(result.valid).toBe(false);
  });

  it('debería rechazar puesto muy corto', () => {
    const result = validatePuesto('AB');
    expect(result.valid).toBe(false);
  });
});

describe('Validación de Mesa de Votación - IMPORTANTE', () => {
  const validateMesa = (mesa) => {
    if (!mesa) {
      return { valid: true, mesa: null }; // Mesa es opcional
    }

    const cleanMesa = mesa.toString().trim();

    if (cleanMesa.length === 0) {
      return { valid: true, mesa: null };
    }

    // Mesa puede ser número o alfanumérica
    if (cleanMesa.length > 10) {
      return { valid: false, error: 'Número de mesa muy largo' };
    }

    return { valid: true, mesa: cleanMesa };
  };

  it('debería validar mesa numérica', () => {
    const result = validateMesa('123');
    expect(result.valid).toBe(true);
    expect(result.mesa).toBe('123');
  });

  it('debería validar mesa alfanumérica', () => {
    const result = validateMesa('ABC-123');
    expect(result.valid).toBe(true);
  });

  it('debería aceptar mesa vacía', () => {
    const result = validateMesa('');
    expect(result.valid).toBe(true);
    expect(result.mesa).toBeNull();
  });
});

describe('Validación Completa de Registro - CRÍTICO', () => {
  const validateRegistration = (data) => {
    const errors = [];

    // Validar líder
    if (!data.leaderId) {
      errors.push('leaderId requerido');
    }

    // Validar evento
    if (!data.eventId) {
      errors.push('eventId requerido');
    }

    // Validar cédula
    if (!data.cedula) {
      errors.push('Cédula requerida');
    } else {
      const cleanCedula = data.cedula.toString().replace(/\D/g, '');
      if (cleanCedula.length < 6 || cleanCedula.length > 10) {
        errors.push('Cédula inválida');
      }
    }

    // Validar nombres
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push('Primer nombre inválido');
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push('Apellido inválido');
    }

    // Validar puesto
    if (!data.puesto || data.puesto.trim().length < 3) {
      errors.push('Puesto de votación inválido');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  it('debería validar registro completo válido', () => {
    const result = validateRegistration({
      leaderId: 'L1',
      eventId: 'E1',
      cedula: '1234567890',
      firstName: 'Juan',
      lastName: 'Pérez',
      puesto: 'Colegio Central',
      phone: '3001234567',
    });

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('debería detectar múltiples errores', () => {
    const result = validateRegistration({
      leaderId: '',
      eventId: '',
      cedula: '123',
      firstName: '',
      lastName: 'A',
      puesto: '',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });

  it('debería rechazar sin líder', () => {
    const result = validateRegistration({
      eventId: 'E1',
      cedula: '1234567890',
      firstName: 'Juan',
      lastName: 'Pérez',
      puesto: 'Colegio',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('leaderId requerido');
  });
});

describe('Validación de Duplicados - CRÍTICO', () => {
  const checkDuplicate = (newRegistration, existingRegistrations) => {
    const duplicate = existingRegistrations.find(
      r =>
        r.cedula === newRegistration.cedula &&
        r.eventId === newRegistration.eventId
    );

    if (duplicate) {
      return {
        isDuplicate: true,
        message: 'Esta cédula ya está registrada en este evento',
        existingRegistration: duplicate,
      };
    }

    return { isDuplicate: false };
  };

  it('debería detectar duplicado exacto', () => {
    const existing = [
      { cedula: '1234567890', eventId: 'E1', firstName: 'Juan' },
    ];

    const newReg = { cedula: '1234567890', eventId: 'E1', firstName: 'Pedro' };

    const result = checkDuplicate(newReg, existing);
    expect(result.isDuplicate).toBe(true);
  });

  it('debería permitir misma cédula en diferentes eventos', () => {
    const existing = [{ cedula: '1234567890', eventId: 'E1' }];
    const newReg = { cedula: '1234567890', eventId: 'E2' };

    const result = checkDuplicate(newReg, existing);
    expect(result.isDuplicate).toBe(false);
  });

  it('debería permitir diferentes cédulas en mismo evento', () => {
    const existing = [{ cedula: '1234567890', eventId: 'E1' }];
    const newReg = { cedula: '9876543210', eventId: 'E1' };

    const result = checkDuplicate(newReg, existing);
    expect(result.isDuplicate).toBe(false);
  });
});

describe('Sanitización de Datos - IMPORTANTE', () => {
  const sanitizeInput = (input) => {
    if (!input) return '';

    return input
      .toString()
      .trim()
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[;'"]/g, '') // Remove SQL injection chars
      .substring(0, 200); // Limit length
  };

  it('debería limpiar espacios', () => {
    const result = sanitizeInput('  Juan  ');
    expect(result).toBe('Juan');
  });

  it('debería remover HTML tags', () => {
    const result = sanitizeInput('<script>alert("xss")</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('debería remover comillas y punto y coma', () => {
    const result = sanitizeInput("name'; DROP TABLE");
    expect(result).not.toContain("'");
    expect(result).not.toContain(';');
  });

  it('debería limitar longitud', () => {
    const longString = 'a'.repeat(300);
    const result = sanitizeInput(longString);
    expect(result.length).toBeLessThanOrEqual(200);
  });
});
