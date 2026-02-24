// forms.js - Manejo de formularios (crear, editar, eliminar)
import { AuthManager } from './auth.js';
import { BOGOTA_LOCALIDADES, CAPITALES_COLOMBIA, normalizePuestoTexto, buildPuestoSearchText } from './utils.js';

export class FormManager {
    static editPuestosCache = [];
    static puestosLeaderCache = [];

    // === QR y Link ===
    static copyLink() {
        const link = document.getElementById('registrationLink');
        link.select();
        document.execCommand('copy');
        alert('Link copiado al portapapeles');
    }

    static openQrModal(link) {
        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = '';

        new QRCode(qrContainer, {
            text: link,
            width: 250,
            height: 250
        });

        document.getElementById('qrModal').classList.add('active');
    }

    static closeQrModal() {
        document.getElementById('qrModal').classList.remove('active');
    }

    // === Cargar puestos ===
    static async cargarEditPuestos(localidad, selectedId = '') {
        const input = document.getElementById('editPuestoBusqueda');
        const hiddenInput = document.getElementById('editPuestoId');
        input.value = '';
        hiddenInput.value = '';
        this.editPuestosCache = [];

        if (!localidad) return;

        try {
            const response = await fetch(`/api/public/puestos?localidad=${encodeURIComponent(localidad)}`);
            if (!response.ok) throw new Error('Error al cargar puestos');

            const data = await response.json();
            this.editPuestosCache = data.data || [];
            
            this.mostrarEditDropdownPuestos();

            if (selectedId) {
                const puesto = this.editPuestosCache.find(p => p._id === selectedId);
                if (puesto) {
                    input.value = `${puesto.nombre} (${puesto.codigoPuesto || ''})`;
                    hiddenInput.value = selectedId;
                }
            }
        } catch (error) {
            console.error('Error al cargar puestos:', error);
        }
    }

    static async cargarPuestosLeader(localidad) {
        if (!localidad) {
            this.puestosLeaderCache = [];
            return;
        }

        try {
            const response = await fetch(`/api/public/puestos?localidad=${encodeURIComponent(localidad)}`);
            if (!response.ok) throw new Error('Error al cargar puestos');

            const data = await response.json();
            this.puestosLeaderCache = data.data || [];
            this.filtrarPuestosLeader();
        } catch (error) {
            console.error('Error al cargar puestos:', error);
        }
    }

    // === Filtrar puestos ===
    static filtrarEditPuestos() {
        const terminoRaw = document.getElementById('editPuestoBusqueda').value;
        const termino = normalizePuestoTexto(terminoRaw);
        
        let puestosAMostrar = termino 
            ? this.editPuestosCache.filter(p => buildPuestoSearchText(p).includes(termino))
            : this.editPuestosCache;
        
        const dropdown = document.getElementById('editPuestoDropdown');
        
        if (puestosAMostrar.length === 0) {
            dropdown.innerHTML = '<div style="padding: 12px; color: #999; text-align: center;">No hay resultados</div>';
        } else {
            dropdown.innerHTML = puestosAMostrar.slice(0, 50).map(p => `
                <div onclick="formManager.seleccionarEditPuesto('${p._id}', '${(p.nombre || '').replace(/'/g, "\\'")}', '${p.codigoPuesto || ''}')" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='white'">
                    <strong>${p.nombre || 'Sin nombre'}</strong>
                    <span style="color: #666; font-size: 12px; margin-left: 8px;">${p.codigoPuesto || ''}</span>
                </div>
            `).join('');
        }
        
        dropdown.style.display = 'block';
    }

    static filtrarPuestosLeader() {
        const terminoRaw = document.getElementById('puestoBusquedaLeader').value;
        const termino = normalizePuestoTexto(terminoRaw);

        let puestosAMostrar = termino 
            ? this.puestosLeaderCache.filter(p => buildPuestoSearchText(p).includes(termino))
            : this.puestosLeaderCache;

        const dropdown = document.getElementById('puestoDropdownLeader');

        if (puestosAMostrar.length === 0) {
            dropdown.innerHTML = '<div style="padding: 12px; color: #999; text-align: center;">No hay resultados</div>';
        } else {
            dropdown.innerHTML = puestosAMostrar.slice(0, 50).map(p => `
                <div onclick="formManager.seleccionarPuestoLeader('${p._id}', '${(p.nombre || '').replace(/'/g, "\\'")}', '${p.codigoPuesto || ''}')" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='white'">
                <strong>${p.nombre || 'Sin nombre'}</strong>
                <span style="color: #666; font-size: 12px; margin-left: 8px;">${p.codigoPuesto || ''}</span>
            </div>
            `).join('');
        }

        dropdown.style.display = 'block';
    }

