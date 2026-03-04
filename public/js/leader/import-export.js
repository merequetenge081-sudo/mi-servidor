// import-export.js - Manejo de importación y exportación de Excel
import { AuthManager } from './auth.js';
import { API_URL } from './utils.js';

export class ImportExportManager {
    static async handleImport(input, leaderId, leaderData) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let jsonData = [];
                
                // Si es un archivo CSV, intentamos parsearlo manualmente para manejar punto y coma
                if (file.name.toLowerCase().endsWith('.csv')) {
                    // Usamos windows-1252 porque Excel en español suele exportar CSVs con esta codificación
                    const text = new TextDecoder("windows-1252").decode(e.target.result);
                    // Detectar separador (coma o punto y coma)
                    const separator = text.includes(';') ? ';' : ',';
                    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                    
                    if (lines.length > 0) {
                        const headers = lines[0].split(separator).map(h => h.trim());
                        for (let i = 1; i < lines.length; i++) {
                            const values = lines[i].split(separator);
                            const row = {};
                            headers.forEach((header, index) => {
                                row[header] = values[index] ? values[index].trim() : '';
                            });
                            jsonData.push(row);
                        }
                    }
                } else {
                    // Para Excel (.xlsx, .xls)
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    jsonData = XLSX.utils.sheet_to_json(firstSheet);
                }

                if (jsonData.length === 0) {
                    alert("El archivo está vacío o no se pudo leer correctamente");
                    input.value = '';
                    return;
                }

                const registrations = this.mapImportRows(jsonData);

