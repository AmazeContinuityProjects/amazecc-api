import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { signIngestPayload } from "@/lib/reviews/reviewAuth";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  const workerBase = process.env.REVIEWS_WORKER_URL || "http://localhost:8787";
  const bodyPayload = JSON.stringify({ triggered_by: auth.username, timestamp: Date.now() });
  const { timestamp, signature } = signIngestPayload(bodyPayload);

  try {
    const workerRes = await fetch(`${workerBase}/internal/recompute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-timestamp": timestamp,
      },
      body: bodyPayload,
    });

    if (!workerRes.ok) {
      const errText = await workerRes.text();
      return NextResponse.json(
        { error: `Worker recompute failed: ${workerRes.status} ${errText}` },
        { status: 502 }
      );
    }

    const result = await workerRes.json();

    await logAdminAction({
      admin_user: auth.username,
      action: "Trigger Reviews Recompute",
      target_resource: "/api/admin/reviews/recompute",
      details: result,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[admin/reviews/recompute] Error:", err);
    return NextResponse.json({ error: "Failed to trigger recompute on edge worker" }, { status: 500 });
  }
}
