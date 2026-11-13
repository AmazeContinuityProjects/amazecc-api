# Writing standard — AmazeCC-API handbook

The audience is a smart junior developer who has never hacked on this codebase
and doesn't know what VTOP is, what a session cookie is, or what scraping is.
Every page must leave them with a working mental model AND working code.

## Voice

- Second person, active, concrete. "You POST to /api/login with…", never
  "one may observe that".
- Spoonfed, but never babyish. Define once ("a *cookie* is…"), then use the
  word.
- No marketing. No "robust". No "seamless". Facts only.
- Keep the junior superpower framing: this backend is a *translator* — it
  turns VTOP's HTML into JSON. Once they see that, everything else follows.

## Page shapes

### Concept pages (start-here, architecture)
1. Frontmatter with `title` + `description` (1–2 sentences, used by llms.txt).
2. `# Title` (no numbering prefix — the sidebar shows section order).
3. An `In one line:` blockquote right under the H1.
4. Body: problem → explanation → example → footguns → quiz or checklist.
5. End with "Where to next" links, not "Conclusion".

### Endpoint pages (generated — `03-api-reference/**`)
1. Frontmatter `title` = the thing the endpoint does ("Get attendance"), +
   `description`.
2. `## In one line` — what it does and what envelope it returns.
3. `## Auth` — which of the auth families, what exactly to put in the body or
   header, and the pointer to the auth page that explains it.
4. `## Request` — method + path, and a table of **exact** body keys with
   types and whether required. No guessing.
5. `## Response` — the real top-level keys, the envelope style, and a complete
   example response (trimmed, never fake).
6. `## Try it live` — `<EndpointTry />` call with `endpoint=` and `auth=`.
7. `## curl` — one-liner with placeholders, runnable as-is on localhost.
8. `## Gotchas` — only when there's something real (session expiry, raw vs
   enveloped, binary downloads, sync shapes).

## Absolute rules

- **Never invent shapes.** If you don't know a field, you don't know it; say
  so or link the handler with `src/app/api/<route>/route.ts#L<line>`.
- VTOP bodies are always sent as `application/x-www-form-urlencoded`; the API
  routes accept JSON at the HTTP boundary regardless.
- Cookies/csrf/authorizedID are per-user, per-session, ~10-minute TTL. Any doc
  that implies otherwise is wrong.
- `{ success }` — if `false`, the request failed even on HTTP 200.
- Every page's last line must be a link forward (or the route file).

## Checklist before merging a docs PR

- [ ] All `03-api-reference/**` match `route-inventory.json` (run
  `node grounding/gen-reference-pages.mjs`; `--check` to verify).
- [ ] `docs/docs.json` is up to date (`node grounding/gen-child-docs.mjs`).
- [ ] New raw `<` in prose are escaped as code or `&lt;` — MDX parses JSX.
- [ ] Links to other handbook pages use root-relative `/amazecc-api/...` or a
  relative path with `.md`
- [ ] No secrets, cookies, tokens, reg numbers, or real VTOP HTML dumps.
