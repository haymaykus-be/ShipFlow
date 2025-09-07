import {
  eventByOrder,
  eventStream,
  logEvent,
  subscribeToEvents,
  getEvents,
  cleanupOldEvents,
  eventStreamRateLimiter,
  EventsQueryParams,
} from "../services/eventsLogService";
import { FastifyInstance } from "fastify";

export async function eventsRoutes(app: FastifyInstance) {
  // Get paginated and filtered events
  app.get<{ Querystring: EventsQueryParams }>(
    "/events",
    async (request, reply) => {
      try {
        const result = await getEvents(request.query);
        return reply.send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch events" });
      }
    }
  );

  // Clean up old events (protected admin endpoint)
  app.post("/events/cleanup", async (request, reply) => {
    try {
      const { daysToKeep = 30 } = request.body as { daysToKeep?: number };
      const result = await cleanupOldEvents(daysToKeep);
      return reply.send({
        success: true,
        message: `Cleaned up events older than ${daysToKeep} days`,
        ...result,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Failed to clean up events" });
    }
  });

  // Real-time event stream with rate limiting
  app.get("/events/stream", async (request, reply) => {
    // Apply rate limiting
    try {
      await eventStreamRateLimiter.consume(request.ip);
    } catch (error) {
      return reply.status(429).send({ error: "Too many requests" });
    }

    // Set SSE and CORS headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept",
    });

    // Send initial comment to establish connection
    reply.raw.write(":ok\n\n");

    try {
      // Send historical events first
      const history = eventStream.getHistory();
      for (const event of history) {
        if (reply.raw.writableEnded) break;
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        // Add a small delay to prevent overwhelming the client
        await new Promise((resolve) => setImmediate(resolve));
      }

      // Subscribe to new events
      const unsubscribe = subscribeToEvents((event) => {
        try {
          if (!reply.raw.writableEnded) {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } catch (error) {
          app.log.error("Error sending SSE:");
          unsubscribe();
          if (!reply.raw.writableEnded) {
            reply.raw.end();
          }
        }
      });

      // Handle client disconnect
      const handleClose = () => {
        unsubscribe();
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      };

      request.raw.on("close", handleClose);
      request.raw.on("error", handleClose);
    } catch (error) {
      app.log.error("Error in SSE stream:");
      if (!reply.raw.writableEnded) {
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  });

  app.post("/events/webhooks", async (req, reply) => {
    const event = req.body as { orderId: string; type: string; payload: any };
    if (!event.orderId)
      return reply.code(400).send({ error: "Missing orderId" });

    await logEvent(event.orderId, event.type, event.payload);

    return { ok: true };
  });

  app.get("/events/:orderId", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };

    const events = await eventByOrder(orderId, { limit: 100 });

    if (!events.length) {
      return reply.code(404).send({
        code: "ERR_NO_EVENTS",
        message: `No events found for order ${orderId}`,
      });
    }

    return { orderId, events };
  });

  app.get("/events/:orderId/stream", async (req, reply) => {
    const { orderId } = req.params as { orderId: string };

    // NOTE: This is just a REST entrypoint; actual streaming happens over sockets
    return {
      orderId,
      socketRoom: `events:${orderId}`,
      message:
        "Connect via Socket.IO and join this room to receive live event logs.",
    };
  });
}
