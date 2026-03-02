// leader-main.js - Módulo principal de inicialización
import { AuthManager } from './auth.js';
import { UIManager } from './ui.js';
import { RegistrationsManager } from './registrations.js';
import { FormManager } from './forms.js?v=2.7.3';
import { DeleteManager } from './delete.js';
import { StatisticsManager } from './statistics.js';
import { ImportExportManager } from './import-export.js';
import { ModalsManager } from './modals.js';
import { LeaderManager } from './leader.js';
import { StorageManager } from './utils.js';

// Exportar managers globales para que puedan ser accedidos desde onclick handlers en HTML
window.registrationsManager = RegistrationsManager;
window.formManager = FormManager;
window.deleteManager = DeleteManager;
window.authManager = AuthManager;
window.uiManager = UIManager;
window.modalManager = ModalsManager;
window.importExportManager = ImportExportManager;
window.statisticsManager = StatisticsManager;
window.leaderManager = LeaderManager;

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Verificar autenticación
        AuthManager.checkAuth();

        // 2. Obtener datos del líder
        let leaderId = StorageManager.getCurrentLeaderId();
        if (!leaderId) {
            try {
                const verifyRes = await AuthManager.apiCall('/api/v2/auth/verify-token');
                if (verifyRes.ok) {
                    const verifyData = await verifyRes.json();
                    const fallbackId = verifyData?.data?.userId || verifyData?.data?._id;
                    if (fallbackId) {
                        StorageManager.saveLeaderId(fallbackId);
                        leaderId = fallbackId;
                    }
                }
            } catch (error) {
                console.error('Error verificando token:', error);
            }
        }

        if (!leaderId) {
            console.error('No se encontró leaderId');
            window.location.href = '/';
            return;
        }
        
        const leaderData = await LeaderManager.loadLeaderData(leaderId);

        // 3. Inicializar tema oscuro
        UIManager.loadDarkMode();

        // 4. Cargar registraciones
        await RegistrationsManager.loadRegistrations(leaderId);
        RegistrationsManager.renderRegistrations();
        RegistrationsManager.checkRevisionPendiente();
        StatisticsManager.loadStatistics(RegistrationsManager.myRegistrations);

        // 5. Verificar términos legales
        await ModalsManager.checkLegalTermsStatus();

        // 6. Inicializar tooltips
        UIManager.initializeTooltips();

        // 7. Conectar event listeners
        connectEventListeners(leaderId, leaderData);

        // 8. Inicializar formulario con valores predeterminados (Bogotá)
        FormManager.toggleUbicacion('bogota');

        // 9. Aplicar cerrar modales al hacer clic en backdrop
        UIManager.closeModalsOnBackdropClick();

    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
    }
});

