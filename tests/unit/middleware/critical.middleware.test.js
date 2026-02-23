/**
 * Critical Middleware Tests
 * Tests críticos adicionales para middleware de autenticación, autorización y seguridad
 */

describe('JWT Authentication Flow - CRÍTICO', () => {
  // Simular flujo completo de autenticación JWT
  const authenticateJWT = (req) => {
    const authHeader = req.headers?.authorization;

    if (!authHeader) {
      return { authenticated: false, error: 'No se proporcionó token', status: 401 };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Formato de token inválido', status: 401 };
    }

    const token = authHeader.substring(7);

    if (!token || token.length < 10) {
      return { authenticated: false, error: 'Token inválido', status: 401 };
    }

    // Simular validación de token
    if (token === 'valid_token_123') {
      return {
        authenticated: true,
        user: { _id: 'user123', role: 'admin', organizationId: 'org1' },
      };
    }

    if (token === 'expired_token') {
      return { authenticated: false, error: 'Token expirado', status: 401 };
    }

    return { authenticated: false, error: 'Token inválido', status: 401 };
  };

  it('debería autenticar con token válido', () => {
    const req = {
      headers: { authorization: 'Bearer valid_token_123' },
    };

    const result = authenticateJWT(req);
    expect(result.authenticated).toBe(true);
    expect(result.user._id).toBe('user123');
  });

  it('debería rechazar sin token', () => {
    const req = { headers: {} };
    const result = authenticateJWT(req);

    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('No se proporcionó token');
    expect(result.status).toBe(401);
  });

  it('debería rechazar formato incorrecto', () => {
    const req = { headers: { authorization: 'InvalidFormat token123' } };
    const result = authenticateJWT(req);

    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Formato de token inválido');
  });

  it('debería rechazar token expirado', () => {
    const req = { headers: { authorization: 'Bearer expired_token' } };
    const result = authenticateJWT(req);

    expect(result.authenticated).toBe(false);
    expect(result.error).toContain('Token expirado');
  });
});

describe('Role-Based Authorization - CRÍTICO', () => {
  const authorizeRole = (user, allowedRoles) => {
    if (!user) {
      return { authorized: false, error: 'Usuario no autenticado', status: 401 };
    }

    if (!user.role) {
      return { authorized: false, error: 'Rol no asignado', status: 403 };
    }

    if (!allowedRoles.includes(user.role)) {
      return {
        authorized: false,
        error: 'No tiene permisos para esta acción',
        status: 403,
      };
    }

    return { authorized: true };
  };

  it('debería autorizar role admin', () => {
    const user = { role: 'admin' };
    const result = authorizeRole(user, ['admin', 'superadmin']);

    expect(result.authorized).toBe(true);
  });

  it('debería rechazar role no permitido', () => {
    const user = { role: 'user' };
    const result = authorizeRole(user, ['admin']);

    expect(result.authorized).toBe(false);
    expect(result.status).toBe(403);
  });

  it('debería rechazar usuario sin role', () => {
    const user = { _id: '123' };
    const result = authorizeRole(user, ['admin']);

    expect(result.authorized).toBe(false);
    expect(result.error).toContain('Rol no asignado');
  });
});

describe('Multi-Tenant Organization Filter - CRÍTICO', () => {
  const buildOrgFilter = (user) => {
    if (!user) {
      return { error: 'Usuario requerido', status: 401 };
    }

    // Superadmin puede ver todo
    if (user.role === 'superadmin') {
      return {};
    }

    // Admin de organización solo ve su org
    if (user.organizationId) {
      return { organizationId: user.organizationId };
    }

    return { error: 'Organización no asignada', status: 403 };
  };

  it('superadmin no debería tener filtro', () => {
    const user = { role: 'superadmin' };
    const filter = buildOrgFilter(user);

    expect(filter).toEqual({});
  });

  it('admin debería filtrar por organizationId', () => {
    const user = { role: 'admin', organizationId: 'org123' };
    const filter = buildOrgFilter(user);

    expect(filter.organizationId).toBe('org123');
  });

  it('debería rechazar usuario sin organización', () => {
    const user = { role: 'admin' };
    const filter = buildOrgFilter(user);

    expect(filter.error).toBeDefined();
    expect(filter.status).toBe(403);
  });
});

