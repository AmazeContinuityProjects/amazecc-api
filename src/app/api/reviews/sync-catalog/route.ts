import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { signIngestPayload } from "@/lib/reviews/reviewAuth";

export const dynamic = "force-dynamic";

function normalizeFacultyName(name: string) {
  return name
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function cleanSchool(dept?: string | null) {
  if (!dept) return "VIT";
  const upper = dept.toUpperCase();
  if (upper.includes("SCOPE") || upper.includes("COMPUTER")) return "SCOPE";
  if (upper.includes("SENSE") || upper.includes("ELECTRONIC")) return "SENSE";
  if (upper.includes("SELECT") || upper.includes("ELECTRICAL")) return "SELECT";
  if (upper.includes("SMEC") || upper.includes("MECHANICAL")) return "SMEC";
  if (upper.includes("SAS") || upper.includes("SCIENCE") || upper.includes("MATH") || upper.includes("PHYSICS") || upper.includes("CHEMISTRY")) return "SAS";
  if (upper.includes("SSL") || upper.includes("SOCIAL") || upper.includes("LANGUAGE")) return "SSL";
  if (upper.includes("SCHEME") || upper.includes("CIVIL") || upper.includes("CHEMICAL")) return "SCHEME";
  if (upper.includes("SBST") || upper.includes("BIO")) return "SBST";
  if (upper.includes("VSB") || upper.includes("BUSINESS") || upper.includes("MANAGEMENT")) return "VSB";
  if (upper.includes("VITSOL") || upper.includes("LAW")) return "VITSOL";
  if (upper.includes("ACAD")) return "ACAD";
  return dept.trim();
}

export async function POST(req: Request) {
  try {
    const res = await fetch("https://vitfac.amazecc.com/faculty");
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch live VIT faculty roster" }, { status: 502 });
    }
    const json = await res.json();
    const rawList = json?.data?.faculty || [];
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json({ error: "Empty faculty roster from upstream" }, { status: 502 });
    }

    const pool = getDbPool();
    let synced = 0;

    for (const f of rawList) {
      if (!f.name || !f.name.trim()) continue;
      const name = f.name.trim();
      const empId = f.employeeId ? f.employeeId.trim() : null;
      const norm = normalizeFacultyName(name);
      const school = cleanSchool(f.dept);
      const designation = f.designation ? f.designation.trim() : "Faculty Member";

      const imageUrl = empId && /^\d+$/.test(empId)
        ? `https://blfxhlmpvdhcpdwgrffr.supabase.co/storage/v1/object/public/images/${empId}.webp`
        : (f.image_url || null);

      const vitfacId = f.id || null;

      if (empId) {
        await pool.query(
          `INSERT INTO faculty (employee_id, name, name_norm, school, designation, image_url, vitfac_id, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'official', NOW())
           ON CONFLICT (employee_id) DO UPDATE 
           SET 
             name = EXCLUDED.name,
             name_norm = EXCLUDED.name_norm,
             school = COALESCE(EXCLUDED.school, faculty.school),
             designation = COALESCE(EXCLUDED.designation, faculty.designation),
             image_url = COALESCE(EXCLUDED.image_url, faculty.image_url),
             vitfac_id = COALESCE(EXCLUDED.vitfac_id, faculty.vitfac_id),
             updated_at = NOW();`,
          [empId, name, norm, school, designation, imageUrl, vitfacId]
        );
        synced++;
      }
    }

    // Trigger worker recomputation
    const workerBase = process.env.REVIEWS_WORKER_URL || "http://localhost:8787";
    try {
      const { timestamp, signature } = signIngestPayload("");
      await fetch(`${workerBase}/internal/recompute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": signature,
          "x-timestamp": timestamp,
        },
        body: "",
      });
    } catch {}

    return NextResponse.json({ success: true, count: synced, message: `Synchronized ${synced} faculty from VIT catalog` });
  } catch (err) {
    console.error("[sync-catalog] Error:", err);
    return NextResponse.json({ error: "Catalog synchronization failed" }, { status: 500 });
  }
}
