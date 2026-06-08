import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { maskUserID } from '@/lib/mask';
import { UploadFileToS3 } from '@/lib/clients/s3';
import { v4 as uuid } from 'uuid';

export async function POST(req: Request, { params }: { params: Promise<{ userID: string }> }) {
    try {
        const { userID } = await params;
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];
        
        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        const maskedID = maskUserID(userID.toUpperCase());
        const pool = getDbPool();

        const fileRecords = [];
        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileID = uuid();
            const extension = file.name.split('.').pop() || '';
            
            await UploadFileToS3(buffer, fileID, file.type);
            
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 3);
            
            await pool.query(
                `INSERT INTO files (file_id, user_id, extension, name, size, expires_at) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [fileID, maskedID, extension, file.name, buffer.length, expiresAt]
            );
            
            fileRecords.push({
                fileID,
                name: file.name,
                extension,
                size: buffer.length,
                expiresAt
            });
        }
        
        return NextResponse.json({ message: "Files uploaded successfully", files: fileRecords });
    } catch (error) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
