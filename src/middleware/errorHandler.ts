import { FastifyInstance } from "fastify";
import { logger } from "../config/logger";

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _, reply) => {
    logger.error(error);
    reply.code(error.statusCode || 500).send({
      error: error.message || "Internal Server Error",
    });
  });
}
