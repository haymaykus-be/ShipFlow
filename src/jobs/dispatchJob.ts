import { Worker } from "bullmq";
import { redis } from "../config/redis";
import { prisma } from "../config/db";

import { logger } from "../config/logger";
import { ERRORS } from "../utils/error";
import { logEvent } from "../services/eventsLogService";
import { io } from "../server";

export const dispatchWorker = new Worker(
  "dispatch",
  async (job) => {
    const { orderId, weight } = job.data;
    logger.info(`📦 Running dispatch for order ${orderId}`);

    try {
      const drivers = await prisma.driver.findMany({
        where: { status: "available", vehicleCap: { gte: weight } },
      });

      if (!drivers.length) {
        // Put back in queue for retry
        throw new Error("No drivers available yet");
      }

      const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
      const eta = new Date(
        Date.now() + (Math.floor(Math.random() * 20) + 10) * 60 * 1000
      );

      const assignment = await prisma.assignment.create({
        data: { orderId, driverId: randomDriver.id, eta },
      });

      await logEvent(orderId, "ASSIGNMENT_CREATED", {
        driverId: randomDriver.id,
        eta,
      });

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
    } catch (err: any) {
      throw ERRORS.ASSIGNMENT_FAILED(orderId);
    }
  },
  { connection: redis }
);

dispatchWorker.on("completed", (job) => {
  logger.info(`✅ Dispatch job ${job?.id} completed`, {
    code: "OK",
    message: "Dispatch job completed successfully",
  });
});

dispatchWorker.on("failed", (job, err) => {
  logger.error(`❌ Dispatch job ${job?.id} failed`, {
    code: (err as any).code || "ERR_INTERNAL",
    message: err.message,
  });
});
