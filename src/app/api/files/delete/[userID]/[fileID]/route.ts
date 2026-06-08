
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/clients/mongodb";
import User from "@/lib/models/Users";
import { DeleteFromS3 } from "@/lib/clients/s3";
import { maskUserID } from "@/lib/mask";



/**
 * @openapi
 * /api/files/delete/{userID}/{fileID}:
 *   delete:
 *     tags:
 *       - Files
 *     security: []
 *     summary: Delete a file belonging to a user
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
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: File deleted successfully
 *                 storageUsed:
 *                   type: number
 *                   example: 5242880
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: File not found
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

export async function DELETE(req: Request, { params }: { params: Promise<{ userID: string, fileID: string }> }) {
    try {
        await connectDB();
        const { userID, fileID } = await params;

        const maskedID = maskUserID(userID.toUpperCase());

        const user = await User.findOne({ UserID: maskedID });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const file = user.files.find((f) => f.fileID === fileID);
        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        try {
            await DeleteFromS3(fileID);
        } catch (error) {
            console.error("Error deleting file from S3:", error);
            return NextResponse.json({ error: "Failed to delete file from storage" }, { status: 500 });
        }

        user.files = user.files.filter((f) => f.fileID !== fileID);
        await user.save();

        const storageUsed = user.files.reduce((acc, f) => acc + f.size, 0);

        return NextResponse.json({
            message: "File deleted successfully",
            storageUsed,
        });
    } catch (error) {
        console.error("Error deleting file:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

