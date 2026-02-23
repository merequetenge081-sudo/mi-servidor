/**
 * Registrations Business Logic Tests
 * Tests de lógica de negocio para registros electorales
 */

describe('Confirmación de Registros - CRÍTICO', () => {
  // Simular confirmación de registro
  const confirmRegistration = (registration, confirmationData) => {
    if (!registration) {
      return { success: false, error: 'Registro no encontrado' };
    }

    if (registration.confirmed) {
      return { success: false, error: 'El registro ya está confirmado' };
    }

    // Validar código de confirmación
    if (confirmationData.code && confirmationData.code !== registration.confirmationCode) {
      return { success: false, error: 'Código de confirmación inválido' };
    }

    return {
      success: true,
      registration: {
        ...registration,
        confirmed: true,
        confirmedAt: new Date().toISOString(),
        confirmationMethod: confirmationData.method || 'admin',
      },
    };
  };

  it('debería confirmar registro válido', () => {
    const reg = {
      _id: 'R1',
      cedula: '1234567890',
      confirmed: false,
      confirmationCode: 'ABC123',
    };

    const result = confirmRegistration(reg, { code: 'ABC123', method: 'email' });
    expect(result.success).toBe(true);
    expect(result.registration.confirmed).toBe(true);
    expect(result.registration.confirmationMethod).toBe('email');
  });

  it('debería rechazar registro ya confirmado', () => {
    const reg = {
      _id: 'R1',
      confirmed: true,
      confirmedAt: '2025-01-01',
    };

    const result = confirmRegistration(reg, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('ya está confirmado');
  });

  it('debería rechazar código incorrecto', () => {
    const reg = {
      _id: 'R1',
      confirmed: false,
      confirmationCode: 'ABC123',
    };

    const result = confirmRegistration(reg, { code: 'WRONG' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Código de confirmación inválido');
  });
});

describe('Contador de Registros por Líder - IMPORTANTE', () => {
  const countRegistrationsByLeader = (registrations, leaderId) => {
    const leaderRegs = registrations.filter(r => r.leaderId === leaderId);

    return {
      total: leaderRegs.length,
      confirmed: leaderRegs.filter(r => r.confirmed).length,
      pending: leaderRegs.filter(r => !r.confirmed).length,
      confirmationRate: leaderRegs.length > 0
        ? (leaderRegs.filter(r => r.confirmed).length / leaderRegs.length) * 100
        : 0,
    };
  };

  it('debería contar registros correctamente', () => {
    const regs = [
      { leaderId: 'L1', confirmed: true },
      { leaderId: 'L1', confirmed: false },
      { leaderId: 'L1', confirmed: true },
      { leaderId: 'L2', confirmed: true },
    ];

    const result = countRegistrationsByLeader(regs, 'L1');
    expect(result.total).toBe(3);
    expect(result.confirmed).toBe(2);
    expect(result.pending).toBe(1);
    expect(result.confirmationRate).toBeCloseTo(66.67, 1);
  });

  it('debería retornar ceros para líder sin registros', () => {
    const regs = [{ leaderId: 'L1', confirmed: true }];
    const result = countRegistrationsByLeader(regs, 'L2');

    expect(result.total).toBe(0);
    expect(result.confirmed).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.confirmationRate).toBe(0);
  });
});

describe('Validación de Cobertura Territorial - IMPORTANTE', () => {
  const validateTerritorialCoverage = (registrations, territories) => {
    const coverage = {};

    territories.forEach(territory => {
      const territoryRegs = registrations.filter(
        r => r.territory === territory.name || r.puesto?.includes(territory.name)
      );
      coverage[territory.name] = {
        registrations: territoryRegs.length,
        goal: territory.goal || 0,
        progress: territory.goal ? (territoryRegs.length / territory.goal) * 100 : 0,
        completed: territory.goal ? territoryRegs.length >= territory.goal : false,
      };
    });

    return coverage;
  };

  it('debería calcular cobertura territorial', () => {
    const regs = [
      { puesto: 'Colegio Norte' },
      { puesto: 'Colegio Norte' },
      { puesto: 'Colegio Sur' },
    ];

    const territories = [
      { name: 'Norte', goal: 5 },
      { name: 'Sur', goal: 1 },
    ];

    const result = validateTerritorialCoverage(regs, territories);

    expect(result.Norte.registrations).toBe(2);
    expect(result.Norte.progress).toBe(40);
    expect(result.Norte.completed).toBe(false);

    expect(result.Sur.registrations).toBe(1);
    expect(result.Sur.progress).toBe(100);
    expect(result.Sur.completed).toBe(true);
  });
});

describe('Detección de Registros Duplicados - CRÍTICO', () => {
  const findDuplicates = (registrations) => {
    const seen = new Map();
    const duplicates = [];

    registrations.forEach(reg => {
      const key = `${reg.cedula}-${reg.eventId}`;
      if (seen.has(key)) {
        duplicates.push({
          cedula: reg.cedula,
          eventId: reg.eventId,
          original: seen.get(key),
          duplicate: reg,
        });
      } else {
        seen.set(key, reg);
      }
    });

    return duplicates;
  };

  it('debería detectar duplicados por cédula y evento', () => {
    const regs = [
      { _id: 'R1', cedula: '123', eventId: 'E1', firstName: 'Juan' },
      { _id: 'R2', cedula: '123', eventId: 'E1', firstName: 'Pedro' },
      { _id: 'R3', cedula: '123', eventId: 'E2', firstName: 'Juan' },
    ];

    const duplicates = findDuplicates(regs);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].cedula).toBe('123');
    expect(duplicates[0].eventId).toBe('E1');
  });

  it('no debería marcar como duplicado si eventos diferentes', () => {
    const regs = [
      { cedula: '123', eventId: 'E1' },
      { cedula: '123', eventId: 'E2' },
    ];

    const duplicates = findDuplicates(regs);
    expect(duplicates.length).toBe(0);
  });
});

