import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { maskUserID } from "@/lib/mask";
import { s3 } from "@/lib/clients/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";



/**
 * @openapi
 * /api/files/download/[userID]/[fileID]:
 *   get:
 *     tags:
 *       - Files
 *     summary: GET endpoint for /api/files/download/[userID]/[fileID]
 *     parameters:
 *       - name: userID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: fileID
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

export async function GET(req: Request, { params }: { params: Promise<{ userID: string, fileID: string }> }) {
    try {
        const { userID, fileID } = await params;
        const maskedID = maskUserID(userID.toUpperCase());
        const pool = getDbPool();

        const { rows } = await pool.query(`SELECT * FROM files WHERE file_id = $1 AND user_id = $2`, [fileID, maskedID]);
        if(rows.length === 0) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        
        const file = rows[0];
        if(new Date(file.expires_at) < new Date()) {
            return NextResponse.json({ error: "File has expired" }, { status: 410 });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME!,
            Key: fileID,
        });
        const data = await s3.send(command);

        if (!data.Body) {
            return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
        }

        const webStream = data.Body.transformToWebStream();
        return new NextResponse(webStream, {
            headers: {
                "Content-Disposition": `attachment; filename="${file.name}"`,
                "Content-Type": data.ContentType || "application/octet-stream",
            },
        });
    } catch (error) {
        console.error("Download Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
