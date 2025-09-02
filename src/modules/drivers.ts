import { FastifyInstance } from "fastify";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { z } from "zod";

const statusSchema = z.object({
  id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  capacity: z.number(),
  status: z.enum(["available", "busy", "offline"]),
});

export async function driversRoutes(app: FastifyInstance) {
  app.post("/drivers/status", async (req, reply) => {
    const parsed = statusSchema.parse(req.body);

    await prisma.driver.upsert({
      where: { id: parsed.id },
      update: {
        lastLat: parsed.lat,
        lastLng: parsed.lng,
        vehicleCap: parsed.capacity,
        status: parsed.status,
      },
      create: {
        id: parsed.id,
        name: `Driver-${parsed.id}`,
        lastLat: parsed.lat,
        lastLng: parsed.lng,
        vehicleCap: parsed.capacity,
        status: parsed.status,
      },
    });

    await redis.hset(`driver:${parsed.id}`, {
      lat: parsed.lat.toString(),
      lng: parsed.lng.toString(),
      capacity: parsed.capacity.toString(),
      status: parsed.status,
    });

    reply.send({ ok: true });
  });
}
