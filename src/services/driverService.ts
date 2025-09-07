import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { z } from "zod";
import { logEvent } from "./eventsLogService";

// More flexible ID validation that allows any string but trims whitespace
export const driverStatusSchema = z.object({
  id: z.string().min(1, "ID is required").trim(),
  lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  lng: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  capacity: z.number().positive("Capacity must be a positive number"),
  status: z.enum(["available", "busy", "offline"]),
});

export type DriverStatusInput = z.infer<typeof driverStatusSchema>;

export async function upsertDriverStatus(input: DriverStatusInput) {
  try {
    // Generate a consistent ID for the driver
    const driverId = input.id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
      ? input.id
      : input.id
          .replace(/^driver-/, "")
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase();

    // Update Redis cache
    await redis.hset(`driver:${driverId}`, {
      lat: input.lat.toString(),
      lng: input.lng.toString(),
      capacity: input.capacity.toString(),
      status: input.status,
    });

    // Update database
    const driver = await prisma.driver.upsert({
      where: { id: driverId },
      update: {
        lastLat: input.lat,
        lastLng: input.lng,
        vehicleCap: input.capacity,
        status: input.status,
      },
      create: {
        id: driverId,
        name: driverId.startsWith("driver-")
          ? driverId
          : `Driver-${driverId}`.substring(0, 50),
        lastLat: input.lat,
        lastLng: input.lng,
        vehicleCap: input.capacity,
        status: input.status,
      },
    });

    await redis.hset(`driver:${input.id}`, {
      lat: input.lat.toString(),
      lng: input.lng.toString(),
      capacity: input.capacity.toString(),
      status: input.status,
    });

    await logEvent("system", "DRIVER_STATUS", {
      driverId: driver.id,
      ...input,
    });

    return driver;
  } catch (error) {
    logger.error("Failed to upsert driver status", { error, input });
    throw new Error("Failed to update driver status");
  }
}

export async function getDriver(id: string) {
  try {
    return await prisma.driver.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            order: true,
          },
        },
      },
    });
  } catch (error) {
    logger.error("Failed to get driver", { error, driverId: id });
    throw new Error("Failed to retrieve driver");
  }
}

export async function getDrivers() {
  try {
    return await prisma.driver.findMany();
  } catch (error) {
    logger.error("Failed to get drivers", { error });
    throw new Error("Failed to retrieve drivers");
  }
}

export async function getDriverAssignments(id: string) {
  try {
    return await prisma.assignment.findMany({
      where: { driverId: id },
      include: {
        order: {
          select: {
            id: true,
            pickup: true,
            dropoff: true,
            trackingToken: true,
            status: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });
  } catch (error) {
    logger.error("Failed to get driver assignments", { error, driverId: id });
    throw new Error("Failed to retrieve driver assignments");
  }
}

export async function completeAssignment(id: string) {
  try {
    return await prisma.assignment.findUnique({
      where: { id },
      include: { order: true, driver: true },
    });
  } catch (error) {
    logger.error("Failed to get compelte driver assignment", {
      error,
      driverId: id,
    });
    throw new Error("Failed to complete driver assignment");
  }
}
