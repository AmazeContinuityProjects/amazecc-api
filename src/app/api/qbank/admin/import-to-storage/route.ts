import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getDirectDownloadUrl(url: string): string {
  if (url.includes('drive.google.com')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://docs.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
  }
  return url;
}

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { paperId } = body;
    if (!paperId) {
      return NextResponse.json({ success: false, error: 'paperId required' }, { status: 400 });
    }

    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT * FROM papers_archive WHERE source_id = $1`,
      [paperId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }

    const paper = rows[0];
    const remoteUrl = paper.file_url;

    if (!remoteUrl || remoteUrl === 'DIRECT_JSON') {
      return NextResponse.json({ success: false, error: 'Paper does not have a downloadable file URL' }, { status: 400 });
    }

    const downloadUrl = getDirectDownloadUrl(remoteUrl);
    let response;
    try {
      response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 30000 // 30 seconds
      });
    } catch (downloadError: any) {
      console.error(`Failed to download file from ${downloadUrl}:`, downloadError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to download file from remote host: ${downloadError.message}` 
      }, { status: 502 });
    }

    const buffer = Buffer.from(response.data);
    const contentType = String(response.headers['content-type'] || 'application/pdf');

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase storage is not configured on the server.' 
      }, { status: 500 });
    }

    const fileExt = contentType.includes('pdf') ? 'pdf' : 'png';
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `papers/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from('qbank')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('qbank')
      .getPublicUrl(filePath);

    await pool.query(
      `UPDATE papers_archive 
       SET file_url = $1, file_size = $2, storage_provider = 'R2', source_type = 'UPLOAD' 
       WHERE source_id = $3`,
      [publicUrl, buffer.length, paperId]
    );

    return NextResponse.json({ 
      success: true, 
      fileUrl: publicUrl, 
      fileSize: buffer.length 
    });
  } catch (error: any) {
    console.error('Import to storage error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
