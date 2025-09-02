import { FastifyInstance } from "fastify";
import { findBestDriver } from "../services/dispatchService";

export async function dispatchRoutes(app: FastifyInstance) {
  app.post("/dispatch/run", async (req, reply) => {
    const { orderId } = req.body as { orderId: string };

    const assignment = await findBestDriver(orderId);

    reply.send({ assignment });
  });
}
