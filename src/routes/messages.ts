import { FastifyInstance } from "fastify";
import { io } from "../server";
import { messageService, CreateMessageInput } from "../services/messageService";
import { prisma } from "../config/db";

export async function messagesRoutes(app: FastifyInstance) {
  // Send a message
  app.post<{ Body: CreateMessageInput }>("/messages", async (req, reply) => {
    const message = await messageService.createMessage(req.body);

    if (
      !message.orderId ||
      !message.fromUserId ||
      !message.toUserId ||
      !message.content
    ) {
      return reply.code(400).send({
        code: "ERR_INVALID_INPUT",
        message: "Missing required fields",
      });
    }
    // Emit message in private room
    io.to(`user:${req.body.toUserId}`).emit("message", message);
    io.to(`user:${req.body.fromUserId}`).emit("message", message);

    return reply.send(message);
  });

  // Get all messages for a user
  app.get<{ Params: { userId: string } }>(
    "/messages/user/:userId",
    async (req) => {
      return messageService.getUserMessages(req.params.userId);
    }
  );

  // Get messages for a specific order
  app.get("/messages/:orderId/:userA/:userB", async (req, reply) => {
    const { orderId, userA, userB } = req.params as {
      orderId: string;
      userA: string;
      userB: string;
    };

    const participants = [userA, userB].sort();

    const messages = await prisma.message.findMany({
      where: {
        orderId,
        participants: { equals: participants },
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.send(messages);
  });
}
