// Constantes de la aplicación
// Separar este archivo no afecta ninguna funcionalidad

export const BOGOTA_LOCALIDADES = [
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 
    'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos', 
    'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda', 
    'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
];

export const SESSION_TIMEOUT_MINUTES = 30;

export const API_BASE = window.location.origin;

export const PALETTE = {
    info: { bg: '#667eea', text: 'Información' },
    success: { bg: '#28a745', text: 'Listo' },
    warning: { bg: '#f0ad4e', text: 'Atención' },
    error: { bg: '#dc3545', text: 'Error' }
};

export function getBogotaLocalidades() {
    return BOGOTA_LOCALIDADES;
}

export function isBogota(localidad) {
    return BOGOTA_LOCALIDADES.includes(localidad);
}
