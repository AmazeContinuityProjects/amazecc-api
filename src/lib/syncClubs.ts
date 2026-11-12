import VTOPClient from "@/lib/clients/VTOPClient";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import { getDbPool } from "@/lib/db";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
let lastSyncAttemptAt = 0;
let syncStateEnsured = false;

async function ensureSyncStateTable() {
    if (syncStateEnsured) return;
    const pool = getDbPool();
    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_sync_state (
            key TEXT PRIMARY KEY,
            last_synced_at TIMESTAMPTZ
        )
    `);
    syncStateEnsured = true;
}

/**
 * Returns true if this instance should perform the sync now.
 * Uses an atomic DB claim so multiple instances/logins don't all sync at once.
 */
async function claimDailySync(key: string): Promise<boolean> {
    const pool = getDbPool();
    await ensureSyncStateTable();

    const res = await pool.query(
        `
        INSERT INTO app_sync_state (key, last_synced_at)
        VALUES ($1, NOW())
        ON CONFLICT (key) DO UPDATE
            SET last_synced_at = NOW()
            WHERE app_sync_state.last_synced_at IS NULL
               OR app_sync_state.last_synced_at < NOW() - INTERVAL '24 hours'
        RETURNING last_synced_at
        `,
        [key]
    );

    return res.rowCount === 1;
}

export async function syncClubsBackground(cookies: string, csrf: string, authorizedID: string) {
    const now = Date.now();
    // Fast in-process throttle to avoid DB checks on every login in a warm instance
    if (now - lastSyncAttemptAt < SYNC_INTERVAL_MS) {
        return;
    }
    lastSyncAttemptAt = now;

    try {
        const shouldSync = await claimDailySync("vtop_clubs");
        if (!shouldSync) {
            return;
        }

        console.log("Background: Syncing VTOP Clubs...");
        const client = VTOPClient();
        
        const clubResp = await client.post(
            "/vtop/event/swf/student/loadClubChapterEnrollmentPage",
            new URLSearchParams({
                verifyMenu: "true", authorizedID, _csrf: csrf, nocache: Date.now().toString(),
            }).toString(),
            {
                headers: {
                    Cookie: cookies,
                    "Content-Type": "application/x-www-form-urlencoded",
                    Referer: "https://vtopcc.vit.ac.in/vtop/open/page",
                },
            }
        );
        
        const parsedData = parseVtopHtml(clubResp.data);
        
        if (parsedData.tables && parsedData.tables.length > 0) {
            const pool = getDbPool();
            const query = `
                INSERT INTO club_details (club_id, club_name, mission, description, hiring_process, website, recruitment_link, instagram, whatsapp, poc)
                VALUES ($1, $2, '', '', '', '', '', '', '', '')
                ON CONFLICT (club_id) DO NOTHING;
            `;

            let addedCount = 0;
            for (const row of parsedData.tables[0].rows) {
                const rawName = row["Association Name (Type)"] || "";
                if (rawName) {
                    const name = rawName.replace(/\([^)]+\)$/, "").trim();
                    // Temporary ID based on name since VTOP doesn't give a short acronym
                    const clubId = name;
                    
                    const result = await pool.query(query, [clubId, name]);
                    if (result.rowCount && result.rowCount > 0) {
                        addedCount++;
                    }
                }
            }
            console.log(`Background: VTOP Clubs sync complete. Added ${addedCount} new clubs.`);
        } else {
            console.log("Background: VTOP Clubs sync complete. No club table found.");
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Background: Error syncing VTOP clubs:", message);
    }
}
