import { NextResponse } from "next/server";

// Deprecated: use /api/ffcs (section: "feedback"). Kept for compatibility.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);
  const ffcsUrl = `${url.origin}/api/ffcs`;
  const res = await fetch(ffcsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, section: "feedback" }),
  }).catch(() => null);
  if (!res) return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  const json = await res.json().catch(() => ({ success: false, error: "Invalid response" }));
  return NextResponse.json(json?.feedbackStatus || json, { status: res.status });
}