// Función para conectar todos los event listeners
function connectEventListeners(leaderId, leaderData) {
    // ========== SEARCH Y FILTROS ==========
    const searchInput = document.getElementById('searchInput');
    const unifiedFilter = document.getElementById('unifiedFilter');
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');

    const triggerFilter = () => {
        const searchTerm = searchInput ? searchInput.value : '';
        const filterValue = unifiedFilter ? unifiedFilter.value : '';
        RegistrationsManager.applyFilters(searchTerm, filterValue);
    };

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', triggerFilter);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') triggerFilter();
        });
    }

    if (unifiedFilter) {
        unifiedFilter.addEventListener('change', triggerFilter);
    }
    // ========== BOTONES DE VISTA ==========
    const viewButtons = document.querySelectorAll('[data-view-button]');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = btn.dataset.viewButton;
            UIManager.goToView(view);
            
            // Si es estadísticas, cargar las gráficas
            if (view === 'statistics') {
                StatisticsManager.loadStatistics(RegistrationsManager.registrations);
            }
        });
    });

    // ========== PAGINACIÓN ==========
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => RegistrationsManager.previousPage());
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => RegistrationsManager.nextPage());
    }

    // ========== BOTONES DE AYUDA ==========
    const helpBtn = document.getElementById('helpBtn');
    const closeHelpBtn = document.getElementById('closeHelpDrawer');
    const helpDrawer = document.getElementById('helpDrawer');

    if (helpBtn) {
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            UIManager.toggleHelpDrawer();
        });
    }

    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => UIManager.closeHelpDrawer());
    }

    // Cerrar help drawer al hacer clic fuera
    if (helpDrawer) {
        helpDrawer.addEventListener('click', (e) => {
            if (e.target === helpDrawer) {
                UIManager.closeHelpDrawer();
            }
        });
    }

    // ========== TEMA OSCURO ==========
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => UIManager.toggleDarkMode());
    }

    // ========== COPIAR ENLACE ==========
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => FormManager.copyLink());
    }

    // ========== DESCARGAR TEMPLATE ==========
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', () => ImportExportManager.downloadTemplate());
    }

    // ========== IMPORTAR ARCHIVO ==========
    const importFileInput = document.getElementById('importFileInput');
    const importBtn = document.getElementById('importBtn');

    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', () => importFileInput.click());

        importFileInput.addEventListener('change', (e) => {
            ImportExportManager.handleImport(e.target, leaderId, leaderData);
            e.target.value = ''; // Limpiar input
        });
    }

    // ========== EXPORTAR DATOS ==========
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            ImportExportManager.exportToExcel(RegistrationsManager.registrations, leaderData);
        });
    }

    // ========== NUEVA REGISTRACIÓN ==========
    const newRegBtn = document.getElementById('newRegBtn');
    if (newRegBtn) {
        newRegBtn.addEventListener('click', () => {
            UIManager.goToView('newRegistration');
            FormManager.resetForm();
        });
    }

    // ========== FORMULARIO DE NUEVA REGISTRACIÓN ==========
    const newRegForm = document.getElementById('newRegForm');
    if (newRegForm) {
        newRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (typeof FormManager.saveNewRegistration === 'function') {
                await FormManager.saveNewRegistration(leaderId, leaderData);
            } else {
                await saveNewRegistrationFallback(leaderId, leaderData);
            }
        });
    }

    // ========== FORMULARIO DE EDICIÓN ==========
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await FormManager.saveEditRegistration();
        });
    }

    // ========== BOTONES DE ACCIÓN EN TABLA ==========
    const registrationsTable = document.getElementById('registrationsTable');
    if (registrationsTable) {
        registrationsTable.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const row = target.closest('tr');
            const regId = row.dataset.regId;

            if (target.classList.contains('edit-btn')) {
                FormManager.openEditModal(RegistrationsManager.registrations, regId);
            } else if (target.classList.contains('delete-btn')) {
                DeleteManager.confirmDelete(regId);
            } else if (target.classList.contains('toggle-confirm-btn')) {
                const currentStatus = row.dataset.status;
                const newStatus = currentStatus === 'Confirmado' ? 'Pendiente' : 'Confirmado';
                RegistrationsManager.toggleConfirm(regId, newStatus);
            }
        });
    }

    // ========== MODAL DE EDICIÓN - PUESTOS ==========
    const editPuestoInput = document.getElementById('editPuestoInput');
    const editPuestoList = document.getElementById('editPuestoList');

    if (editPuestoInput) {
        editPuestoInput.addEventListener('input', () => FormManager.filtrarEditPuestos());
    }

    if (editPuestoList) {
        editPuestoList.addEventListener('click', (e) => {
            if (e.target.classList.contains('puesto-option')) {
                FormManager.seleccionarEditPuesto(e.target.dataset.puesto);
            }
        });
    }

    // ========== MODAL DE EDICIÓN - UBICACIÓN ==========
    const editUbicacionRadios = document.querySelectorAll('input[name="editUbicacionTipo"]');
    editUbicacionRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            FormManager.toggleEditUbicacion(e.target.value);
        });
    });

    // ========== MODAL DE EDICIÓN - CAPITAL ==========
    const editDepartamentoSelect = document.getElementById('editDepartamento');
    if (editDepartamentoSelect) {
        editDepartamentoSelect.addEventListener('change', () => {
            FormManager.actualizarEditCapital();
        });
    }

    // ========== MODAL DE EDICIÓN - CERRAR ==========
    const closeEditModal = document.getElementById('closeEditModal');
    const editModal = document.getElementById('editModal');

    if (closeEditModal) {
        closeEditModal.addEventListener('click', () => {
            editModal.style.display = 'none';
        });
    }

    // ========== MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ==========
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            const response = await DeleteManager.performDelete();
            if (response.ok) {
                DeleteManager.closeDeleteConfirmModal();
                await RegistrationsManager.loadRegistrations(leaderId);
                RegistrationsManager.renderRegistrations();
                RegistrationsManager.checkRevisionPendiente();
                StatisticsManager.loadStatistics(RegistrationsManager.myRegistrations);
                ModalsManager.showSuccessModal('Éxito', 'Registración eliminada correctamente');
            }
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            DeleteManager.closeDeleteConfirmModal();
        });
    }

    // ========== MODAL DE QR ==========
    const closeQrModal = document.getElementById('closeQrModal');
    if (closeQrModal) {
        closeQrModal.addEventListener('click', () => FormManager.closeQrModal());
    }

    // ========== MODAL DE TÉRMINOS LEGALES ==========
    const acceptLegalTermsBtn = document.getElementById('acceptLegalTermsBtn');
    const rejectLegalTermsBtn = document.getElementById('rejectLegalTermsBtn');

    if (acceptLegalTermsBtn) {
        acceptLegalTermsBtn.addEventListener('click', () => ModalsManager.acceptLegalTerms());
    }

    if (rejectLegalTermsBtn) {
        rejectLegalTermsBtn.addEventListener('click', () => {
            document.getElementById('legalTermsModal').style.display = 'none';
        });
    }

    // ========== MODAL DE POLÍTICA DE PRIVACIDAD ==========
    const closePolicyModal = document.getElementById('closePolicyModal');
    if (closePolicyModal) {
        closePolicyModal.addEventListener('click', () => ModalsManager.closePolicyModal());
    }

    // ========== BOTÓN DE CERRAR SESIÓN ==========
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            AuthManager.confirmLogout();
        });
    }

    // ========== ENLACE DE POLÍTICA ==========
    const policyLink = document.getElementById('policyLink');
    if (policyLink) {
        policyLink.addEventListener('click', (e) => ModalsManager.showPolicyModal(e));
    }

    // ========== NUEVA REGISTRACIÓN - PUESTOS ==========
    const puestoInput = document.getElementById('puestoInput');
    const puestoList = document.getElementById('puestoList');

    if (puestoInput) {
        puestoInput.addEventListener('input', () => FormManager.filtrarPuestosLeader());
    }

    if (puestoList) {
        puestoList.addEventListener('click', (e) => {
            if (e.target.classList.contains('puesto-option')) {
                FormManager.seleccionarPuestoLeader(e.target.dataset.puesto);
            }
        });
    }

    // ========== NUEVA REGISTRACIÓN - UBICACIÓN ==========
    const ubicacionRadios = document.querySelectorAll('input[name="ubicacionTipo"]');
    ubicacionRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            FormManager.toggleUbicacion(e.target.value);
        });
    });

    // ========== NUEVA REGISTRACIÓN - CAPITAL ==========
    const departamentoSelect = document.getElementById('departamento');
    if (departamentoSelect) {
        departamentoSelect.addEventListener('change', () => {
            FormManager.actualizarCapital();
        });
    }

    // ========== QR EN NUEVA REGISTRACIÓN ==========
    const qrBtn = document.getElementById('qrBtn');
    if (qrBtn) {
        qrBtn.addEventListener('click', () => {
            const link = document.getElementById('novoRegistrationLink').value;
            if (link) {
                FormManager.openQrModal(link);
            }
        });
    }

    // ========== CERRAR MODALES CON ESC ==========
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            ModalsManager.closeSuccessModal();
            ModalsManager.closeErrorModal();
            FormManager.closeQrModal();
            DeleteManager.closeDeleteConfirmModal();
            const editModal = document.getElementById('editModal');
            if (editModal) editModal.style.display = 'none';
        }
    });
}

