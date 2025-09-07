import { prisma } from "../config/db";

export async function recordEtaHistory(
  orderId: string,
  driverId: string,
  distanceKm: number,
  etaMinutes: number,
  actualMinutes: number
) {
  return prisma.etaHistory.create({
    data: { orderId, driverId, distanceKm, etaMinutes, actualMinutes },
  });
}

export async function getEtaAdjustmentFactor(driverId: string) {
  const history = await prisma.etaHistory.findMany({
    where: { driverId },
    orderBy: { createdAt: "desc" },
    take: 50, // last 50 trips
  });

  if (!history.length) return 1; // no adjustment

  const ratios = history.map((h) => h.actualMinutes / h.etaMinutes);
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  return avg; // e.g., 1.2 = usually 20% slower
}
