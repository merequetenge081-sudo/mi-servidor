/**
 * CORE DOM UTILITIES
 * Helpers para manipulación del DOM sin jQuery
 */

const DOMUtils = {
    /**
     * Selecciona un elemento por ID
     */
    byId(id) {
        return document.getElementById(id);
    },

    /**
     * Selecciona elementos por selector CSS
     */
    query(selector, context = document) {
        return context.querySelector(selector);
    },

    /**
     * Selecciona todos los elementos
     */
    queryAll(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    },

    /**
     * Setea atributo(s)
     */
    setAttribute(el, attr, value) {
        if (typeof attr === 'object') {
            Object.entries(attr).forEach(([key, val]) => el.setAttribute(key, val));
        } else {
            el.setAttribute(attr, value);
        }
        return el;
    },

    /**
     * Setea clases
     */
    addClass(el, className) {
        el.classList.add(...className.split());
        return el;
    },

    removeClass(el, className) {
        el.classList.remove(...className.split());
        return el;
    },

    toggleClass(el, className) {
        el.classList.toggle(className);
        return el;
    },

    hasClass(el, className) {
        return el.classList.contains(className);
    },

    /**
     * Manejo de display
     */
    show(el) {
        el.style.display = '';
        return el;
    },

    hide(el) {
        el.style.display = 'none';
        return el;
    },

    toggle(el) {
        el.style.display = el.style.display === 'none' ? '' : 'none';
        return el;
    },

    /**
     * Setea texto/HTML
     */
    setText(el, text) {
        el.textContent = text;
        return el;
    },

    setHTML(el, html) {
        el.innerHTML = html;
        return el;
    },

    /**
     * Event listeners
     */
    on(el, event, handler) {
        el.addEventListener(event, handler);
        return el;
    },

    off(el, event, handler) {
        el.removeEventListener(event, handler);
        return el;
    },

    /**
     * Delegación de eventos
     */
    delegate(container, selector, event, handler) {
        container.addEventListener(event, (e) => {
            if (e.target.closest(selector)) {
                handler.call(e.target.closest(selector), e);
            }
        });
    },

    /**
     * Crear elementos
     */
    create(tag, attrs = {}, content = '') {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'style') {
                Object.assign(el.style, value);
            } else {
                el.setAttribute(key, value);
            }
        });
        if (content) {
            el.innerHTML = content;
        }
        return el;
    },

    /**
     * Get/Set valores de input
     */
    getValue(el) {
        return el.value;
    },

    setValue(el, value) {
        el.value = value;
        return el;
    },

    /**
     * Limpieza de nodos
     */
    clear(el) {
        el.innerHTML = '';
        return el;
    },

    /**
     * Agregar/remover hijos
     */
    append(parent, child) {
        parent.appendChild(child);
        return parent;
    },

    prepend(parent, child) {
        parent.insertBefore(child, parent.firstChild);
        return parent;
    },

    /**
     * Dataset (data attributes)
     */
    getData(el, key) {
        return el.dataset[key];
    },

    setData(el, key, value) {
        el.dataset[key] = value;
        return el;
    },

    /**
     * Try Update - Actualiza elemento solo si existe
     * No lanza error si no encuentra el elemento
     */
    tryUpdate(idOrElement, value) {
        const el = typeof idOrElement === 'string' 
            ? document.getElementById(idOrElement) 
            : idOrElement;
        
        if (el) {
            el.textContent = value;
        }
        return el;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
}
