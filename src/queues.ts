import { Queue } from "bullmq";
import { redis } from "./config/redis";

export const dispatchQueue = new Queue("dispatch", { connection: redis });
export const etaQueue = new Queue("eta", { connection: redis });
