/**
 * Tests para el módulo registrations.js del panel de líderes
 * @jest-environment jsdom
 */

import { RegistrationsManager } from '../../../public/js/leader/registrations.js';
import { AuthManager } from '../../../public/js/leader/auth.js';
import { jest } from '@jest/globals';

// Mock de AuthManager.apiCall
AuthManager.apiCall = jest.fn();

describe('leaderRegistrations', () => {
    beforeEach(() => {
        // Reset del estado del manager
        RegistrationsManager.myRegistrations = [];
        RegistrationsManager.filteredRegistrations = [];
        RegistrationsManager.currentPage = 1;
        RegistrationsManager.itemsPerPage = 10;
        
        jest.clearAllMocks();
    });

    describe('parseRegistrationsResponse', () => {
        test('deberia retornar array directamente si es array', () => {
            const data = [{ id: 1 }, { id: 2 }];
            const result = RegistrationsManager.parseRegistrationsResponse(data);
            
            expect(result).toEqual(data);
            expect(Array.isArray(result)).toBe(true);
        });

        test('deberia extraer data.registrations si existe', () => {
            const data = {
                registrations: [{ id: 1 }, { id: 2 }]
            };
            const result = RegistrationsManager.parseRegistrationsResponse(data);
            
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        test('deberia extraer data.data si existe', () => {
            const data = {
                data: [{ id: 1 }, { id: 2 }]
            };
            const result = RegistrationsManager.parseRegistrationsResponse(data);
            
            expect(result).toEqual([{ id: 1 }, { id: 2 }]);
        });

        test('deberia retornar array vacio si no es formato valido', () => {
            expect(RegistrationsManager.parseRegistrationsResponse(null)).toEqual([]);
            expect(RegistrationsManager.parseRegistrationsResponse({})).toEqual([]);
            expect(RegistrationsManager.parseRegistrationsResponse('string')).toEqual([]);
            expect(RegistrationsManager.parseRegistrationsResponse(123)).toEqual([]);
        });

        test('deberia priorizar array directo sobre propiedades', () => {
            // Si pasamos un array con propiedades adicionales
            const data = [{ id: 1 }];
            data.registrations = [{ id: 999 }];
            
            const result = RegistrationsManager.parseRegistrationsResponse(data);
            expect(result).toBe(data);
            expect(result[0]).toEqual({ id: 1 });
        });
    });

    describe('loadRegistrations', () => {
        test('deberia cargar registros del API correctamente', async () => {
            const mockRegistrations = [
                { _id: '1', leaderId: 'leader-123', firstName: 'Juan' },
                { _id: '2', leaderId: 'leader-123', firstName: 'María' },
                { _id: '3', leaderId: 'leader-456', firstName: 'Pedro' }
            ];

            AuthManager.apiCall.mockResolvedValueOnce({
                ok: true,
                json: async () => mockRegistrations
            });

            const result = await RegistrationsManager.loadRegistrations('leader-123');

            expect(AuthManager.apiCall).toHaveBeenCalledWith(
                '/api/registrations?leaderId=leader-123&limit=10000'
            );
            expect(result).toHaveLength(2); // Solo los del líder 123
            expect(result[0].firstName).toBe('Juan');
            expect(result[1].firstName).toBe('María');
        });

        test('deberia filtrar registros por leaderId', async () => {
            const mockRegistrations = [
                { _id: '1', leaderId: 'leader-A', firstName: 'Juan' },
                { _id: '2', leaderId: 'leader-B', firstName: 'María' },
                { _id: '3', leaderId: 'leader-A', firstName: 'Pedro' }
            ];

            AuthManager.apiCall.mockResolvedValueOnce({
                ok: true,
                json: async () => mockRegistrations
            });

            const result = await RegistrationsManager.loadRegistrations('leader-A');

            expect(result).toHaveLength(2);
            expect(result.every(r => r.leaderId === 'leader-A')).toBe(true);
        });

        test('deberia inicializar filteredRegistrations con todos los registros', async () => {
            const mockRegistrations = [
                { _id: '1', leaderId: 'leader-123', firstName: 'Juan' }
            ];

            AuthManager.apiCall.mockResolvedValueOnce({
                ok: true,
                json: async () => mockRegistrations
            });

            await RegistrationsManager.loadRegistrations('leader-123');

            expect(RegistrationsManager.filteredRegistrations).toEqual(
                RegistrationsManager.myRegistrations
            );
        });

        test('deberia resetear currentPage a 1', async () => {
            RegistrationsManager.currentPage = 5;

            AuthManager.apiCall.mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            await RegistrationsManager.loadRegistrations('leader-123');

            expect(RegistrationsManager.currentPage).toBe(1);
        });

        test('deberia manejar respuesta con formato data.registrations', async () => {
            const mockResponse = {
                registrations: [
                    { _id: '1', leaderId: 'leader-123', firstName: 'Juan' }
                ]
            };

            AuthManager.apiCall.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await RegistrationsManager.loadRegistrations('leader-123');

            expect(result).toHaveLength(1);
            expect(result[0].firstName).toBe('Juan');
        });

        test('deberia lanzar error si el API falla', async () => {
            AuthManager.apiCall.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            await expect(
                RegistrationsManager.loadRegistrations('leader-123')
            ).rejects.toThrow('Error al cargar registros');
        });

        test('deberia manejar errores de red', async () => {
            AuthManager.apiCall.mockRejectedValueOnce(new Error('Network error'));

            await expect(
                RegistrationsManager.loadRegistrations('leader-123')
            ).rejects.toThrow('Network error');
        });
    });

    describe('checkRevisionPendiente', () => {
        beforeEach(() => {
            // Mock del DOM
            document.body.innerHTML = '<div id="alertaRevision"></div>';
        });

        test('deberia retornar registros que requieren revision', () => {
            RegistrationsManager.myRegistrations = [
                { id: '1', requiereRevisionPuesto: true, revisionPuestoResuelta: false },
                { id: '2', requiereRevisionPuesto: false },
                { id: '3', requiereRevisionPuesto: true, revisionPuestoResuelta: true },
                { id: '4', requiereRevisionPuesto: true, revisionPuestoResuelta: false }
            ];

            const result = RegistrationsManager.checkRevisionPendiente();

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('4');
        });

        test('deberia mostrar alerta si hay revisiones pendientes', () => {
            const alertaDiv = document.getElementById('alertaRevision');
            RegistrationsManager.myRegistrations = [
                { id: '1', requiereRevisionPuesto: true, revisionPuestoResuelta: false }
            ];

            RegistrationsManager.checkRevisionPendiente();

            expect(alertaDiv.style.display).toBe('flex');
        });

        test('deberia ocultar alerta si no hay revisiones pendientes', () => {
            const alertaDiv = document.getElementById('alertaRevision');
            RegistrationsManager.myRegistrations = [
                { id: '1', requiereRevisionPuesto: false }
            ];

            RegistrationsManager.checkRevisionPendiente();

            expect(alertaDiv.style.display).toBe('none');
        });

        test('deberia retornar array vacio si no hay revisiones pendientes', () => {
            RegistrationsManager.myRegistrations = [
                { id: '1', requiereRevisionPuesto: false },
                { id: '2', revisionPuestoResuelta: true }
            ];

            const result = RegistrationsManager.checkRevisionPendiente();

            expect(result).toHaveLength(0);
        });
    });

    describe('filtrarRegistrosRevision', () => {
        test('deberia filtrar solo registros con revision pendiente', () => {
            RegistrationsManager.myRegistrations = [
                { id: '1', requiereRevisionPuesto: true, revisionPuestoResuelta: false },
                { id: '2', requiereRevisionPuesto: false },
                { id: '3', requiereRevisionPuesto: true, revisionPuestoResuelta: true },
                { id: '4', requiereRevisionPuesto: true, revisionPuestoResuelta: false }
            ];

            const result = RegistrationsManager.filtrarRegistrosRevision();

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('4');
        });

        test('deberia actualizar filteredRegistrations', () => {
            RegistrationsManager.myRegistrations = [
                { id: '1', requiereRevisionPuesto: true, revisionPuestoResuelta: false },
                { id: '2', requiereRevisionPuesto: false }
            ];

            RegistrationsManager.filtrarRegistrosRevision();

            expect(RegistrationsManager.filteredRegistrations).toHaveLength(1);
            expect(RegistrationsManager.filteredRegistrations[0].id).toBe('1');
        });

        test('deberia resetear currentPage a 1', () => {
            RegistrationsManager.currentPage = 5;
            RegistrationsManager.myRegistrations = [];

            RegistrationsManager.filtrarRegistrosRevision();

            expect(RegistrationsManager.currentPage).toBe(1);
        });
    });

    describe('renderRegistrations', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <table>
                    <tbody id="registrationsTableBody"></tbody>
                </table>
            `;
        });

        test('deberia mostrar mensaje cuando no hay registros', () => {
            RegistrationsManager.filteredRegistrations = [];
            
            // Mock de updatePagination
            const updatePaginationSpy = jest.spyOn(RegistrationsManager, 'updatePagination').mockImplementation(() => {});

            RegistrationsManager.renderRegistrations();

            const tbody = document.getElementById('registrationsTableBody');
            expect(tbody.innerHTML).toContain('No hay registros para mostrar');
            expect(tbody.innerHTML).toContain('bi-inbox');

            updatePaginationSpy.mockRestore();
        });

        test('deberia paginar correctamente los registros', () => {
            // Crear 25 registros
            RegistrationsManager.filteredRegistrations = Array.from({ length: 25 }, (_, i) => ({
                _id: `id-${i}`,
                firstName: `Nombre${i}`,
                lastName: `Apellido${i}`,
                email: `email${i}@test.com`,
                cedula: `${1000 + i}`,
                localidad: 'Kennedy',
                votingPlace: 'Puesto 1',
                confirmed: false
            }));
            RegistrationsManager.currentPage = 1;
            RegistrationsManager.itemsPerPage = 10;

            // Mock de renderRow y updatePagination
            const renderRowSpy = jest.spyOn(RegistrationsManager, 'renderRow').mockImplementation((reg) => `<tr><td>${reg.firstName}</td></tr>`);
            const updatePaginationSpy = jest.spyOn(RegistrationsManager, 'updatePagination').mockImplementation(() => {});

            RegistrationsManager.renderRegistrations();

            // Debería renderizar 10 items (página 1)
            expect(renderRowSpy).toHaveBeenCalledTimes(10);

            renderRowSpy.mockRestore();
            updatePaginationSpy.mockRestore();
        });

        test('deberia mostrar segunda pagina correctamente', () => {
            RegistrationsManager.filteredRegistrations = Array.from({ length: 25 }, (_, i) => ({
                _id: `id-${i}`,
                firstName: `Nombre${i}`,
                lastName: `Apellido${i}`,
                email: `email${i}@test.com`,
                cedula: `${1000 + i}`,
                localidad: 'Kennedy',
                votingPlace: 'Puesto 1',
                confirmed: false
            }));
            RegistrationsManager.currentPage = 2;
            RegistrationsManager.itemsPerPage = 10;

            const renderRowSpy = jest.spyOn(RegistrationsManager, 'renderRow').mockImplementation((reg) => `<tr><td>${reg.firstName}</td></tr>`);
            const updatePaginationSpy = jest.spyOn(RegistrationsManager, 'updatePagination').mockImplementation(() => {});

            RegistrationsManager.renderRegistrations();

            // Segunda página,Items 10-19
            expect(renderRowSpy).toHaveBeenCalledTimes(10);
            expect(renderRowSpy).toHaveBeenCalledWith(
                expect.objectContaining({ firstName: 'Nombre10' })
            );

            renderRowSpy.mockRestore();
            updatePaginationSpy.mockRestore();
        });
    });

    describe('renderRow', () => {
        test('deberia renderizar registro confirmado', () => {
            const reg = {
                _id: 'reg-1',
                firstName: 'Juan',
                lastName: 'Pérez',
                email: 'juan@test.com',
                cedula: '123456789',
                localidad: 'Kennedy',
                votingPlace: 'Colegio San José',
                votingTable: '001',
                date: '2024-01-15T10:00:00',
                confirmed: true,
                requiereRevisionPuesto: false
            };

            const html = RegistrationsManager.renderRow(reg);

            expect(html).toContain('<tr>');
            expect(html).toContain('Juan');
            expect(html).toContain('Pérez');
            expect(html).toContain('juan@test.com');
            expect(html).toContain('Confirmado');
            expect(html).toContain('badge-success');
        });

        test('deberia renderizar registro pendiente', () => {
            const reg = {
                _id: 'reg-2',
                firstName: 'María',
                lastName: 'García',
                email: 'maria@test.com',
                cedula: '987654321',
                localidad: 'Suba',
                votingPlace: 'Escuela Central',
                votingTable: '002',
                date: '2024-01-16T11:00:00',
                confirmed: false,
                requiereRevisionPuesto: false
            };

            const html = RegistrationsManager.renderRow(reg);

            expect(html).toContain('<tr>');
            expect(html).toContain('María');
            expect(html).toContain('García');
            expect(html).toContain('Pendiente');
            expect(html).toContain('badge-warning');
        });

        test('deberia mostrar badge de revision si requiere revision', () => {
            const reg = {
                _id: 'reg-3',
                firstName: 'Pedro',
                lastName: 'López',
                email: 'pedro@test.com',
                cedula: '111222333',
                localidad: 'Usaquén',
                votingPlace: 'Instituto',
                votingTable: '003',
                date: '2024-01-17T12:00:00',
                confirmed: false,
                requiereRevisionPuesto: true,
                revisionPuestoResuelta: false
            };

            const html = RegistrationsManager.renderRow(reg);

            expect(html).toContain('<tr>');
            expect(html).toContain('Pedro');
            expect(html).toContain('Revisar puesto');
            expect(html).toContain('badge-revision');
        });

        test('no deberia mostrar badge de revision si ya fue resuelta', () => {
            const reg = {
                _id: 'reg-4',
                firstName: 'Ana',
                lastName: 'Martínez',
                email: 'ana@test.com',
                cedula: '444555666',
                localidad: 'Chapinero',
                votingPlace: 'Colegio',
                votingTable: '004',
                date: '2024-01-18T13:00:00',
                confirmed: true,
                requiereRevisionPuesto: true,
                revisionPuestoResuelta: true
            };

            const html = RegistrationsManager.renderRow(reg);

            expect(html).not.toContain('Revisar puesto');
            expect(html).not.toContain('badge-revision');
        });
    });
});