async function saveNewRegistrationFallback(leaderId, leaderData) {
    const consentCheckbox = document.getElementById('hasConsentToRegisterLeader');
    const consentError = document.getElementById('consentErrorLeader');

    if (consentError) {
        consentError.style.display = 'none';
    }

    if (consentCheckbox && !consentCheckbox.checked) {
        if (consentError) {
            consentError.style.display = 'block';
        }
        return;
    }

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const cedula = document.getElementById('cedula').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!firstName || !lastName || !cedula) {
        alert('Por favor completa nombre, apellido y cedula');
        return;
    }

    const ubicacionTipo = document.querySelector('input[name="ubicacionTipo"]:checked')?.value || 'bogota';
    let localidad = '';
    let departamento = '';
    let capital = '';
    let puestoId = null;
    let mesa = null;
    let votingPlace = null;
    let votingTable = null;

    if (ubicacionTipo === 'bogota') {
        localidad = document.getElementById('localidad').value;
        puestoId = document.getElementById('puestoId').value;
        votingTable = document.getElementById('votingTable').value.trim();

        if (!localidad || !puestoId || !votingTable) {
            alert('Por favor completa la localidad, el puesto y la mesa');
            return;
        }

        mesa = Number(votingTable);
        if (!Number.isFinite(mesa)) {
            alert('Numero de mesa invalido');
            return;
        }
    } else {
        departamento = document.getElementById('departamento').value;
        capital = document.getElementById('capital').value;
        localidad = departamento;
        votingPlace = document.getElementById('votingPlace').value.trim();
        votingTable = document.getElementById('votingTable').value.trim();

        if (!departamento || !votingPlace || !votingTable) {
            alert('Por favor completa el departamento, puesto y mesa');
            return;
        }
    }

    const resolvedLeaderId = leaderData?.leaderId || leaderData?._id || leaderId;
    const payload = {
        leaderId: resolvedLeaderId,
        eventId: leaderData?.eventId || null,
        firstName,
        lastName,
        cedula,
        email: email || null,
        phone: phone || null,
        localidad,
        departamento: departamento || null,
        capital: capital || null,
        puestoId: ubicacionTipo === 'bogota' ? puestoId : null,
        mesa: ubicacionTipo === 'bogota' ? mesa : null,
        votingPlace: ubicacionTipo === 'bogota' ? null : votingPlace,
        votingTable: ubicacionTipo === 'bogota' ? null : votingTable,
        registeredToVote: ubicacionTipo === 'bogota',
        hasConsentToRegister: true
    };

    try {
        const res = await AuthManager.apiCall('/api/registrations', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const responseData = await res.json();
        if (!res.ok || responseData.error) {
            alert(responseData.error || 'Error al guardar registro');
            return;
        }

        ModalsManager.showSuccessModal('Registro guardado', 'Registro creado exitosamente');
        if (typeof FormManager.resetForm === 'function') {
            FormManager.resetForm();
        }

        if (window.goToView) {
            window.goToView('registrations');
        }

        if (window.refreshRegistrations) {
            await window.refreshRegistrations();
        }
    } catch (error) {
        console.error('Error al guardar registro:', error);
        alert('Error al guardar registro');
    }
}

