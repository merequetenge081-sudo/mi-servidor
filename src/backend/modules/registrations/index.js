/**
 * Registration Module
 * Exporta el módulo completo de Registrations
 */

export { RegistrationController } from "./registration.controller.js";
export { RegistrationService } from "./registration.service.js";
export { RegistrationRepository } from "./registration.repository.js";
export { default as registrationRoutes } from "./registration.routes.js";

export default {
  controller: require("./registration.controller.js").RegistrationController,
  service: require("./registration.service.js").RegistrationService,
  repository: require("./registration.repository.js").RegistrationRepository,
  routes: require("./registration.routes.js").default
};
