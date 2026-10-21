import { NextResponse } from "next/server";
import { runVtopProxy } from "@/lib/vtop-proxy";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const outcome = await runVtopProxy("course-completion", body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