// Exportar para permitir reinicios si es necesario
export function reinitializeEventListeners(leaderId, leaderData) {
    connectEventListeners(leaderId, leaderData);
}

// ========== EXPORTAR FUNCIONES GLOBALES PARA ONCLICK HANDLERS ==========
// Las funciones deben estar disponibles globalmente para onclick en HTML

// UI
window.goToView = (viewName) => UIManager.goToView(viewName);
window.toggleHelpDrawer = () => UIManager.toggleHelpDrawer();
window.closeHelpDrawer = () => UIManager.closeHelpDrawer();
window.toggleDarkMode = () => UIManager.toggleDarkMode();

// Auth
window.logout = () => AuthManager.logout();
window.confirmLogout = () => AuthManager.confirmLogout();
window.closeLogoutModal = () => AuthManager.closeLogoutModal();

// Registrations
window.filtrarRegistrosRevision = () => {
    const searchInput = document.getElementById('searchInput');
    const unifiedFilter = document.getElementById('unifiedFilter');

    if (searchInput) searchInput.value = '';
    if (unifiedFilter) unifiedFilter.value = 'needs_review';

    RegistrationsManager.applyFilters('', 'needs_review');
    UIManager.goToView('registrations');
};
window.refreshRegistrations = async (keepPage = false) => {
    const leaderId = StorageManager.getCurrentLeaderId();
    if (leaderId) {
        await RegistrationsManager.loadRegistrations(leaderId, keepPage);
        RegistrationsManager.renderRegistrations();
        RegistrationsManager.checkRevisionPendiente();
        StatisticsManager.loadStatistics(RegistrationsManager.myRegistrations);
    }
};

