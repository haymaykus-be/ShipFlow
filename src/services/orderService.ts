import { prisma } from "../config/db";
import { z } from "zod";
import { ERRORS } from "../utils/error";
import { logEvent } from "./eventsLogService";
import { recordEtaHistory } from "./etaService";
import { io } from "../server";
import { dispatchQueue } from "../queues";

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const orderSchema = z.object({
  id: z.string().uuid().optional(),
  pickup: locationSchema,
  dropoff: locationSchema,
  weight: z.number().positive(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});

export type OrderInput = z.infer<typeof orderSchema>;

export async function upsertOrder(input: OrderInput) {
  const order = await prisma.order.upsert({
    where: { id: input.id || "noop" },
    update: {
      pickup: input.pickup,
      dropoff: input.dropoff,
      weight: input.weight,
      windowStart: new Date(input.windowStart),
      windowEnd: new Date(input.windowEnd),
    },
    create: {
      pickup: input.pickup,
      dropoff: input.dropoff,
      weight: input.weight,
      windowStart: new Date(input.windowStart),
      windowEnd: new Date(input.windowEnd),
    },
  });

  await logEvent(order.id, input.id ? "ORDER_UPDATED" : "ORDER_CREATED", order);

  // Auto-assign on new order
  if (!input.id) {
    await autoAssignRandomDriver(order.id, order.weight);
  }

  return order;
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw ERRORS.ORDER_NOT_FOUND(id);
  return order;
}

export async function getOrders() {
  return prisma.order.findMany({
    include: {
      assignments: {
        include: { driver: true },
      },
    },
  });
}

export async function completeOrder(orderId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { orderId },
    include: { order: true, driver: true },
  });

  if (!assignment) throw new Error(`No assignment found for order ${orderId}`);

  // Mark order as completed
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: "completed" },
  });

  // Calculate actual time (in minutes)
  const createdAt = assignment.assignedAt.getTime();
  const deliveredAt = Date.now();
  const actualMinutes = Math.round((deliveredAt - createdAt) / 60000);

  const baseEtaMinutes = Math.round(
    (assignment.eta.getTime() - createdAt) / 60000
  );

  await recordEtaHistory(
    orderId,
    assignment.driverId,
    0,
    baseEtaMinutes,
    actualMinutes
  );

  await logEvent(orderId, "ORDER_COMPLETED", {
    driverId: assignment.driverId,
    actualMinutes,
    baseEtaMinutes,
  });

  return order;
}

async function autoAssignRandomDriver(orderId: string, weight: number) {
  const drivers = await prisma.driver.findMany({
    where: { status: "available", vehicleCap: { gte: weight } },
  });

  if (!drivers.length) {
    // 🚩 Queue fallback if no drivers
    await dispatchQueue.add(
      "await-driver",
      { orderId, weight },
      { attempts: 20, backoff: { type: "exponential", delay: 5000 } }
    );

    await logEvent(orderId, "NO_DRIVERS_AVAILABLE", {});
    return;
  }

  const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
  const eta = new Date(
    Date.now() + (Math.floor(Math.random() * 20) + 10) * 60 * 1000
  );

  const assignment = await prisma.assignment.create({
    data: {
      orderId,
      driverId: randomDriver.id,
      eta,
    },
  });

  await logEvent(orderId, "ASSIGNMENT_CREATED", {
    driverId: randomDriver.id,
    eta,
  });

  // Emit live events
  io.emit("event", {
    type: "ASSIGNMENT_CREATED",
    payload: { orderId, driverId: randomDriver.id, eta },
  });

  io.to(`shipment:${orderId}`).emit("assignment", {
    orderId,
    driverId: randomDriver.id,
    eta,
  });

  return assignment;
}

export async function getUnassignedOrders() {
  return prisma.order.findMany({
    where: { assignments: { none: {} }, status: "pending" },
  });
}
