// utils.js - Utilidades compartidas y constantes
export const API_URL = window.location.origin;

export const BOGOTA_LOCALIDADES = [
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme',
    'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá',
    'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires',
    'Antonio Nariño', 'Puente Aranda', 'La Candelaria',
    'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
];

export const CAPITALES_COLOMBIA = {
    'Amazonas': 'Leticia', 'Antioquia': 'Medellín', 'Arauca': 'Arauca',
    'Atlántico': 'Barranquilla', 'Bolívar': 'Cartagena', 'Boyacá': 'Tunja',
    'Caldas': 'Manizales', 'Caquetá': 'Florencia', 'Casanare': 'Yopal',
    'Cauca': 'Popayán', 'Cesar': 'Valledupar', 'Chocó': 'Quibdó',
    'Córdoba': 'Montería', 'Cundinamarca': 'Bogotá', 'Guainía': 'Inírida',
    'Guaviare': 'San José del Guaviare', 'Huila': 'Neiva',
    'La Guajira': 'Riohacha', 'Magdalena': 'Santa Marta',
    'Meta': 'Villavicencio', 'Nariño': 'Pasto',
    'Norte de Santander': 'Cúcuta', 'Putumayo': 'Mocoa',
    'Quindío': 'Armenia', 'Risaralda': 'Pereira',
    'San Andrés y Providencia': 'San Andrés', 'Santander': 'Bucaramanga',
    'Sucre': 'Sincelejo', 'Tolima': 'Ibagué', 'Valle del Cauca': 'Cali',
    'Vaupés': 'Mitú', 'Vichada': 'Puerto Carreño'
};

export class StorageManager {
    static getCurrentToken() {
        return sessionStorage.getItem('token') || localStorage.getItem('token');
    }

    static getCurrentLeaderId() {
        return sessionStorage.getItem('leaderId') || localStorage.getItem('leaderId');
    }

    static saveToken(token) {
        localStorage.setItem('token', token);
        sessionStorage.setItem('token', token);
    }

    static saveLeaderId(id) {
        localStorage.setItem('leaderId', id);
        sessionStorage.setItem('leaderId', id);
    }

    static clearAuth() {
        localStorage.removeItem('token');
        localStorage.removeItem('leaderId');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('leaderId');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('username');
    }
}

export function normalizePuestoTexto(value) {
    return (value || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildPuestoSearchText(puesto) {
    const aliases = Array.isArray(puesto.aliases) ? puesto.aliases.join(' ') : '';
    const base = `${puesto.nombre || ''} ${puesto.codigoPuesto || ''} ${aliases}`;
    return normalizePuestoTexto(base);
}

export function formatDate(date) {
    return new Date(date).toLocaleDateString('es-CO');
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