// Auto-refresh every 30 seconds, preserving page
if (!window.autoRefreshInterval) {
    window.autoRefreshInterval = setInterval(() => {
        if (window.refreshRegistrations) {
            window.refreshRegistrations(true).catch(console.error);
        }
    }, 30000);
}
window.autoVerifyRegistrations = async () => {
    const leaderId = StorageManager.getCurrentLeaderId();
    if (!leaderId) return;

    const proceed = confirm('Esto verificara localidad y puesto de tus registros. Deseas continuar?');
    if (!proceed) return;

    const btn = document.getElementById('autoVerifyBtn');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> Verificando...';
    }

    try {
        const result = await RegistrationsManager.autoVerifyRegistrations(leaderId, 0.85);
        const message = `Registros revisados: ${result.total}\n` +
            `Actualizados: ${result.updated}\n` +
            `Autocorregidos: ${result.corrected}\n` +
            `Requieren revision: ${result.requiresReview}\n` +
            `Sin cambios: ${result.unchanged}`;

        ModalsManager.showSuccessModal('Verificacion automatica', message);
        await window.refreshRegistrations();
    } catch (error) {
        alert(error.message || 'Error al verificar registros');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};
window.previousPage = () => RegistrationsManager.changePage(-1);
window.nextPage = () => RegistrationsManager.changePage(1);

// Forms - Nuevo registro
window.copyLink = () => FormManager.copyLink();
window.openQrModal = () => FormManager.openQrModal();
window.closeQrModal = () => FormManager.closeQrModal();
window.filtrarPuestosLeader = () => FormManager.filtrarPuestosLeader();
window.mostrarDropdownPuestosLeader = () => FormManager.filtrarPuestosLeader();
window.handleLocalidadChange = async () => {
    const localidad = document.getElementById('localidad').value;
    await FormManager.cargarPuestosLeader(localidad);
};
window.seleccionarPuestoLeader = (id, nombre, codigo) => FormManager.seleccionarPuestoLeader(id, nombre, codigo);
window.toggleUbicacion = (tipo) => FormManager.toggleUbicacion(tipo);
window.actualizarCapital = () => FormManager.actualizarCapital();

// Forms - Modal de edición
window.closeEditModal = () => FormManager.closeEditModal();
window.toggleEditUbicacion = (tipo) => FormManager.toggleEditUbicacion(tipo);
window.handleEditLocalidadChange = async () => {
    const localidad = document.getElementById('editLocalidad').value;
    const selectedId = document.getElementById('editPuestoId').value;
    await FormManager.cargarEditPuestos(localidad, selectedId);
};
window.actualizarEditCapital = () => FormManager.actualizarEditCapital();
window.filtrarEditPuestos = () => FormManager.filtrarEditPuestos();
window.mostrarEditDropdownPuestos = () => FormManager.mostrarEditDropdownPuestos();

// Modals
window.closeSuccessModal = () => ModalsManager.closeSuccessModal();
window.closeErrorModal = () => ModalsManager.closeErrorModal();
window.showPolicyModal = (event) => ModalsManager.showPolicyModal(event);
window.showConsentPolicyModalForm = (event) => ModalsManager.showPolicyModal(event);
window.acceptLegalTerms = () => ModalsManager.acceptLegalTerms();

// Delete
window.closeDeleteConfirmModal = () => DeleteManager.closeDeleteConfirmModal();

// Import/Export
window.downloadTemplate = () => ImportExportManager.downloadTemplate();
window.handleImport = async (input) => {
    const leaderId = StorageManager.getCurrentLeaderId();
    if (!leaderId) return;
    const leaderData = await LeaderManager.loadLeaderData(leaderId);
    await ImportExportManager.handleImport(input, leaderId, leaderData);
};
window.exportToExcel = async () => {
    const leaderId = StorageManager.getCurrentLeaderId();
    if (!leaderId) return;
    const leaderData = await LeaderManager.loadLeaderData(leaderId);
    await ImportExportManager.exportToExcel(RegistrationsManager.myRegistrations, leaderData);
};

