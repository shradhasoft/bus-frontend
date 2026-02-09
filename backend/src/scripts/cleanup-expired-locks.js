// jobs/lockCleanup.js
import cron from "node-cron";
import SeatLockService from "../services/seatLockService.js";

// Choose frequency. */5 * * * * = every 5 minutes
const scheduleCleanup = (cronExpression = "*/5 * * * *") => {
  cron.schedule(cronExpression, async () => {
    try {
      console.log(`[LockCleanup] Running expired locks cleanup at ${new Date().toISOString()}`);
      const result = await SeatLockService.cleanupExpiredLocksJob();
      console.log(`[LockCleanup] Cleanup completed, modifiedCount=${result.modifiedCount}`);
    } catch (error) {
      console.error("[LockCleanup] Cleanup failed:", error);
    }
  });
};

// manual runner you can call from admin route or at server start
const runCleanup = async () => {
  try {
    console.log("Running manual cleanup...");
    const result = await SeatLockService.cleanupExpiredLocksJob();
    console.log("Manual cleanup completed:", result);
    return result;
  } catch (error) {
    console.error("Manual cleanup failed:", error);
    throw error;
  }
};

export { scheduleCleanup, runCleanup };
