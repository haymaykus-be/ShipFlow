import Fastify from "fastify";

import { driversRoutes } from "./routes/drivers";
import { dispatchRoutes } from "./routes/dispatch";
import { ordersRoutes } from "./routes/orders";
import { setupErrorHandler } from "./middleware/errorHandler";
import { trackingRoutes } from "./routes/tracking";
// import { setupRateLimit } from "./middleware/rateLimit";
import { eventsRoutes } from "./routes/events";
import { exceptionsRoutes } from "./routes/exceptions";
import { etaRoutes } from "./routes/eta";
import cors from "@fastify/cors";
import { messagesRoutes } from "./routes/messages";

export function buildApp() {
  const app = Fastify({
    logger: true,
    disableRequestLogging: process.env.NODE_ENV === "test",
  });

  app.register(cors, {
    origin: "*",
    methods: ["GET", "POST"],
  });

  // Add Content-Type Parser for JSON
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const json = JSON.parse(body as string);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );
  app.get("/", async () => {
    return { ok: true };
  });

  const API_PREFIX = "/api";

  // setupErrorHandler(app);
  // setupRateLimit(app);

  // Register plugins and routes
  // app.register(setupRateLimit);
  app.register(ordersRoutes, { prefix: API_PREFIX });
  app.register(driversRoutes, { prefix: API_PREFIX });
  app.register(dispatchRoutes, { prefix: API_PREFIX });
  app.register(trackingRoutes, { prefix: API_PREFIX });
  app.register(etaRoutes, { prefix: API_PREFIX });
  app.register(messagesRoutes, { prefix: API_PREFIX });

  app.register(eventsRoutes, { prefix: API_PREFIX });
  app.register(exceptionsRoutes, { prefix: API_PREFIX });

  app.register(setupErrorHandler);

  return app;
}
