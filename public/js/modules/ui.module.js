// Módulo de UI - Alertas, Confirmaciones y Modales
// Funciones para mostrar elementos de interfaz al usuario

import { PALETTE } from '../utils/constants.js';

export function showAlert(message, type = 'info') {
    return new Promise(resolve => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const theme = PALETTE[type] || PALETTE.info;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        const card = document.createElement('div');
        card.style.cssText = `background: ${isDarkMode ? '#16213e' : '#ffffff'}; color: ${isDarkMode ? '#e0e0e0' : '#333'}; border-radius: 12px; padding: 24px; width: 92%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); border: 1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'};`;

        const header = document.createElement('div');
        header.style.cssText = `display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-weight: 700; color: ${theme.bg};`;
        header.textContent = theme.text;

        const body = document.createElement('div');
        body.style.cssText = 'font-size: 14px; line-height: 1.5; margin-bottom: 18px;';
        body.textContent = message;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `width: 100%; border: none; border-radius: 8px; padding: 10px; background: ${theme.bg}; color: white; font-weight: 600; cursor: pointer;`;
        btn.textContent = 'Aceptar';
        btn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(btn);
        overlay.appendChild(card);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(true);
            }
        });
        document.body.appendChild(overlay);
    });
}

export function showConfirm(message) {
    return new Promise(resolve => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease-in;';

        const card = document.createElement('div');
        card.style.cssText = `background: ${isDarkMode ? '#16213e' : '#ffffff'}; color: ${isDarkMode ? '#e0e0e0' : '#333'}; border-radius: 16px; padding: 28px; width: 92%; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); text-align: center; border: 1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'};`;

        const title = document.createElement('div');
        title.style.cssText = `font-size: 18px; font-weight: 700; margin-bottom: 12px; color: ${isDarkMode ? '#f0f0f0' : '#1a1a2e'};`;
        title.textContent = '⚠️ Confirmar';

        const body = document.createElement('div');
        body.style.cssText = 'font-size: 14px; line-height: 1.6; margin-bottom: 24px; white-space: pre-line;';
        body.textContent = message;

        const btns = document.createElement('div');
        btns.style.cssText = 'display: flex; gap: 12px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.style.cssText = `flex: 1; border: 1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}; background: ${isDarkMode ? '#2d3748' : '#f8f9fa'}; color: ${isDarkMode ? '#e2e8f0' : '#6c757d'}; border-radius: 8px; padding: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;`;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('mouseover', () => {
            cancelBtn.style.background = isDarkMode ? '#4a5568' : '#e9ecef';
        });
        cancelBtn.addEventListener('mouseout', () => {
            cancelBtn.style.background = isDarkMode ? '#2d3748' : '#f8f9fa';
        });
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.style.cssText = 'flex: 1; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; padding: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
        okBtn.textContent = 'Confirmar';
        okBtn.addEventListener('mouseover', () => {
            okBtn.style.transform = 'translateY(-1px)';
            okBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        okBtn.addEventListener('mouseout', () => {
            okBtn.style.transform = 'translateY(0)';
            okBtn.style.boxShadow = 'none';
        });
        okBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        btns.appendChild(cancelBtn);
        btns.appendChild(okBtn);

        card.appendChild(title);
        card.appendChild(body);
        card.appendChild(btns);
        overlay.appendChild(card);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
        
        document.body.appendChild(overlay);
    });
}

export function showToast(message, type = 'info', duration = 3000) {
    const colors = {
        info: '#667eea',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function showLoading(message = 'Cargando...') {
    const existing = document.getElementById('globalLoading');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'globalLoading';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; padding: 24px 32px; border-radius: 12px; text-align: center;">
            <div style="width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px;"></div>
            <div style="color: #333; font-size: 14px;">${message}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

export function hideLoading() {
    const loading = document.getElementById('globalLoading');
    if (loading) loading.remove();
}
