// leader-main.js - Módulo principal de inicialización
import { AuthManager } from './auth.js';
import { UIManager } from './ui.js';
import { RegistrationsManager } from './registrations.js';
import { FormManager } from './forms.js';
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
        const leaderId = StorageManager.getCurrentLeaderId();
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

        // 5. Verificar términos legales
        await ModalsManager.checkLegalTermsStatus();

        // 6. Inicializar tooltips
        UIManager.initializeTooltips();

        // 7. Conectar event listeners
        connectEventListeners(leaderId, leaderData);

        // 8. Aplicar cerrar modales al hacer clic en backdrop
        UIManager.closeModalsOnBackdropClick();

    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
    }
});

// Función para conectar todos los event listeners
function connectEventListeners(leaderId, leaderData) {
    // ========== SEARCH Y FILTROS ==========
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            const statusValue = statusFilter ? statusFilter.value : 'todos';
            RegistrationsManager.applyFilters(searchTerm, statusValue);
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            const statusValue = e.target.value;
            const searchTerm = searchInput ? searchInput.value : '';
            RegistrationsManager.applyFilters(searchTerm, statusValue);
        });
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
            await FormManager.saveNewRegistration(leaderId, leaderData);
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
    const editUbicacionRadios = document.querySelectorAll('input[name="editUbicacion"]');
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
    const ubicacionRadios = document.querySelectorAll('input[name="ubicacion"]');
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

// Exportar para permitir reinicios si es necesario
export function reinitializeEventListeners(leaderId, leaderData) {
    connectEventListeners(leaderId, leaderData);
}

// ========== EXPORTAR FUNCIONES GLOBALES PARA ONCLICK HANDLERS ==========
// Las funciones deben estar disponibles globalmente para onclick en HTML

window.goToView = (viewName) => UIManager.goToView(viewName);
window.toggleHelpDrawer = () => UIManager.toggleHelpDrawer();
window.closeHelpDrawer = () => UIManager.closeHelpDrawer();
window.logout = () => AuthManager.logout();
window.confirmLogout = () => AuthManager.confirmLogout();

// Registrations
window.filtrarRegistrosRevision = () => RegistrationsManager.applyFilters('revision', 'revision');
window.refreshRegistrations = async () => {
    const leaderId = StorageManager.getCurrentLeaderId();
    if (leaderId) await RegistrationsManager.loadRegistrations(leaderId);
};
window.previousPage = () => RegistrationsManager.changePage(-1);
window.nextPage = () => RegistrationsManager.changePage(1);

// Forms
window.copyLink = () => FormManager.copyLink();
window.openQrModal = () => FormManager.openQrModal();
window.filtrarPuestosLeader = () => FormManager.filtrarPuestos();
window.mostrarDropdownPuestosLeader = () => FormManager.mostrarDropdownPuestos();

// Import/Export
window.downloadTemplate = () => ImportExportManager.downloadTemplate();
window.exportToExcel = async () => {
    const leaderId = StorageManager.getCurrentLeaderId();
    if (!leaderId) return;
    const leaderData = await LeaderManager.loadLeaderData(leaderId);
    await ImportExportManager.exportToExcel(RegistrationsManager.myRegistrations, leaderData);
};
