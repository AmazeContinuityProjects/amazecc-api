import VTOPClient, { getVtopReferer } from "@/lib/clients/VTOPClient";
import { parseStudentProfile } from "@/lib/parsers/student-profile";
import { URLSearchParams } from "url";
import { ownerKeyFor } from "./socialDb";

/**
 * The one place a request's caller is established.
 *
 * Every social route needs the same two things: proof that the session is live,
 * and the `owner_key` derived from the VTOP *response*. Centralising it stops
 * the routes drifting apart — which is exactly how the three broken reg-number
 * readers in the frontend happened.
 *
 * Nothing in the request body is an identity assertion. A caller can put any
 * reg number in the payload; it cannot make VTOP return someone else's
 * profile. That is what closes the IDOR.
 */

export type CallerIdentity = {
  ownerKey: string;
  displayName: string;
  cookies: string;
  authorizedID: string;
  csrf: string;
};

export type CallerResult =
  | { ok: true; caller: CallerIdentity }
  | { ok: false; status: number; error: string; detail?: Record<string, unknown> };

export async function identifyCaller(body: {
  cookies?: string | string[];
  authorizedID?: string;
  csrf?: string;
}): Promise<CallerResult> {
  const cookieHeader = Array.isArray(body.cookies) ? body.cookies.join("; ") : body.cookies;
  const { authorizedID, csrf } = body;

  if (!csrf || !authorizedID || !cookieHeader) {
    return {
      ok: false,
      status: 400,
      error: "missing_credentials",
      detail: { detail: "Missing cookies, csrf or authorizedID" },
    };
  }

  try {
    const client = VTOPClient();
    const res = await client.post(
      "/vtop/studentsRecord/StudentProfileAllView",
      new URLSearchParams({
        verifyMenu: "true",
        authorizedID,
        _csrf: csrf,
        nocache: Date.now().toString(),
      }).toString(),
      {
        headers: {
          Cookie: cookieHeader,
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: getVtopReferer(),
        },
      }
    );

    const profile = parseStudentProfile(res.data);
    // Mirrors AmazeCC-API/src/lib/identity.ts:175
    const regNumber = profile.registerNo || profile.applicationNumber;
    if (!regNumber) {
      return {
        ok: false,
        status: 401,
        error: "vtop_identity_unresolved",
        detail: {
          detail:
            "VTOP returned no REGISTER NO for these cookies. The session is not this student's, or has expired.",
        },
      };
    }

    return {
      ok: true,
      caller: {
        ownerKey: ownerKeyFor(regNumber),
        displayName: profile.name || "",
        cookies: cookieHeader,
        authorizedID,
        csrf,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/\b401\b|unauthor|\bsession\b|invalid\s*csrf/i.test(message)) {
      return { ok: false, status: 401, error: "vtop_session_expired", detail: { detail: message } };
    }
    console.error("social identifyCaller error:", message);
    return { ok: false, status: 502, error: "vtop_unavailable", detail: { detail: message } };
  }
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const parsed = await req.json().catch(() => ({}));
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}
