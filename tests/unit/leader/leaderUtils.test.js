/**
 * Tests para el módulo utils.js del panel de líderes
 * @jest-environment jsdom
 */

import { 
    BOGOTA_LOCALIDADES, 
    CAPITALES_COLOMBIA, 
    StorageManager,
    normalizePuestoTexto,
    buildPuestoSearchText,
    formatDate,
    escapeHtml 
} from '../../../public/js/leader/utils.js';

describe('leaderUtils', () => {
    describe('Constantes', () => {
        test('BOGOTA_LOCALIDADES deberia contener 20 localidades', () => {
            expect(BOGOTA_LOCALIDADES).toHaveLength(20);
            expect(BOGOTA_LOCALIDADES).toContain('Usaquén');
            expect(BOGOTA_LOCALIDADES).toContain('Suba');
            expect(BOGOTA_LOCALIDADES).toContain('Kennedy');
        });

        test('CAPITALES_COLOMBIA deberia mapear departamentos a capitales', () => {
            expect(CAPITALES_COLOMBIA['Antioquia']).toBe('Medellín');
            expect(CAPITALES_COLOMBIA['Cundinamarca']).toBe('Bogotá');
            expect(CAPITALES_COLOMBIA['Valle del Cauca']).toBe('Cali');
            expect(Object.keys(CAPITALES_COLOMBIA)).toHaveLength(32);
        });
    });

    describe('StorageManager', () => {
        beforeEach(() => {
            // Limpiar storage antes de cada test
            sessionStorage.clear();
            localStorage.clear();
        });

        test('getCurrentToken deberia retornar token de sessionStorage primero', () => {
            sessionStorage.setItem('token', 'session-token');
            localStorage.setItem('token', 'local-token');
            expect(StorageManager.getCurrentToken()).toBe('session-token');
        });

        test('getCurrentToken deberia retornar token de localStorage si no hay en session', () => {
            localStorage.setItem('token', 'local-token');
            expect(StorageManager.getCurrentToken()).toBe('local-token');
        });

        test('getCurrentLeaderId deberia retornar leaderId de sessionStorage primero', () => {
            sessionStorage.setItem('leaderId', 'session-id');
            localStorage.setItem('leaderId', 'local-id');
            expect(StorageManager.getCurrentLeaderId()).toBe('session-id');
        });

        test('saveToken deberia guardar en ambos storages', () => {
            StorageManager.saveToken('test-token');
            expect(sessionStorage.getItem('token')).toBe('test-token');
            expect(localStorage.getItem('token')).toBe('test-token');
        });

        test('saveLeaderId deberia guardar en ambos storages', () => {
            StorageManager.saveLeaderId('test-id');
            expect(sessionStorage.getItem('leaderId')).toBe('test-id');
            expect(localStorage.getItem('leaderId')).toBe('test-id');
        });

        test('clearAuth deberia limpiar todos los datos de autenticacion', () => {
            localStorage.setItem('token', 'token');
            localStorage.setItem('leaderId', 'id');
            localStorage.setItem('role', 'leader');
            localStorage.setItem('username', 'user');
            sessionStorage.setItem('token', 'token');
            sessionStorage.setItem('leaderId', 'id');
            sessionStorage.setItem('role', 'leader');
            sessionStorage.setItem('username', 'user');

            StorageManager.clearAuth();

            expect(localStorage.getItem('token')).toBeNull();
            expect(localStorage.getItem('leaderId')).toBeNull();
            expect(localStorage.getItem('role')).toBeNull();
            expect(localStorage.getItem('username')).toBeNull();
            expect(sessionStorage.getItem('token')).toBeNull();
            expect(sessionStorage.getItem('leaderId')).toBeNull();
            expect(sessionStorage.getItem('role')).toBeNull();
            expect(sessionStorage.getItem('username')).toBeNull();
        });
    });

    describe('normalizePuestoTexto', () => {
        test('deberia normalizar texto removiendo acentos', () => {
            expect(normalizePuestoTexto('José García')).toBe('jose garcia');
            expect(normalizePuestoTexto('María Ángel')).toBe('maria angel');
        });

        test('deberia convertir a minusculas', () => {
            expect(normalizePuestoTexto('PUESTO DE VOTACIÓN')).toBe('puesto de votacion');
        });

        test('deberia remover caracteres especiales excepto espacios', () => {
            expect(normalizePuestoTexto('Puesto #123-A')).toBe('puesto 123 a');
            expect(normalizePuestoTexto('Col. San José (Norte)')).toBe('col san jose norte');
        });

        test('deberia normalizar espacios multiples a uno solo', () => {
            expect(normalizePuestoTexto('Puesto   con    espacios')).toBe('puesto con espacios');
        });

        test('deberia manejar valores nulos o undefined', () => {
            expect(normalizePuestoTexto(null)).toBe('');
            expect(normalizePuestoTexto(undefined)).toBe('');
            expect(normalizePuestoTexto('')).toBe('');
        });

        test('deberia mantener numeros', () => {
            expect(normalizePuestoTexto('Puesto 123ABC')).toBe('puesto 123abc');
        });
    });

    describe('buildPuestoSearchText', () => {
        test('deberia combinar nombre, codigo y aliases del puesto', () => {
            const puesto = {
                nombre: 'Colegio San José',
                codigoPuesto: '001',
                aliases: ['Col. San José', 'San José']
            };
            const result = buildPuestoSearchText(puesto);
            expect(result).toContain('colegio san jose');
            expect(result).toContain('001');
            expect(result).toContain('col san jose');
        });

        test('deberia manejar puesto sin aliases', () => {
            const puesto = {
                nombre: 'Escuela Central',
                codigoPuesto: '002'
            };
            const result = buildPuestoSearchText(puesto);
            expect(result).toContain('escuela central');
            expect(result).toContain('002');
        });

        test('deberia manejar puesto sin codigo', () => {
            const puesto = {
                nombre: 'Instituto Nacional',
                aliases: ['Instituto']
            };
            const result = buildPuestoSearchText(puesto);
            expect(result).toContain('instituto nacional');
            expect(result).toContain('instituto');
        });

        test('deberia normalizar todo el texto', () => {
            const puesto = {
                nombre: 'José García',
                codigoPuesto: 'ABC-123',
                aliases: ['García']
            };
            const result = buildPuestoSearchText(puesto);
            expect(result).toBe('jose garcia abc 123 garcia');
        });
    });

    describe('formatDate', () => {
        test('deberia formatear fecha en formato colombiano', () => {
            const date = new Date('2024-03-15T10:30:00');
            const formatted = formatDate(date);
            // El formato exacto puede variar según la configuración local,
            // pero debe contener los componentes de la fecha
            expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
        });

        test('deberia manejar string de fecha ISO', () => {
            const formatted = formatDate('2024-12-25T00:00:00Z');
            expect(formatted).toBeTruthy();
            expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
        });
    });

    describe('escapeHtml', () => {
        test('deberia escapar < y >', () => {
            expect(escapeHtml('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
        });

        test('deberia escapar & (ampersand)', () => {
            expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        test('deberia manejar comillas (textContent no las escapa)', () => {
            // Nota: textContent no escapa comillas, solo <, >, &
            expect(escapeHtml('"quoted"')).toBe('"quoted"');
        });

        test('deberia manejar texto sin caracteres especiales', () => {
            expect(escapeHtml('Normal text 123')).toBe('Normal text 123');
        });

        test('deberia manejar texto vacio', () => {
            expect(escapeHtml('')).toBe('');
        });

        test('deberia prevenir inyeccion de HTML', () => {
            const malicious = '<img src=x onerror=alert(1)>';
            const escaped = escapeHtml(malicious);
            expect(escaped).not.toContain('<img');
            expect(escaped).toContain('&lt;img');
        });
    });
});
