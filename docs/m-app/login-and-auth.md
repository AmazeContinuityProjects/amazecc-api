# Login and authentication

This explains how a user signs in to VITianCC, how the app establishes a session, how it keeps requests authenticated, and what happens when a session expires.

## 1. How sign-in works

### The login request
- **Endpoint:** `POST https://vtopcc5.vit.ac.in/login/vitian/appLoginProcess`
- **Sent as:** JSON with an encrypted body (no pre-existing session auth headers)  
  - The app collects the login details, converts them to JSON, **encrypts** them, and sends:  
    `{ "encData": "<encrypted_payload>" }`
- **Observed details:** the login payload includes a `mobile` field; other credential fields (such as username/application number/password/OTP, depending on the flow) are assembled at runtime. The exact field list should be confirmed from a controlled, authorized capture because the payload is encrypted.

### What a successful login gives the app
On success, the server/app provides the information needed to make further calls for that session, including:
- a **session-specific URL path segment** used to build most API URLs,
- values used to generate the **authentication headers** (`S-API-KEY` and the time-bound `S-KEY-USER`),
- the student **application number**, which the app attaches to many requests.

On failure, the app shows an authentication/error message and stays on (or returns to) the sign-in flow.

## 2. How the app stays authenticated (after login)

For most actions after login, the app sends two headers with every request:

- **`S-API-KEY`** – a session API key/token obtained from the logged-in session.
- **`S-KEY-USER`** – a fresh, time-based value computed for the request (derived from the current time, a session/user component, and `vitian`, then encoded/encrypted). Because it’s time-bound, it must be generated per request, not reused.

The app also **automatically includes the student application number** in the body of standard (non-login) action requests.

> In plain terms: logging in once isn’t enough by itself—the app proves the session on every call using these headers plus the session-specific URL path.

## 3. Extra sign-in and verification options (on the device)

Besides the main account login, the app supports convenience/step-up checks:

| Option | What it does | Notes (from app behavior) |
|---|---|---|
| **MPIN (6-digit PIN)** | Quick unlock/sign-in within the app | Screens/flows for setting and entering MPIN; actions to set and validate the MPIN (`setMpin`, `validateMpin`). “Forgot MPIN” falls back to login. |
| **Biometric (fingerprint/face)** | Unlock using device biometrics | “Login Using FingerPrint” and biometric prompts/lockout messages; biometric events can be logged (`biometricLog`). |
| **OTP** | One-time code for sensitive steps | Used in flows like wallet/payment (e.g. submitting/validating an OTP). |

These help control access on the device, but **server access still depends on a valid VTOP session and correct authenticated requests**.

## 4. Session expiry and logging out

### When the session expires or becomes invalid
- The server may respond in a way the app treats as “session no longer valid” (e.g. an “Invalid request. Please login again.” case).
- When this happens, the app **stops the current flow and sends you to the sign-in screen** (it does not keep retrying with stale credentials). Locally cached data may remain, but protected actions require a fresh login.

### Logging out
- The app provides a logout action that tells the server to end the session and then returns the user to sign-in. On logout you should expect local session state to be cleared/reset.

## 5. Practical tips

- **Log in before doing anything else:** all data-fetching actions assume an active session (session path segment, headers, application number).
- **Refresh after re-login:** every time you authenticate again, recompute/use the new session values—don’t carry over old headers or path segments.
- **Expect encryption:** the login (and some other) requests are encrypted into `encData`; sending plain credentials/params where encryption is required won’t work.
- **Handle expiry gracefully:** if a call is rejected as an invalid session, re-authenticate and retry the action.
- **Keep credentials safe:** only use your own account, over a trusted connection, and in accordance with VIT/VTOP policies.

## Technical reference (recovered identifiers)
Login: `eHa::orf` → `appLoginProcess`, body `{encData: sLa::Hxf(...)}`; session/config: `tLa` (`cvf`, `Pxf`, `Euf`), headers `Grf/Crf/Drf` (`S-API-KEY`, `S-KEY-USER` via `uLa::Hv`), `applNo` via `vLa::Kxf`; session-expiry handling in `zrf/_rvb/Erf` with navigation to `/sign_in_page`; MPIN/biometric/OTP actions & routes as noted.
