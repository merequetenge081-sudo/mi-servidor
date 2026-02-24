/**
 * Tests para el módulo auth.js del panel de líderes
 * @jest-environment jsdom
 */

import { AuthManager } from '../../../public/js/leader/auth.js';
import { StorageManager } from '../../../public/js/leader/utils.js';
import { jest } from '@jest/globals';

// Mock de fetch
global.fetch = jest.fn();


describe('leaderAuth', () => {
    beforeEach(() => {
        // Limpiar mocks y storage antes de cada test
        jest.clearAllMocks();
        sessionStorage.clear();
        localStorage.clear();
        AuthManager.isRedirecting = false;
        
        // Reset fetch mock
        fetch.mockReset();
        
    });

    describe('getAuthHeaders', () => {
        test('deberia incluir token en Authorization header', () => {
            StorageManager.saveToken('test-token-123');
            const headers = AuthManager.getAuthHeaders();
            
            expect(headers).toHaveProperty('Authorization');
            expect(headers.Authorization).toBe('Bearer test-token-123');
        });

        test('deberia incluir Content-Type application/json', () => {
            StorageManager.saveToken('token');
            const headers = AuthManager.getAuthHeaders();
            
            expect(headers['Content-Type']).toBe('application/json');
        });

        test('deberia funcionar con token en sessionStorage', () => {
            sessionStorage.setItem('token', 'session-token');
            const headers = AuthManager.getAuthHeaders();
            
            expect(headers.Authorization).toBe('Bearer session-token');
        });

        test('deberia funcionar con token en localStorage', () => {
            localStorage.setItem('token', 'local-token');
            const headers = AuthManager.getAuthHeaders();
            
            expect(headers.Authorization).toBe('Bearer local-token');
        });
    });

    describe('apiCall', () => {
        test('deberia hacer fetch con headers de autenticacion', async () => {
            StorageManager.saveToken('test-token');
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: 'test' })
            });

            await AuthManager.apiCall('/api/test');

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/test'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-token',
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        test('deberia combinar headers personalizados con headers de auth', async () => {
            StorageManager.saveToken('token');
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200
            });

            await AuthManager.apiCall('/api/test', {
                headers: {
                    'X-Custom-Header': 'custom-value'
                }
            });

            expect(fetch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer token',
                        'X-Custom-Header': 'custom-value'
                    })
                })
            );
        });

        test('deberia pasar opciones adicionales a fetch', async () => {
            StorageManager.saveToken('token');
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200
            });

            await AuthManager.apiCall('/api/test', {
                method: 'POST',
                body: JSON.stringify({ key: 'value' })
            });

            expect(fetch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ key: 'value' })
                })
            );
        });

        test('deberia redirigir a login en respuesta 401', async () => {
            StorageManager.saveToken('invalid-token');
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            await expect(AuthManager.apiCall('/api/test')).rejects.toThrow('Session expired');
            
            expect(AuthManager.isRedirecting).toBe(true);
            expect(StorageManager.getCurrentToken()).toBeNull();
        });

        test('deberia limpiar auth storage en respuesta 401', async () => {
            StorageManager.saveToken('invalid-token');
            StorageManager.saveLeaderId('leader-123');
            
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            try {
                await AuthManager.apiCall('/api/test');
            } catch (e) {
                // Esperamos que lance error
            }

            expect(StorageManager.getCurrentToken()).toBeNull();
            expect(StorageManager.getCurrentLeaderId()).toBeNull();
        });

        test('no deberia redirigir multiples veces en 401', async () => {
            AuthManager.isRedirecting = true;
            StorageManager.saveToken('token');
            
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 401
            });

            const response = await AuthManager.apiCall('/api/test');
            
            expect(response.status).toBe(401);
            expect(AuthManager.isRedirecting).toBe(true);
        });

        test('deberia retornar respuesta exitosa', async () => {
            StorageManager.saveToken('token');
            const mockResponse = {
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            };
            fetch.mockResolvedValueOnce(mockResponse);

            const response = await AuthManager.apiCall('/api/test');

            expect(response).toBe(mockResponse);
            expect(response.ok).toBe(true);
        });
    });

    describe('checkAuth', () => {
        test('deberia retornar true si token y leaderId existen', () => {
            StorageManager.saveToken('token');
            StorageManager.saveLeaderId('leader-id');

            const result = AuthManager.checkAuth();

            expect(result).toBe(true);
        });

        test('deberia retornar false y redirigir si no hay token', () => {
            StorageManager.saveLeaderId('leader-id');
            // No guardamos token

            const result = AuthManager.checkAuth();

            expect(result).toBe(false);
            expect(StorageManager.getCurrentLeaderId()).toBeNull();
        });

        test('deberia retornar false y redirigir si no hay leaderId', () => {
            StorageManager.saveToken('token');
            // No guardamos leaderId

            const result = AuthManager.checkAuth();

            expect(result).toBe(false);
            expect(StorageManager.getCurrentToken()).toBeNull();
        });

        test('deberia limpiar auth antes de redirigir', () => {
            StorageManager.saveToken('token');
            StorageManager.saveLeaderId('leader-id');
            localStorage.setItem('role', 'leader');
            
            // Removemos leaderId para forzar fallo
            localStorage.removeItem('leaderId');
            sessionStorage.removeItem('leaderId');

            AuthManager.checkAuth();

            expect(StorageManager.getCurrentToken()).toBeNull();
            expect(localStorage.getItem('role')).toBeNull();
        });
    });

    describe('logout', () => {
        test('deberia mostrar modal de confirmacion', () => {
            // Mock DOM
            document.body.innerHTML = '<div id="logoutModal"></div>';
            const modal = document.getElementById('logoutModal');

            AuthManager.logout();

            expect(modal.classList.contains('active')).toBe(true);
        });
    });

    describe('closeLogoutModal', () => {
        test('deberia ocultar modal de confirmacion', () => {
            // Mock DOM
            document.body.innerHTML = '<div id="logoutModal" class="active"></div>';
            const modal = document.getElementById('logoutModal');

            AuthManager.closeLogoutModal();

            expect(modal.classList.contains('active')).toBe(false);
        });
    });

    describe('confirmLogout', () => {
        test('deberia limpiar storage y redirigir', () => {
            StorageManager.saveToken('token');
            StorageManager.saveLeaderId('leader-id');

            AuthManager.confirmLogout();

            expect(StorageManager.getCurrentToken()).toBeNull();
            expect(StorageManager.getCurrentLeaderId()).toBeNull();
            expect(AuthManager.isRedirecting).toBe(true);
        });
    });
});
