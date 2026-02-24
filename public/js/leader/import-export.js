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

                if (responseData.error) {
                    this.showImportErrors(responseData.details || responseData.error);
                } else {
                    return responseData;
                }
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
            firstName: row['Nombre'],
            lastName: row['Apellido'],
            cedula: row['Cédula'] || row['Cedula'],
            email: row['Email'],
            phone: row['Celular'] || row['Telefono'],
            votingTable: row['Mesa'],
            localidad: row['Localidad'],
            votingPlace: row['Puesto Votación'] || row['Puesto Votacion']
        }));
    }

    static showImportErrors(details) {
        if (Array.isArray(details)) {
            const list = document.getElementById('errorList');
            list.innerHTML = '';
            details.forEach(err => {
                const li = document.createElement('li');
                li.textContent = `Fila ${err.row} - ${err.name}: ${err.error}`;
                list.appendChild(li);
            });
        }
        document.getElementById('errorModal').classList.add('active');
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
