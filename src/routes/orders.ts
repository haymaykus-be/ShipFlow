import { FastifyInstance } from "fastify";
import {
  completeOrder,
  getOrder,
  getOrders,
  getUnassignedOrders,
  orderSchema,
  upsertOrder,
} from "../services/orderService";
import { io } from "../server";
import { prisma } from "../config/db";
import { logEvent } from "../services/eventsLogService";

export async function ordersRoutes(app: FastifyInstance) {
  app.post("/orders", async (req, reply) => {
    const parsed = orderSchema.parse(req.body);
    const order = await upsertOrder(parsed);
    const link = `${
      process.env.PUBLIC_TRACKING_URL || "http://localhost:3001"
    }/tracking/${order.id}?token=${order.trackingToken}`;

    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        assignments: {
          include: { driver: true },
        },
      },
    });
    reply.send({ ...fullOrder, link });
  });

  // List all orders
  app.get("/orders", async (_, reply) => {
    const orders = await getOrders();

    return reply.send(orders);
  });

  // Get single order
  app.get("/orders/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await getOrder(id);
    if (!order)
      return reply.code(404).send({
        code: "ERR_ORDER_NOT_FOUND",
        message: `Order ${id} not found`,
      });
    return reply.send(order);
  });
  app.post("/orders/:id/complete", async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await completeOrder(id);

    io.to(`shipment:${id}`).emit("order_completed", { orderId: id });

    return { ok: true, order };
  });

  app.get("/orders/unassigned", async (_, reply) => {
    const orders = await getUnassignedOrders();
    return reply.send(orders);
  });

  app.post("/orders/:id/confirm", async (req, reply) => {
    const { id } = req.params as { id: string };

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return reply
        .code(404)
        .send({ code: "ERR_NOT_FOUND", message: "Order not found" });
    }
    if (order.status !== "delivered_pending") {
      return reply.code(400).send({
        code: "ERR_INVALID_STATE",
        message: "Order not awaiting confirmation",
      });
    }

    const completed = await prisma.order.update({
      where: { id },
      data: { status: "completed" },
    });

    await logEvent(completed.id, "ORDER_COMPLETED", {
      confirmedBy: "customer",
    });

    io.emit("event", {
      type: "ORDER_COMPLETED",
      payload: { orderId: completed.id },
    });
    io.to(`shipment:${completed.id}`).emit("order_completed", {
      orderId: completed.id,
    });

    return { ok: true, order: completed };
  });
}
