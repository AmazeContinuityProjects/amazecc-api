import VTOPClient from "@/lib/clients/VTOPClient";
import { parseVtopHtml } from "@/lib/parsers/auto-parse";
import { getDbPool } from "@/lib/db";

export async function syncClubsBackground(cookies: string, csrf: string, authorizedID: string) {
    try {
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
        }
    } catch (err: any) {
        console.error("Background: Error syncing VTOP clubs:", err.message);
    }
}
