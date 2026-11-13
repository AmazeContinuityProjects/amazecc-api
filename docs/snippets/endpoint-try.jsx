// Interactive "try it" panel for API reference pages.
// Modeled on the API site's own /docs endpoint tester: log in with VTOP
// (or paste admin/club/cabshare tokens), then send real requests straight
// at https://api.amazecc.com from the docs page. Session lives in
// sessionStorage so it vanishes with the tab; nothing is transmitted
// anywhere except the API itself.
const DEFAULT_API = "https://api.amazecc.com";

const AUTH_LABELS = {
  none: "Public",
  vtop: "VTOP session",
  moodle: "Moodle LMS",
  admin: "Admin token",
  "gorobo-admin": "Admin + permission",
  club: "Club token",
  cabshare: "CabShare token",
  eventhub: "EventHub",
  social: "VTOP (identity-bound)",
  cron: "CRON_SECRET",
};

const AUTH_BODY = {
  vtop: ["cookies", "authorizedID", "csrf"],
  social: ["cookies", "authorizedID", "csrf"],
  moodle: ["username", "pass"],
  eventhub: ["username", "password"],
};

const AUTH_HEADER = {
  admin: "Bearer",
  "gorobo-admin": "Bearer",
  club: "Bearer",
  cabshare: "Bearer",
  cron: "Bearer",
};

const METHOD_COLORS = {
  GET: "#10b981", POST: "#3b82f6", PUT: "#f97316", PATCH: "#a855f7", DELETE: "#ef4444",
};

const pretty = (v) => {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
};

const loadCreds = () => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(sessionStorage.getItem("aapi-try-auth") || "{}"); } catch { return {}; }
};
const saveCreds = (creds) => {
  try { sessionStorage.setItem("aapi-try-auth", JSON.stringify(creds)); } catch {}
};

