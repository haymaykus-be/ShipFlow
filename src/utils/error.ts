export class AppError extends Error {
  public code: string;
  public statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Predefined errors
export const ERRORS = {
  ORDER_NOT_FOUND: (id: string) =>
    new AppError("ERR_ORDER_NOT_FOUND", `Order ${id} not found`, 404),

  DRIVER_NOT_FOUND: (id: string) =>
    new AppError("ERR_DRIVER_NOT_FOUND", `Driver ${id} not found`, 404),

  NO_DRIVERS_AVAILABLE: () =>
    new AppError("ERR_NO_DRIVERS_AVAILABLE", "No drivers available", 400),

  INVALID_INPUT: (details?: string) =>
    new AppError("ERR_INVALID_INPUT", details || "Invalid request input", 422),

  INTERNAL: (details?: string) =>
    new AppError("ERR_INTERNAL", details || "Internal server error", 500),

  // 🚚 Dispatch-specific
  ASSIGNMENT_FAILED: (orderId: string) =>
    new AppError(
      "ERR_ASSIGNMENT_FAILED",
      `Failed to assign driver for order ${orderId}`,
      500
    ),

  // 🕒 ETA-specific
  ETA_CALC_FAILED: (assignmentId: string) =>
    new AppError(
      "ERR_ETA_CALC_FAILED",
      `Failed to calculate ETA for assignment ${assignmentId}`,
      500
    ),
};
