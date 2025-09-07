import { Worker } from "bullmq";
import { redis } from "../config/redis";
import { prisma } from "../config/db";
import { haversineDistance, estimateETA } from "../utils/geo";
import { io } from "../server";

import { logger } from "../config/logger";
import { ERRORS } from "../utils/error";
import { logEvent } from "../services/eventsLogService";
import { getEtaAdjustmentFactor } from "../services/etaService";

export const etaWorker = new Worker(
  "eta",
  async (job) => {
    const { assignmentId, driverId } = job.data;
    logger.info(
      `🕒 ETA job started for assignment ${assignmentId} (driver: ${driverId})`
    );

    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { order: true, driver: true },
      });

      if (!assignment) throw ERRORS.ETA_CALC_FAILED(assignmentId);

      const { order, driver } = assignment;
      if (!driver?.lastLat || !driver?.lastLng)
        throw ERRORS.ETA_CALC_FAILED(assignmentId);

      const { lat = 0, lng = 0 } = order.dropoff as {
        lat: number;
        lng: number;
      };

      const dist = haversineDistance(
        [driver.lastLng, driver.lastLat],
        [lng, lat]
      );

      const baseEtaMinutes = estimateETA(dist);
      const adjustment = await getEtaAdjustmentFactor(driver.id);
      const etaMinutes = Math.round(baseEtaMinutes * adjustment);
      const newEta = new Date(Date.now() + etaMinutes * 60 * 1000);

      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { eta: newEta },
      });

      await logEvent(order.id, "ETA_UPDATED", {
        driverId,
        distanceKm: dist,
        baseEtaMinutes,
        adjustment,
        predictedEta: newEta,
      });

      io.to(`shipment:${order.id}`).emit("eta_update", {
        orderId: order.id,
        driverId,
        distanceKm: dist,
        baseEtaMinutes,
        adjustment,
        predictedEta: newEta,
      });

      return { eta: newEta, distanceKm: dist };
    } catch (err: any) {
      throw ERRORS.ETA_CALC_FAILED(assignmentId);
    }
  },
  { connection: redis }
);

etaWorker.on("failed", (job, err) => {
  logger.error(`❌ ETA job ${job?.id} failed`, {
    code: (err as any).code || "ERR_INTERNAL",
    message: err.message,
  });
});
