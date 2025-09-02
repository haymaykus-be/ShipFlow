import Fastify from "fastify";

import { driversRoutes } from "./modules/drivers";
import { dispatchRoutes } from "./modules/dispatch";
import { ordersRoutes } from "./modules/orders";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(ordersRoutes);
  app.register(driversRoutes);
  app.register(dispatchRoutes);

  return app;
}
