/**
 * VALIDATOR UTILITIES
 * Funciones de validación
 */

const Validators = {
    /**
     * Valida que requerido no sea vacío
     */
    required(value) {
        if (value === null || value === undefined || value === '') {
            return { valid: false, message: 'Este campo es requerido' };
        }
        return { valid: true };
    },

    /**
     * Valida email
     */
    email(value) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(value)) {
            return { valid: false, message: 'Email inválido' };
        }
        return { valid: true };
    },

    /**
     * Valida número de teléfono
     */
    phone(value) {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length < 7 || cleaned.length > 15) {
            return { valid: false, message: 'Teléfono inválido' };
        }
        return { valid: true };
    },

    /**
     * Valida cédula colombiana
     */
    cedula(value) {
        const cleaned = value.toString().replace(/\D/g, '');
        
        // Validar que tenga 5-10 dígitos
        if (cleaned.length < 5 || cleaned.length > 10) {
            return { valid: false, message: 'Cédula inválida (5-10 dígitos)' };
        }

        // Si son 10 dígitos, validar dígito verificador
        if (cleaned.length === 10) {
            const digits = cleaned.slice(0, 9).split('').map(Number);
            const checkDigit = Number(cleaned[9]);
            
            let sum = 0;
            let multiplier = 3;
            
            for (let i = 0; i < 9; i++) {
                let result = digits[i] * multiplier;
                result = result % 10;
                sum += result;
                multiplier = multiplier === 2 ? 3 : 2;
            }
            
            const verifyDigit = (sum % 10 === 0) ? 0 : 10 - (sum % 10);
            
            if (verifyDigit !== checkDigit) {
                return { valid: false, message: 'Cédula inválida (dígito verificador)' };
            }
        }

        return { valid: true };
    },

    /**
     * Valida URL
     */
    url(value) {
        try {
            new URL(value);
            return { valid: true };
        } catch {
            return { valid: false, message: 'URL inválida' };
        }
    },

    /**
     * Valida longitud mínima
     */
    minLength(value, min) {
        if (value.length < min) {
            return { valid: false, message: `Mínimo ${min} caracteres` };
        }
        return { valid: true };
    },

    /**
     * Valida longitud máxima
     */
    maxLength(value, max) {
        if (value.length > max) {
            return { valid: false, message: `Máximo ${max} caracteres` };
        }
        return { valid: true };
    },

    /**
     * Valida que sea un número
     */
    number(value) {
        if (isNaN(value) || value === '') {
            return { valid: false, message: 'Debe ser un número' };
        }
        return { valid: true };
    },

    /**
     * Valida que sea un número positivo
     */
    positiveNumber(value) {
        const result = this.number(value);
        if (!result.valid) return result;
        if (Number(value) <= 0) {
            return { valid: false, message: 'Debe ser un número positivo' };
        }
        return { valid: true };
    },

    /**
     * Valida que sea una fecha válida
     */
    date(value) {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return { valid: false, message: 'Fecha inválida' };
        }
        return { valid: true };
    },

    /**
     * Valida que sea una fecha futura
     */
    futureDate(value) {
        const result = this.date(value);
        if (!result.valid) return result;
        if (new Date(value) <= new Date()) {
            return { valid: false, message: 'Debe ser una fecha futura' };
        }
        return { valid: true };
    },

    /**
     * Valida que sea una fecha pasada
     */
    pastDate(value) {
        const result = this.date(value);
        if (!result.valid) return result;
        if (new Date(value) >= new Date()) {
            return { valid: false, message: 'Debe ser una fecha pasada' };
        }
        return { valid: true };
    },

    /**
     * Valida que coincidan dos valores
     */
    match(value1, value2) {
        if (value1 !== value2) {
            return { valid: false, message: 'Los valores no coinciden' };
        }
        return { valid: true };
    },

    /**
     * Valida regex personalizado
     */
    pattern(value, regex, message = 'Formato inválido') {
        if (!regex.test(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    },

    /**
     * Valida múltiples reglas
     */
    validate(value, rules = []) {
        for (let rule of rules) {
            if (typeof rule === 'function') {
                const result = rule(value);
                if (!result.valid) return result;
            }
        }
        return { valid: true };
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
}
