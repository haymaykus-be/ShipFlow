import { FastifyInstance } from "fastify";
import { logger } from "../config/logger";
import {
  driverStatusSchema,
  upsertDriverStatus,
  getDriver,
  getDrivers,
  getDriverAssignments,
  completeAssignment,
} from "../services/driverService";
import { prisma } from "../config/db";
import { logEvent } from "../services/eventsLogService";
import { io } from "../server";

export async function driversRoutes(app: FastifyInstance) {
  // Update driver status
  app.post("/drivers/status", async (req, reply) => {
    try {
      const parsed = driverStatusSchema.parse(req.body);
      const driver = await upsertDriverStatus(parsed);
      return reply.status(200).send(driver);
    } catch (error) {
      logger.error("Failed to update driver status", { error });
      return reply.status(400).send({
        code: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "Invalid input data",
      });
    }
  });

  // Get driver by ID
  app.get("/drivers/:id", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const driver = await getDriver(id);

      if (!driver) {
        return reply.status(404).send({
          code: "DRIVER_NOT_FOUND",
          message: `Driver ${id} not found`,
        });
      }

      return reply.status(200).send(driver);
    } catch (error) {
      logger.error("Failed to get driver", { error });
      return reply.status(500).send({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve driver",
      });
    }
  });

  // List all drivers
  app.get("/drivers", async (_, reply) => {
    try {
      const drivers = await getDrivers();
      return reply.status(200).send(drivers);
    } catch (error) {
      logger.error("Failed to list drivers", { error });
      return reply.status(500).send({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve drivers",
      });
    }
  });

  // Get driver assignments
  app.get("/drivers/:id/assignments", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const assignments = await getDriverAssignments(id);

      if (!assignments) {
        return reply.status(404).send({
          code: "DRIVER_NOT_FOUND",
          message: `Driver ${id} not found`,
        });
      }

      return reply.status(200).send(assignments);
    } catch (error) {
      logger.error("Failed to get driver assignments", { error });
      return reply.status(500).send({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve driver assignments",
      });
    }
  });

  // Complete assignment
  app.post("/drivers/:id/assignments/:id/complete", async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const assignment = await completeAssignment(id);

      if (!assignment) {
        return reply.status(404).send({
          code: "ASSIGNMENT_NOT_FOUND",
          message: `Assignment ${id} not found`,
        });
      }
      await prisma.order.update({
        where: { id: assignment.orderId },
        data: { status: "completed" },
      });
      await logEvent(assignment.orderId, "ORDER_COMPLETED", {
        driverId: assignment.driverId,
      });

      io.emit("event", {
        type: "ORDER_COMPLETED",
        payload: {
          orderId: assignment.orderId,
          driverId: assignment.driverId,
        },
      });
      io.to(`shipment:${assignment.orderId}`).emit("order_completed", {
        orderId: assignment.orderId,
      });

      return { ok: true, assignmentId: assignment.id };
    } catch (error) {
      logger.error("Failed to complete assignment", { error });
      return reply.status(500).send({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to complete assignment",
      });
    }
  });

  app.post("/assignments/:id/mark-delivered", async (req, reply) => {
    const { id } = req.params as { id: string };

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { order: true, driver: true },
    });

    if (!assignment) {
      return reply
        .code(404)
        .send({ code: "ERR_NOT_FOUND", message: "Assignment not found" });
    }

    // Mark order as delivered_pending
    const order = await prisma.order.update({
      where: { id: assignment.orderId },
      data: { status: "delivered_pending" },
    });

    await logEvent(order.id, "ORDER_DELIVERED_PENDING", {
      driverId: assignment.driverId,
    });

    io.emit("event", {
      type: "ORDER_DELIVERED_PENDING",
      payload: { orderId: order.id, driverId: assignment.driverId },
    });
    io.to(`shipment:${order.id}`).emit("order_delivered_pending", {
      orderId: order.id,
    });

    return { ok: true, order };
  });
}
