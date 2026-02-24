/**
 * UI Version Configuration
 * Centraliza el versionado de recursos estáticos para cache busting
 * 
 * USO:
 * En HTML: /css/dashboard.css?v=2.7.0
 * En JS: import { UI_VERSION } from './config/ui-version.js'
 */

// Version actual del sistema UI
export const UI_VERSION = "2.7.3";

// Helper para generar URLs con versión
export function versionedUrl(path) {
  return `${path}?v=${UI_VERSION}`;
}

// Configuración de recursos versionados
export const VERSIONED_RESOURCES = {
  css: {
    modern: `/css/modern.css?v=${UI_VERSION}`,
    dashboard: `/css/dashboard.css?v=${UI_VERSION}`,
    leader: `/css/leader.css?v=${UI_VERSION}`,
    analytics: `/css/analytics-enhanced.css?v=${UI_VERSION}`
  },
  js: {
    index: `/js/index.js?v=${UI_VERSION}`,
    dashboard: `/js/dashboard.js?v=${UI_VERSION}`,
    leader: `/js/leader/leader-main.js?v=${UI_VERSION}`,
    xlsx: `/js/xlsx.full.min.js?v=${UI_VERSION}`
  }
};

// Log de versiones (para debugging)
export const VERSION_HISTORY = [
  { version: "2.7.3", date: "2026-02-24", changes: "Alias en puestos + cache busting" },
  { version: "2.7.0", date: "2026-02-23", changes: "Refactorización UI - Rutas absolutas y versionado unificado" },
  { version: "2.6.0", date: "2026-02-23", changes: "Rediseño SaaS de Solicitudes de Eliminación" },
  { version: "2.5.0", date: "2026-02-20", changes: "Integración sistema de notificaciones" }
];

console.log(`🎨 UI Version: ${UI_VERSION}`);
