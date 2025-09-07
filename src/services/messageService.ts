import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CreateMessageInput {
  fromUserId: string;
  toUserId: string;
  orderId?: string;
  content: string;
}

export const messageService = {
  /**
   * Create a new message
   */
  async createMessage(data: CreateMessageInput) {
    const participants = [data.fromUserId, data.toUserId].sort();
    return prisma.message.create({
      data: {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        participants,
        orderId: data.orderId,
        content: data.content,
      },
    });
  },

  /**
   * Get conversation history between two users
   */
  async getConversation(userId: string, peerId: string) {
    return prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: peerId },
          { fromUserId: peerId, toUserId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * Get all messages for a user
   */
  async getUserMessages(userId: string) {
    return prisma.message.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Get messages for a specific order
   */
  async getOrderMessages(orderId: string, userId: string) {
    return prisma.message.findMany({
      where: {
        orderId,
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: "asc" },
    });
  },
};
