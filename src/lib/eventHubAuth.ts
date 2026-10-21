export type EventHubCredentials = {
  username?: string;
  password?: string;
  /**
   * A cached session, in the compound form `/api/events/login` returns:
   * `"<id>"` or `"<id>; cookiesession1=<c>"`.
   */
  jsessionid?: string;
  /** Also accepted separately, for callers that do not send a compound value. */
  cookiesession1?: string;
};

/**
 * Build a `Cookie` header for EventHub.
 *
 * ## A cached session is NOT validated here
 *
 * When `jsessionid` is supplied it is used as-is. EventHub sessions expire
 * server-side and nothing tells the client, so the caller is responsible for
 * treating a cached session as a cache — see the `fetchedAt` handling in the
 * frontend's credential manager. Callers that want a session proven good should
 * verify the response actually contains a profile and not a login form, which is
 * what `getEventHubProfile` does.
 */
export async function getEventHubCookie(
  params: EventHubCredentials,
): Promise<string | null> {
  if (params.jsessionid) {
    // The compound form is already a cookie fragment, so it is appended after
    // `JSESSIONID=` verbatim. A bare id gets `cookiesession1` from the separate
    // field when one is given.
    if (params.jsessionid.includes("cookiesession1")) {
      return `JSESSIONID=${params.jsessionid}`;
    }
    const extra = params.cookiesession1 ? `; cookiesession1=${params.cookiesession1}` : "";
    return `JSESSIONID=${params.jsessionid}${extra}`;
  }

  if (!params.username || !params.password) return null;

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const loginParams = new URLSearchParams({
    username: params.username,
    password: params.password,
    validateVitian: "1",
  });

  const loginRes = await fetch("https://eventhubcc.vit.ac.in/EventHub/mainDashboard", {
    method: "POST",
    body: loginParams,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    redirect: "manual",
  });

  // EventHub sets JSESSIONID + cookiesession1 even for REJECTED credentials
  // (HTTP 200 + login form), so a Set-Cookie header alone proves nothing.
  // The only distinguisher is the response body: a failed login re-renders
  // the login form (action="/EventHub/mainDashboard"), a successful one
  // renders the dashboard.
  const rawCookies: string[] =
    typeof (loginRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (loginRes.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : (loginRes.headers.get("set-cookie")?.split(/,(?=[^;]+=[^;]+;)/) ?? []);

  let jsessionid: string | null = null;
  let cookiesession1: string | null = null;
  for (const c of rawCookies) {
    const j = c.match(/JSESSIONID=([^;,\s]+)/);
    if (j) jsessionid = j[1];
    const cc = c.match(/cookiesession1=([^;,\s]+)/);
    if (cc) cookiesession1 = cc[1];
  }
  if (!jsessionid) return null;

  const body = await loginRes.text();
  if (looksLikeLoginPage(body)) return null;

  let combinedCookie = `JSESSIONID=${jsessionid}`;
  if (cookiesession1) {
    combinedCookie += `; cookiesession1=${cookiesession1}`;
  }

  return combinedCookie;
}

/** True when the response is EventHub's login page rather than a profile. */
export function looksLikeLoginPage(html: string): boolean {
  return /action=["']\/EventHub\/mainDashboard["']/i.test(html);
}
