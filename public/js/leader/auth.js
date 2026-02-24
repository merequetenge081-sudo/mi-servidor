// auth.js - Manejo de autenticación y sesiones
import { API_URL, StorageManager } from './utils.js';

export class AuthManager {
    static isRedirecting = false;

    static getAuthHeaders() {
        const token = StorageManager.getCurrentToken();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    }

    static async apiCall(endpoint, options = {}) {
        const headers = {
            ...this.getAuthHeaders(),
            ...options.headers
        };

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401 && !this.isRedirecting) {
            this.isRedirecting = true;
            StorageManager.clearAuth();
            window.location.replace('/');
            throw new Error('Session expired');
        }

        return response;
    }

    static checkAuth() {
        const token = StorageManager.getCurrentToken();
        const leaderId = StorageManager.getCurrentLeaderId();

        if (!token || !leaderId) {
            StorageManager.clearAuth();
            window.location.replace('/');
            return false;
        }
        return true;
    }

    static logout() {
        document.getElementById('logoutModal').classList.add('active');
    }

    static closeLogoutModal() {
        document.getElementById('logoutModal').classList.remove('active');
    }

    static confirmLogout() {
        this.isRedirecting = true;
        StorageManager.clearAuth();
        window.location.replace('/');
    }
}
