import { NextResponse } from 'next/server';
import path from 'path';
import User from '@/lib/models/Users';
import { UploadFileToS3 } from '@/lib/clients/s3';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/clients/mongodb';
import { maskUserID } from '@/lib/mask';

const MAX_STORAGE = 5 * 1024 * 1024;
const ADMINS = (process.env.ADMINS || "").split(",").map(id => id.trim());

/**
 * @openapi
 * /api/files/upload/{userID}:
 *   post:
 *     tags:
 *       - Files
 *     summary: Upload a file for a user
 */

export async function POST(req: Request, { params }: { params: Promise<{ userID: string }> }) {
    try {
        await connectDB();

        const { userID } = await params;
        const maskedID = maskUserID(userID?.toUpperCase() || "");
        
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

        const isAdmin = ADMINS.includes(userID?.toUpperCase() || "");
        let user = await User.findOne({ UserID: maskedID });
        
        if (!user) {
            user = await User.create({ UserID: maskedID, files: [] });
        }

        const currentStorage = user.files.reduce((acc: number, f: any) => acc + f.size, 0);
        if (!isAdmin && currentStorage + file.size > MAX_STORAGE) {
            return NextResponse.json({ error: "Storage limit exceeded" }, { status: 400 });
        }

        const extension = path.extname(file.name);
        const cleanName = path.basename(file.name, extension);
        const uniqueKey = `${maskedID}/${uuidv4()}-${cleanName}${extension}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        
        await UploadFileToS3({ originalname: file.name, buffer, mimetype: file.type } as any, uniqueKey);

        const expiresAt = isAdmin
            ? new Date("2099-12-31T23:59:59Z")
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        const newFile = {
            fileID: uniqueKey,
            extension: extension.replace(".", ""),
            name: file.name,
            size: file.size,
            expiresAt
        };

        user.files.push(newFile);
        await user.save();

        return NextResponse.json({
            message: "File uploaded successfully",
            file: newFile,
            storageUsed: currentStorage + file.size,
            isAdmin
        }, { status: 201 });

    } catch (err) {
        console.error("Upload Error:", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
