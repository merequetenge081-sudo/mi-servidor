// leader.js - Manejo de datos del líder
import { AuthManager } from './auth.js';
import { API_URL, StorageManager } from './utils.js';

export class LeaderManager {
    static leaderData = null;

    static async loadLeaderData(leaderId) {
        try {
            const response = await AuthManager.apiCall(`/api/leaders/${leaderId}`);

            if (!response.ok) throw new Error('Error al cargar datos del líder');

            const responseData = await response.json();
            this.leaderData = responseData?.data || responseData;

            const resolvedLeaderId = this.leaderData?.leaderId || this.leaderData?._id;
            if (resolvedLeaderId) {
                StorageManager.saveLeaderId(resolvedLeaderId);
            }

            // Set leader name in welcome screen
            const storedUsername = sessionStorage.getItem('username') || localStorage.getItem('username');
            const resolvedName = this.leaderData?.name || storedUsername || 'Líder';
            const firstName = resolvedName ? resolvedName.split(' ')[0] : 'Líder';
            document.getElementById('leaderNameWelcome').textContent = firstName;

            // Set registration link
            const token = this.leaderData?.token || this.leaderData?.publicToken || this.leaderData?.leaderId;
            const link = `${API_URL}/form.html?token=${token}`;
            document.getElementById('registrationLink').value = link;

            return this.leaderData;
        } catch (error) {
            console.error('Error al cargar datos del líder:', error);
            const storedUsername = sessionStorage.getItem('username') || localStorage.getItem('username');
            document.getElementById('leaderNameWelcome').textContent = storedUsername || 'Líder';
            throw error;
        }
    }
}
