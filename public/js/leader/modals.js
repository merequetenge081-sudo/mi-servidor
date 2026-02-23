// modals.js - Manejo de modales y términos legales
import { AuthManager } from './auth.js';

export class ModalsManager {
    static showSuccessModal(title, message) {
        document.getElementById('successTitle').textContent = title;
        document.getElementById('successMessage').textContent = message;
        document.getElementById('successModal').classList.add('active');
    }

    static closeSuccessModal() {
        document.getElementById('successModal').classList.remove('active');
    }

    static closeErrorModal() {
        document.getElementById('errorModal').classList.remove('active');
    }

    // === Legal Terms ===
    static async checkLegalTermsStatus() {
        try {
            const response = await AuthManager.apiCall('/api/auth/legal-terms-status');
            if (!response.ok) return true;
            const data = await response.json();
            return data.hasAccepted;
        } catch (error) {
            console.error('Error checking legal terms status:', error);
            return true;
        }
    }

    static showLegalTermsModal() {
        document.getElementById('legalTermsModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        const checkbox = document.getElementById('acceptLegalTermsCheckbox');
        const btn = document.getElementById('acceptLegalTermsBtn');
        
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                btn.disabled = false;
                btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btn.style.cursor = 'pointer';
                document.getElementById('legalTermsError').style.display = 'none';
            } else {
                btn.disabled = true;
                btn.style.background = 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)';
                btn.style.cursor = 'not-allowed';
            }
        });
    }

    static closeLegalTermsModal() {
        document.getElementById('legalTermsModal').style.display = 'none';
        document.body.style.overflow = '';
    }

    static showPolicyModal(event) {
        if (event) event.preventDefault();
        document.getElementById('policyModal').classList.add('active');
    }

    static closePolicyModal() {
        document.getElementById('policyModal').classList.remove('active');
    }

    static async acceptLegalTerms() {
        const checkbox = document.getElementById('acceptLegalTermsCheckbox');
        const btn = document.getElementById('acceptLegalTermsBtn');
        const errorDiv = document.getElementById('legalTermsError');
        
        if (!checkbox.checked) {
            errorDiv.style.display = 'block';
            return;
        }
        
        btn.disabled = true;
        btn.innerHTML = '<span class="loading"></span> Procesando...';
        
        try {
            const response = await AuthManager.apiCall('/api/auth/accept-legal-terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.closeLegalTermsModal();
                this.showSuccessModal('Términos Aceptados', 'Has aceptado los términos y condiciones. Ya puedes usar la plataforma.');
                return true;
            } else {
                errorDiv.textContent = data.error || 'Error al aceptar términos';
                errorDiv.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-check-circle"></i> Aceptar y Continuar';
                return false;
            }
        } catch (error) {
            console.error('Error accepting legal terms:', error);
            errorDiv.textContent = 'Error de conexión. Intenta nuevamente.';
            errorDiv.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-circle"></i> Aceptar y Continuar';
            return false;
        }
    }
}