    static mostrarEditDropdownPuestos() {
        this.filtrarEditPuestos();
    }

    static seleccionarEditPuesto(id, nombre, codigo) {
        document.getElementById('editPuestoBusqueda').value = `${nombre} (${codigo})`;
        document.getElementById('editPuestoId').value = id;
        document.getElementById('editPuestoDropdown').style.display = 'none';
    }

    static seleccionarPuestoLeader(id, nombre, codigo) {
        document.getElementById('puestoBusquedaLeader').value = `${nombre} (${codigo})`;
        document.getElementById('puestoId').value = id;
        document.getElementById('puestoDropdownLeader').style.display = 'none';
    }

    // === Toggle ubicación ===
    static toggleEditUbicacion(tipo) {
        const bogotaContainer = document.getElementById('editBogotaContainer');
        const restoContainer = document.getElementById('editRestoContainer');
        const localidadSelect = document.getElementById('editLocalidad');
        const departamentoSelect = document.getElementById('editDepartamento');
        const puestoCatalogo = document.getElementById('editPuestoCatalogo');
        const puestoManual = document.getElementById('editPuestoManual');

        if (tipo === 'bogota') {
            bogotaContainer.style.display = 'block';
            restoContainer.style.display = 'none';
            localidadSelect.required = true;
            departamentoSelect.required = false;
            departamentoSelect.value = '';
            document.getElementById('editCapitalContainer').style.display = 'none';
            puestoCatalogo.style.display = 'block';
            puestoManual.style.display = 'none';
        } else {
            bogotaContainer.style.display = 'none';
            restoContainer.style.display = 'block';
            localidadSelect.required = false;
            departamentoSelect.required = true;
            localidadSelect.value = '';
            puestoCatalogo.style.display = 'none';
            puestoManual.style.display = 'block';
        }
    }

    static toggleUbicacion(tipo) {
        const bogotaContainer = document.getElementById('bogotaContainer');
        const restoContainer = document.getElementById('restoContainer');
        const localidadSelect = document.getElementById('localidad');
        const departamentoSelect = document.getElementById('departamento');
        const puestoCatalogo = document.getElementById('puestoCatalogo');
        const puestoManual = document.getElementById('puestoManual');
        const puestoIdSelect = document.getElementById('puestoId');
        const votingPlaceInput = document.getElementById('votingPlace');

        if (tipo === 'bogota') {
            bogotaContainer.style.display = 'block';
            restoContainer.style.display = 'none';
            localidadSelect.required = true;
            departamentoSelect.required = false;
            departamentoSelect.value = '';
            document.getElementById('capitalContainer').style.display = 'none';
            puestoCatalogo.style.display = 'block';
            puestoManual.style.display = 'none';
            puestoIdSelect.required = true;
            this.puestosLeaderCache = [];
            document.getElementById('puestoBusquedaLeader').value = '';
            if (votingPlaceInput) {
                votingPlaceInput.required = false;
                votingPlaceInput.value = '';
            }
        } else {
            bogotaContainer.style.display = 'none';
            restoContainer.style.display = 'block';
            localidadSelect.required = false;
            departamentoSelect.required = true;
            localidadSelect.value = '';
            puestoCatalogo.style.display = 'none';
            puestoManual.style.display = 'block';
            puestoIdSelect.required = false;
            puestoIdSelect.value = '';
            this.puestosLeaderCache = [];
            document.getElementById('puestoBusquedaLeader').value = '';
            if (votingPlaceInput) {
                votingPlaceInput.required = true;
            }
        }
    }

    // === Capital ===
    static actualizarEditCapital() {
        const departamento = document.getElementById('editDepartamento').value;
        const capitalContainer = document.getElementById('editCapitalContainer');
        const capitalInput = document.getElementById('editCapital');

        if (departamento && CAPITALES_COLOMBIA[departamento]) {
            capitalInput.value = CAPITALES_COLOMBIA[departamento];
            capitalContainer.style.display = 'block';
        } else {
            capitalInput.value = '';
            capitalContainer.style.display = 'none';
        }
    }

