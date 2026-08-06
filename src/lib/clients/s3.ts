import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import "dotenv/config";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

export const s3 = new S3Client({
  region: process.env.B2_REGION!,
  endpoint: process.env.B2_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
  }
});

export async function UploadFileToS3(
  buffer: Buffer,
  key: string,
  mimetype: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );
}

export async function DeleteFromS3(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
    })
  );
}
