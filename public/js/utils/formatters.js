/**
 * FORMATTER UTILITIES
 * Funciones de formateo de datos
 */

const Formatters = {
    /**
     * Formatea una fecha
     */
    formatDate(date, format = 'es-CO') {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString(format);
    },

    /**
     * Formatea una fecha con hora
     */
    formatDateTime(date, format = 'es-CO') {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleString(format);
    },

    /**
     * Formatea un número como porcentaje
     */
    formatPercent(value, decimals = 1) {
        if (value === null || value === undefined) return '0%';
        return `${Number(value).toFixed(decimals)}%`;
    },

    /**
     * Formatea un número con separadores de miles
     */
    formatNumber(value) {
        if (value === null || value === undefined) return '0';
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * Formatea un nombre (Primera letra mayúscula)
     */
    formatName(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    },

    /**
     * Formatea un email (máscara simple)
     */
    maskEmail(email) {
        if (!email) return '';
        const [local, domain] = email.split('@');
        const maskedLocal = local.charAt(0) + '***' + local.charAt(local.length - 1);
        return `${maskedLocal}@${domain}`;
    },

    /**
     * Formatea un teléfono
     */
    formatPhone(phone) {
        if (!phone) return '-';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    },

    /**
     * Formatea una cédula
     */
    formatCedula(cedula) {
        if (!cedula) return '-';
        return cedula.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    },

    /**
     * Trunca texto
     */
    truncate(text, length = 50) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    },

    /**
     * Capitaliza primera letra
     */
    capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    },

    /**
     * Slugifica un texto
     */
    slug(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .trim('-');
    },

    /**
     * Formatea bytes a tamaño legible
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Formatea duración en tiempo
     */
    formatTime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h`;
    },

    /**
     * Resalta texto (para búsquedas)
     */
    highlight(text, search) {
        if (!search) return text;
        const regex = new RegExp(`(${search})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formatters;
}
