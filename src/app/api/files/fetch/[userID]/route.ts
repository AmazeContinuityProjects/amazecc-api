
import { NextResponse } from 'next/server';
import User from '@/lib/models/Users';
import { connectDB } from '@/lib/clients/mongodb';
import { maskUserID } from '@/lib/mask';



/**
 * @openapi
 * /api/files/fetch/{userID}:
 *   get:
 *     tags:
 *       - Files
 *     security: []
 *     summary: Fetch all active files for a user
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *           example: 24BCE1234
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   fileID:
 *                     type: string
 *                     example: file_abc123
 *                   name:
 *                     type: string
 *                     example: notes.pdf
 *                   size:
 *                     type: number
 *                     example: 245760
 *                   expiresAt:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-01-20T12:00:00.000Z
 *       500:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

export async function GET(req: Request, { params }: { params: Promise<{ userID: string }> }) {
    try {
        await connectDB();
        const { userID } = await params;
        const maskedID = maskUserID(userID.toUpperCase());

        let user = await User.findOne({ UserID: maskedID });

        if (!user) {
            return NextResponse.json([]);
        }

        const now = new Date();
        user.files = user.files.filter(file => file.expiresAt > now);
        await user.save();

        return NextResponse.json(user.files);
    } catch (error) {
        console.error("Error fetching files:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}


