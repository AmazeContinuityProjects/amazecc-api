export async function getEventHubCookie(
  params: { username?: string; password?: string; jsessionid?: string },
): Promise<string | null> {
  if (params.jsessionid) {
    return `JSESSIONID=${params.jsessionid}`;
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
