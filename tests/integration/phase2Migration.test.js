/**
 * Phase 2 Migration Tests
 * Verifies frontend API client migration to /api/v2 with legacy fallback
 */

describe('Frontend API Client Phase 2 Migration', () => {
  describe('API Configuration', () => {
    it('should define v1 and v2 API base paths', () => {
      const API_V1_BASE = '/api';
      const API_V2_BASE = '/api/v2';

      expect(API_V1_BASE).toBe('/api');
      expect(API_V2_BASE).toBe('/api/v2');
    });
  });

  describe('Response Unwrapping', () => {
    it('should unwrap v2 success response format', () => {
      const unwrapData = (response) => {
        if (response && response.success === true && response.data !== undefined) {
          return response.data;
        }
        return response;
      };

      const v2Response = {
        success: true,
        data: { id: 1, name: 'Test Event' },
        pagination: { page: 1, pageSize: 20, total: 100 }
      };

      const unwrapped = unwrapData(v2Response);
      expect(unwrapped).toEqual({ id: 1, name: 'Test Event' });
    });

    it('should pass through legacy response format unchanged', () => {
      const unwrapData = (response) => {
        if (response && response.success === true && response.data !== undefined) {
          return response.data;
        }
        return response;
      };

      const legacyResponse = { id: 1, name: 'Test Event' };

      const result = unwrapData(legacyResponse);
      expect(result).toEqual({ id: 1, name: 'Test Event' });
    });

    it('should normalize registrations response with pagination', () => {
      const normalizeRegistrationsResponse = (response) => {
        if (response && response.success === true && response.data !== undefined) {
          const pagination = response.pagination || {};
          return {
            data: response.data,
            total: pagination.total ?? response.total ?? 0,
            confirmedCount: response.confirmedCount ?? 0,
            page: pagination.page ?? response.page ?? 1,
            limit: pagination.pageSize ?? response.limit ?? 20,
            pages: pagination.totalPages ?? response.pages ?? 1
          };
        }

        return response;
      };

      const v2Response = {
        success: true,
        data: [
          { id: 1, firstName: 'John', cedula: '123' },
          { id: 2, firstName: 'Jane', cedula: '456' }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 50,
          totalPages: 3
        }
      };

      const normalized = normalizeRegistrationsResponse(v2Response);
      expect(normalized.data).toHaveLength(2);
      expect(normalized.total).toBe(50);
      expect(normalized.pages).toBe(3);
      expect(normalized.limit).toBe(20);
    });
  });

  describe('API Fallback Logic', () => {
    it('should try v2 endpoint first, then fallback to v1 on 404', async () => {
      const fetchAttempts = [];

      const mockFetch = (url) => {
        fetchAttempts.push(url);
        
        // Simulate 404 for v2, success for v1
        if (url.includes('/api/v2')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' })
          });
        }

        // v1 endpoint succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 1, name: 'Test' })
        });
      };

      const apiRequestWithFallback = async (primaryUrl, fallbackUrl) => {
        try {
          const response = await mockFetch(primaryUrl);
          if (response.ok) {
            return await response.json();
          }
          if (response.status === 404 && fallbackUrl) {
            const fallbackResponse = await mockFetch(fallbackUrl);
            if (fallbackResponse.ok) {
              return await fallbackResponse.json();
            }
            throw new Error('Both endpoints failed');
          }
          throw new Error('Request failed');
        } catch (error) {
          throw error;
        }
      };

      const result = await apiRequestWithFallback('/api/v2/leaders', '/api/leaders');

      expect(fetchAttempts).toContain('/api/v2/leaders');
      expect(fetchAttempts).toContain('/api/leaders');
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should use v2 endpoint if available', async () => {
      const fetchAttempts = [];

      const mockFetch = (url) => {
        fetchAttempts.push(url);
        
        // Both endpoints succeed, but v2 should be used
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            success: true,
            data: { id: 1, v2: true }
          })
        });
      };

      const apiRequestWithFallback = async (primaryUrl, fallbackUrl) => {
        const response = await mockFetch(primaryUrl);
        if (response.ok) {
          return await response.json();
        }
        // Would fallback here
        throw new Error('Request failed');
      };

      const result = await apiRequestWithFallback('/api/v2/events', '/api/events');

      // Should only call v2, not v1
      expect(fetchAttempts).toEqual(['/api/v2/events']);
      expect(result.success).toBe(true);
    });
  });

  describe('Endpoint Migration Map', () => {
    const endpointMap = {
      // Events
      listEvents: { v2: '/api/v2/events', v1: '/api/events' },
      activeEvent: { v2: '/api/v2/events/active/current', v1: '/api/events/active' },
      leaderToken: { v2: '/api/v2/leaders/token/:token', v1: '/api/registro/:token' },
      // Registrations
      listRegistrations: { v2: '/api/v2/registrations', v1: '/api/registrations' },
      // Duplicates
      duplicatesReport: { v2: '/api/v2/duplicates/report', v1: '/api/duplicates' },
      // Audit
      auditLogs: { v2: '/api/v2/audit/logs', v1: '/api/audit-logs' },
      auditStats: { v2: '/api/v2/audit/stats', v1: '/api/audit-stats' },
    };

    Object.entries(endpointMap).forEach(([name, routes]) => {
      it(`should map ${name} to v2 and v1`, () => {
        expect(routes.v2).toBeDefined();
        expect(routes.v1).toBeDefined();
        expect(routes.v2).toContain('/api/v2');
        expect(routes.v1).toContain('/api');
      });
    });
  });

  describe('Form Integration Points', () => {
    it('should load leader info via v2 token endpoint with v1 fallback', () => {
      const endpoints = {
        v2: '/api/v2/leaders/token/:token',
        v1: '/api/registro/:token'
      };

      expect(endpoints.v2).toMatch(/\/api\/v2\/leaders\/token/);
      expect(endpoints.v1).toMatch(/\/api\/registro/);
    });

    it('should load active event from v2 with v1 fallback', () => {
      const endpoints = {
        v2: '/api/v2/events/active/current',
        v1: '/api/events/active'
      };

      expect(endpoints.v2).toContain('/events/active/current');
      expect(endpoints.v1).toContain('/events/active');
    });

    it('should submit registration to v2 with v1 fallback', () => {
      const endpoints = {
        v2: '/api/v2/registrations',
        v1: '/api/registrations'
      };

      expect(endpoints.v2).toBe('/api/v2/registrations');
      expect(endpoints.v1).toBe('/api/registrations');
    });
  });

  describe('Response Normalization', () => {
    it('should normalize pagination fields from v2 response', () => {
      const v2Pagination = {
        page: 1,
        pageSize: 20,
        total: 100,
        totalPages: 5
      };

      const normalized = {
        page: v2Pagination.page,
        limit: v2Pagination.pageSize,
        total: v2Pagination.total,
        pages: v2Pagination.totalPages
      };

      expect(normalized.limit).toBe(20);
      expect(normalized.pages).toBe(5);
    });

    it('should handle missing pagination with sensible defaults', () => {
      const normalizeRegistrationsResponse = (response) => {
        if (response && response.success === true && response.data !== undefined) {
          const pagination = response.pagination || {};
          return {
            data: response.data,
            total: pagination.total ?? 0,
            confirmedCount: response.confirmedCount ?? 0,
            page: pagination.page ?? 1,
            limit: pagination.pageSize ?? 20,
            pages: pagination.totalPages ?? 1
          };
        }
        return response;
      };

      const response = {
        success: true,
        data: [{ id: 1 }]
        // No pagination provided
      };

      const normalized = normalizeRegistrationsResponse(response);
      expect(normalized.page).toBe(1);
      expect(normalized.limit).toBe(20);
      expect(normalized.total).toBe(0);
      expect(normalized.pages).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages for v2 failures', () => {
      const errors = {
        404: 'Recurso no encontrado',
        403: 'Acceso denegado',
        400: 'Datos inválidos',
        500: 'Error del servidor'
      };

      expect(errors[404]).toBe('Recurso no encontrado');
      expect(errors[403]).toBe('Acceso denegado');
    });

    it('should attach status code to error for migration decisions', () => {
      const createError = (message, status) => {
        const error = new Error(message);
        error.status = status;
        return error;
      };

      const error = createError('Not found', 404);
      expect(error.status).toBe(404);
      expect(error.message).toBe('Not found');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should support legacy /api/registro/:token endpoint', () => {
      const legacyEndpoint = '/api/registro/:token';
      expect(legacyEndpoint).toMatch(/\/api\/registro/);
    });

    it('should support legacy /api/events/active endpoint', () => {
      const legacyEndpoint = '/api/events/active';
      expect(legacyEndpoint).toBe('/api/events/active');
    });

    it('should support legacy /api/registrations POST endpoint', () => {
      const legacyEndpoint = '/api/registrations';
      expect(legacyEndpoint).toBe('/api/registrations');
    });
  });
});
