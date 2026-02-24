/**
 * Unit Tests: leaderImport module
 * Pruebas para el mapeo de filas importadas en el panel del lider
 */

import { mapImportRow, mapImportRows } from '../../../public/js/modules/leaderImport.js';

describe('leaderImport', () => {
  it('deberia mapear una fila con llaves principales', () => {
    const row = {
      Nombre: 'Juan',
      Apellido: 'Perez',
      Cédula: '123',
      Email: 'juan@example.com',
      Celular: '300123',
      Mesa: '10',
      Localidad: 'Suba',
      'Puesto Votación': 'Colegio Central'
    };

    expect(mapImportRow(row)).toEqual({
      firstName: 'Juan',
      lastName: 'Perez',
      cedula: '123',
      email: 'juan@example.com',
      phone: '300123',
      votingTable: '10',
      localidad: 'Suba',
      votingPlace: 'Colegio Central'
    });
  });

  it('deberia mapear una fila con llaves alternativas', () => {
    const row = {
      Nombre: 'Ana',
      Apellido: 'Lopez',
      Cedula: '456',
      Email: 'ana@example.com',
      Telefono: '301456',
      Mesa: '5',
      Localidad: 'Usaquen',
      'Puesto Votacion': 'Universidad Central'
    };

    const mapped = mapImportRow(row);
    expect(mapped.cedula).toBe('456');
    expect(mapped.phone).toBe('301456');
    expect(mapped.votingPlace).toBe('Universidad Central');
  });

  it('deberia mapear multiples filas', () => {
    const rows = [
      { Nombre: 'Carlos', Apellido: 'Diaz', Cedula: '111' },
      { Nombre: 'Maria', Apellido: 'Gomez', Cédula: '222' }
    ];

    const mapped = mapImportRows(rows);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].cedula).toBe('111');
    expect(mapped[1].cedula).toBe('222');
  });

  it('deberia retornar array vacio si rows no es array', () => {
    expect(mapImportRows(null)).toEqual([]);
    expect(mapImportRows(undefined)).toEqual([]);
  });
});
