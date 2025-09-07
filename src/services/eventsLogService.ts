import { prisma } from "../config/db";
import { RateLimiterMemory } from "rate-limiter-flexible";

export async function logEvent(orderId: string, type: string, payload: any) {
  const event = await prisma.eventLog.create({
    data: {
      orderId,
      type,
      payload,
    },
  });
  eventStream.publish(event);
  return event;
}

export async function eventByOrder(
  orderId: string,
  { limit }: { limit: number }
) {
  return prisma.eventLog.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export interface EventsQueryParams {
  page?: number;
  limit?: number;
  orderId?: string;
  type?: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  search?: string;
}

export interface PaginatedEvents {
  data: any[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function getEvents({
  page = 1,
  limit = 20,
  orderId,
  type,
  fromDate,
  toDate,
  search,
}: EventsQueryParams = {}): Promise<PaginatedEvents> {
  const skip = (page - 1) * limit;

  const where: any = {
    ...(orderId && { orderId }),
    ...(type && { type }),
    ...((fromDate || toDate) && {
      createdAt: {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      },
    }),
    ...(search && {
      OR: [
        { type: { contains: search, mode: "insensitive" } },
        { orderId: { contains: search, mode: "insensitive" } },
        { "payload::text": { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.eventLog.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAllEvents({
  page = 1,
  limit = 20,
  orderId,
  type,
  fromDate,
  toDate,
}: {
  page?: number;
  limit?: number;
  orderId?: string;
  type?: string;
  fromDate?: Date;
  toDate?: Date;
} = {}) {
  const skip = (page - 1) * limit;

  const where = {
    ...(orderId && { orderId }),
    ...(type && { type }),
    createdAt: {
      ...(fromDate && { gte: fromDate }),
      ...(toDate && { lte: toDate }),
    },
  };

  const [events, total] = await Promise.all([
    prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        order: {
          select: {
            id: true,
            status: true,
            customerId: true,
          },
        },
      },
    }),
    prisma.eventLog.count({ where }),
  ]);

  return {
    data: events,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Clean up old events (to be called by a scheduled job)
export async function cleanupOldEvents(
  daysToKeep = 30
): Promise<{ count: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await prisma.eventLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return { count: result.count };
}

type EventHandler = (event: any) => void;

class EventStream {
  private subscribers: Set<EventHandler> = new Set();
  private history: any[] = [];
  private readonly maxHistory = 100; // Keep last 100 events

  subscribe(handler: EventHandler, sendHistory = true): () => void {
    // Send historical events first if requested
    if (sendHistory && this.history.length > 0) {
      this.history.forEach((event) => handler(event));
    }

    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  publish(event: any) {
    // Add to history
    this.history.push(event);
    // Keep only the most recent events
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Broadcast to all subscribers
    this.subscribers.forEach((handler) => handler(event));
  }

  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }
}

export const eventStream = new EventStream();

export function subscribeToEvents(handler: EventHandler): () => void {
  return eventStream.subscribe(handler);
}

export const eventStreamRateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 1, // per second
});
