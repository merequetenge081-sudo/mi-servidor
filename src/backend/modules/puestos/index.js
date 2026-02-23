/**
 * Puesto Module
 * Exporta el módulo completo de Puestos (Polling Places)
 */

export { PuestoController } from "./puesto.controller.js";
export { PuestoService } from "./puesto.service.js";
export { PuestoRepository } from "./puesto.repository.js";
export { default as puestoRoutes } from "./puesto.routes.js";

export default {
  controller: PuestoController,
  service: PuestoService,
  repository: PuestoRepository,
  routes: puestoRoutes
};
