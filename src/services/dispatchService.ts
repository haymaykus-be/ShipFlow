import { prisma } from "../config/db";
import { haversineDistance, estimateETA } from "../utils/geo";
import { ERRORS } from "../utils/error";
import { logEvent } from "./eventsLogService";

export async function findBestDriver(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ERRORS.ORDER_NOT_FOUND(orderId);

  const drivers = await prisma.driver.findMany({
    where: { status: "available" },
  });
  if (!drivers.length) throw ERRORS.NO_DRIVERS_AVAILABLE();

  let bestDriver = null;
  let bestDist = Infinity;

  for (const driver of drivers) {
    if (!driver.lastLat || !driver.lastLng) continue;

    const { lat = 0, lng = 0 } = order.pickup as { lat: number; lng: number };
    const dist = haversineDistance(
      [driver.lastLng, driver.lastLat],
      [lng, lat]
    );
    if (dist < bestDist && driver.vehicleCap >= order.weight) {
      bestDist = dist;
      bestDriver = driver;
    }
  }

  if (!bestDriver) throw ERRORS.NO_DRIVERS_AVAILABLE();

  const etaMinutes = estimateETA(bestDist);
  const eta = new Date(Date.now() + etaMinutes * 60 * 1000);

  const assignment = prisma.assignment.create({
    data: {
      orderId,
      driverId: bestDriver.id,
      eta,
    },
  });

  await logEvent(orderId, "ASSIGNMENT_CREATED", {
    driverId: bestDriver.id,
    eta,
  });

  return assignment;
}

export async function getAssignment(id: string) {
  return prisma.assignment.findUnique({
    where: { id },
    include: { order: true, driver: true },
  });
}
