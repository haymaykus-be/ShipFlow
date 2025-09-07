import { FastifyInstance } from "fastify";
import { prisma } from "../config/db";
import { haversineDistance, estimateETA } from "../utils/geo";
import { getEtaAdjustmentFactor } from "../services/etaService";
import { io } from "../server";
import { logEvent } from "../services/eventsLogService";

export async function etaRoutes(app: FastifyInstance) {
  app.get("/eta/predict/:orderId", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };

    const assignment = await prisma.assignment.findFirst({
      where: { orderId },
      include: { order: true, driver: true },
    });

    if (!assignment) {
      return reply.code(404).send({
        code: "ERR_ASSIGNMENT_NOT_FOUND",
        message: `No active assignment found for order ${orderId}`,
      });
    }

    const { driver, order } = assignment;
    if (!driver?.lastLat || !driver?.lastLng || !order?.dropoff) {
      return reply.code(400).send({
        code: "ERR_DRIVER_NO_LOCATION",
        message: `Driver ${driver.id} has no location data`,
      });
    }

    const { lat = 0, lng = 0 } = order.dropoff as {
      lat: number;
      lng: number;
    };

    // Base distance & ETA
    const distKm = haversineDistance(
      [driver.lastLng, driver.lastLat],
      [lng, lat]
    );
    const baseEtaMinutes = estimateETA(distKm);

    // Predictive adjustment factor (based on driver history)
    const adjustment = await getEtaAdjustmentFactor(driver.id);
    const etaMinutes = Math.round(baseEtaMinutes * adjustment);

    const predictedEta = new Date(Date.now() + etaMinutes * 60 * 1000);

    const result = {
      orderId,
      driverId: driver.id,
      distanceKm: distKm,
      baseEtaMinutes,
      adjustment,
      predictedEta,
    };

    // Log + broadcast predictive ETA
    await logEvent(orderId, "ETA_PREDICTED", result);
    io.to(`events:${orderId}`).emit("event", {
      type: "ETA_PREDICTED",
      payload: result,
    });
    io.to(`shipment:${orderId}`).emit("eta_update", result);

    return result;
  });
}