describe('Request Validation Middleware - IMPORTANTE', () => {
  const validateRequest = (body, schema) => {
    const errors = [];

    schema.required.forEach(field => {
      if (!body[field]) {
        errors.push(`${field} es requerido`);
      }
    });

    Object.keys(schema.types || {}).forEach(field => {
      if (body[field] !== undefined) {
        const expectedType = schema.types[field];
        const actualType = typeof body[field];

        if (actualType !== expectedType) {
          errors.push(`${field} debe ser tipo ${expectedType}`);
        }
      }
    });

    Object.keys(schema.minLength || {}).forEach(field => {
      if (body[field] && body[field].length < schema.minLength[field]) {
        errors.push(`${field} debe tener al menos ${schema.minLength[field]} caracteres`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  it('debería validar body correcto', () => {
    const body = { username: 'admin', password: 'password123' };
    const schema = {
      required: ['username', 'password'],
      types: { username: 'string', password: 'string' },
      minLength: { username: 3, password: 8 },
    };

    const result = validateRequest(body, schema);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('debería detectar campos faltantes', () => {
    const body = { username: 'admin' };
    const schema = { required: ['username', 'password'] };

    const result = validateRequest(body, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('password es requerido');
  });

  it('debería detectar tipos incorrectos', () => {
    const body = { username: 'admin', age: '25' };
    const schema = {
      required: ['username'],
      types: { age: 'number' },
    };

    const result = validateRequest(body, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('tipo number'))).toBe(true);
  });
});

describe('HTTP Error Handler - CRÍTICO', () => {
  const errorHandler = (error) => {
    const response = {
      success: false,
      error: 'Error interno del servidor',
      statusCode: 500,
    };

    // Errores de validación
    if (error.name === 'ValidationError') {
      response.error = error.message || 'Error de validación';
      response.statusCode = 400;
      return response;
    }

    // Errores de autenticación
    if (error.name === 'UnauthorizedError' || error.message?.includes('token')) {
      response.error = 'No autorizado';
      response.statusCode = 401;
      return response;
    }

    // Errores de permisos
    if (error.name === 'ForbiddenError') {
      response.error = 'Acceso denegado';
      response.statusCode = 403;
      return response;
    }

    // Recursos no encontrados
    if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
      response.error = error.message || 'Recurso no encontrado';
      response.statusCode = 404;
      return response;
    }

    // Errores de MongoDB
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      if (error.code === 11000) {
        response.error = 'Ya existe un registro con estos datos';
        response.statusCode = 409;
        return response;
      }
    }

    return response;
  };

  it('debería manejar ValidationError', () => {
    const error = { name: 'ValidationError', message: 'Datos inválidos' };
    const result = errorHandler(error);

    expect(result.statusCode).toBe(400);
    expect(result.error).toBe('Datos inválidos');
  });

  it('debería manejar UnauthorizedError', () => {
    const error = { name: 'UnauthorizedError' };
    const result = errorHandler(error);

    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('No autorizado');
  });

  it('debería manejar errores de duplicados (MongoDB)', () => {
    const error = { name: 'MongoError', code: 11000 };
    const result = errorHandler(error);

    expect(result.statusCode).toBe(409);
    expect(result.error).toContain('Ya existe');
  });

  it('debería retornar 500 para errores desconocidos', () => {
    const error = { name: 'UnknownError' };
    const result = errorHandler(error);

    expect(result.statusCode).toBe(500);
  });
});

describe('Rate Limiting - IMPORTANTE', () => {
  class RateLimiter {
    constructor(maxRequests, windowMs) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
      this.requests = new Map();
    }

    checkLimit(identifier) {
      const now = Date.now();
      const userRequests = this.requests.get(identifier) || [];

      // Limpiar requests fuera de la ventana
      const validRequests = userRequests.filter(
        timestamp => now - timestamp < this.windowMs
      );

      if (validRequests.length >= this.maxRequests) {
        return {
          allowed: false,
          error: 'Demasiadas solicitudes',
          retryAfter: this.windowMs - (now - validRequests[0]),
        };
      }

      validRequests.push(now);
      this.requests.set(identifier, validRequests);

      return {
        allowed: true,
        remaining: this.maxRequests - validRequests.length,
      };
    }
  }

  it('debería permitir requests dentro del límite', () => {
    const limiter = new RateLimiter(3, 60000); // 3 req/min

    const result1 = limiter.checkLimit('user1');
    const result2 = limiter.checkLimit('user1');
    const result3 = limiter.checkLimit('user1');

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result3.allowed).toBe(true);
  });

  it('debería bloquear después del límite', () => {
    const limiter = new RateLimiter(2, 60000);

    limiter.checkLimit('user1');
    limiter.checkLimit('user1');
    const result = limiter.checkLimit('user1');

    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Demasiadas solicitudes');
  });

  it('debería tener límites independientes por usuario', () => {
    const limiter = new RateLimiter(2, 60000);

    limiter.checkLimit('user1');
    limiter.checkLimit('user1');

    const user2Result = limiter.checkLimit('user2');
    expect(user2Result.allowed).toBe(true);
  });
});

describe('CORS Handler - IMPORTANTE', () => {
  const handleCORS = (origin, allowedOrigins) => {
    if (!origin) {
      return { allowed: true }; // Same-origin requests
    }

    if (allowedOrigins.includes('*')) {
      return { allowed: true, headers: { 'Access-Control-Allow-Origin': '*' } };
    }

    if (allowedOrigins.includes(origin)) {
      return {
        allowed: true,
        headers: { 'Access-Control-Allow-Origin': origin },
      };
    }

    return { allowed: false, error: 'Origen no permitido' };
  };

  it('debería permitir orígenes en whitelist', () => {
    const result = handleCORS('https://example.com', ['https://example.com']);
    expect(result.allowed).toBe(true);
  });

  it('debería rechazar orígenes no permitidos', () => {
    const result = handleCORS('https://malicious.com', ['https://example.com']);
    expect(result.allowed).toBe(false);
  });

  it('debería permitir wildcard', () => {
    const result = handleCORS('https://any-domain.com', ['*']);
    expect(result.allowed).toBe(true);
  });
});

describe('Input Sanitization - IMPORTANTE', () => {
  const sanitizeInput = (data) => {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = {};

    Object.keys(data).forEach(key => {
      let value = data[key];

      if (typeof value === 'string') {
        // Remove HTML tags and their content
        value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        value = value.replace(/<[^>]*>/g, '');
        // Remove SQL injection attempts
        value = value.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)/gi, '');
        // Trim whitespace
        value = value.trim();
      }

      sanitized[key] = value;
    });

    return sanitized;
  };

  it('debería remover HTML tags', () => {
    const input = { name: '<script>alert("xss")</script>Juan' };
    const result = sanitizeInput(input);

    expect(result.name).toBe('Juan');
    expect(result.name).not.toContain('<script>');
  });

  it('debería remover SQL injection', () => {
    const input = { query: "SELECT * FROM users WHERE id='1'" };
    const result = sanitizeInput(input);

    expect(result.query).not.toContain('SELECT');
  });

  it('debería limpiar espacios', () => {
    const input = { name: '  Juan  ' };
    const result = sanitizeInput(input);

    expect(result.name).toBe('Juan');
  });
});
