import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

async function main() {
  console.log("🌱 Seeding ShipFlow database & Redis...");

  // Clear DB
  await prisma.assignment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.driver.deleteMany();

  // Clear Redis driver cache
  const keys = await redis.keys("driver:*");
  if (keys.length) await redis.del(keys);

  // Demo drivers
  const driverData = [
    {
      id: "driver-1",
      name: "Alice Johnson",
      vehicleCap: 500,
      status: "available",
      lastLat: 40.7128,
      lastLng: -74.006, // NYC
    },
    {
      id: "driver-2",
      name: "Bob Smith",
      vehicleCap: 200,
      status: "available",
      lastLat: 40.73061,
      lastLng: -73.935242, // Brooklyn
    },
    {
      id: "driver-3",
      name: "Carlos Martinez",
      vehicleCap: 1000,
      status: "busy",
      lastLat: 40.650002,
      lastLng: -73.949997, // Queens
    },
  ];

  await prisma.driver.createMany({ data: driverData });

  // Seed Redis driver cache
  for (const d of driverData) {
    await redis.hset(`driver:${d.id}`, {
      lat: d.lastLat.toString(),
      lng: d.lastLng.toString(),
      capacity: d.vehicleCap.toString(),
      status: d.status,
    });
  }

  console.log(`🚚 Seeded ${driverData.length} drivers`);

  // Demo orders
  const order1 = await prisma.order.create({
    data: {
      id: "order-1",
      pickup: { lat: 40.758896, lng: -73.98513 }, // Times Square
      dropoff: { lat: 40.706001, lng: -74.0088 }, // Wall St
      weight: 100,
      windowStart: new Date(Date.now() + 15 * 60 * 1000),
      windowEnd: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: "pending",
    },
  });

  const order2 = await prisma.order.create({
    data: {
      id: "order-2",
      pickup: { lat: 40.73061, lng: -73.935242 }, // Brooklyn
      dropoff: { lat: 40.650002, lng: -73.949997 }, // Queens
      weight: 300,
      windowStart: new Date(Date.now() + 30 * 60 * 1000),
      windowEnd: new Date(Date.now() + 3 * 60 * 60 * 1000),
      status: "pending",
    },
  });

  console.log(`📦 Seeded orders: ${order1.id}, ${order2.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
