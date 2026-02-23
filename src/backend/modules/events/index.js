/**
 * Event Module
 * Exporta el módulo completo de Events
 */

export { EventController } from "./event.controller.js";
export { EventService } from "./event.service.js";
export { EventRepository } from "./event.repository.js";
export { default as eventRoutes } from "./event.routes.js";

export default {
  controller: EventController,
  service: EventService,
  repository: EventRepository,
  routes: eventRoutes
};
