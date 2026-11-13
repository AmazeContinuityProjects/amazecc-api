---
title: "VTOP login, from scratch"
description: "How /api/login works: captcha, offline solver, cookies, csrf, authorizedID, and what to do when it breaks."
---

# VTOP login, from scratch

> **In one line:** `POST /api/login` solves the captcha for you, posts to VTOP, reads the dashboard, and returns the three secrets you need for every other VTOP call.

**Endpoint:** `POST /api/login`  
**Auth:** none  
**Rate limit:** 5 per minute per IP

## What it does, step by step

1. **Rate-limit you.** Five logins per minute per IP. That's deliberately tight — VTOP serves
   captchas specifically to deter exactly what this endpoint does.
2. **Fetch a captcha.** `getCaptcha()` hits `https://vtopcc.vit.ac.in/vtop/prelogin/setup`,
   extracts the CSRF token and the captcha image from the login page.
3. **Solve it.** `solveCaptcha()` is an offline solver: a single-layer perceptron trained on
   6-character VTOP captchas, encoded in `src/app/api/login/bitmaps.ts` (411 KB of weights). No
   external service is called — the CAPTCHA never leaves the server.
4. **POST the login** to `/vtop/login` with your credentials and the answer.
5. **Follow the 302** to the dashboard. If VTOP says "invalid captcha / invalid credentials /
   password expired", you surface the error and stop.
6. **Parse the dashboard.** Extract `authorizedidx` (your authorizedID), `_csrf`, and your
   cookies. Also — if your authorizedID represents one or more clubs — issue a club token so the
   frontend can register on behalf of yourself and the club in one login.
7. **Respond** with everything the next call needs.

## Example

```bash
curl -X POST "https://api.amazecc.com/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"21BCE0000","password":"your-password"}'
```

Success response:

```json
{
  "success": true,
  "message": "Login successful",
  "cookies": "JSESSIONID=ABC123...; _csrf=XYZ...; Authorization=...",
  "csrf": "XYZ...",
  "authorizedID": "21BCE0000",
  "clubToken": null
}
```

**Keep those three values.** Every VTOP call afterwards carries exactly them:

```bash
curl -X POST "https://api.amazecc.com/api/attendance" \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": "JSESSIONID=ABC123...; _csrf=XYZ...; Authorization=...",
    "csrf": "XYZ...",
    "authorizedID": "21BCE0000",
    "semesterId": "CH20262705"
  }'
```

## What can go wrong

| Symptom | Cause | Fix |
|---|---|---|
| `reCAPTCHA` / `gResponse` | VTOP serves reCAPTCHA to datacenter IPs (your server, not your laptop) | VTOP does this to cloud IPs specifically; use a residential IP or accept that the deployed API may get reCAPTCHAd. The solver only handles the image captchas. |
| `{"success": false, "message": "Invalid Credentials"}` | Password wrong | You mistyped, or your password recently changed |
| `{"success": false, "message": "Invalid Captcha"}` | The offline solver guessed wrong | Retry — the solver's hit rate is high but not perfect; 5 attempts per minute are allowed |
| `Password expired` | VTOP forced a password change | Log into VTOP in a browser and change it |
| 429 Too Many Requests | You called the endpoint too much from one IP | Wait a minute |
| 504 Deadline | VTOP was unreachable or the captcha never resolved | Check the VTOP instance; retry; see `ROUTE_TRACKER.md` if VTOP changed its markup |

## Where to next

- **[Sessions & cookies](./sessions-and-cookies.md)** — what the cookies actually are.
- **[Internals: the login endpoint, line by line](../02-internals/login-endpoint.md)** — the code path.
- **[Quickstart](../00-start-here/quickstart.md)** — first call after login.
