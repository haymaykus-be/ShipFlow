import { FastifyInstance } from "fastify";
import { logger } from "../config/logger";
import { AppError } from "../utils/error";

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _, reply) => {
    logger.error(error);

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    } else {
      reply.code(500).send({
        code: "ERR_INTERNAL",
        message: "Unexpected server error",
      });
    }
  });

  app.setNotFoundHandler((_, reply) => {
    reply.code(404).send({
      code: "ERR_NOT_FOUND",
      message: "Route not found",
    });
  });
}
