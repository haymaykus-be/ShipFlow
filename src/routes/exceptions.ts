import { FastifyInstance } from "fastify";

import { sendWebhook } from "../services/webhookService";
import { io } from "../server";
import { logEvent } from "../services/eventsLogService";

export async function exceptionsRoutes(app: FastifyInstance) {
  app.post("/exceptions/:orderId", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const { reason } = req.body as { reason: string };

    if (!reason) return reply.code(400).send({ error: "Missing delay reason" });

    await logEvent(orderId, "SLA_BREACH", { reason });

    // Notify clients via webhook
    await sendWebhook("http://client-system.example.com/webhook", {
      event: "SLA_BREACH",
      orderId,
      reason,
    });

    // Notify live dashboards
    io.to(`shipment:${orderId}`).emit("sla_breach", { orderId, reason });

    return { ok: true };
  });
}
