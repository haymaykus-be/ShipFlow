import { buildApp } from "./app";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./config/logger";
import { AppError, ERRORS } from "./utils/error";
import { eventByOrder } from "./services/eventsLogService";
import { messageService } from "./services/messageService";

// Export the Socket.IO server instance
export let io: SocketIOServer;

async function start() {
  const app = buildApp();
  await app.ready(); // ✅ ensure routes/plugins are loaded

  const port = Number(process.env.PORT) || 3000;

  // Attach Socket.IO to Fastify's server
  io = new SocketIOServer(app.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`🔗 Socket connected: ${socket.id}`);

    // Structured socket error handling
    socket.on("error", (err) => {
      if (err instanceof AppError) {
        socket.emit("error", { code: err.code, message: err.message });
      } else if (err instanceof Error) {
        socket.emit("error", { code: "ERR_INTERNAL", message: err.message });
      } else {
        socket.emit("error", { code: "ERR_UNKNOWN", message: "Unknown error" });
      }
      logger.error(`⚡ Socket error on ${socket.id}`, { err });
    });

    socket.on("join_user", (trackingToken: string) => {
      socket.join(`user:${trackingToken}`);
      logger.info(
        `👤 Socket ${socket.id} joined private user room ${trackingToken}`
      );
    });

    // Direct message
    socket.on("direct_message", async (msg) => {
      const { fromUserId, toUserId, orderId, content } = msg;

      const saved = await messageService.createMessage({
        fromUserId,
        toUserId,
        orderId,
        content,
      });

      io.to(`user:${toUserId}`).emit("message", saved);
      io.to(`user:${fromUserId}`).emit("message", saved);
      socket.emit("message_sent", saved);
    });

    socket.on("join_shipment", (shipmentId: string) => {
      try {
        if (!shipmentId) throw ERRORS.INVALID_INPUT("Missing shipmentId");

        socket.join(`shipment:${shipmentId}`);
        logger.info(
          `📦 Socket ${socket.id} joined shipment room ${shipmentId}`
        );

        socket.emit("joined", {
          room: `shipment:${shipmentId}`,
          message: "Joined shipment tracking successfully",
        });
      } catch (err: any) {
        socket.emit("error", {
          code: err.code || "ERR_INTERNAL",
          message: err.message || "Failed to join shipment room",
        });
        logger.error("🚨 Socket join error", { err });
      }
    });

    socket.on("join_events", async (orderId: string) => {
      if (!orderId) {
        return socket.emit("error", {
          code: "ERR_INVALID_INPUT",
          message: "Missing orderId",
        });
      }

      socket.join(`events:${orderId}`);
      logger.info(`📡 Socket ${socket.id} subscribed to events:${orderId}`);

      // Send backlog of events immediately
      const events = await eventByOrder(orderId, { limit: 100 });

      socket.emit("event_history", { orderId, events });
    });

    socket.on("disconnect", (reason) => {
      logger.info(`🔌 Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  await app.listen({ port, host: "0.0.0.0" });
  logger.info(`🚀 ShipFlow running at http://localhost:${port}`);
}

start().catch((err) => {
  logger.error("❌ Failed to start ShipFlow", { err });
  process.exit(1);
});
