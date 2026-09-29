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

  const setCookieHeader = loginRes.headers.get("set-cookie");
  if (!setCookieHeader) return null;

  const jmatch = setCookieHeader.match(/JSESSIONID=([^;,\s]+)/);
  if (!jmatch) return null;

  const cmatch = setCookieHeader.match(/cookiesession1=([^;,\s]+)/);
  let combinedCookie = `JSESSIONID=${jmatch[1]}`;
  if (cmatch) {
    combinedCookie += `; cookiesession1=${cmatch[1]}`;
  }

  return combinedCookie;
}

/** True when the response is EventHub's login page rather than a profile. */
export function looksLikeLoginPage(html: string): boolean {
  return /action=["']\/EventHub\/mainDashboard["']/i.test(html);
}
