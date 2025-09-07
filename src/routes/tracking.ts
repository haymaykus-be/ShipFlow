import { FastifyInstance } from "fastify";
import { prisma } from "../config/db";

export async function trackingRoutes(app: FastifyInstance) {
  // ✅ Get tracking info by orderId
  app.get("/tracking/:orderId", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };
    const { token } = req.query as { token?: string };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignments: {
          include: { driver: true },
        },
      },
    });

    if (!order) {
      return reply
        .code(404)
        .send({ code: "ERR_NOT_FOUND", message: "Order not found" });
    }

    if (token !== order.trackingToken) {
      return reply.code(403).send({
        code: "ERR_FORBIDDEN",
        message: "Invalid or missing tracking token",
      });
    }

    // Prepare clean response
    const driver =
      order.assignments.length > 0 ? order.assignments[0].driver : null;

    return reply.send({
      orderId: order.id,
      customerId: order.customerId,
      trackingToken: order.trackingToken,
      driverId: driver?.id || null,
      driverName: driver?.name || null,
      driverStatus: driver?.status || null,
      eta: order.assignments.length > 0 ? order.assignments[0].eta : null,
      status: order.status,
    });
  });
}
