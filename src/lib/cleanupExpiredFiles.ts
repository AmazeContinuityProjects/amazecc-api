import cron from "node-cron";
import { getDbPool } from "./db";
import { DeleteFromS3 } from "./clients/s3";

async function cleanup() {
    console.log("🛠 Running cleanup task...");
    try {
        const pool = getDbPool();
        const now = new Date();

        // Find all expired files
        const res = await pool.query(`SELECT file_id FROM files WHERE expires_at < $1`, [now]);
        
        for (const row of res.rows) {
            try {
                await DeleteFromS3(row.file_id);
            } catch (err) {
                console.error("❌ Failed to delete from S3:", err);
            }
        }

        // Delete expired files from the database
        await pool.query(`DELETE FROM files WHERE expires_at < $1`, [now]);

        console.log("✅ Cleanup completed.");
    } catch (err) {
        console.error("Cleanup Failed:", err);
    }
}

export function startCleanupCron() {
    cron.schedule("0 * * * *", cleanup);
    cleanup();
}
