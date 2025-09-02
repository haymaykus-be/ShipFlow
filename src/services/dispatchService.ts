import { prisma } from "../config/db";
import { haversineDistance, estimateETA } from "../utils/geo";

export async function findBestDriver(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const drivers = await prisma.driver.findMany({
    where: { status: "available" },
  });
  if (!drivers.length) throw new Error("No drivers available");
  const { lat = 0, lng = 0 } = order.pickup as { lat: number; lng: number };

  let bestDriver: { id: string } | null = null;
  let bestDist = Infinity;

  for (const driver of drivers) {
    if (!driver.lastLat || !driver.lastLng) continue;
    const dist = haversineDistance(
      [driver.lastLng, driver.lastLat],
      [lng, lat]
    );
    if (dist < bestDist && driver.vehicleCap >= order.weight) {
      bestDist = dist;
      bestDriver = driver;
    }
  }

  if (!bestDriver) throw new Error("No suitable driver found");

  const etaMinutes = estimateETA(bestDist);
  const eta = new Date(Date.now() + etaMinutes * 60 * 1000);

  return prisma.assignment.create({
    data: {
      orderId,
      driverId: bestDriver.id,
      eta,
    },
  });
}
