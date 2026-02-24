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
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                if (jsonData.length === 0) {
                    alert("El archivo está vacío");
                    input.value = '';
                    return;
                }

                const registrations = this.mapImportRows(jsonData);

                const response = await fetch(`${API_URL}/api/registrations/bulk`, {
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

                if (!response.ok || responseData.failed > 0) {
                    this.showImportResults(responseData);
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
        
        return rows.map(row => ({
            firstName: row['Nombre'] || row['nombre'],
            lastName: row['Apellido'] || row['apellido'],
            cedula: (row['Cédula'] || row['Cedula'] || row['cedula'] || '').toString().trim(),
            email: row['Email'] || row['email'],
            phone: (row['Celular'] || row['Telefono'] || row['celular'] || row['telefono'] || '').toString().trim(),
            votingTable: row['Mesa'] || row['mesa'],
            localidad: row['Localidad'] || row['localidad'],
            votingPlace: row['Puesto Votación'] || row['Puesto Votacion'] || row['puesto_votacion'] || row['Puesto']
        }));
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
                'Nombre': r.firstName || '',
                'Apellido': r.lastName || '',
                'Email': r.email || '',
                'Cédula': r.cedula || '',
                'Localidad': r.localidad || '',
                'Puesto Votación': r.votingPlace || '',
                'Mesa': r.votingTable || '',
                'Teléfono': r.phone || '',
                'Fecha': new Date(r.date).toLocaleDateString('es-CO'),
                'Estado': r.confirmed ? 'Confirmado' : 'Pendiente'
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Mis Registros');

            const safeName = leaderData && leaderData.name 
                ? leaderData.name.replace(/[^a-zA-Z0-9]/g, '_') 
                : 'leader';
            XLSX.writeFile(wb, `mis_registros_${safeName}.xlsx`);
        } catch (err) {
            console.error('Export Error:', err);
            alert('Ocurrió un error al exportar: ' + err.message);
        }
    }

    static downloadTemplate() {
        const headers = [
            ['Nombre', 'Apellido', 'Cédula', 'Email', 'Celular', 'Mesa', 'Localidad', 'Puesto Votación']
        ];

        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "Plantilla_Registros.xlsx");
    }
}
