import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../config/db";

const orderSchema = z.object({
  id: z.string().uuid().optional(),
  pickup: z.object({ lat: z.number(), lng: z.number() }),
  dropoff: z.object({ lat: z.number(), lng: z.number() }),
  weight: z.number().positive(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});

export async function ordersRoutes(app: FastifyInstance) {
  app.post("/orders", async (req, reply) => {
    const parsed = orderSchema.parse(req.body);

    const order = await prisma.order.upsert({
      where: { id: parsed.id || "noop" },
      update: parsed,
      create: parsed,
    });

    reply.send(order);
  });
}
