// delete.js - Manejo de eliminación de registros
import { AuthManager } from './auth.js';

export class DeleteManager {
    static deleteId = null;

    static confirmDelete(id) {
        this.deleteId = id;
        document.getElementById('deleteConfirmModal').classList.add('active');
    }

    static closeDeleteConfirmModal() {
        this.deleteId = null;
        document.getElementById('deleteConfirmModal').classList.remove('active');
    }

    static async performDelete() {
        if (!this.deleteId) return;

        try {
            const res = await AuthManager.apiCall(`/api/registrations/${this.deleteId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.error) {
                alert('Error: ' + data.error);
            } else {
                this.closeDeleteConfirmModal();
                if (window.refreshRegistrations) {
                    await window.refreshRegistrations(true);
                }
                return data;
            }
        } catch (err) {
            console.error(err);
            alert('Error al eliminar registro');
            this.closeDeleteConfirmModal();
        }
    }
}