describe('Búsqueda de Registros - IMPORTANTE', () => {
  const searchRegistrations = (registrations, query) => {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) return registrations;

    return registrations.filter(reg => {
      return (
        reg.cedula?.includes(lowerQuery) ||
        reg.firstName?.toLowerCase().includes(lowerQuery) ||
        reg.lastName?.toLowerCase().includes(lowerQuery) ||
        reg.puesto?.toLowerCase().includes(lowerQuery) ||
        reg.phone?.includes(lowerQuery)
      );
    });
  };

  it('debería buscar por cédula', () => {
    const regs = [
      { cedula: '1234567890', firstName: 'Juan' },
      { cedula: '9876543210', firstName: 'María' },
    ];

    const result = searchRegistrations(regs, '123');
    expect(result.length).toBe(1);
    expect(result[0].firstName).toBe('Juan');
  });

  it('debería buscar por nombre (case-insensitive)', () => {
    const regs = [
      { firstName: 'Juan', lastName: 'Pérez' },
      { firstName: 'María', lastName: 'López' },
    ];

    const result = searchRegistrations(regs, 'JUAN');
    expect(result.length).toBe(1);
  });

  it('debería retornar todos si query vacío', () => {
    const regs = [{ firstName: 'Juan' }, { firstName: 'María' }];
    const result = searchRegistrations(regs, '');
    expect(result.length).toBe(2);
  });
});

describe('Exportación de Registros - IMPORTANTE', () => {
  const exportRegistrationsToCSV = (registrations) => {
    if (!registrations || registrations.length === 0) {
      return { success: false, error: 'No hay registros para exportar' };
    }

    const headers = ['Cédula', 'Nombres', 'Apellidos', 'Puesto', 'Mesa', 'Confirmado'];
    const rows = registrations.map(r => [
      r.cedula || '',
      r.firstName || '',
      r.lastName || '',
      r.puesto || '',
      r.mesa || '',
      r.confirmed ? 'SÍ' : 'NO',
    ]);

    return {
      success: true,
      headers,
      rows,
      totalRows: rows.length,
    };
  };

  it('debería exportar registros a CSV', () => {
    const regs = [
      {
        cedula: '123',
        firstName: 'Juan',
        lastName: 'Pérez',
        puesto: 'Colegio A',
        mesa: '10',
        confirmed: true,
      },
      {
        cedula: '456',
        firstName: 'María',
        lastName: 'López',
        puesto: 'Colegio B',
        mesa: '20',
        confirmed: false,
      },
    ];

    const result = exportRegistrationsToCSV(regs);
    expect(result.success).toBe(true);
    expect(result.headers.length).toBe(6);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0][5]).toBe('SÍ');
    expect(result.rows[1][5]).toBe('NO');
  });

  it('debería rechazar exportación sin registros', () => {
    const result = exportRegistrationsToCSV([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No hay registros');
  });
});