                const response = await fetch(`${API_URL}/api/v2/registrations/bulk/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${AuthManager.getAuthHeaders()['Authorization'].split(' ')[1]}`
                    },
                    body: JSON.stringify({
                        leaderId,
                        registrations
                    })
                });

                const responseData = await response.json();
                input.value = '';

                // Mostrar resultados si hay autocorrecciones, errores, o fallos
                if (!response.ok || responseData.failed > 0 || (responseData.autocorrections && responseData.autocorrections.length > 0)) {
                    this.showImportResults(responseData);
                    
                    // Auto-cerrar modal después de 5 segundos si solo hay éxito (sin errores)
                    if (responseData.imported > 0 && responseData.failed === 0) {
                        setTimeout(() => {
                            const modal = document.getElementById('errorModal');
                            if (modal && modal.classList.contains('active')) {
                                modal.classList.remove('active');
                            }
                        }, 5000);
                    }
                } else {
                    // Show success message
                    const message = `✅ Importación exitosa!\n\n` +
                        `📊 Registros importados: ${responseData.imported}\n` +
                        (responseData.requiresReview > 0 ? `⚠️ Requieren revisión: ${responseData.requiresReview}\n` : '') +
                        `\n${responseData.message}`;
                    
                    alert(message);
                    
                    // Reload registrations
                    if (window.registrationsManager && window.registrationsManager.loadRegistrations) {
                        const leaderId = sessionStorage.getItem('leaderId') || localStorage.getItem('leaderId');
                        if (leaderId) {
                            await window.registrationsManager.loadRegistrations(leaderId);
                            window.registrationsManager.renderRegistrations();
                            window.registrationsManager.checkRevisionPendiente();
                            if (window.statisticsManager) {
                                window.statisticsManager.loadStatistics(window.registrationsManager.myRegistrations);
                            }
                        }
                    }
                }
                
                return responseData;
            } catch (err) {
                console.error(err);
                alert("Error al leer el archivo Excel");
                input.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    static mapImportRows(rows) {
        if (!Array.isArray(rows)) return [];
        
        return rows.map(row => {
            // Normalizar las llaves para ignorar espacios, mayúsculas y caracteres raros
            const normalizedRow = {};
            for (const key in row) {
                if (Object.hasOwnProperty.call(row, key)) {
                    let normKey = key.toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]/g, '')
                        .trim();
                    normalizedRow[normKey] = row[key];
                }
            }

            let firstName = (normalizedRow['nombre'] || normalizedRow['nombres'] || '').toString().trim();
            let lastName = (normalizedRow['apellido'] || normalizedRow['apellidos'] || '').toString().trim();

            // Si no hay apellido pero el nombre tiene espacios, lo dividimos
            if (!lastName && firstName && firstName.includes(' ')) {
                const parts = firstName.split(/\s+/);
                if (parts.length >= 2) {
                    // Asumimos que la primera mitad es nombre y la segunda apellido
                    const half = Math.ceil(parts.length / 2);
                    firstName = parts.slice(0, half).join(' ');
                    lastName = parts.slice(half).join(' ');
                }
            }

            return {
                firstName: firstName || 'Desconocido',
                lastName: lastName || '.', // El backend requiere lastName
                cedula: (normalizedRow['cedula'] || normalizedRow['cdula'] || normalizedRow['cc'] || '').toString().trim(),
                email: (normalizedRow['email'] || normalizedRow['correo'] || '').toString().trim(),
                phone: (normalizedRow['celular'] || normalizedRow['telefono'] || '').toString().trim(),
                votingTable: (normalizedRow['mesa'] || '').toString().trim(),
                localidad: (normalizedRow['localidad'] || '').toString().trim(),
                votingPlace: (normalizedRow['puestovotacion'] || normalizedRow['puesto'] || '').toString().trim()
            };
        });
    }

    static showImportResults(data) {
        const modal = document.getElementById('errorModal');
        const list = document.getElementById('errorList');
        const errorTitle = document.getElementById('errorTitle');
        const errorMessage = document.getElementById('errorMessage');
        
        if (!modal || !list) {
            // Fallback to alert if modal not found
            let message = `Importación completada:\n\n`;
            message += `✅ Importados: ${data.imported || 0}\n`;
            if (data.autocorrected > 0) {
                message += `🔧 Autocorregidos: ${data.autocorrected}\n`;
            }
            if (data.requiresReview > 0) {
                message += `⚠️ Requieren revisión: ${data.requiresReview}\n`;
            }
            if (data.failed > 0) {
                message += `❌ Con errores: ${data.failed}\n`;
            }
            message += `\n${data.message}`;
            alert(message);
            return;
        }

        // Update modal content
        if (errorTitle) {
            const hasIssues = data.requiresReview > 0 || data.failed > 0;
            errorTitle.textContent = hasIssues ? 'Importación Completada con Advertencias' : 'Importación Exitosa';
        }
        
        if (errorMessage) {
            let msg = '';
            if (data.imported > 0) {
                msg += `✅ ${data.imported} registro(s) importados correctamente\n`;
            }
            if (data.autocorrected > 0) {
                msg += `🔧 ${data.autocorrected} registro(s) autocorregidos automáticamente\n`;
            }
            if (data.requiresReview > 0) {
                msg += `⚠️ ${data.requiresReview} registro(s) requieren revisión de puesto\n`;
            }
            if (data.failed > 0) {
                msg += `❌ ${data.failed} registro(s) con errores\n`;
            }
            errorMessage.textContent = msg;
        }

        // Show detailed information in list
        list.innerHTML = '';
        
        // 1. Show autocorrections
        if (Array.isArray(data.autocorrections) && data.autocorrections.length > 0) {
            const autoHeader = document.createElement('li');
            autoHeader.textContent = '🔧 CORRECCIONES AUTOMÁTICAS:';
            autoHeader.style.fontWeight = 'bold';
            autoHeader.style.marginTop = '12px';
            autoHeader.style.marginBottom = '8px';
            autoHeader.style.color = '#2563eb';
            list.appendChild(autoHeader);
            
            data.autocorrections.forEach(correction => {
                const li = document.createElement('li');
                const correctionsList = correction.corrections.map(c => 
                    `${c.field}: "${c.original}" → "${c.corrected}" (${c.similarity} similitud)`
                ).join('; ');
                li.textContent = `Fila ${correction.row} - ${correction.name}: ${correctionsList}`;
                li.style.marginBottom = '6px';
                li.style.paddingLeft = '16px';
                li.style.color = '#1d4ed8';
                list.appendChild(li);
            });
        }
        
        // 2. Show errors
        if (Array.isArray(data.errors) && data.errors.length > 0) {
            const errorHeader = document.createElement('li');
            errorHeader.textContent = '❌ ERRORES:';
            errorHeader.style.fontWeight = 'bold';
            errorHeader.style.marginTop = '12px';
            errorHeader.style.marginBottom = '8px';
            errorHeader.style.color = '#dc2626';
            list.appendChild(errorHeader);
            
            data.errors.forEach(err => {
                const li = document.createElement('li');
                li.textContent = `Fila ${err.row} - ${err.name}: ${err.error}`;
                li.style.marginBottom = '6px';
                li.style.paddingLeft = '16px';
                li.style.color = '#991b1b';
                list.appendChild(li);
            });
        }
        
        if (list.children.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Importación completada sin advertencias';
            li.style.color = '#059669';
            list.appendChild(li);
        }
        
        modal.classList.add('active');
        
        // Auto-reload registrations after showing results
        if (data && data.imported > 0) {
            setTimeout(() => {
                if (window.registrationsManager && window.registrationsManager.loadRegistrations) {
                    const leaderId = sessionStorage.getItem('leaderId') || localStorage.getItem('leaderId');
                    if (leaderId) {
                        window.registrationsManager.loadRegistrations(leaderId).then(() => {
                            window.registrationsManager.renderRegistrations();
                            window.registrationsManager.checkRevisionPendiente();
                            if (window.statisticsManager && window.registrationsManager.myRegistrations) {
                                window.statisticsManager.loadStatistics(window.registrationsManager.myRegistrations);
                            }
                        });
                    }
                }
            }, 500);
        }
    }

    static showImportErrors(details) {
        // Legacy method - redirect to showImportResults
        this.showImportResults({
            imported: 0,
            requiresReview: 0,
            failed: Array.isArray(details) ? details.length : 1,
            errors: Array.isArray(details) ? details : [{ row: 0, name: 'Error', error: details }]
        });
    }

    static exportToExcel(registrations, leaderData) {
        try {
            if (!registrations || registrations.length === 0) {
                alert('No hay registros para exportar');
                return;
            }

            if (typeof XLSX === 'undefined') {
                alert('Error: La librería de Excel no se ha cargado');
                return;
            }

            const data = registrations.map(r => ({
                'Nombre': `${r.firstName || ''} ${r.lastName || ''}`.trim(),
                'Email': r.email || '',
                'Cédula': r.cedula || '',
                'Teléfono': r.phone || '',
                'Departamento': r.departamento || r.department || '',
                'Municipio': r.capital || r.municipality || '',
                'Localidad': r.localidad || '',
                'Puesto Votación': r.votingPlace || '',
                'Mesa': r.votingTable || '',
                'Fecha': new Date(r.date).toLocaleDateString('es-CO'),
                'Estado': r.confirmed ? 'Confirmado' : 'Pendiente'
            }));

            const leaderName = leaderData && leaderData.name ? leaderData.name : 'Líder';
            const title = `Reporte de Registros - ${leaderName}`;
            const headers = Object.keys(data[0]);

            const wsData = [
                [title],
                [],
                headers
            ];

            data.forEach(item => {
                const rowData = headers.map(key => {
                    const val = item[key];
                    return val !== null && val !== undefined ? String(val) : '';
                });
                wsData.push(rowData);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            if (!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, headers.length - 1) } });

            if (!ws['A1'].s) ws['A1'].s = {};
            ws['A1'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } };

            const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
            data.forEach(row => {
                headers.forEach((header, i) => {
                    const val = String(row[header] || '');
                    if (val.length > colWidths[i].wch) {
                        colWidths[i].wch = Math.min(val.length + 2, 50);
                    }
                });
            });
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Mis Registros');

            const safeName = leaderName.replace(/[^a-zA-Z0-9]/g, '_');
            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `mis_registros_${safeName}_${dateStr}.xlsx`);
        } catch (err) {
            console.error('Export Error:', err);
            alert('Ocurrió un error al exportar: ' + err.message);
        }
    }

    static downloadTemplate() {
        const headers = [
            ['Nombres', 'Apellidos', 'Cédula', 'Email', 'Celular', 'Mesa', 'Localidad', 'Puesto Votación']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "Plantilla_Registros.xlsx");
    }
}
