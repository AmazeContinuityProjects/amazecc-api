
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/clients/mongodb";
import { maskUserID } from "@/lib/mask";
import User from "@/lib/models/Users";
import { s3 } from "@/lib/clients/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";



/**
 * @openapi
 * /api/files/download/{userID}/{fileID}:
 *   get:
 *     tags:
 *       - Files
 *     security: []
 *     summary: Download a file belonging to a user
 *     parameters:
 *       - in: path
 *         name: userID
 *         required: true
 *         schema:
 *           type: string
 *           example: 24BCE1234
 *       - in: path
 *         name: fileID
 *         required: true
 *         schema:
 *           type: string
 *           example: file_abc123
 *     responses:
 *       200:
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: File not found
 *       410:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: File has expired
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

export async function GET(req: Request, { params }: { params: Promise<{ userID: string, fileID: string }> }) {
    try {
        await connectDB();
        const { userID, fileID } = await params;

        const maskedID = maskUserID(userID.toUpperCase());

        const user = await User.findOne({ UserID: maskedID });
        if(!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const file = user.files.find((f) => f.fileID === fileID);
        if(!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        if(file.expiresAt && new Date(file.expiresAt) < new Date()) {
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

