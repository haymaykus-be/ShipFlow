import axios from "axios";
import { logger } from "../config/logger";

export async function sendWebhook(url: string, event: any) {
  try {
    await axios.post(url, event);
    logger.info(`✅ Webhook sent to ${url}`, { event });
  } catch (err: any) {
    logger.error(`❌ Webhook failed to ${url}`, { error: err.message });
  }
}
