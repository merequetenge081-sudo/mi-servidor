/**
 * Helpers & Utilities Tests
 * Pruebas para funciones helper y utilidades avanzadas
 */

describe('Data Transformation Utilities', () => {
  // Simulación de transformadores
  const transformUser = (raw) => {
    return {
      id: raw.id,
      fullName: `${raw.firstName} ${raw.lastName}`.trim(),
      email: raw.email?.toLowerCase(),
      role: raw.role || 'guest',
      createdAt: new Date(raw.createdAt),
    };
  };

  it('debería transformar usuario correctamente', () => {
    const raw = {
      id: '123',
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'JUAN@EXAMPLE.COM',
      role: 'admin',
      createdAt: '2025-02-23',
    };

    const result = transformUser(raw);
    expect(result.fullName).toBe('Juan Pérez');
    expect(result.email).toBe('juan@example.com');
    expect(result.id).toBe('123');
  });

  const flattenObject = (obj, prefix = '') => {
    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  };

  it('debería aplanar objeto anidado', () => {
    const nested = {
      user: {
        name: 'Juan',
        email: {
          primary: 'juan@example.com',
        },
      },
    };

    const flat = flattenObject(nested);
    expect(flat['user.name']).toBe('Juan');
    expect(flat['user.email.primary']).toBe('juan@example.com');
  });
});

describe('CSV & Data Export Utilities', () => {
  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(item =>
      headers.map(header => {
        const value = item[header];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  };

  it('debería convertir array a CSV', () => {
    const data = [
      { id: '1', name: 'Juan', email: 'juan@example.com' },
      { id: '2', name: 'María', email: 'maria@example.com' },
    ];

    const csv = convertToCSV(data);
    expect(csv).toContain('id,name,email');
    expect(csv).toContain('1,Juan,juan@example.com');
  });

  it('debería escazar valores con comas', () => {
    const data = [
      { id: '1', name: 'López, Juan', email: 'juan@example.com' },
    ];

    const csv = convertToCSV(data);
    expect(csv).toContain('"López, Juan"');
  });
});

describe('Validation Utilities Advanced', () => {
  const validateCedula = (cedula) => {
    if (!cedula) return { valid: false, error: 'Cédula requerida' };

    cedula = cedula.toString().replace(/\D/g, '');

    if (cedula.length < 5 || cedula.length > 11) {
      return { valid: false, error: 'Formato inválido' };
    }

    return { valid: true };
  };

  it('debería validar cédula válida', () => {
    const result = validateCedula('1234567890');
    expect(result.valid).toBe(true);
  });

  it('debería rechazar cédula muy corta', () => {
    const result = validateCedula('123');
    expect(result.valid).toBe(false);
  });

  const validatePhoneNumber = (phone) => {
    const colombiaPattern = /^(\+57|0057|57)?[1-8]\d{6,9}$/;
    return {
      valid: colombiaPattern.test(phone?.replace(/\D/g, '') || ''),
      formatted: phone?.replace(/\D/g, ''),
    };
  };

  it('debería validar número telefónico', () => {
    const result = validatePhoneNumber('3101234567');
    expect(result.valid).toBe(true);
  });

  it('debería rechazar teléfono inválido', () => {
    const result = validatePhoneNumber('123');
    expect(result.valid).toBe(false);
  });
});

describe('String Formatting Utilities', () => {
  const maskEmail = (email) => {
    const [local, domain] = email.split('@');
    const masked = local.substring(0, 2) + '*'.repeat(local.length - 2) + '@' + domain;
    return masked;
  };

  it('debería enmascarar email', () => {
    const result = maskEmail('juan.perez@example.com');
    expect(result).toContain('ju****');
    expect(result).toContain('@example.com');
  });

  const maskCedula = (cedula) => {
    cedula = cedula.toString();
    return cedula.substring(0, 3) + '***' + cedula.substring(cedula.length - 2);
  };

  it('debería enmascarar cédula', () => {
    const result = maskCedula('1234567890');
    expect(result).toBe('123***90');
  });

  const formatCurrency = (amount, currency = 'COP') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  it('debería formatear moneda', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1');
  });
});

describe('Date Utilities Advanced', () => {
  const getDateRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { start, end };
  };

  it('debería retornar rango de fechas', () => {
    const range = getDateRange(7);
    const diff = range.end - range.start;
    const days = diff / (1000 * 60 * 60 * 24);
    expect(days).toBeCloseTo(7, 0);
  });

  const getAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  it('debería calcular edad correctamente', () => {
    const birthDate = new Date('1990-02-23');
    const age = getAge(birthDate);
    expect(age).toBeGreaterThanOrEqual(30);
  });
});

