import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { maskUserID } from '@/lib/mask';
import { DeleteFromS3 } from '@/lib/clients/s3';

/**
 * @openapi
 * /api/files/delete/[userID]/[fileID]:
 *   delete:
 *     tags:
 *       - Files
 *     summary: DELETE endpoint for /api/files/delete/[userID]/[fileID]
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
 */

export async function DELETE(req: Request, { params }: { params: Promise<{ userID: string, fileID: string }> }) {
    try {
        const { userID, fileID } = await params;
        const maskedID = maskUserID(userID.toUpperCase());
        const pool = getDbPool();

        const { rowCount } = await pool.query(
            `DELETE FROM files WHERE file_id = $1 AND user_id = $2 RETURNING *`,
            [fileID, maskedID]
        );

        if (rowCount === 0) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        await DeleteFromS3(fileID);
        return NextResponse.json({ message: "File deleted successfully" });
    } catch (error) {
        console.error("Delete Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
