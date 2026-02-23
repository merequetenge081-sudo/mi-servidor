// leader.js - Manejo de datos del líder
import { AuthManager } from './auth.js';
import { API_URL } from './utils.js';

export class LeaderManager {
    static leaderData = null;

    static async loadLeaderData(leaderId) {
        try {
            const response = await AuthManager.apiCall(`/api/leaders/${leaderId}`);

            if (!response.ok) throw new Error('Error al cargar datos del líder');

            this.leaderData = await response.json();

            // Set leader name in welcome screen
            const firstName = this.leaderData.name ? this.leaderData.name.split(' ')[0] : 'Líder';
            document.getElementById('leaderNameWelcome').textContent = firstName;

            // Set registration link
            const token = this.leaderData.token || this.leaderData.publicToken || this.leaderData.leaderId;
            const link = `${API_URL}/form.html?token=${token}`;
            document.getElementById('registrationLink').value = link;

            return this.leaderData;
        } catch (error) {
            console.error('Error al cargar datos del líder:', error);
            document.getElementById('leaderNameWelcome').textContent = 'Líder';
            throw error;
        }
    }
}
