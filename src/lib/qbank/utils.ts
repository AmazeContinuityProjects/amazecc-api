import { s3 } from "@/lib/clients/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";

export interface QBankPaper {
  source_id: string;
  course_code: string;
  title: string;
  source_type: string;
  exam_year: number;
  file_url: string;
  source_url: string | null;
  uploader_reg_no: string;
  approval_status: string;
  ocr_logs: string | null;
  ocr_progress: number;
  ocr_model: string | null;
  file_size: number | null;
  storage_provider: string | null;
  created_at: string;
  exam_semester: string | null;
}

export function getDirectDownloadUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();

    if (host === 'drive.google.com') {
      const fileIdMatch =
        url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        return `https://docs.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    }
  } catch {
    // Keep original behavior for invalid or non-absolute URLs.
  }

  return url;
}

export async function fetchPaperPdfBuffer(paper: QBankPaper): Promise<Buffer> {
  if (paper.storage_provider === 'R2') {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME!,
        Key: `papers/${paper.source_id}.pdf`,
      })
    );
    if (!result.Body) throw new Error('PDF not found in storage');
    const chunks: Uint8Array[] = [];
    const body = result.Body as unknown as AsyncIterable<Uint8Array>;
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  const downloadUrl = getDirectDownloadUrl(paper.file_url);
  const response = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    timeout: 30000,
  });
  return Buffer.from(response.data);
}
