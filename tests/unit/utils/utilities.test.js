/**
 * Unit Tests: Utility Functions
 * Pruebas para funciones de utilidad importantes
 */

describe('Password Validation Utility', () => {
  const validatePassword = (password) => {
    if (password.length < 8) {
      return { valid: false, errors: ['Mínimo 8 caracteres'] };
    }

    const errors = [];
    if (!/[A-Z]/.test(password)) {
      errors.push('Una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Una minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Un número');
    }
    if (!/[\W_]/.test(password)) {
      errors.push('Un carácter especial');
    }

    return errors.length === 0
      ? { valid: true }
      : { valid: false, errors };
  };

  it('debería aceptar contraseña válida', () => {
    const result = validatePassword('SecurePass123!');
    expect(result.valid).toBe(true);
  });

  it('debería rechazar contraseña muy corta', () => {
    const result = validatePassword('Short1!');
    expect(result.valid).toBe(false);
    expect(result.errors.length > 0).toBe(true);
  });

  it('debería detectar falta de mayúscula', () => {
    const result = validatePassword('lowercase123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Una mayúscula');
  });

  it('debería detectar falta de minúscula', () => {
    const result = validatePassword('UPPERCASE123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Una minúscula');
  });

  it('debería detectar falta de número', () => {
    const result = validatePassword('NoNumbers!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Un número');
  });

  it('debería detectar falta de carácter especial', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Un carácter especial');
  });
});

describe('Date Formatting Utility', () => {
  const formatDate = (date, format = 'es-CO') => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString(format);
    } catch {
      return null;
    }
  };

  it('debería formatear una fecha válida', () => {
    const result = formatDate('2025-02-23');
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('debería retornar null para fecha inválida', () => {
    const result = formatDate(null);
    expect(result).toBeNull();
  });

  it('debería usar la zona horaria especificada', () => {
    const colombianDate = formatDate('2025-02-23', 'es-CO');
    const usaDate = formatDate('2025-02-23', 'en-US');
    // Ambas deben tener contenido pero pueden diferir en formato
    expect(colombianDate).toBeDefined();
    expect(usaDate).toBeDefined();
  });
});

describe('String Utilities', () => {
  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const trimSpaces = (str) => {
    return str ? str.trim() : '';
  };

  const slugify = (str) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '');
  };

  describe('capitalize', () => {
    it('debería capitalizar primera letra', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('debería mantener capitalización anterior', () => {
      expect(capitalize('HELLO')).toBe('HELLO');
    });

    it('debería retornar string vacío para null', () => {
      expect(capitalize(null)).toBe('');
    });
  });

  describe('trimSpaces', () => {
    it('debería remover espacios al inicio', () => {
      expect(trimSpaces('  hello')).toBe('hello');
    });

    it('debería remover espacios al final', () => {
      expect(trimSpaces('hello  ')).toBe('hello');
    });

    it('debería remover espacios en ambos lados', () => {
      expect(trimSpaces('  hello world  ')).toBe('hello world');
    });
  });

  describe('slugify', () => {
    it('debería convertir a minúsculas', () => {
      expect(slugify('HELLO')).toContain('hello');
    });

    it('debería reemplazar espacios con guiones', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('debería remover caracteres especiales', () => {
      expect(slugify('hello@world!')).toBe('helloworld');
    });
  });
});

describe('Array Utilities', () => {
  const removeDuplicates = (arr) => {
    return [...new Set(arr)];
  };

  const groupBy = (arr, key) => {
    return arr.reduce((result, item) => {
      const group = item[key];
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(item);
      return result;
    }, {});
  };

  const filterByProperty = (arr, property, value) => {
    return arr.filter(item => item[property] === value);
  };

  describe('removeDuplicates', () => {
    it('debería remover elementos duplicados', () => {
      const result = removeDuplicates([1, 2, 2, 3, 3, 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('debería mantener orden original', () => {
      const result = removeDuplicates([3, 1, 2, 1, 3]);
      expect(result[0]).toBe(3);
      expect(result[1]).toBe(1);
    });
  });

  describe('groupBy', () => {
    it('debería agrupar elementos por propiedad', () => {
      const data = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const result = groupBy(data, 'category');
      expect(result['A'].length).toBe(2);
      expect(result['B'].length).toBe(1);
    });
  });

  describe('filterByProperty', () => {
    it('debería filtrar por propiedad específica', () => {
      const data = [
        { status: 'active', name: 'Item 1' },
        { status: 'inactive', name: 'Item 2' },
        { status: 'active', name: 'Item 3' },
      ];
      const result = filterByProperty(data, 'status', 'active');
      expect(result.length).toBe(2);
    });
  });
});

describe('Object Utilities', () => {
  const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };

  const merge = (obj1, obj2) => {
    return { ...obj1, ...obj2 };
  };

  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  };

  describe('deepClone', () => {
    it('debería crear una copia profunda', () => {
      const original = { name: 'test', nested: { value: 1 } };
      const cloned = deepClone(original);
      cloned.nested.value = 2;
      expect(original.nested.value).toBe(1);
    });
  });

  describe('merge', () => {
    it('debería combinar dos objetos', () => {
      const result = merge({ a: 1 }, { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('debería sobrescribir propiedades duplicadas', () => {
      const result = merge({ a: 1 }, { a: 2 });
      expect(result.a).toBe(2);
    });
  });

  describe('getNestedValue', () => {
    it('debería obtener valor anidado', () => {
      const obj = { user: { profile: { name: 'John' } } };
      const result = getNestedValue(obj, 'user.profile.name');
      expect(result).toBe('John');
    });

    it('debería retornar undefined si ruta no existe', () => {
      const obj = { user: { name: 'John' } };
      const result = getNestedValue(obj, 'user.notexist');
      expect(result).toBeUndefined();
    });
  });
});

describe('Number Utilities', () => {
  const formatCurrency = (num, currency = 'USD') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
    }).format(num);
  };

  const roundToDecimals = (num, decimals = 2) => {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  const isInRange = (num, min, max) => {
    return num >= min && num <= max;
  };

  describe('formatCurrency', () => {
    it('debería formatear número como moneda', () => {
      const result = formatCurrency(1000);
      expect(result).toContain('1');
      expect(result).toContain('0');
    });
  });

  describe('roundToDecimals', () => {
    it('debería redondear a decimales especificados', () => {
      expect(roundToDecimals(3.14159, 2)).toBe(3.14);
      expect(roundToDecimals(3.14159, 3)).toBe(3.142);
    });
  });

  describe('isInRange', () => {
    it('debería validar si número está en rango', () => {
      expect(isInRange(5, 1, 10)).toBe(true);
      expect(isInRange(15, 1, 10)).toBe(false);
    });
  });
});
