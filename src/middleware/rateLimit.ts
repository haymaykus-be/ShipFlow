import rateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

export async function setupRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 10, // max requests per window
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      code: "ERR_RATE_LIMIT",
      message: "Too many requests, please try again later",
    }),
  });
}
