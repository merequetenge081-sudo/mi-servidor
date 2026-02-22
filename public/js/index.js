// Punto de entrada para módulos frontend
// Este archivo exporta todos los módulos organizados

// Utils
export * from './utils/constants.js';
export * from './utils/helpers.js';

// Modules
export * from './modules/ui.module.js';

// Nota: Para usar estos módulos en un archivo HTML, agregar:
// <script type="module" src="/js/index.js"></script>
// O importar individualmente:
// import { showAlert, getBogotaLocalidades } from '/js/index.js';