export const EndpointTry = ({
  path,
  method = "post",
  auth = "none",
  defaultBody = null,
}) => {
  const [creds, setCreds] = useState(loadCreds);
  const [panel, setPanel] = useState(null); // null | 'vtop' | 'tokens'
  const [vtopForm, setVtopForm] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState(defaultBody ? pretty(defaultBody) : "{\n  \n}");
  const [response, setResponse] = useState(null);
  const [running, setRunning] = useState(false);

  const methodU = method.toUpperCase();
  const isBodyMethod = ["POST", "PUT", "PATCH"].includes(methodU);
  const needsBodyAuth = Boolean(AUTH_BODY[auth]);
  const needsHeaderAuth = Boolean(AUTH_HEADER[auth]);
  const hasCreds = needsBodyAuth ? Boolean(creds[auth]) : needsHeaderAuth ? Boolean(creds[auth]) : true;

  const setAuth = (key, value) => {
    const next = { ...creds, [key]: value };
    setCreds(next);
    saveCreds(next);
  };
  const logout = () => { setCreds({}); saveCreds({}); };

  const vtopLogin = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch(`${DEFAULT_API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vtopForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Login failed");
      const cookies = Array.isArray(data.cookies) ? data.cookies.join("; ") : data.cookies;
      setAuth("vtop", { cookies, authorizedID: data.authorizedID, csrf: data.csrf });
      setPanel(null);
      setVtopForm({ username: "", password: "" });
    } catch (err) { setError(err.message || String(err)); } finally { setBusy(false); }
  };

  const tokenLogin = (key) => (e) => {
    e.preventDefault();
    const t = e.target.elements.token.value.trim();
    if (t) setAuth(key, t);
    e.target.reset();
  };

  const buildRequest = () => {
    const url = `${DEFAULT_API}${path}`;
    const headers = { Accept: "application/json" };
    if (needsHeaderAuth && creds[auth]) headers.Authorization = `Bearer ${creds[auth]}`;
    let finalBody = body;
    if (isBodyMethod && body.trim()) {
      if (needsBodyAuth && creds[auth]) {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch { throw new Error("Request body is not valid JSON"); }
        finalBody = JSON.stringify({ ...parsed, ...creds[auth] }, null, 2);
      }
      headers["Content-Type"] = "application/json";
    }
    return { url, headers, finalBody: isBodyMethod ? finalBody : undefined };
  };

  const send = async () => {
    setRunning(true); setError(""); setResponse(null);
    const started = performance.now();
    try {
      const { url, headers, finalBody } = buildRequest();
      const res = await fetch(url, { method: methodU, headers, body: finalBody });
      const ms = Math.round(performance.now() - started);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      const respHeaders = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      setResponse({ status: res.status, statusText: res.statusText, ms, data, headers: respHeaders });
    } catch (err) { setError(err.message || String(err)); } finally { setRunning(false); }
  };

  const chip = (label, tone) => (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.3rem",
        fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.02em",
        padding: "0.15rem 0.5rem", borderRadius: "9999px",
        color: tone === "warn" ? "#f59e0b" : tone === "ok" ? "#10b981" : "#94a3b8",
        background: tone === "warn" ? "rgba(245,158,11,0.12)" : tone === "ok" ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.12)",
        border: "1px solid currentColor",
      }}
    >
      {label}
    </span>
  );

  const methodBadge = (
    <span style={{
      display: "inline-block", minWidth: "3.4rem", textAlign: "center",
      fontFamily: "ui-monospace, monospace", fontWeight: 800, fontSize: "0.72rem",
      padding: "0.2rem 0.45rem", borderRadius: "0.375rem",
      color: "#fff", background: METHOD_COLORS[methodU] || "#64748b",
    }}>{methodU}</span>
  );

  const inputStyle = {
    width: "100%", padding: "0.45rem 0.6rem", fontSize: "0.8rem",
    background: "var(--ifm-background-surface-color, #0d0f14)", color: "inherit",
    border: "1px solid var(--ifm-color-emphasis-200, #26282e)", borderRadius: "0.5rem", boxSizing: "border-box",
  };

  const btnStyle = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: "0.4rem",
    fontSize: "0.8rem", fontWeight: 600, padding: "0.45rem 0.8rem",
    borderRadius: "0.5rem", cursor: "pointer", border: "none",
    color: primary ? "#ffffff" : "inherit",
    background: primary ? "#6366F1" : "var(--ifm-color-emphasis-100, #1f2126)",
  });

  return (
    <div className="not-prose" style={{
      margin: "1rem 0 2rem", borderRadius: "0.75rem", overflow: "hidden",
      border: "1px solid var(--ifm-color-emphasis-200, #26282e)",
      background: "var(--ifm-background-surface-color, #0d0f14)",
      fontFamily: "var(--ifm-font-family-base, system-ui)",
    }}>
      {/* header */}
      <div style={{ padding: "0.7rem 0.9rem", borderBottom: "1px solid var(--ifm-color-emphasis-200, #26282e)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          {methodBadge}
          <code style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>{path}</code>
        </div>
        {auth === "none"
          ? chip("public", "off")
          : hasCreds ? chip(`${AUTH_LABELS[auth]} - signed in`, "ok") : chip(AUTH_LABELS[auth] || auth, "warn")}
      </div>

      {/* body */}
      <div style={{ padding: "0.9rem" }}>
        {/* auth strip */}
        {auth !== "none" && (
          <div style={{ marginBottom: "0.7rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {auth === "vtop" && (
              <>
                <button style={btnStyle(false)} onClick={() => setPanel(panel === "vtop" ? null : "vtop")}>
                  {creds.vtop ? "Re-log in" : "Log in with VTOP"}
                </button>
                {creds.vtop && <button style={btnStyle(false)} onClick={logout}>Clear</button>}
              </>
            )}
            {(auth === "admin" || auth === "gorobo-admin" || auth === "club" || auth === "cabshare" || auth === "cron") && (
              <>
                <button style={btnStyle(false)} onClick={() => setPanel(panel === "tokens" ? null : "tokens")}>
                  {creds[auth] ? "Update token" : "Set token"}
                </button>
                {creds[auth] && <button style={btnStyle(false)} onClick={logout}>Clear</button>}
              </>
            )}
          </div>
        )}

        {/* login panel */}
        {panel === "vtop" && (
          <form onSubmit={vtopLogin} style={{ marginBottom: "0.7rem", padding: "0.7rem", border: "1px solid var(--ifm-color-emphasis-200, #26282e)", borderRadius: "0.5rem", display: "grid", gap: "0.5rem" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>VTOP login</div>
            <input style={inputStyle} placeholder="Registration number e.g. 21BCE0000" value={vtopForm.username} onChange={(e) => setVtopForm({ ...vtopForm, username: e.target.value })} required autoComplete="username" />
            <input style={inputStyle} type="password" placeholder="Password" value={vtopForm.password} onChange={(e) => setVtopForm({ ...vtopForm, password: e.target.value })} required autoComplete="current-password" />
            {error && <div style={{ fontSize: "0.75rem", color: "#f87171" }}>{error}</div>}
            <button type="submit" style={btnStyle(true)} disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
          </form>
        )}

        {/* token panel */}
        {panel === "tokens" && (
          <form onSubmit={tokenLogin(auth)} style={{ marginBottom: "0.7rem", padding: "0.7rem", border: "1px solid var(--ifm-color-emphasis-200, #26282e)", borderRadius: "0.5rem", display: "grid", gap: "0.5rem" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>
              {auth === "admin" || auth === "gorobo-admin" ? "Admin bearer token" : auth === "club" ? "Club rep token" : auth === "cabshare" ? "CabShare token" : "CRON_SECRET"}
            </div>
            <textarea name="token" style={{ ...inputStyle, minHeight: "3.5rem", fontFamily: "ui-monospace, monospace" }} placeholder="paste token" required />
            <button type="submit" style={btnStyle(true)}>Save</button>
          </form>
        )}

        {/* request body */}
        {isBodyMethod && (
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--ifm-color-emphasis-600, #9aa0aa)" }}>JSON request body</label>
        )}
        {isBodyMethod && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            style={{ ...inputStyle, minHeight: "9rem", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem", lineHeight: 1.45 }}
          />
        )}

        {/* send */}
        <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button style={btnStyle(true)} onClick={send} disabled={running}>{running ? "Sending…" : "Send request"}</button>
          {!isBodyMethod && <span style={{ fontSize: "0.75rem", alignSelf: "center", color: "var(--ifm-color-emphasis-600, #9aa0aa)" }}>no body for {methodU}</span>}
        </div>

        {/* response */}
        {(response || error) && (
          <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--ifm-color-emphasis-200, #26282e)", paddingTop: "0.7rem" }}>
            {error && <div style={{ fontSize: "0.8rem", color: "#f87171" }}>{error}</div>}
            {response && (
              <>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "0.35rem", color: response.status < 300 ? "#10b981" : response.status < 400 ? "#f59e0b" : "#ef4444", background: response.status < 300 ? "rgba(16,185,129,0.12)" : response.status < 400 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)" }}>
                    {response.status} {response.statusText}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ifm-color-emphasis-600, #9aa0aa)" }}>{response.ms} ms</span>
                </div>
                <pre style={{ ...inputStyle, margin: 0, maxHeight: "22rem", overflow: "auto", fontSize: "0.7rem" }}>
{typeof response.data === "string" ? response.data.slice(0, 6000) : pretty(response.data)}
                </pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
