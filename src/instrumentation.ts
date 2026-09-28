/**
 * Startup checks. Runs once when the server process initialises, which is the
 * only place a missing secret can be reported as a configuration problem
 * rather than as a mystifying 500 on the first request that needs it.
 *
 * Everything else in this repo fails lazily on purpose — `getDbPool` throws on
 * first query, `maskUserID` throws when `ID_SALT` is missing. Those are only
 * reached by a subset of routes, so failing at boot would take down routes
 * that do not need them. `SOCIAL_GRANT_SECRET_KEY` is different: it is cheap
 * to check, and a missing value would otherwise surface much later as an
 * unreadable-peer error that looks like a bug rather than a missing variable.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import so `node:crypto` is never pulled into the edge bundle.
  const { assertGrantSecretConfigured } = await import("./lib/socialGrantSecret");

  try {
    assertGrantSecretConfigured();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Loud, and explicitly a configuration problem.
    console.error(
      `\n[fatal] Invalid social-timetable configuration: ${message}\n` +
        `        The server will start, but /api/social/* will fail until this is fixed.\n`
    );
  }

  if (process.env.ADMIN_SECRET && process.env.ID_SALT && process.env.ADMIN_SECRET === process.env.ID_SALT) {
    console.warn(
      "\n[warn] ADMIN_SECRET and ID_SALT are set to the same value. The admin/club " +
        "token signing key and the student-identity salt must be independent; rotate " +
        "both and give them distinct values.\n"
    );
  }
}