// Crear instancia global de FormManager para onclick handlers en HTML
window.formManager = FormManager;

// ========== BULK DELETE FUNCTIONS ==========

/**
 * Abrir modal de eliminación masiva
 */
window.openBulkDeleteModal = async () => {
    const modal = document.getElementById('bulkDeleteModal');
    const countElement = document.getElementById('bulkDeleteCount');
    const pendingAlert = document.getElementById('bulkDeletePendingAlert');
    const form = document.getElementById('bulkDeleteForm');
    
    // Mostrar cantidad de registros
    if (countElement) {
        const count = RegistrationsManager.myRegistrations.length;
        countElement.textContent = `${count} registro${count !== 1 ? 's' : ''}`;
    }
    
    // Verificar si hay solicitud pendiente
    try {
        const response = await AuthManager.apiCall('/api/registrations/deletion-request/status');
        const data = await response.json();
        
        if (data.hasPendingRequest && data.request) {
            pendingAlert.style.display = 'block';
            form.style.display = 'none';
        } else {
            pendingAlert.style.display = 'none';
            form.style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking deletion request status:', error);
    }
    
    // Limpiar form
    document.getElementById('bulkDeletePassword').value = '';
    document.getElementById('bulkDeleteReason').value = '';
    
    modal.classList.add('active');
    modal.style.display = 'flex';
};

/**
 * Cerrar modal de eliminación masiva
 */
window.closeBulkDeleteModal = () => {
    const modal = document.getElementById('bulkDeleteModal');
    modal.classList.remove('active');
    modal.style.display = 'none';
};

/**
 * Toggle password visibility
 */
window.toggleBulkDeletePassword = () => {
    const passwordInput = document.getElementById('bulkDeletePassword');
    const icon = document.getElementById('bulkDeletePasswordIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
};

/**
 * Enviar solicitud de eliminación masiva
 */
window.submitBulkDelete = async (event) => {
    event.preventDefault();
    
    const password = document.getElementById('bulkDeletePassword').value;
    const reason = document.getElementById('bulkDeleteReason').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    if (!password) {
        ModalsManager.showError('Debes ingresar tu contraseña');
        return;
    }
    
    // Deshabilitar botón durante la petición
    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Enviando...';
    
    try {
        const response = await AuthManager.apiCall('/api/registrations/deletion-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password, reason })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error al enviar solicitud');
        }
        
        // Éxito
        window.closeBulkDeleteModal();
        ModalsManager.showSuccess(
            '¡Registros Eliminados!',
            data.message || 'Tus registros han sido eliminados permanentemente.'
        );

        // Recargar datos
        setTimeout(() => window.location.reload(), 2000);
        
    } catch (error) {
        console.error('Error al solicitar eliminación masiva:', error);
        ModalsManager.showError(error.message || 'Error al enviar solicitud de eliminación');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
    }
};

// ========== ACCIONES EN LOTE (Dropdown) ==========
window.toggleBulkDropdown = (e) => {
    e.stopPropagation();
    const menu = document.getElementById('bulkActionsMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
};

document.addEventListener('click', () => {
    const menu = document.getElementById('bulkActionsMenu');
    if (menu && menu.style.display === 'block') {
        menu.style.display = 'none';
    }
});

// ========== VOLVER A ADMIN ==========
window.returnToAdmin = () => {
    const adminToken = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
    if (adminToken) {
        localStorage.setItem('token', adminToken);
        sessionStorage.setItem('token', adminToken);
        localStorage.removeItem('role');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('admin_token');
        localStorage.removeItem('admin_token');
        window.location.href = '/dashboard.html';
    }
};

// Verificar si venimos de Admin mode
document.addEventListener('DOMContentLoaded', () => {
    const adminToken = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
    if (adminToken) {
        const btn = document.getElementById('returnAdminBtn');
        if (btn) {
            btn.style.display = 'inline-flex';
        }
    }
});