describe('Crypto & Security Utilities', () => {
  const hashSimple = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  };

  it('debería hashear string', () => {
    const hash1 = hashSimple('test123');
    const hash2 = hashSimple('test123');
    expect(hash1).toBe(hash2);
    expect(hash1).toBeDefined();
  });

  const generateRandomToken = (length = 32) => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  it('debería generar token aleatorio', () => {
    const token = generateRandomToken(32);
    expect(token.length).toBe(32);
    expect(/^[a-zA-Z0-9]+$/.test(token)).toBe(true);
  });
});

describe('File Utilities', () => {
  const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };

  it('debería extraer extensión de archivo', () => {
    expect(getFileExtension('document.PDF')).toBe('pdf');
    expect(getFileExtension('image.jpg')).toBe('jpg');
  });

  const isValidFileType = (filename, allowedTypes) => {
    const ext = getFileExtension(filename);
    return allowedTypes.includes(ext);
  };

  it('debería validar tipo de archivo', () => {
    const allowed = ['pdf', 'xlsx', 'doc'];
    expect(isValidFileType('document.pdf', allowed)).toBe(true);
    expect(isValidFileType('image.jpg', allowed)).toBe(false);
  });

  const getFileSizeCategory = (sizeInBytes) => {
    const mb = sizeInBytes / (1024 * 1024);
    if (mb < 1) return 'small';
    if (mb < 10) return 'medium';
    if (mb < 100) return 'large';
    return 'extra-large';
  };

  it('debería categorizar tamaño de archivo', () => {
    expect(getFileSizeCategory(500000)).toBe('small');
    expect(getFileSizeCategory(5242880)).toBe('medium');
    expect(getFileSizeCategory(50000000)).toBe('large');
  });
});

describe('Error Logging Utilities', () => {
  const createErrorLog = (error, context = {}) => {
    return {
      timestamp: new Date().toISOString(),
      message: error.message || error,
      stack: error.stack,
      context,
      severity: error.severity || 'error',
    };
  };

  it('debería crear error log', () => {
    const error = new Error('Test error');
    const log = createErrorLog(error, { userId: '123' });

    expect(log.timestamp).toBeDefined();
    expect(log.message).toBe('Test error');
    expect(log.context.userId).toBe('123');
  });

  const errorSeverity = (error) => {
    if (error.includes('critical')) return 'critical';
    if (error.includes('warning')) return 'warning';
    return 'info';
  };

  it('debería clasificar severidad de error', () => {
    expect(errorSeverity('critical database error')).toBe('critical');
    expect(errorSeverity('warning: deprecated')).toBe('warning');
    expect(errorSeverity('info: completed')).toBe('info');
  });
});

describe('Config & Environment Utilities', () => {
  const getConfig = (env = 'development') => {
    const configs = {
      development: {
        debug: true,
        logLevel: 'debug',
        port: 3000,
      },
      production: {
        debug: false,
        logLevel: 'error',
        port: 8080,
      },
      test: {
        debug: true,
        logLevel: 'warn',
        port: 3001,
      },
    };

    return configs[env] || configs.development;
  };

  it('debería retornar config por ambiente', () => {
    const devConfig = getConfig('development');
    expect(devConfig.debug).toBe(true);
    expect(devConfig.port).toBe(3000);
  });

  it('debería retornar config de producción', () => {
    const prodConfig = getConfig('production');
    expect(prodConfig.debug).toBe(false);
    expect(prodConfig.port).toBe(8080);
  });
});

describe('Query Builder Utilities', () => {
  const buildQuery = (filters) => {
    const query = {};

    if (filters.search) {
      query.$or = [
        { name: new RegExp(filters.search, 'i') },
        { email: new RegExp(filters.search, 'i') },
      ];
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.createdAfter) {
      query.createdAt = { $gte: new Date(filters.createdAfter) };
    }

    return query;
  };

  it('debería construir query con búsqueda', () => {
    const query = buildQuery({ search: 'juan' });
    expect(query.$or).toBeDefined();
    expect(query.$or.length).toBe(2);
  });

  it('debería construir query con estado', () => {
    const query = buildQuery({ status: 'active' });
    expect(query.status).toBe('active');
  });
});