    static actualizarCapital() {
        const departamento = document.getElementById('departamento').value;
        const capitalContainer = document.getElementById('capitalContainer');
        const capitalInput = document.getElementById('capital');

        if (departamento && CAPITALES_COLOMBIA[departamento]) {
            capitalInput.value = CAPITALES_COLOMBIA[departamento];
            capitalContainer.style.display = 'block';
        } else {
            capitalInput.value = '';
            capitalContainer.style.display = 'none';
        }
    }

    // === Edit Modal ===
    static openEditModal(registrations, id) {
        const reg = registrations.find(r => r._id === id);
        if (!reg) {
            alert('Registro no encontrado');
            return;
        }

        document.getElementById('editId').value = id;
        document.getElementById('editFirstName').value = reg.firstName || '';
        document.getElementById('editLastName').value = reg.lastName || '';
        document.getElementById('editEmail').value = reg.email || '';
        document.getElementById('editPhone').value = reg.phone || '';
        document.getElementById('editVotingPlace').value = reg.votingPlace || '';
        document.getElementById('editVotingTable').value = reg.votingTable || reg.mesa || '';

        const isBogota = BOGOTA_LOCALIDADES.includes(reg.localidad);
        if (isBogota) {
            document.getElementById('editUbicacionBogota').checked = true;
            this.toggleEditUbicacion('bogota');
            document.getElementById('editLocalidad').value = reg.localidad || '';
            const selectedPuestoId = reg.puestoId && typeof reg.puestoId === 'object'
                ? reg.puestoId._id
                : reg.puestoId;
            this.cargarEditPuestos(reg.localidad, selectedPuestoId);
        } else {
            document.getElementById('editUbicacionResto').checked = true;
            this.toggleEditUbicacion('resto');
            document.getElementById('editDepartamento').value = reg.departamento || reg.localidad || '';
            this.actualizarEditCapital();
            if (reg.capital) {
                document.getElementById('editCapital').value = reg.capital;
            }
        }

        document.getElementById('editModal').classList.add('active');
    }

    static closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
    }

    static async saveEditRegistration() {
        const id = document.getElementById('editId').value;
        const ubicacionTipo = document.querySelector('input[name="editUbicacionTipo"]:checked')?.value;
        
        let localidad = '';
        let departamento = '';
        let capital = '';

        if (ubicacionTipo === 'bogota') {
            localidad = document.getElementById('editLocalidad').value;
        } else {
            departamento = document.getElementById('editDepartamento').value;
            capital = document.getElementById('editCapital').value;
            localidad = departamento;
        }

        const votingPlace = document.getElementById('editVotingPlace').value.trim();
        const votingTable = document.getElementById('editVotingTable').value.trim();
        const puestoId = document.getElementById('editPuestoId').value;

        const localidadValida = ubicacionTipo === 'bogota' ? localidad : departamento;
        if (!localidadValida) {
            alert('Por favor completa la Localidad/Departamento');
            return;
        }

        if (ubicacionTipo === 'bogota' && (!puestoId || !votingTable)) {
            alert('Por favor selecciona el Puesto de Votación y la Mesa');
            return;
        }

        if (ubicacionTipo !== 'bogota' && (!votingPlace || !votingTable)) {
            alert('Por favor completa Puesto de Votación y Mesa');
            return;
        }

        const data = {
            firstName: document.getElementById('editFirstName').value,
            lastName: document.getElementById('editLastName').value,
            email: document.getElementById('editEmail').value,
            phone: document.getElementById('editPhone').value,
            localidad,
            departamento: departamento || null,
            capital: capital || null,
            registeredToVote: ubicacionTipo === 'bogota',
            puestoId: ubicacionTipo === 'bogota' ? puestoId : null,
            mesa: ubicacionTipo === 'bogota' ? parseInt(votingTable) : null,
            votingPlace: ubicacionTipo === 'bogota' ? null : votingPlace,
            votingTable: ubicacionTipo === 'bogota' ? null : votingTable
        };

        try {
            const res = await AuthManager.apiCall(`/api/registrations/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            const responseData = await res.json();

            if (responseData.error) {
                alert(responseData.error);
            } else {
                this.closeEditModal();
                return responseData;
            }
        } catch (err) {
            console.error(err);
            alert('Error al actualizar registro');
        }
    }
}
