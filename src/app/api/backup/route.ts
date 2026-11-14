import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";
import { identifyCaller, readBody } from "@/lib/socialCaller";
import { CLOUD_BACKUP_TABLE, ensureCloudBackupSchema, validateEnvelope } from "@/lib/cloudBackupDb";

/**
 * @openapi
 * /api/backup:
 *   post:
 *     tags:
 *       - Backup
 *     summary: Store, fetch or delete the caller's end-to-end encrypted backup
 *     description: >
 *       The caller is identified from their live VTOP session (identifyCaller),
 *       never from the body. The envelope is encrypted in the browser with a
 *       passphrase the server never sees.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/VtopSession'
 *               - type: object
 *                 required: [action]
 *                 properties:
 *                   action:
 *                     type: string
 *                     enum: [get, put, delete]
 *                   envelope:
 *                     type: object
 *                     description: Required for put. {v, kdf, iterations, salt, iv, ciphertext}
 *     responses:
 *       200:
 *         description: Done. For get, `envelope` is null when no backup exists.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 envelope: { type: object, nullable: true }
 *                 updatedAt: { type: string, nullable: true }
 *       400:
 *         description: Bad action or envelope
 *       401:
 *         description: VTOP session missing or not the caller's
 *       413:
 *         description: Envelope over 512 KB
 *       429:
 *         description: Too many requests
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`backup:${ip}`, 20, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  const body = await readBody(req);
  const action = String(body.action ?? "");
  if (!["get", "put", "delete"].includes(action)) {
    return NextResponse.json({ success: false, error: "invalid_action" }, { status: 400 });
  }

  const ident = await identifyCaller(body as { cookies?: string; authorizedID?: string; csrf?: string });
  if (!ident.ok) {
    return NextResponse.json({ success: false, error: ident.error, ...(ident.detail ?? {}) }, { status: ident.status });
  }
  const owner = ident.caller.ownerKey;

  try {
    await ensureCloudBackupSchema();
    const pool = getDbPool();

    if (action === "get") {
      const { rows } = await pool.query(
        `SELECT envelope, updated_at FROM ${CLOUD_BACKUP_TABLE} WHERE owner_key = $1`,
        [owner]
      );
      return NextResponse.json({
        success: true,
        envelope: rows[0]?.envelope ?? null,
        updatedAt: rows[0]?.updated_at ?? null,
      });
    }

    if (action === "delete") {
      await pool.query(`DELETE FROM ${CLOUD_BACKUP_TABLE} WHERE owner_key = $1`, [owner]);
      return NextResponse.json({ success: true });
    }

    const checked = validateEnvelope(body.envelope);
    if (!checked.ok) {
      const status = checked.error === "too_large" ? 413 : 400;
      return NextResponse.json({ success: false, error: checked.error }, { status });
    }
    const { rows } = await pool.query(
      `INSERT INTO ${CLOUD_BACKUP_TABLE} (owner_key, envelope, size_bytes, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (owner_key) DO UPDATE
         SET envelope = EXCLUDED.envelope, size_bytes = EXCLUDED.size_bytes, updated_at = NOW()
       RETURNING updated_at`,
      [owner, checked.envelope, checked.size]
    );
    return NextResponse.json({ success: true, updatedAt: rows[0]?.updated_at ?? null });
  } catch (err: unknown) {
    console.error("backup route failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ success: false, error: "backup_unavailable" }, { status: 500 });
  }
}
