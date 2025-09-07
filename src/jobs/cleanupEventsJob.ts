import { logger } from "../config/logger";
import { cleanupOldEvents } from "../services/eventsLogService";
import { Job } from "bullmq";

export const CLEANUP_EVENTS_JOB_NAME = "cleanup-old-events";
const DEFAULT_DAYS_TO_KEEP = 30;

export async function processCleanupEventsJob(job: Job) {
  const { daysToKeep = DEFAULT_DAYS_TO_KEEP } = job.data;

  try {
    logger.info(`Starting cleanup of events older than ${daysToKeep} days`);
    const result = await cleanupOldEvents(daysToKeep);

    logger.info(`Cleaned up ${result.count} old events`);
    return {
      success: true,
      message: `Cleaned up ${result.count} events older than ${daysToKeep} days`,
      ...result,
    };
  } catch (error) {
    logger.error("Error cleaning up old events:", error);
    throw error;
  }
}

export function registerCleanupEventsJob(worker: any) {
  worker.process(CLEANUP_EVENTS_JOB_NAME, processCleanupEventsJob);
}