describe('Filtrado Avanzado de Registros - IMPORTANTE', () => {
  const applyAdvancedFilters = (registrations, filters) => {
    let filtered = [...registrations];

    if (filters.leaderId) {
      filtered = filtered.filter(r => r.leaderId === filters.leaderId);
    }

    if (filters.eventId) {
      filtered = filtered.filter(r => r.eventId === filters.eventId);
    }

    if (filters.confirmed !== undefined) {
      filtered = filtered.filter(r => r.confirmed === filters.confirmed);
    }

    if (filters.puesto) {
      filtered = filtered.filter(r =>
        r.puesto?.toLowerCase().includes(filters.puesto.toLowerCase())
      );
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(r =>
        new Date(r.createdAt) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(r =>
        new Date(r.createdAt) <= new Date(filters.dateTo)
      );
    }

    return filtered;
  };

  it('debería filtrar por múltiples criterios', () => {
    const regs = [
      { leaderId: 'L1', eventId: 'E1', confirmed: true, puesto: 'Norte', createdAt: '2025-01-15' },
      { leaderId: 'L1', eventId: 'E1', confirmed: false, puesto: 'Sur', createdAt: '2025-01-20' },
      { leaderId: 'L2', eventId: 'E1', confirmed: true, puesto: 'Norte', createdAt: '2025-01-25' },
    ];

    const result = applyAdvancedFilters(regs, {
      leaderId: 'L1',
      confirmed: true,
      puesto: 'norte',
    });

    expect(result.length).toBe(1);
    expect(result[0].puesto).toBe('Norte');
  });

  it('debería filtrar por rango de fechas', () => {
    const regs = [
      { createdAt: '2025-01-10' },
      { createdAt: '2025-01-20' },
      { createdAt: '2025-01-30' },
    ];

    const result = applyAdvancedFilters(regs, {
      dateFrom: '2025-01-15',
      dateTo: '2025-01-25',
    });

    expect(result.length).toBe(1);
  });
});

describe('Validación de Cuotas de Registro - IMPORTANTE', () => {
  const checkRegistrationQuota = (leader, registrations, maxQuota = 100) => {
    const leaderRegs = registrations.filter(r => r.leaderId === leader._id);

    const quota = {
      current: leaderRegs.length,
      max: leader.customQuota || maxQuota,
      available: (leader.customQuota || maxQuota) - leaderRegs.length,
      percentage: ((leaderRegs.length / (leader.customQuota || maxQuota)) * 100).toFixed(2),
      canRegister: leaderRegs.length < (leader.customQuota || maxQuota),
    };

    return quota;
  };

  it('debería calcular cuota disponible', () => {
    const leader = { _id: 'L1', customQuota: 50 };
    const regs = Array(30).fill({ leaderId: 'L1' });

    const quota = checkRegistrationQuota(leader, regs);
    expect(quota.current).toBe(30);
    expect(quota.max).toBe(50);
    expect(quota.available).toBe(20);
    expect(quota.canRegister).toBe(true);
  });

  it('debería bloquear si cuota llena', () => {
    const leader = { _id: 'L1', customQuota: 10 };
    const regs = Array(10).fill({ leaderId: 'L1' });

    const quota = checkRegistrationQuota(leader, regs);
    expect(quota.canRegister).toBe(false);
    expect(quota.available).toBe(0);
  });

  it('debería usar cuota por defecto si no tiene customQuota', () => {
    const leader = { _id: 'L1' };
    const regs = Array(50).fill({ leaderId: 'L1' });

    const quota = checkRegistrationQuota(leader, regs, 100);
    expect(quota.max).toBe(100);
    expect(quota.available).toBe(50);
  });
});

describe('Notificaciones de Registro - IMPORTANTE', () => {
  const shouldSendNotification = (registration, settings) => {
    const notifications = {
      confirmationEmail: false,
      reminderEmail: false,
      smsNotification: false,
    };

    // Email de confirmación si está habilitado y hay email
    if (settings.enableConfirmationEmail && registration.email) {
      notifications.confirmationEmail = true;
    }

    // Recordatorio si no está confirmado después de 24h
    if (settings.enableReminders && !registration.confirmed) {
      const hoursSinceCreation = (Date.now() - new Date(registration.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation >= 24) {
        notifications.reminderEmail = true;
      }
    }

    // SMS si está habilitado y hay teléfono
    if (settings.enableSMS && registration.phone && registration.phone.length >= 10) {
      notifications.smsNotification = true;
    }

    return notifications;
  };

  it('debería activar email de confirmación', () => {
    const reg = { email: 'test@test.com', phone: '3001234567' };
    const settings = { enableConfirmationEmail: true, enableSMS: false };

    const result = shouldSendNotification(reg, settings);
    expect(result.confirmationEmail).toBe(true);
    expect(result.smsNotification).toBe(false);
  });

  it('debería activar SMS si está configurado', () => {
    const reg = { phone: '3001234567' };
    const settings = { enableSMS: true };

    const result = shouldSendNotification(reg, settings);
    expect(result.smsNotification).toBe(true);
  });

  it('debería activar recordatorio después de 24h', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const reg = { confirmed: false, createdAt: yesterday.toISOString(), email: 'test@test.com' };
    const settings = { enableReminders: true };

    const result = shouldSendNotification(reg, settings);
    expect(result.reminderEmail).toBe(true);
  });
});
