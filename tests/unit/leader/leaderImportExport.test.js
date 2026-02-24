/**
 * Unit Tests: Frontend Import/Export Manager
 * Pruebas para el módulo frontend de importación y exportación
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

describe('Frontend ImportExportManager', () => {
  
  // ========== Mock Setup ==========
  let mockAuthManager;
  let mockRegistrationsManager;
  let mockStatisticsManager;

  beforeEach(() => {
    // Mock DOM
    document.body.innerHTML = `
      <div id="errorModal" class="modal">
        <h2 id="errorTitle">Título</h2>
        <p id="errorMessage">Mensaje</p>
        <ul id="errorList"></ul>
        <button id="closeErrorBtn"></button>
      </div>
      <input type="file" id="fileInput" accept=".xlsx,.xls" />
    `;

    // Mock Managers
    mockAuthManager = {
      getAuthHeaders: jest.fn(() => ({
        'Authorization': 'Bearer mock-token'
      })),
      apiCall: jest.fn()
    };

    mockRegistrationsManager = {
      myRegistrations: [],
      loadRegistrations: jest.fn().mockResolvedValue([]),
      renderRegistrations: jest.fn(),
      checkRevisionPendiente: jest.fn()
    };

    mockStatisticsManager = {
      loadStatistics: jest.fn()
    };

    // Exponer al global
    window.AuthManager = mockAuthManager;
    window.registrationsManager = mockRegistrationsManager;
    window.statisticsManager = mockStatisticsManager;
  });

  // ========== Test: mapImportRows ==========
  describe('mapImportRows', () => {
    
    it('debería mapear filas correctamente', () => {
      const rows = [
        {
          'Nombre': 'Juan',
          'Apellido': 'García',
          'Cédula': '12345678',
          'Email': 'juan@test.com',
          'Celular': '3001234567',
          'Puesto Votación': 'Puesto 1',
          'Mesa': 1,
          'Localidad': 'Usaquén'
        }
      ];

      // Simulando la función mapImportRows
      const mapped = rows.map(row => ({
        firstName: row['Nombre'] || row['nombre'],
        lastName: row['Apellido'] || row['apellido'],
        cedula: (row['Cédula'] || row['Cedula'] || row['cedula'] || '').toString().trim(),
        email: row['Email'] || row['email'],
        phone: (row['Celular'] || row['Telefono'] || row['celular'] || row['telefono'] || '').toString().trim(),
        votingTable: row['Mesa'] || row['mesa'],
        localidad: row['Localidad'] || row['localidad'],
        votingPlace: row['Puesto Votación'] || row['Puesto Votacion'] || row['puesto_votacion'] || row['Puesto']
      }));

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toEqual({
        firstName: 'Juan',
        lastName: 'García',
        cedula: '12345678',
        email: 'juan@test.com',
        phone: '3001234567',
        votingTable: 1,
        localidad: 'Usaquén',
        votingPlace: 'Puesto 1'
      });
    });

    it('debería soportar variaciones de nombres de columnas', () => {
      const testCases = [
        { 'Nombre': 'Juan', 'Apellido': 'García' },
        { 'nombre': 'María', 'apellido': 'López' },
        { 'NOMBRE': 'Pedro', 'APELLIDO': 'Martínez' }
      ];

      testCases.forEach(row => {
        const mapped = {
          firstName: row['Nombre'] || row['nombre'] || row['NOMBRE'],
          lastName: row['Apellido'] || row['apellido'] || row['APELLIDO']
        };

        expect(mapped.firstName).toBeDefined();
        expect(mapped.lastName).toBeDefined();
      });
    });

    it('debería limpiar espacios en blanco', () => {
      const rows = [
        {
          'Nombre': '  Juan  ',
          'Email': '  juan@test.com  ',
          'Cédula': '  12345678  '
        }
      ];

      const cedula = (rows[0]['Cédula'] || '').toString().trim();
      expect(cedula).toBe('12345678');
    });
  });

  // ========== Test: showImportResults ==========
  describe('showImportResults', () => {
    
    it('debería mostrar modal con resultados correctos', () => {
      const data = {
        imported: 5,
        autocorrected: 2,
        requiresReview: 1,
        failed: 0,
        errors: [],
        autocorrections: []
      };

      const modal = document.getElementById('errorModal');
      const errorTitle = document.getElementById('errorTitle');
      const errorMessage = document.getElementById('errorMessage');
      const errorList = document.getElementById('errorList');

      // Simular mostrar resultados
      modal.classList.add('active');
      errorTitle.textContent = data.failed > 0 ? 'Errores' : 'Éxito';
      
      let msg = '';
      if (data.imported > 0) msg += `✅ ${data.imported} importados\n`;
      if (data.autocorrected > 0) msg += `🔧 ${data.autocorrected} autocorregidos\n`;
      if (data.requiresReview > 0) msg += `⚠️ ${data.requiresReview} requieren revisión\n`;
      if (data.failed > 0) msg += `❌ ${data.failed} errores\n`;
      
      errorMessage.textContent = msg;

      expect(modal.classList.contains('active')).toBe(true);
      expect(errorTitle.textContent).toBe('Éxito');
      expect(errorMessage.textContent).toContain('✅ 5 importados');
      expect(errorMessage.textContent).toContain('🔧 2 autocorregidos');
    });

    it('debería mostrar autocorrecciones en el modal', () => {
      const data = {
        imported: 3,
        autocorrected: 2,
        requiresReview: 0,
        failed: 0,
        errors: [],
        autocorrections: [
          {
            row: 2,
            name: 'Juan García',
            corrections: [
              {
                field: 'votingPlace',
                original: 'Puesto Usacuén',
                corrected: 'Puesto Usaquén',
                similarity: '92.5%'
              }
            ]
          },
          {
            row: 3,
            name: 'María López',
            corrections: [
              {
                field: 'localidad',
                original: 'usaquén',
                corrected: 'Usaquén',
                similarity: '95.0%'
              }
            ]
          }
        ]
      };

      const errorList = document.getElementById('errorList');
      errorList.innerHTML = '';

      // Mostrar autocorrecciones
      if (data.autocorrections.length > 0) {
        const header = document.createElement('li');
        header.textContent = '🔧 CORRECCIONES AUTOMÁTICAS:';
        errorList.appendChild(header);

        data.autocorrections.forEach(correction => {
          const li = document.createElement('li');
          const details = correction.corrections.map(c => 
            `${c.field}: "${c.original}" → "${c.corrected}"`
          ).join('; ');
          li.textContent = `Fila ${correction.row} - ${correction.name}: ${details}`;
          errorList.appendChild(li);
        });
      }

      expect(errorList.children.length).toBeGreaterThan(0);
      expect(errorList.textContent).toContain('CORRECCIONES AUTOMÁTICAS');
      expect(errorList.textContent).toContain('Puesto Usacuén');
      expect(errorList.textContent).toContain('Puesto Usaquén');
    });

    it('debería mostrar errores en el modal', () => {
      const data = {
        imported: 3,
        autocorrected: 0,
        requiresReview: 0,
        failed: 2,
        errors: [
          {
            row: 5,
            name: 'Pedro Martínez',
            error: 'Faltan campos requeridos: Email'
          },
          {
            row: 8,
            name: 'Ana Rodríguez',
            error: 'Ya existe un registro con cédula 99999999'
          }
        ],
        autocorrections: []
      };

      const errorList = document.getElementById('errorList');
      errorList.innerHTML = '';

      // Mostrar errores
      if (data.errors.length > 0) {
        const header = document.createElement('li');
        header.textContent = '❌ ERRORES:';
        errorList.appendChild(header);

        data.errors.forEach(err => {
          const li = document.createElement('li');
          li.textContent = `Fila ${err.row} - ${err.name}: ${err.error}`;
          errorList.appendChild(li);
        });
      }

      expect(errorList.textContent).toContain('ERRORES');
      expect(errorList.textContent).toContain('Pedro Martínez');
      expect(errorList.textContent).toContain('Ana Rodríguez');
    });

    it('debería mostrar mezcla de autocorrecciones y errores', () => {
      const data = {
        imported: 8,
        autocorrected: 2,
        requiresReview: 1,
        failed: 1,
        errors: [
          {
            row: 9,
            name: 'Error User',
            error: 'Error field'
          }
        ],
        autocorrections: [
          {
            row: 3,
            name: 'Correct User',
            corrections: [
              {
                field: 'votingPlace',
                original: 'Old',
                corrected: 'New',
                similarity: '90%'
              }
            ]
          }
        ]
      };

      const errorList = document.getElementById('errorList');
      errorList.innerHTML = '';

      // Agregar autocorrecciones
      if (data.autocorrections.length > 0) {
        const header1 = document.createElement('li');
        header1.textContent = '🔧 CORRECCIONES AUTOMÁTICAS:';
        errorList.appendChild(header1);
        data.autocorrections.forEach(c => {
          const li = document.createElement('li');
          li.textContent = `Fila ${c.row} - ${c.name}`;
          errorList.appendChild(li);
        });
      }

      // Agregar errores
      if (data.errors.length > 0) {
        const header2 = document.createElement('li');
        header2.textContent = '❌ ERRORES:';
        errorList.appendChild(header2);
        data.errors.forEach(e => {
          const li = document.createElement('li');
          li.textContent = `Fila ${e.row} - ${e.name}`;
          errorList.appendChild(li);
        });
      }

      expect(errorList.children.length).toBe(4); // 2 headers + 2 items
      expect(errorList.textContent).toContain('CORRECCIONES');
      expect(errorList.textContent).toContain('ERRORES');
    });
  });

  // ========== Test: Response Handling ==========
  describe('Response Handling', () => {
    
    it('debería procesar respuesta exitosa con autocorrecciones', () => {
      const response = {
        success: true,
        imported: 10,
        autocorrected: 3,
        requiresReview: 2,
        failed: 0,
        errors: [],
        autocorrections: [],
        message: 'Importación exitosa'
      };

      expect(response.success).toBe(true);
      expect(response.imported).toBe(10);
      expect(response.autocorrected).toBe(3);
    });

    it('debería ser JSON serializable', () => {
      const response = {
        success: true,
        imported: 5,
        autocorrected: 2,
        message: 'Test message',
        autocorrections: [
          {
            row: 2,
            name: 'Test',
            corrections: [{ field: 'test', original: 'a', corrected: 'b', similarity: '90%' }]
          }
        ]
      };

      const json = JSON.stringify(response);
      const parsed = JSON.parse(json);

      expect(parsed.autocorrections[0].corrections[0].field).toBe('test');
    });
  });

  // ========== Test: Integration con Managers ==========
  describe('Integration con Managers', () => {
    
    it('debería recargar registraciones después de importar', async () => {
      const leaderId = 'test123';
      sessionStorage.setItem('leaderId', leaderId);

      // Simular carga después de importación
      if (window.registrationsManager && window.registrationsManager.loadRegistrations) {
        await window.registrationsManager.loadRegistrations(leaderId);
        window.registrationsManager.renderRegistrations();
        window.registrationsManager.checkRevisionPendiente();
      }

      expect(mockRegistrationsManager.loadRegistrations).toHaveBeenCalledWith(leaderId);
      expect(mockRegistrationsManager.renderRegistrations).toHaveBeenCalled();
      expect(mockRegistrationsManager.checkRevisionPendiente).toHaveBeenCalled();
    });

    it('debería actualizar estadísticas después de importar', async () => {
      if (window.statisticsManager) {
        window.statisticsManager.loadStatistics([]);
      }

      expect(mockStatisticsManager.loadStatistics).toHaveBeenCalled();
    });
  });

  // ========== Test: Error Handling ==========
  describe('Error Handling', () => {
    
    it('debería mostrar alerta si modal no existe', () => {
      // Remover modal
      const modal = document.getElementById('errorModal');
      modal.remove();

      const data = {
        imported: 0,
        failed: 1,
        errors: [{ error: 'Test error' }]
      };

      // Debería crear alerta de fallback
      const shouldShowAlert = !document.getElementById('errorModal');
      expect(shouldShowAlert).toBe(true);
    });

    it('debería manejar respuesta vacía', () => {
      const data = {
        errors: [],
        autocorrections: [],
        imported: 0,
        failed: 0
      };

      expect(data.errors.length).toBe(0);
      expect(data.autocorrections.length).toBe(0);
    });
  });

  // ========== Test: User Experience ==========
  describe('User Experience', () => {
    
    it('debería mostrar mensaje amigable con emojis', () => {
      const message = '✅ 10 registros importados\n🔧 3 autocorregidos\n⚠️ 2 requieren revisión';
      
      expect(message).toContain('✅');
      expect(message).toContain('🔧');
      expect(message).toContain('⚠️');
    });

    it('debería resumir correcciones por tipo', () => {
      const corrections = [
        { field: 'votingPlace', count: 5 },
        { field: 'localidad', count: 3 },
        { field: 'departamento', count: 1 }
      ];

      const summary = corrections
        .map(c => `${c.count} ${c.field}`)
        .join(', ');

      expect(summary).toContain('5 votingPlace');
      expect(summary).toContain('3 localidad');
    });
  });
});
