# Login & authentication

Recovered from: `eHa::orf/Hrf/zrf/Grf/Crf/Drf`, `tLa` (`cvf/Pxf/Euf`), `vLa::Kxf`, `uLa::Hv`, `sLa::Hxf/Ixf`, `pp.txt` routes/strings, Blutter asm `aAh.dart` & callers.

## 1. Login endpoint

- **URL:** `POST https://vtopcc5.vit.ac.in/login/vitian/appLoginProcess`
- **Client method:** `eHa::orf(loginData)` (async)
- **Auth headers:** not attached as session headers for this call (`Brf=false` path); request sent without pre-established `S-API-KEY`/`S-KEY-USER` session pair.
- **Retry/timeout flags:** `rrf=false` (reduced/disabled retry behavior vs standard calls).
- **Content-Type:** `application/json; charset=UTF-8` (via `zrf`).

### 1.1 Request body (on-wire shape)
- `loginData` (Dart map of credentials/fields) is serialized to JSON and **encrypted**:
  - `encData = sLa::Hxf(jsonEncode(loginData))`
- Sent as: `{ "encData": "<encrypted>" }`

**Observed/likely credential fields (from pp/asm):** `mobile` (seen in login arg construction), plus standard VTOP/VITian credentials (e.g. user id/application no/password/OTP/MPIN context depending on flow). Exact field names must be confirmed by decrypting a controlled capture or inspecting `Hxf` input assembly in the relevant caller.

### 1.2 Response
- Processed by `zrf` (decrypt/parse via `sLa::Ixf` where applicable); on success app establishes session/config used to derive `cvf()`, `Pxf/Euf` (→ `S-API-KEY`/`S-KEY-USER`), and `applNo`. On failure, user-facing auth/error states are shown.

## 2. Post-login session material

| Element | Source | Purpose |
|---|---|---|
| `cvf()` | `tLa::cvf()` (late-static `_dEb`) | Dynamic URL path/prefix segment: requests go to `base + cvf() + action` |
| `S-API-KEY` | `Crf()` → `tLa::Pxf()` | Per-session/request auth header value |
| `S-KEY-USER` | `Drf()` → `uLa::Hv("{ts_ms}|{tLa::Euf()}|vitian")` | Time-bound signed header (recomputed; ties request to user/time) |
| `applNo` | `vLa::Kxf("applNo")` | Injected into bodies of `qrf` calls (student/application identifier) |

All of the above are runtime/session-derived; valid calls require an authenticated context consistent with the app’s crypto and server expectations.

## 3. Local/device authentication factors

The app supports additional device-level auth around app access/session continuity (UI/flow strings in snapshot):

- **MPIN:** 6-digit PIN — routes/actions & strings: `/mPinScreenView`, `/mpin_set_page`, "Enter 6 Digit Login in PIN", "Forgot MPIN? (or) Login", actions `setMpin`, `validateMpin`.
- **Biometric:** fingerprint/biometrics — "Login Using FingerPrint", biometric auth prompts/lockout handling, action `biometricLog` (logged via `qrf` with params like `fromDate/toDate`).
- **OTP:** `/otp_new_screen`, `submitOtp` (wallet/payment flow), "Wallet Adjustment OTP".

These gate/augment access locally but server-side authorization still depends on valid VTOP session, headers, and (where used) encrypted payloads.

## 4. Session lifecycle & expiry handling

- **Detection:** API responses indicating invalid/expired session (e.g. "Invalid request. Please login again.") are handled in `zrf/_rvb/Erf`.
- **Behavior:** client may clear/refresh cached state and **navigate to sign-in** (`/sign_in_page`, main navigator `Qrc` in `package:vtop/main.dart`) instead of continuing with stale credentials.
- **Re-auth:** user re-authenticates (credentials/MPIN/biometric as applicable); app reinitializes `tLa`/session values, after which `cvf`, `S-API-KEY`, `S-KEY-USER`, and `applNo` become valid for subsequent `qrf/prf/nrf/...` calls.
- **Logout:** action `logOut` (routed through `qrf`/API) available; UI confirms "Do you want to logout?".

## 5. Best-use / integration guidance

- **Perform login first:** obtain session by calling `appLoginProcess` with correctly constructed & encrypted `encData`; persist returned session material needed to derive `cvf/Pxf/Euf/applNo`.
- **Regenerate headers per request context:** `S-KEY-USER` is time-bound (`timestamp|...|vitian`); generate fresh values aligned with the app’s algorithm/clock.
- **Carry `applNo`:** for `qrf`-style actions, include/inject `applNo` as the client does.
- **Handle re-login:** on session-invalid responses, stop, re-authenticate, refresh derived headers/prefix, then retry.
- **Security:** credentials and `encData`/headers are sensitive—handle only for your own account, over TLS, respecting certificate pinning and institutional policy.
